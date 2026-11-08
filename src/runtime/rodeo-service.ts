declare const __APP_VERSION__: string;
const clientVersion = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "development";
import { siteRoomApi, validateSiteLink, type SiteLink } from "./site-service";
import OBR from "@owlbear-rodeo/sdk";
import type { Player } from "@owlbear-rodeo/sdk";
import type { RoomSession, RoomPoll, RoomSignal } from "@/lib/roomProtocol";
export const ROOM_KEY = "fr.clap.owlbear/v2/room",
  PLAYER_KEY = "fr.clap.owlbear/v2/player";
export const HOST_KEY = "fr.clap.owlbear/v2/host";
export const TRANSFER_KEY='fr.clap.owlbear/v2/sheet-transfer';
const SIGNAL = "fr.clap.owlbear/v2/signal";
type Descriptor = {
  site?: SiteLink;
  owlbearRoomId?: string;
  revision?: number;
  hostId: string;
  epoch: string;
  title: string;
  closed: boolean;
  blocked: string[];
};
type Presence = { active: boolean; instance: string };
export interface RodeoPort {
  roomId: string;
  self: () => Promise<Player>;
  others: () => Promise<Player[]>;
  roomMetadata: () => Promise<Record<string, unknown>>;
  setRoomMetadata: (value: Record<string, unknown>) => Promise<void>;
  setPlayerMetadata: (value: Record<string, unknown>) => Promise<void>;
  send: (channel: string, data: unknown) => Promise<void>;
  onPlayersChange?: (callback:(players:Player[])=>void)=>()=>void;
  onSignal: (
    callback: (event: { connectionId: string; data: unknown }) => void,
  ) => () => void;
}
export async function sdkPort(): Promise<RodeoPort> {
  return {
    roomId: OBR.room.id,
    self: async () => ({
      id: await OBR.player.getId(),
      name: await OBR.player.getName(),
      role: await OBR.player.getRole(),
      connectionId: await OBR.player.getConnectionId(),
      metadata: await OBR.player.getMetadata(),
      color: await OBR.player.getColor(),
      syncView: await OBR.player.getSyncView(),
    }),
    others: () => OBR.party.getPlayers(),
    roomMetadata: () => OBR.room.getMetadata(),
    setRoomMetadata: (v) => OBR.room.setMetadata(v),
    setPlayerMetadata: (v) => OBR.player.setMetadata(v),
    send: (c, d) => OBR.broadcast.sendMessage(c, d, { destination: "REMOTE" }),
    onPlayersChange: cb => OBR.party.onChange(cb),
    onSignal: (cb) => OBR.broadcast.onMessage(SIGNAL, cb),
  };
}
export class OwlbearRoomService {
  paused = false;
  linked = false;
  notice = "";
  loadingPlayers:string[]=[];
  private stopPlayers?:()=>void;
  diagnostics={sent:0,received:0,accepted:0,lastReject:'',lastError:'',participants:[] as {role:string;version:string;partyConnection:boolean;sdkConnection:boolean}[]};
  readonly code: string;
  private sequence = 0;
  private signals: RoomSignal[] = [];
  private chunks = new Map<
    string,
    {
      sender: string;
      target: string;
      instance: string;
      parts: string[];
      count: number;
      next: number;
      updated: number;
    }
  >();
  private outgoing = new Map<string,{connection:string;packets:any[];timer?:ReturnType<typeof setTimeout>;attempts:number}>();
  private acknowledged = new Set<string>();
  private dispose?: () => void;
  private localInstance = "";
  private receiving = Promise.resolve();
  constructor(
    readonly port: RodeoPort,
    code: string,
  ) {
    this.code = code;
  }
  async start() {
    this.stopPlayers=this.port.onPlayersChange?.(players=>{void this.descriptor().then(d=>{this.readSheetTransfers(players,d);}).catch(()=>{});});
    this.dispose = this.port.onSignal((event) => {
      this.receiving = this.receiving
        .then(() => this.receive(event))
        .catch(error => { this.diagnostics.lastError=error instanceof Error?error.message:String(error); });
    });
    const own=await this.port.self();
    await this.port.setPlayerMetadata({
      [PLAYER_KEY]: { sdkConnectionId: own.connectionId, active: false, instance: "", transport: "native-v1", version: clientVersion },
    });
  }
  stop() {
    this.stopPlayers?.();
    this.dispose?.();
    for(const job of this.outgoing.values())clearTimeout(job.timer);this.outgoing.clear();
  }
  async descriptor(): Promise<Descriptor | undefined> {
    const players = await this.players();
    const masters = players.filter((player) => player.role === "GM");
    // Room metadata is discovery only. The GM's own player metadata is the authority,
    // so a player cannot redirect the table by editing shared room metadata.
    return masters
      .map((player) => player.metadata[HOST_KEY] as Descriptor | undefined)
      .filter((d): d is Descriptor =>
        Boolean(
          d &&
          d.owlbearRoomId === this.port.roomId &&
          typeof d.hostId === "string" &&
          typeof d.epoch === "string" &&
          typeof d.title === "string" &&
          Array.isArray(d.blocked) &&
          masters.some((player) => player.id === d.hostId),
        ),
      )
      .sort((a, b) => (b.revision || 0) - (a.revision || 0))[0];
  }
  private readSheetTransfers(players:Player[],d?:Descriptor){
    const info=d?players.find(p=>p.id===d.hostId&&p.role==='GM')?.metadata[TRANSFER_KEY] as any:undefined;
    const next=d&&!d.closed&&info?.epoch===d.epoch&&Array.isArray(info.players)?info.players.filter((id:unknown):id is string=>typeof id==='string'&&!d.blocked.includes(id)).slice(0,16):[];
    if(JSON.stringify(next)!==JSON.stringify(this.loadingPlayers)){this.loadingPlayers=next;if(typeof window!=='undefined')window.dispatchEvent(new Event('clap-integration-state'));}
  }
  async publishSheetTransfers(ids:string[]){const self=await this.port.self();const d=await this.descriptor();if(!d||d.hostId!==self.id||self.role!=='GM')return;await this.port.setPlayerMetadata({[TRANSFER_KEY]:{epoch:d.epoch,players:ids.slice(0,16)}});}
  private async players() {
    return [await this.port.self(), ...(await this.port.others())];
  }
  private async save(d: Descriptor) {
    const previous = await this.descriptor();
    d.owlbearRoomId = this.port.roomId;
    d.revision = Math.max(Date.now(), (previous?.revision || 0) + 1);
    await this.port.setPlayerMetadata({ [HOST_KEY]: d });
    await this.port.setRoomMetadata({ [ROOM_KEY]: d });
  }
  private async currentHost() {
    const d = await this.descriptor();
    if (d) return d.hostId;
    return (await this.players())
      .filter((p) => p.role === "GM" && p.metadata[PLAYER_KEY])
      .sort((a, b) => a.id.localeCompare(b.id))[0]?.id;
  }
  async isHost() {
    return (await this.port.self()).id === (await this.currentHost());
  }
  private error(message: string, status = 401): never {
    throw Object.assign(new Error(message), { status });
  }
  private async authenticate(session: RoomSession | null) {
    const self = await this.port.self();
    const d = await this.descriptor();
    if (!d) {
      if (self.role === 'GM' && session?.role === 'mj' && session.id === self.id) this.error('La salle doit etre reprise par le MJ.', 401);
      this.error('Connexion au MJ en cours. Nouvelle tentative automatique.', 409);
    }
    if (
      d.closed ||
      !session ||
      session.room !== this.code ||
      session.id !== self.id ||
      !session.token.startsWith(d.epoch + ":")
    )
      this.error("La salle a été fermée ou a expiré.");
    if (d.blocked.includes(self.id)) {
      this.paused = true;
      this.error("Tu as été expulsé de la salle par le MJ.");
    }
    if (
      self.id === d.hostId &&
      (self.metadata[HOST_KEY] as Descriptor | undefined)?.revision !==
        d.revision
    )
      await this.port.setPlayerMetadata({ [HOST_KEY]: d });
    return { self, d, host: self.id === d.hostId };
  }
  api = async (
    path: string,
    body: any,
    session: RoomSession | null,
  ): Promise<any> => {
    if (path.startsWith("/integration/")) {
      const self = await this.port.self();
      if (self.role !== "GM" || self.id !== (await this.currentHost()))
        this.error("Liaison réservée au MJ Owlbear.", 403);
      if (path === "/integration/validate") return validateSiteLink(body.link);
      if (path === "/integration/link") {
        const site = await validateSiteLink(body.link);
        this.paused = false;
        await this.save({
          hostId: self.id,
          epoch: crypto.randomUUID(),
          title: "Salle liée au site CLAP!",
          closed: false,
          blocked: [],
          site,
        });
        return site;
      }
      if (path === "/integration/unlink") {
        this.paused = false;
        await this.save({
          hostId: self.id,
          epoch: crypto.randomUUID(),
          title: "Salle CLAP!",
          closed: true,
          blocked: [],
        });
        return { ok: true };
      }
    }
    const linked = (await this.descriptor())?.site;
    this.linked = Boolean(linked);
    if (linked) {
      if (path === "/leave") this.paused = true;
      return siteRoomApi(this.port, linked, path, body, session);
    }
    if (path === "/list") return { rooms: [] }; // Owlbear rooms are never registered with the website directory.
    const self = await this.port.self();
    if (path === "" || path === "/join") {
      let d = await this.descriptor();
      const host = await this.currentHost();
      if (path === "") {
        if (self.role !== "GM" || self.id !== host)
          this.error("Création réservée au MJ de la salle Owlbear.", 403);
        d = {
          hostId: self.id,
          epoch: crypto.randomUUID(),
          title: String(body.title || "Salle CLAP!").slice(0, 80),
          closed: false,
          blocked: [],
        };
        await this.save(d);
      }
      if (!d || d.closed)
        this.error("Le MJ doit ouvrir sa salle pour la rejoindre.", 404);
      if (d.blocked.includes(self.id)) {
        this.paused = true;
        this.error("Tu as été expulsé de la salle par le MJ.");
      }
      const active = (await this.players()).filter(
        (p) => (p.metadata[PLAYER_KEY] as Presence | undefined)?.active,
      );
      if (active.length >= 16 && !active.some((p) => p.id === self.id))
        this.error("La partie CLAP! est complète (16 participants).", 409);
      this.paused = false;
      await this.port.setPlayerMetadata({
        [PLAYER_KEY]: { sdkConnectionId: self.connectionId, active: true, instance: this.localInstance, transport: "native-v1", version: clientVersion },
      });
      return {
        room: this.code,
        id: self.id,
        name: self.name.slice(0, 40),
        role: self.id === d.hostId ? "mj" : "player",
        token: d.epoch + ":" + crypto.randomUUID(),
        localHosting: true,
      };
    }
    const { d, host } = await this.authenticate(session);
    if (path === "/poll") {
      if (
        typeof body.instance !== "string" ||
        !Number.isSafeInteger(body.since)
      )
        this.error("Présence invalide.", 400);
      if (this.localInstance !== body.instance) {
        this.localInstance = body.instance;
        await this.port.setPlayerMetadata({
          [PLAYER_KEY]: { sdkConnectionId: self.connectionId, active: true, instance: body.instance, transport: "native-v1", version: clientVersion },
        });
      }
      // Freeze the signal cursor before awaiting presence: an offer accepted during
      // this read belongs to the next poll, whose member instances can match it.
      const signalCursor = this.sequence;
      const party = await this.players();
      this.readSheetTransfers(party,d);
      this.diagnostics.participants=party.filter(player=>(player.metadata[PLAYER_KEY] as any)?.active).map(player=>({role:player.role,version:String((player.metadata[PLAYER_KEY] as any)?.version||'inconnue'),partyConnection:typeof player.connectionId==='string',sdkConnection:typeof (player.metadata[PLAYER_KEY] as any)?.sdkConnectionId==='string'}));
      const outdated = party.find(player => player.id !== self.id && (player.metadata[PLAYER_KEY] as any)?.active && (player.metadata[PLAYER_KEY] as any)?.transport !== 'native-v1');
      const notice = outdated ? 'Le participant « '+outdated.name.slice(0,40)+' » utilise une ancienne version de CLAP!. Rechargez l’extension chez tous les participants.' : '';
      if (notice !== this.notice) { this.notice=notice;if(typeof window!=='undefined')window.dispatchEvent(new Event('clap-integration-state')); }
      const members = party
        .filter(
          (p) =>
            p.id === self.id ||
            ((p.metadata[PLAYER_KEY] as Presence | undefined)?.active &&
              !d.blocked.includes(p.id)),
        )
        .map((p) => ({
          id: p.id,
          name: p.name.slice(0, 40),
          role: p.id === d.hostId ? ("mj" as const) : ("player" as const),
          owlbearRole: p.role,
          instance:
            p.id === self.id
              ? body.instance
              : (p.metadata[PLAYER_KEY] as Presence).instance,
          online: true,
        }));
      return {
        room: { title: d.title, locked: false },
        self: { role: host ? "mj" : "player", hideRolls: false },
        roomRevision: Date.now(),
        members,
        signals: this.signals.filter((s) => s.seq > body.since && s.seq <= signalCursor),
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        relayConfigured: false,
      } satisfies RoomPoll;
    }
    if (path === "/signal") {
      const target = (await this.players()).find((p) => p.id === body.target);
      if (
        !target ||
        (target.metadata[PLAYER_KEY] as Presence | undefined)?.instance !==
          body.instance ||
        (!host && target.id !== d.hostId)
      )
        this.error("Participant indisponible.", 409);
      const json = JSON.stringify({
        connection: body.connection,
        description: body.description,
        senderInstance: this.localInstance,
      });
      const id = crypto.randomUUID(),
        count = Math.ceil(json.length / 1800);
      const packets:any[]=[];
      for (let index = 0; index < count; index++)
        packets.push({
          id,
          target: body.target,
          instance: body.instance,
          count,
          index,
          text: json.slice(index * 1800, (index + 1) * 1800),
        });
      const job={connection:(target.metadata[PLAYER_KEY] as any)?.sdkConnectionId || target.connectionId,packets,attempts:0} as {connection:string;packets:any[];attempts:number;timer?:ReturnType<typeof setTimeout>};
      this.outgoing.set(id,job);
      const transmit=async()=>{
        if(!this.outgoing.has(id))return;
        if(++job.attempts>6){this.outgoing.delete(id);this.diagnostics.lastError='La négociation de connexion ne reçoit aucune confirmation.';return;}
        try {this.diagnostics.sent+=packets.length;for(const packet of packets)await this.port.send(SIGNAL,packet);}
        catch(error){this.diagnostics.lastError=error instanceof Error?error.message:String(error);}
        if(this.outgoing.has(id))job.timer=setTimeout(()=>{void transmit();},2500);
      };
      await transmit();
      return { ok: true };
    }
    if (path === "/leave") {
      this.paused = true;
      if (host) await this.save({ ...d, closed: true });
      await this.port.setPlayerMetadata({
        [PLAYER_KEY]: { sdkConnectionId: self.connectionId, active: false, instance: this.localInstance, transport: "native-v1", version: clientVersion },
      });
      return { ok: true };
    }
    if (!host) this.error("Action réservée au MJ.", 403);
    if (path === "/title") {
      if (
        typeof body.title !== "string" ||
        !body.title.trim() ||
        body.title.trim().length > 80 ||
        /[\u0000-\u001f]/.test(body.title)
      )
        this.error("Nom de salle invalide.", 400);
      await this.save({ ...d, title: body.title.trim() });
      return { ok: true };
    }
    if (path === "/kick") {
      if (
        body.target === self.id ||
        !(await this.players()).some((p) => p.id === body.target)
      )
        this.error("Participant invalide.", 400);
      await this.save({
        ...d,
        blocked: [...new Set([...d.blocked, body.target])],
      });
      return { ok: true };
    }
    if (path === "/transfer") {
      const target = (await this.players()).find(
        (p) => p.id === body.target && p.role === "GM",
      );
      if (!target)
        this.error(
          "Donne d’abord le rôle MJ Owlbear au successeur pour transmettre la partie.",
          400,
        );
      await this.save({ ...d, hostId: target.id });
      return { ok: true };
    }
    if (path === "/password")
      this.error(
        "L’accès à cette partie est géré par les permissions de la salle Owlbear.",
        400,
      );
    this.error("Action de salle inconnue.", 404);
  };
  private async receive(event: { connectionId: string; data: unknown }) {
    this.diagnostics.received++;
    const packet = event.data as any;
    if (!packet || typeof packet !== "object") return;
    const self = await this.port.self();
    if (packet.target !== self.id || packet.instance !== this.localInstance) { this.diagnostics.lastReject=packet.target!==self.id?'autre destinataire':'instance locale différente';return; }
    if(typeof packet.ack==='string') {
      const job=this.outgoing.get(packet.ack);
      if(job && job.connection===event.connectionId){clearTimeout(job.timer);this.outgoing.delete(packet.ack);}
      return;
    }
    if (
      typeof packet.id !== "string" ||
      packet.id.length > 100 ||
      !Number.isSafeInteger(packet.count) ||
      packet.count < 1 ||
      packet.count > 128 ||
      !Number.isSafeInteger(packet.index) ||
      typeof packet.text !== "string" ||
      packet.text.length > 1800
    )
      return;
    const candidates = (await this.port.others()).filter(p => p.connectionId === event.connectionId || (p.metadata[PLAYER_KEY] as any)?.sdkConnectionId === event.connectionId);
    const sender = candidates.length === 1 ? candidates[0] : undefined;
    const d = await this.descriptor();
    if (d?.site) return;
    if (
      !sender ||
      !d ||
      d.closed ||
      d.blocked.includes(sender.id) ||
      (self.id !== d.hostId && sender.id !== d.hostId)
    )
      {this.diagnostics.lastReject=!sender?'connexion émetteur inconnue':!d?'MJ introuvable':'émetteur ou salle non autorisé';return;}
    if(this.acknowledged.has(event.connectionId+':'+packet.id)){
      await this.port.send(SIGNAL,{ack:packet.id,target:sender.id,instance:(sender.metadata[PLAYER_KEY] as Presence)?.instance});return;
    }
    for (const [id, chunk] of this.chunks)
      if (Date.now() - chunk.updated > 30000) this.chunks.delete(id);
    const key = event.connectionId + ":" + packet.id;
    if (packet.index === 0) {
      if (this.chunks.size >= 32) return;
      this.chunks.set(key, {
        sender: sender.id,
        target: self.id,
        instance: packet.instance,
        parts: [],
        count: packet.count,
        next: 0,
        updated: Date.now(),
      });
    }
    const chunk = this.chunks.get(key);
    if (!chunk || chunk.count !== packet.count || chunk.next !== packet.index)
      return;
    chunk.parts.push(packet.text);
    chunk.next++;
    chunk.updated = Date.now();
    if (chunk.next !== chunk.count) return;
    this.chunks.delete(key);
    const data = JSON.parse(chunk.parts.join(""));
    if (
      !data ||
      typeof data.connection !== "string" ||
      data.connection.length > 100 ||
      typeof data.senderInstance !== "string" ||
      !["offer", "answer"].includes(data.description?.type) ||
      typeof data.description.sdp !== "string" ||
      data.description.sdp.length > 100000
    )
      return;
    if(data.senderInstance !== (sender.metadata[PLAYER_KEY] as Presence | undefined)?.instance){this.diagnostics.lastReject='présence distante non actualisée';return;}
    if (
      (self.id === d.hostId && data.description.type !== "offer") ||
      (self.id !== d.hostId && data.description.type !== "answer")
    )
      return;
    this.acknowledged.add(event.connectionId+':'+packet.id);if(this.acknowledged.size>100)this.acknowledged.delete(this.acknowledged.values().next().value!);
    await this.port.send(SIGNAL,{ack:packet.id,target:sender.id,instance:data.senderInstance});
    this.diagnostics.accepted++;
    this.diagnostics.lastReject="";
    this.signals = [
      ...this.signals,
      {
        seq: ++this.sequence,
        sender: sender.id,
        senderInstance: data.senderInstance,
        connection: data.connection,
        description: data.description,
      },
    ].slice(-100);
  }
}
export async function roomCode(id: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(id),
  );
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  )
    .join("")
    .slice(0, 12)
    .toUpperCase();
}
