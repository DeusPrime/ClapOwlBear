import OBR from "@owlbear-rodeo/sdk";
import type { Player } from "@owlbear-rodeo/sdk";
import type { RoomSession, RoomPoll, RoomSignal } from "@/lib/roomProtocol";
export const ROOM_KEY = "fr.clap.owlbear/v2/room",
  PLAYER_KEY = "fr.clap.owlbear/v2/player";
const SIGNAL = "fr.clap.owlbear/v2/signal";
type Descriptor = {
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
    send: (c, d) => OBR.broadcast.sendMessage(c, d),
    onSignal: (cb) => OBR.broadcast.onMessage(SIGNAL, cb),
  };
}
export class OwlbearRoomService {
  paused = false;
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
    this.dispose = this.port.onSignal((event) => {
      this.receiving = this.receiving
        .then(() => this.receive(event))
        .catch(() => {});
    });
    await this.port.setPlayerMetadata({
      [PLAYER_KEY]: { active: false, instance: "" },
    });
  }
  stop() {
    this.dispose?.();
  }
  async descriptor(): Promise<Descriptor | undefined> {
    const metadata = await this.port.roomMetadata();
    const d = metadata[ROOM_KEY] as Descriptor | undefined;
    if (
      !d ||
      typeof d.hostId !== "string" ||
      typeof d.epoch !== "string" ||
      typeof d.title !== "string" ||
      !Array.isArray(d.blocked)
    )
      return;
    const players = await this.players();
    // A player cannot acquire MJ privileges by writing an arbitrary host ID into metadata.
    if (
      !players.some((player) => player.id === d.hostId && player.role === "GM")
    )
      return;
    return d;
  }
  private async players() {
    return [await this.port.self(), ...(await this.port.others())];
  }
  private async save(d: Descriptor) {
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
    if (
      !d ||
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
    return { self, d, host: self.id === d.hostId };
  }
  api = async (
    path: string,
    body: any,
    session: RoomSession | null,
  ): Promise<any> => {
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
        [PLAYER_KEY]: { active: true, instance: this.localInstance },
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
          [PLAYER_KEY]: { active: true, instance: body.instance },
        });
      }
      const members = (await this.players())
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
        signals: this.signals.filter((s) => s.seq > body.since),
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
      for (let index = 0; index < count; index++)
        await this.port.send(SIGNAL, {
          id,
          target: body.target,
          instance: body.instance,
          count,
          index,
          text: json.slice(index * 1800, (index + 1) * 1800),
        });
      return { ok: true };
    }
    if (path === "/leave") {
      this.paused = true;
      if (host) await this.save({ ...d, closed: true });
      await this.port.setPlayerMetadata({
        [PLAYER_KEY]: { active: false, instance: this.localInstance },
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
    const packet = event.data as any;
    if (!packet || typeof packet !== "object") return;
    const self = await this.port.self();
    if (packet.target !== self.id || packet.instance !== this.localInstance)
      return;
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
    const sender = (await this.port.others()).find(
      (p) => p.connectionId === event.connectionId,
    );
    const d = await this.descriptor();
    if (
      !sender ||
      !d ||
      d.closed ||
      d.blocked.includes(sender.id) ||
      (self.id !== d.hostId && sender.id !== d.hostId)
    )
      return;
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
      data.senderInstance !==
        (sender.metadata[PLAYER_KEY] as Presence | undefined)?.instance ||
      !["offer", "answer"].includes(data.description?.type) ||
      typeof data.description.sdp !== "string" ||
      data.description.sdp.length > 100000
    )
      return;
    if (
      (self.id === d.hostId && data.description.type !== "offer") ||
      (self.id !== d.hostId && data.description.type !== "answer")
    )
      return;
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
