import {callRoomApi,sharedRoomClient} from '@owlbear/runtime/client';
import { localizeText } from '@/i18n/localize';
import { selectDirectory, loadDirectories } from "./directories";
import { ensureRoomProject } from './roomProject';
import { roomInventoryChanges, roomHeroEditFields, roomHeroEditSignature } from './roomInventoryChanges';
import { owlbearRoomUrlSchema } from './roomProtocol';
import { playerIdentityToken } from './playerIdentity';
import { rememberRoomNickname } from "./roomNickname";
import { toast } from "sonner";
import { getCharacter, upsertCharacter, deleteCharacter, type Character } from "./characters";
import { roomCharacterSchema, type PublicRoll, type RoomChatMessage, type RoomRollRequest, type RoomListing, type RoomMember, type RoomMessage, type RoomPoll, type RoomSession, type RoomSignal } from "./roomProtocol";
import { rememberOwnedRoom, ownedRoom, ownedLocalRoom, forgetOwnedRoom, rememberRoomSettings, roomSettings } from './roomResume';
import { RoomTransport } from "./roomTransport";
import type { BundledResource } from "./resourceBundle";
import { transferableRoomResource, importRoomResource } from "./roomResources";
import { applyGameCommand, emptyGame, gameView, rollRequestSchema, type LocalGame, type GameCommand } from './localRoomGame';
import { saveLocalRoom, loadLocalRoom, captureRoomLibrary, exportRoomArchive, type RoomArchive, type PrivateRoomRef } from './roomArchive';

const API = (import.meta.env.VITE_ROOM_API_URL || "/api/rooms").replace(/\/$/, "");
const STORAGE = "clap-room-session-v1";
type Peer = { pc: RTCPeerConnection; transport?: RoomTransport; connection: string; instance: string; started: number; sheet: string; assignment?: string; resources?: Map<string, string> };
type Snapshot = {
  projectName?: string;
  owlbearUrl?: string;
  projectId?: string;
  projects?: { id: string; name: string }[];
  roomResources?: BundledResource[];
  availableHeroes?: { id: string; name: string; ownerId?: string }[];
  roomHeroes: Character[];
  heroProposals: (Extract<RoomMessage, { kind?: 'hero-proposal' }> & { playerId: string })[];
  pendingHeroProposal?: string;
  exitNotice?: string;
  savedSheets?: RoomArchive['sheets'];
  savedSheetResources?: RoomArchive['sheetResources'];
  privateRefs: PrivateRoomRef[];
  roomInfo: { title: string; locked: boolean } | null; sheetResources: Record<string, BundledResource[]>;
  requests: RoomRollRequest[]; hideRolls: boolean; messages: RoomChatMessage[]; session: RoomSession | null; members: RoomMember[]; connected: string[];
  sheets: Record<string, Character>; error: string; syncing: boolean; relayConfigured: boolean;
};

export class RoomClient {
  private state: Snapshot = { roomHeroes: [], heroProposals: [], privateRefs: [], roomInfo: null, sheetResources: {}, requests: [], hideRolls: false, messages: [], session: null, members: [], connected: [], sheets: {}, error: "", syncing: false, relayConfigured: false };
  private game: LocalGame = emptyGame();
  private publicHeroes = new Map<string, { heroName: string; heroConcept: string }>();
  private archive?: RoomArchive;
  private persistence = Promise.resolve();
  private pendingCommands = new Map<string, { peerId: string; resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private handoff?: RoomArchive;
  private commandLimits = new Map<string, { count: number; reset: number }>();
  private resourceQueue = Promise.resolve();
  private resourceOperations = new Map<string, { playerId: string; resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private listeners = new Set<() => void>();
  private lastRevision = -1;
  private resolvedRequests = new Set<string>();
  private assignments = new Map<string, Extract<RoomMessage, { kind?: "assign-sheet" }>>();
  private approvedSheetIds = new Map<string, string>();
  private addingHeroes = new Map<string, Promise<Character>>();
  private proposal?: Extract<RoomMessage, { kind?: 'hero-proposal' }>;
  private receivingAssignments = new Set<string>();
  private peers = new Map<string, Peer>();
  private seenRolls = new Set<string>();
  private instance = "";
  private since = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private iceServers: RTCIceServer[] = [];
  private stopped = true;
  private busy = false;
  private generation = 0;
  private releaseLock?: () => void;
  private lockAbort?: AbortController;
  private characterSaved = (event: Event) => {
    const hero = (event as CustomEvent<Character>).detail;
    if (this.state.session?.role !== 'mj' || !this.archive?.heroes.some(value => value.id === hero.id)) return;
    const parsed = roomCharacterSchema.safeParse({ ...hero, portrait: hero.portrait || undefined });
    if (!parsed.success) return;
    this.archive = { ...this.archive, heroes: this.archive.heroes.map(value => value.id === hero.id ? parsed.data : value) };
    this.update({}); this.persist();
  };
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  private update(patch: Partial<Snapshot>) {
    const refs = patch.privateRefs || this.state.privateRefs;
    const active = new Set(refs.filter(ref => ref.type === 'hero').map(ref => ref.id));
    const heroes = this.archive?.heroes || [];
    if (this.archive) patch = { owlbearUrl: this.archive.owlbearUrl, ...patch };
    patch = { roomResources: this.archive?.resources as BundledResource[] || [], ...patch };
    this.state = { ...this.state, projectId: this.archive?.projectId, projects: Object.entries(this.archive?.projectLinks || {}).map(([id, project]) => ({ id, name: project.name })), roomHeroes: (this.archive?.projectId ? heroes.filter(hero => active.has(hero.id)) : heroes) as Character[], ...patch };
    this.listeners.forEach(l => l());
  }
  private persist() {
    const session = this.state.session;
    if (session?.role !== 'mj' || !this.archive) return;
    const record: RoomArchive = { ...this.archive, title: this.state.roomInfo?.title || this.archive.title, hostId: session.id, hostName: session.name,
      players: Object.fromEntries(Object.entries({ ...this.archive.players, ...Object.fromEntries(this.state.members.filter(member => member.role === 'player').map(member => [member.id, { name: member.name }])) }).slice(-200)),
      game: this.game, privateRefs: this.state.privateRefs, updatedAt: Date.now(),
      sheets: Object.fromEntries(Object.entries({ ...this.archive.sheets, ...this.state.sheets }).slice(-16)) as RoomArchive['sheets'],
      sheetResources: Object.fromEntries(Object.entries({ ...this.archive.sheetResources, ...this.state.sheetResources }).slice(-16)) as RoomArchive['sheetResources'] };
    this.archive = record;
    this.update({ projectName: record.projectName, savedSheets: record.sheets, savedSheetResources: record.sheetResources });
    this.persistence = this.persistence.catch(() => {}).then(() => saveLocalRoom(record));
    void this.persistence.catch(() => this.update({ error: 'La sauvegarde locale a échoué. Exporte ta salle avant de fermer.' }));
  }
  setPrivateRefs(privateRefs: PrivateRoomRef[]) {
    if (this.state.session?.role !== 'mj' || !this.archive) throw new Error('Action réservée au MJ.');
    if (privateRefs.length > 500 || privateRefs.some(ref => ref.count !== undefined && (!Number.isSafeInteger(ref.count) || ref.count < 0))) throw new Error('Compteur ou liste de cartes invalide.');
    if (this.archive?.projectId && this.archive.projectLinks?.[this.archive.projectId]) this.archive = { ...this.archive, projectLinks: { ...this.archive.projectLinks, [this.archive.projectId]: { ...this.archive.projectLinks[this.archive.projectId], refs: privateRefs } } };
    this.update({ privateRefs }); this.persist();
  }
  async useProject(projectId: string) {
    const archive = this.archive, session = this.state.session;
    if (session?.role !== 'mj' || !archive) throw new Error('Changement de projet réservé au MJ.');
    if (this.importingProject) throw new Error('Un import de projet est déjà en cours.');
    const linked = archive.projectLinks?.[projectId];
    if (linked) {
      this.archive = { ...archive, projectId, projectName: linked.name };
      this.update({ projectName: linked.name, privateRefs: linked.refs });
      this.publishGame(); await this.persistence;
      window.dispatchEvent(new Event('focus'));
      return;
    }
    const { collectStudioProject } = await import('./studioProject');
    const project = await collectStudioProject(projectId);
    if (project.project.roomKey) throw new Error('Choisis un projet de ta bibliothèque.');
    if (this.archive?.id !== archive.id || this.state.session?.id !== session.id) throw new Error('La salle a changé. Réessaie.');
    const JSZip = (await import('jszip')).default;
    const bytes = await new JSZip().file('studio.json', JSON.stringify(project)).generateAsync({ type: 'arraybuffer' });
    await this.importProject(bytes, projectId);
  }
  private importingProject = false;
  async setOwlbearRoomUrl(value: string) {
    if (this.state.session?.role !== 'mj' || !this.archive) throw new Error('Action réservée au MJ.');
    const owlbearUrl = value.trim() ? owlbearRoomUrlSchema.parse(value.trim()) : undefined;
    this.archive = { ...this.archive, owlbearUrl };
    this.update({ owlbearUrl }); this.publishGame(); await this.persistence;
  }
  async addRoomResource(source: BundledResource) {
    const archive = this.archive, session = this.state.session;
    if (session?.role !== 'mj' || !archive) throw new Error('Action réservée au MJ.');
    if (archive.resources.length >= 500 || this.state.privateRefs.length >= 500) throw new Error('La salle contient déjà 500 cartes.');
    const directory = ensureRoomProject(archive.id, archive.title);
    const copy = transferableRoomResource(source);
    const resource = { type: copy.type, item: { ...copy.item, id: crypto.randomUUID(), directoryId: directory.id, updatedAt: Date.now() } } as BundledResource;
    await (await import('./resourceBundle')).upsertBundledResource(resource);
    if (this.archive?.id !== archive.id || this.state.session?.id !== session.id) throw new Error('La salle a changé.');
    this.archive = { ...this.archive, resources: [...this.archive.resources, transferableRoomResource(resource)] };
    this.setPrivateRefs([...this.state.privateRefs, { type: resource.type, id: resource.item.id }]);
    await this.persistence;
    return resource;
  }
  async updateRoomHero(character: Character, expectedUpdatedAt: number, expectedState?: string) {
    const archive = this.archive, session = this.state.session;
    if (session?.role !== 'mj' || !archive) throw new Error('Action réservée au MJ.');
    const owner = Object.entries(this.state.sheets).find(([, hero]) => hero.id === character.id)?.[0];
    if (owner) {
      const current = this.state.sheets[owner];
      if (expectedState ? roomHeroEditSignature(current) !== expectedState : current.updatedAt !== expectedUpdatedAt) throw new Error('La fiche a changé. Rouvre-la avant de modifier son état.');
      return this.heroAction(owner, { type: 'edit-sheet', character: roomCharacterSchema.parse({ ...character, portrait: character.portrait || undefined }), expectedUpdatedAt, expectedState: expectedState || roomHeroEditSignature(current) });
    }
    const stored = archive.heroes.find(hero => hero.id === character.id);
    if (!stored) throw new Error('Héros absent de la salle.');
    if (expectedState ? roomHeroEditSignature(stored as Character) !== expectedState : stored.updatedAt !== expectedUpdatedAt) throw new Error('La fiche a changé. Rouvre-la avant de modifier son état.');
    const hero = roomCharacterSchema.parse({ ...stored, ...roomHeroEditFields(character), portrait: stored.portrait || undefined, updatedAt: Date.now() });
    await upsertCharacter(hero as Character);
    if (this.archive?.id !== archive.id || this.state.session?.id !== session.id || this.state.session.role !== 'mj') throw new Error('La salle a changé.');
    this.archive = { ...this.archive!, heroes: this.archive!.heroes.map(item => item.id === hero.id ? hero : item) };
    this.publishGame(); await this.persistence;
    window.dispatchEvent(new Event('clap-room-character-assigned'));
  }
  async importProject(bytes: ArrayBuffer, sourceId?: string) {
    const session = this.state.session, archive = this.archive;
    if (session?.role !== 'mj' || !archive) throw new Error('Import réservé au MJ.');
    if (this.importingProject) throw new Error('Un import de projet est déjà en cours.');
    if (Object.keys(archive.projectLinks || {}).length >= 50) throw new Error('La salle contient déjà 50 projets.');
    this.importingProject = true;
    try {
    const directory = ensureRoomProject(archive.id, archive.title);
    const { importStudioArchive } = await import('./studioImport');
    const result = await importStudioArchive(bytes, () => {}, { directoryId: directory.id, maxHeroes: 100 - archive.heroes.length, maxResources: 500 - archive.resources.length, maxEntries: 500 });
    if (this.archive?.id !== archive.id || this.state.session?.id !== session.id) throw new Error('La salle a changé. Le projet importé reste disponible sur cet appareil.');
    const heroes = (await Promise.all(result.heroIds.map(id => getCharacter(id)))).filter((hero): hero is Character => Boolean(hero));
    const resources = (await (await import('./resourceBundle')).loadAllBundledResources()).filter(resource => result.resourceRefs.some(ref => ref.type === resource.type && ref.id === resource.item.id));
    const refs = [...heroes.map(hero => ({ type: 'hero' as const, id: hero.id })), ...result.resourceRefs];
    const projectId = sourceId || crypto.randomUUID();
    const projectLinks = { ...this.archive.projectLinks };
    if (!this.archive.projectId && this.state.privateRefs.length) projectLinks[crypto.randomUUID()] = { name: this.archive.projectName || 'Projet précédent', refs: this.state.privateRefs };
    projectLinks[projectId] = { name: result.sourceName, refs };
    this.archive = { ...this.archive, projectId, projectLinks, projectName: result.sourceName, heroes: [...this.archive.heroes, ...heroes.map(hero => roomCharacterSchema.parse({ ...hero, portrait: hero.portrait || undefined }))], resources: [...this.archive.resources, ...resources.map(transferableRoomResource)] };
    this.update({ projectName: result.sourceName });
    this.setPrivateRefs(refs);
    this.publishGame();
    await this.persistence;
    window.dispatchEvent(new Event('clap-room-character-assigned'));
    window.dispatchEvent(new Event('focus'));
    return { name: result.sourceName, heroes: result.heroes, resources: result.resources, tools: result.tools };
    } finally { this.importingProject = false; }
  }
  async addRoomHero(source: Character, resources?: BundledResource[]) {
    const key = `${this.archive?.id}:${source.id}`;
    const pending = this.addingHeroes.get(key);
    if (pending) return pending;
    const operation = this.createRoomHero(source, resources);
    this.addingHeroes.set(key, operation);
    try { return await operation; } finally { this.addingHeroes.delete(key); }
  }
  private async createRoomHero(source: Character, resources?: BundledResource[]) {
    const session = this.state.session;
    const archive = this.archive;
    if (session?.role !== 'mj' || !archive) throw new Error('Action réservée au MJ.');
    const existingId = archive.heroSources?.[source.id] || source.id;
    const existing = archive.heroes.find(hero => hero.id === existingId) || Object.values(archive.sheets).find(hero => hero.id === existingId);
    if (existing) return existing as Character;
    if (archive.heroes.length >= 100) throw new Error('La salle contient déjà 100 héros.');
    const project = ensureRoomProject(archive.id, archive.title);
    const hero = roomCharacterSchema.parse({ ...structuredClone(source), id: crypto.randomUUID(), directoryId: project.id, portrait: source.portrait || undefined }) as Character;
    const linked = resources ?? await (await import('./resourceBundle')).loadLinkedBundledResources(source);
    hero.linkedResources = [];
    const { upsertBundledResource } = await import('./resourceBundle');
    for (const resource of linked) {
      const copied = transferableRoomResource(resource);
      const id = crypto.randomUUID();
      await upsertBundledResource({ type: copied.type, item: { ...copied.item, id, directoryId: hero.directoryId } } as BundledResource);
      hero.linkedResources.push({ type: copied.type, id });
    }
    if (this.archive?.id !== archive.id || this.state.session?.id !== session.id) throw new Error('La salle a changé. Réessaie.');
    await upsertCharacter(hero);
    const copiedResources = await (await import('./resourceBundle')).loadLinkedBundledResources(hero);
    if (this.archive?.id !== archive.id || this.state.session?.id !== session.id) throw new Error('La salle a changé. Réessaie.');
    this.archive = { ...this.archive, heroSources: { ...this.archive.heroSources, [source.id]: hero.id }, heroes: [...this.archive.heroes, hero], resources: [...this.archive.resources.filter(resource => !copiedResources.some(copy => copy.type === resource.type && copy.item.id === resource.item.id)), ...copiedResources.map(transferableRoomResource)] };
    this.setPrivateRefs([...this.state.privateRefs, { type: 'hero', id: hero.id }]);
    await this.persistence;
    this.publishGame();
    window.dispatchEvent(new Event('clap-room-character-assigned'));
    return hero;
  }
  async removeRoomHero(id: string) {
    if (this.state.session?.role !== 'mj' || !this.archive) throw new Error('Action réservée au MJ.');
    if (Object.values(this.state.sheets).some(hero => hero.id === id)) throw new Error('Cette fiche est actuellement utilisée par un joueur.');
    const hero = this.archive.heroes.find(hero => hero.id === id);
    const owned = hero && loadDirectories().some(project => project.id === hero.directoryId && project.roomKey === this.archive?.id);
    const sheets = { ...this.archive.sheets };
    const sheetResources = { ...this.archive.sheetResources };
    for (const [playerId, sheet] of Object.entries(sheets)) if (sheet.id === id) { delete sheets[playerId]; delete sheetResources[playerId]; }
    this.archive = { ...this.archive, sheets, sheetResources, heroes: this.archive.heroes.filter(hero => hero.id !== id) };
    this.setPrivateRefs(this.state.privateRefs.filter(ref => ref.type !== 'hero' || ref.id !== id));
    if (this.archive.heroSources) this.archive.heroSources = Object.fromEntries(Object.entries(this.archive.heroSources).filter(([, target]) => target !== id));
    this.publishGame();
    await this.persistence;
    if (owned) await deleteCharacter(id);
    window.dispatchEvent(new Event('clap-room-character-assigned'));
  }
  async resolveHeroProposal(id: string, accepted: boolean) {
    const proposal = this.state.heroProposals.find(value => value.id === id);
    if (this.state.session?.role !== 'mj' || !proposal) throw new Error('Demande indisponible.');
    const transport = this.peers.get(proposal.playerId)?.transport;
    if (!transport || transport.channel.readyState !== 'open') throw new Error('Le joueur doit être connecté.');
    if (accepted) {
      const hero = await this.addRoomHero(proposal.character as Character, proposal.resources as BundledResource[]);
      await this.assignCharacter(proposal.playerId, hero.id);
    }
    transport.send({ kind: 'hero-proposal-result', id, accepted });
    this.update({ heroProposals: this.state.heroProposals.filter(value => value.id !== id) });
  }
  private gameState(member: RoomMember): Extract<RoomMessage, { kind?: 'game-state' }> {
    const heroes = this.state.members.filter(value => value.role === 'player').map(value => ({ id: value.id,
      heroName: (this.state.sheets[value.id]?.nom || '').slice(0, 160), heroConcept: (this.state.sheets[value.id]?.concept || '').slice(0, 300) }));
    const owners = new Map(Object.entries({ ...this.archive?.sheets, ...this.state.sheets }).filter(([id]) => this.state.members.some(member => member.id === id && member.role === 'player')).map(([id, hero]) => [hero.id, id]));
    const roomHeroes = [...new Map([...this.state.roomHeroes, ...Object.values(this.archive?.sheets || {}), ...Object.values(this.state.sheets)].map(hero => [hero.id, hero])).values()].map(hero => ({ id: hero.id, name: (hero.nom || 'Héros sans nom').slice(0, 160), ownerId: owners.get(hero.id) }));
    return { kind: 'game-state', ...gameView(this.game, member), heroes, roomHeroes, ...(this.state.owlbearUrl ? { owlbearUrl: this.state.owlbearUrl } : {}) };
  }
  private publishGame() {
    const session = this.state.session;
    if (session?.role !== 'mj') return;
    this.update({ ...gameView(this.game, session), hideRolls: this.game.hideRolls });
    this.persist();
    for (const [id, peer] of this.peers) {
      const member = this.state.members.find(value => value.id === id);
      if (member) peer.transport?.send(this.gameState(member));
    }
  }
  private async command(command: GameCommand) {
    const session = this.state.session;
    if (!session) throw new Error('Rejoins une salle pour jouer.');
    if (session.role === 'mj') {
      this.game = applyGameCommand(this.game, command, session, this.state.members);
      this.publishGame();
      await this.persistence;
      return;
    }
    const host = this.state.members.find(member => member.role === 'mj');
    const transport = host && this.peers.get(host.id)?.transport;
    if (!transport || transport.channel.readyState !== 'open') throw new Error('Connexion au MJ indisponible. Attends son retour.');
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { this.pendingCommands.delete(command.id); reject(new Error('Le MJ ne confirme pas la réception.')); }, 15000);
      this.pendingCommands.set(command.id, { peerId: host!.id, resolve, reject, timer });
      if (!transport.send({ kind: 'game-command', command })) { clearTimeout(timer); this.pendingCommands.delete(command.id); reject(new Error('Envoi au MJ impossible.')); }
    });
  }
  async exportArchive() {
    if (this.state.session?.role !== 'mj' || !this.archive) throw new Error('Export réservé au MJ.');
    this.persist();
    const record = await captureRoomLibrary(this.archive);
    const blob = await exportRoomArchive(record);
    await this.persistence.catch(() => {});
    if (this.archive?.id === record.id) { this.archive = { ...this.archive, heroes: record.heroes, resources: record.resources }; this.persist(); await this.persistence.catch(() => {}); }
    return {blob,name:record.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_') + '.clapSalle'};
  }

  private save(session: RoomSession) {
    sessionStorage.setItem(STORAGE, JSON.stringify(session));
    rememberOwnedRoom(session);
    rememberRoomNickname(session.room, session.name);
    this.update({ session });
  }
  private async api<T>(path:string,body:unknown,session=this.state.session):Promise<T>{return callRoomApi<T>(path,body,session);}
  list() { return this.api<{ rooms: RoomListing[] }>("/list", { identityToken: playerIdentityToken() }, null); }
  async resumeLocalRoom(id: string) {
    if (this.state.session?.role === 'mj' && this.state.session.localRoomId === id) return;
    if (this.busy || this.state.session) throw new Error('Quitte d’abord la salle actuelle.');
    const archive = await loadLocalRoom(id);
    if (!archive) throw new Error('Sauvegarde locale introuvable.');
    const previous = ownedLocalRoom(id);
    if (previous) {
      try { await this.resumeOwnedRoom(previous.room); return; }
      catch (cause) { if ((cause as { status?: number }).status !== 401) throw cause; }
    }
    await this.enter(archive.hostName.trim() || 'MJ', undefined, undefined, { localRoomId: id, title: archive.title, ...roomSettings(id) });
  }
  async resumeOwnedRoom(code: string) {
    const session = ownedRoom(code);
    if (!session) throw new Error('Accès MJ introuvable sur cet appareil.');
    if (typeof RTCPeerConnection === 'undefined') throw new Error('Ce navigateur ne prend pas en charge les salles WebRTC.');
    if (this.busy || this.state.session) throw new Error('Quitte d’abord la salle actuelle.');
    this.busy = true;
    try {
      // Validate the saved bearer token with the server before restoring the identity.
      const poll = await this.api<RoomPoll>('/poll', { since: 0, instance: crypto.randomUUID() }, session);
      this.archive = session.localRoomId ? await loadLocalRoom(session.localRoomId) : undefined;
      this.game = this.archive?.game || emptyGame();
      this.update({ projectName: this.archive?.projectName, privateRefs: this.archive?.privateRefs || [], savedSheets: this.archive?.sheets || {}, savedSheetResources: this.archive?.sheetResources || {} });
      this.save(session); this.applyRoomPoll(poll); this.publishGame(); this.start();
    } catch (cause) {
      if ((cause as { status?: number }).status === 401) forgetOwnedRoom(code);
      throw cause;
    } finally { this.busy = false; }
  }
  async rejoin(room: string) { await this.enter('', room, undefined, { resumeOnly: true }); }
  async enter(name: string, room?: string, characterId?: string, options: { title?: string; password?: string; localRoomId?: string; resumeOnly?: boolean } = {}) {
    if (this.busy || this.state.session) throw new Error("Quitte d’abord la salle actuelle.");
    if (typeof RTCPeerConnection === "undefined") throw new Error("Ce navigateur ne prend pas en charge les salles WebRTC.");
    this.busy = true;
    try {
      // Check local access storage before creating a server-side identity.
      sessionStorage.setItem("clap-room-storage-test", "1"); sessionStorage.removeItem("clap-room-storage-test");
      let archive: RoomArchive | undefined;
      if (!room) {
        archive = options.localRoomId ? await loadLocalRoom(options.localRoomId) : undefined;
        if (options.localRoomId && !archive) throw new Error('Sauvegarde locale introuvable.');
        archive ??= { format: 'clapSalle', version: 1, id: crypto.randomUUID(), title: options.title || `Salle de ${name}`, hostId: '', hostName: name, updatedAt: Date.now(), game: emptyGame(), privateRefs: [], heroes: [], resources: [], sheets: {}, sheetResources: {} };
        archive = { ...archive, title: options.title?.trim() || archive.title };
        await saveLocalRoom(archive);
      }
      const session = await this.api<RoomSession>(room ? "/join" : "", { name, room, title: archive?.title || options.title, password: options.password, identityToken: playerIdentityToken(), resumeOnly: options.resumeOnly, returningPlayers: archive?.players }, null);
      if (room && session.role === 'mj') {
        const owned = ownedRoom(room);
        if (owned?.localRoomId) archive = await loadLocalRoom(owned.localRoomId);
      }
      this.archive = archive;
      this.game = archive ? { ...archive.game, requests: [] } : emptyGame();
      // Invitations and transient participant identities are never restored from files.
      if (archive && archive.hostId !== session.id) this.game = { ...this.game, messages: this.game.messages.map(message => ({ ...message,
        sender: message.sender === archive.hostId ? session.id : message.sender,
        privateTo: message.privateTo === archive.hostId ? session.id : message.privateTo })) };
      this.update({ exitNotice: undefined, owlbearUrl: archive?.owlbearUrl, projectName: archive?.projectName, roomInfo: { title: archive?.title || options.title || '', locked: Boolean(options.password) }, privateRefs: archive?.privateRefs || [], savedSheets: archive?.sheets || {}, savedSheetResources: archive?.sheetResources || {}, messages: [], requests: [], sheets: {}, sheetResources: {} });
      this.save({ ...session, characterId, ...(archive ? { localRoomId: archive.id } : {}) });
      if (archive) rememberRoomSettings(archive.id, options.password);
      this.publishGame();
      this.start();
    } finally { this.busy = false; }
  }
  async restore() {
    if (!this.stopped) return;
    try {
      const session = JSON.parse(sessionStorage.getItem(STORAGE) || "null");
      if (session && /^[A-F0-9]{12}$/.test(session.room) && typeof session.token === "string" && typeof session.id === "string" && ["mj", "player"].includes(session.role)) {
        this.archive = session.localRoomId ? await loadLocalRoom(session.localRoomId) : undefined;
        if (!this.stopped) return;
        this.game = this.archive?.game || emptyGame();
        this.update({ projectName: this.archive?.projectName, privateRefs: this.archive?.privateRefs || [], savedSheets: this.archive?.sheets || {}, savedSheetResources: this.archive?.sheetResources || {} });
        rememberRoomNickname(session.room, session.name);
        rememberOwnedRoom(session);
        this.update({ session }); this.publishGame(); this.start();
      }
    } catch { this.update({ error: "La reprise de la salle n’est pas disponible dans ce navigateur." }); }
  }
  private start() {
    window.addEventListener('clap-character-saved', this.characterSaved);
    this.stopped = false;
    this.instance = crypto.randomUUID(); this.since = 0;
    const generation = ++this.generation;
    this.update({ error: "", syncing: true });
    void this.prepareRoomHeroes().catch(() => this.update({ error: 'Impossible de préparer les copies des héros de la salle.' }));
    // A duplicated browser tab must not negotiate with the same participant identity.
    if (navigator.locks) {
      this.lockAbort = new AbortController();
      void navigator.locks.request(`clap-room-${this.state.session!.room}:${this.state.session!.id}`, { signal: this.lockAbort.signal }, async () => {
        if (this.stopped || generation !== this.generation) return;
        await new Promise<void>(resolve => { this.releaseLock = resolve; void this.tick(generation); });
      }).catch(() => { /* Released while waiting for the previous tab. */ });
    } else void this.tick(generation);
  }
  private async prepareRoomHeroes() {
    if (this.state.session?.role !== 'mj' || !this.archive) return;
    const refs = this.state.privateRefs.filter(ref => ref.type === 'hero');
    for (const ref of refs) {
      const saved = this.archive.heroes.find(hero => hero.id === ref.id);
      if (saved) continue;
      const source = saved as Character | undefined || await getCharacter(ref.id);
      if (!source) continue;
      await this.addRoomHero(source);
      this.archive = { ...this.archive, heroes: this.archive.heroes.filter(hero => hero.id !== ref.id) };
      this.setPrivateRefs(this.state.privateRefs.filter(value => value.type !== 'hero' || value.id !== ref.id));
    }
    // Restore the room's own editable copies if the project library was cleared.
    for (const hero of this.archive.heroes) if (!await getCharacter(hero.id)) await upsertCharacter(hero as Character);
  }
  stop() {
    window.removeEventListener('clap-character-saved', this.characterSaved);
    this.persist();
    for (const pending of this.pendingCommands.values()) { clearTimeout(pending.timer); pending.reject(new Error('Connexion interrompue.')); }
    this.pendingCommands.clear();
    this.publicHeroes.clear();
    this.stopped = true; this.generation++;
    for (const operation of this.resourceOperations.values()) { clearTimeout(operation.timer); operation.reject(new Error("Connexion interrompue.")); }
    this.resourceOperations.clear();
    clearTimeout(this.timer);
    this.lockAbort?.abort(); this.releaseLock?.(); this.releaseLock = undefined;
    this.peers.forEach(p => { p.transport?.close(); p.pc.close(); }); this.peers.clear(); this.seenRolls.clear(); this.approvedSheetIds.clear(); this.assignments.clear(); this.resolvedRequests.clear(); this.lastRevision = -1;
    this.update({ availableHeroes: [], roomHeroes: [], heroProposals: [], pendingHeroProposal: undefined, roomInfo: null, sheetResources: {}, connected: [], members: [], sheets: {}, messages: [], requests: [], hideRolls: false, syncing: false });
    this.proposal = undefined;
  }
  async setRoomTitle(title:string){await this.api('/title',{title});await this.refreshRoom();this.persist();}
  private integrationChanging=false;
  isRoomTransitioning(){return this.integrationChanging||this.busy;}
  async linkSiteRoom(link:string){
    this.integrationChanging=true;
    try{const config=await this.api<{room:string}>('/integration/validate',{link});const name=this.state.session?.name||'MJ Owlbear';
    if(this.state.session)await this.leave();await this.api('/integration/link',{link},null);await this.enter(name,config.room);}
    finally{this.integrationChanging=false;}
  }
  async unlinkSiteRoom(){this.integrationChanging=true;try{const name=this.state.session?.name||'MJ Owlbear';if(this.state.session)await this.leave();await this.api('/integration/unlink',{},null);await this.enter(name,undefined,undefined,{title:'Salle CLAP!'});}finally{this.integrationChanging=false;}}
  async sendChat(text: string, target?: string) {
    await this.command({ type: 'chat', id: crypto.randomUUID(), text, ...(target ? { target } : {}) });
  }
  async leave() {
    if (this.state.session?.role === 'mj' && this.archive) {
      this.persist();
      await this.persistence;
      const library = await captureRoomLibrary(this.archive);
      this.archive = { ...this.archive, heroes: library.heroes, resources: library.resources };
      this.persist(); await this.persistence;
    }
    try { await this.api("/leave", {}); }
    catch (error) { if ((error as { status?: number }).status !== 401) throw error; }
    this.forget();
  }
  private forget() { const code = this.state.session?.room; this.stop(); if (code) forgetOwnedRoom(code); sessionStorage.removeItem(STORAGE); this.update({ session: null, owlbearUrl: undefined, projectName: undefined, error: "" }); }
  async assignCharacter(playerId: string, characterId: string) {
    const session = this.state.session;
    const member = this.state.members.find(member => member.id === playerId && member.role === 'player');
    if (session?.role !== 'mj' || !member) throw new Error('Attribution réservée au MJ de la salle.');
    const peer = this.peers.get(playerId);
    if (!peer?.transport || peer.transport.channel.readyState !== 'open') throw new Error('Le joueur doit être connecté pour recevoir sa fiche.');
    const savedEntry = Object.entries(this.archive?.sheets || {}).find(([, hero]) => hero.id === characterId);
    const stored = this.archive?.heroes.find(hero => hero.id === characterId) || savedEntry?.[1];
    if (!stored) throw new Error('Ajoute d’abord ce héros à la salle avant de l’attribuer.');
    const occupied = Object.entries({ ...this.archive?.sheets, ...this.state.sheets }).some(([id, hero]) => id !== playerId && hero.id === characterId && this.state.members.some(member => member.id === id && member.role === 'player'));
    if (occupied) throw new Error('Ce héros est déjà attribué à un autre joueur.');
    const character = savedEntry ? (this.state.sheets[savedEntry[0]] || stored) as Character : stored as Character;
    const parsed = character && roomCharacterSchema.safeParse({ ...character, portrait: character.portrait || undefined });
    if (!parsed?.success) throw new Error('Cette fiche ne peut pas être partagée. Vérifie son contenu et son portrait.');
    if (this.state.session?.id !== session.id || this.peers.get(playerId) !== peer) throw new Error('La connexion a changé. Réessaie.');
    const resources = savedEntry ? this.state.sheetResources[savedEntry[0]] || this.archive?.sheetResources[savedEntry[0]] || [] : this.archive?.resources.filter(resource => character.linkedResources.some(link => link.type === resource.type && link.id === resource.item.id)) || [];
    if (!(this.archive?.heroes.some(hero => hero.id === characterId) || Object.values(this.archive?.sheets || {}).some(hero => hero.id === characterId)) || this.state.session?.id !== session.id || this.peers.get(playerId) !== peer) throw new Error('Le héros ou la connexion a changé. Réessaie.');
    const message: Extract<RoomMessage, { kind?: 'assign-sheet' }> = { kind: 'assign-sheet', assignmentId: crypto.randomUUID(), character: parsed.data, resources: resources.map(resource => transferableRoomResource(resource as BundledResource)),
      project: { id: session.localRoomId || session.room, title: this.state.roomInfo?.title || `Salle de ${session.name}` } };
    if (Object.entries({ ...this.archive?.sheets, ...this.state.sheets }).some(([id, hero]) => id !== playerId && hero.id === characterId && this.state.members.some(member => member.id === id && member.role === 'player'))) throw new Error('Ce héros est déjà attribué à un autre joueur.');
    if (!peer.transport.send(message)) throw new Error('La fiche ne peut pas être envoyée pour le moment.');
    this.assignments.set(playerId, message); peer.assignment = message.assignmentId;
    this.approvedSheetIds.set(playerId, characterId);
    const expected = { ...parsed.data, id: this.approvedSheetIds.get(playerId)! };
    const sheets = { ...this.archive!.sheets };
    const sheetResources = { ...this.archive!.sheetResources };
    for (const [id, hero] of Object.entries(sheets)) if (hero.id === characterId || id === playerId) { delete sheets[id]; delete sheetResources[id]; }
    sheets[playerId] = expected;
    sheetResources[playerId] = resources.map(resource => transferableRoomResource(resource as BundledResource));
    const heroes = [...new Map([...this.archive!.heroes, ...Object.values(this.archive!.sheets), ...Object.values(this.state.sheets)].map(hero => [hero.id, hero])).values()];
    this.archive = { ...this.archive!, heroes, sheets, sheetResources };
    const refs = [...this.state.privateRefs];
    for (const hero of heroes) if (!refs.some(ref => ref.type === 'hero' && ref.id === hero.id)) refs.push({ type: 'hero', id: hero.id });
    this.state = { ...this.state, privateRefs: refs };
    this.update({ sheets: { ...this.state.sheets, [playerId]: expected as Character }, sheetResources: { ...this.state.sheetResources, [playerId]: resources as BundledResource[] } });
    this.publishGame();
  }
  private sendAssignment(id: string, peer: Peer) {
    const message = this.assignments.get(id);
    if (message && peer.assignment !== message.assignmentId && peer.transport?.send(message)) peer.assignment = message.assignmentId;
  }
  private async receiveAssignment(sender: string, message: Extract<RoomMessage, { kind?: 'assign-sheet' }>) {
    const session = this.state.session;
    if (session?.role !== 'player' || !this.state.members.some(member => member.id === sender && member.role === 'mj')) return;
    const acknowledge = () => this.peers.get(sender)?.transport?.send({ kind: 'assigned-sheet', assignmentId: message.assignmentId });
    if (session.receivedAssignment === message.assignmentId) { acknowledge(); return; }
    if (this.receivingAssignments.has(message.assignmentId)) return;
    this.receivingAssignments.add(message.assignmentId);
    try {
      const project = ensureRoomProject(message.project?.id || session.room, message.project?.title || this.state.roomInfo?.title || 'Salle de jeu', session.roomDirectoryId);
      const character = { ...message.character, directoryId: project.id, linkedResources: [] } as Character;
      for (const resource of message.resources || []) character.linkedResources.push(await importRoomResource(resource as BundledResource, character));
      await upsertCharacter(character);
      if (this.state.session?.id !== session.id || !this.state.members.some(member => member.id === sender && member.role === 'mj')) return;
      this.save({ ...this.state.session, characterId: character.id, receivedAssignment: message.assignmentId, roomDirectoryId: project.id });
      selectDirectory(project.id);
      this.peers.forEach(peer => { peer.sheet = ''; });
      acknowledge();
      window.dispatchEvent(new Event('clap-room-character-assigned'));
      toast.success(localizeText('Le MJ t’a attribué une fiche de héros.'));
      for (const peer of this.peers.values()) void this.sendSheet(peer);
    } catch { this.update({ error: 'Impossible de sauvegarder la fiche attribuée sur cet appareil.' }); }
    finally { this.receivingAssignments.delete(message.assignmentId); }
  }
  async selectCharacter(characterId: string) {
    const session = this.state.session;
    if (session?.role !== 'player') throw new Error('Rejoins une salle comme joueur.');
    const host = this.state.members.find(member => member.role === 'mj');
    const transport = host && this.peers.get(host.id)?.transport;
    if (!transport || transport.channel.readyState !== 'open') throw new Error('Attends la connexion du MJ.');
    const character = await getCharacter(characterId);
    if (!character) throw new Error('Héros introuvable.');
    const resources = await (await import('./resourceBundle')).loadLinkedBundledResources(character);
    if (this.state.session !== session) throw new Error('La salle a changé.');
    const id = crypto.randomUUID();
    const message: RoomMessage = { kind: 'hero-proposal', id, character: roomCharacterSchema.parse({ ...character, portrait: character.portrait || undefined }), resources: resources.map(resource => transferableRoomResource(resource as BundledResource)) };
    if (!transport.send(message)) throw new Error('Envoi au MJ impossible.');
    this.proposal = message as Extract<RoomMessage, { kind?: 'hero-proposal' }>;
    this.update({ pendingHeroProposal: id });
    toast.info(localizeText('Proposition envoyée au MJ. Ton héros actuel est conservé en attendant.'));
  }
  async selectRoomHero(characterId: string) {
    const session = this.state.session;
    const host = this.state.members.find(member => member.role === 'mj');
    const transport = host && this.peers.get(host.id)?.transport;
    if (session?.role !== 'player' || !transport || transport.channel.readyState !== 'open') throw new Error('Attends la connexion du MJ.');
    const id = crypto.randomUUID();
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { this.pendingCommands.delete(id); reject(new Error('Le choix du héros n’a pas été confirmé.')); }, 15000);
      this.pendingCommands.set(id, { peerId: host.id, resolve, reject, timer });
      if (!transport.send({ kind: 'hero-select', id, characterId })) { clearTimeout(timer); this.pendingCommands.delete(id); reject(new Error('Envoi impossible.')); }
    });
  }
  private closePeer(id: string) {
    const peer = this.peers.get(id);
    this.peers.delete(id); peer?.transport?.close(); peer?.pc.close();
    const sheets = { ...this.state.sheets }; delete sheets[id];
    const sheetResources = { ...this.state.sheetResources }; delete sheetResources[id];
    for (const [operationId, operation] of this.resourceOperations) if (operation.playerId === id) { clearTimeout(operation.timer); operation.reject(new Error("Joueur déconnecté.")); this.resourceOperations.delete(operationId); }
    this.update({ sheetResources, sheets, connected: this.state.connected.filter(key => key !== id) });
  }
  private newPeer(member: RoomMember, connection: string) {
    this.closePeer(member.id);
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const peer: Peer = { pc, connection, instance: member.instance, started: Date.now(), sheet: "" };
    this.peers.set(member.id, peer);
    const attach = (channel: RTCDataChannel) => {
      if (peer.transport) { channel.close(); return; }
      peer.transport = new RoomTransport(channel, message => {
        if (this.peers.get(member.id) === peer) this.receive(member.id, message);
      });
      channel.onopen = () => {
        if (this.peers.get(member.id) !== peer) return;
        this.update({ connected: [...new Set([...this.state.connected, member.id])] });
        void this.sendSheet(peer);
        this.sendAssignment(member.id, peer);
        if (this.state.session?.role === 'mj' && !this.assignments.has(member.id)) {
          const saved = this.archive?.sheets[member.id];
          if (saved) void this.assignCharacter(member.id, saved.id).catch(cause => this.update({ error: cause instanceof Error ? cause.message : 'Reprise du héros impossible.' }));
        }
        if (this.state.session?.role === 'player' && this.proposal) peer.transport?.send(this.proposal);
        if (this.state.session?.role === 'mj') peer.transport?.send(this.gameState(member));
      };
      if (channel.readyState === "open") channel.onopen.call(channel, new Event("open"));
      channel.onclose = () => { if (this.peers.get(member.id) === peer) this.closePeer(member.id); };
    };
    pc.onconnectionstatechange = () => {
      if (this.peers.get(member.id) === peer && ["failed", "closed"].includes(pc.connectionState)) this.closePeer(member.id);
    };
    if (this.state.session?.role === "player") attach(pc.createDataChannel("clap", { ordered: true }));
    else pc.ondatachannel = event => attach(event.channel);
    return peer;
  }
  private async description(peer: Peer) {
    await peer.pc.setLocalDescription();
    if (peer.pc.iceGatheringState !== "complete") {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => done(new Error("La connexion entre navigateurs prend trop de temps.")), 12000);
        const changed = () => { if (peer.pc.iceGatheringState === "complete") done(); };
        const done = (error?: Error) => {
          clearTimeout(timer); peer.pc.removeEventListener("icegatheringstatechange", changed);
          if (error) reject(error); else resolve();
        };
        peer.pc.addEventListener("icegatheringstatechange", changed);
      });
    }
    return peer.pc.localDescription!.toJSON();
  }
  private async offer(member: RoomMember, generation: number) {
    const peer = this.newPeer(member, crypto.randomUUID());
    const description = await this.description(peer);
    if (generation !== this.generation || this.peers.get(member.id) !== peer) return;
    await this.api("/signal", { target: member.id, instance: member.instance, connection: peer.connection, description });
  }
  private async signal(signal: RoomSignal, generation: number) {
    const member = this.state.members.find(m => m.id === signal.sender && m.instance === signal.senderInstance && m.online);
    if (!member || !this.state.session) return;
    if (this.state.session.role === "mj" && member.role === "player" && signal.description.type === "offer") {
      const current = this.peers.get(member.id);
      if (current?.connection === signal.connection) return;
      const peer = this.newPeer(member, signal.connection);
      await peer.pc.setRemoteDescription(signal.description);
      const description = await this.description(peer);
      if (generation !== this.generation || this.peers.get(member.id) !== peer) return;
      await this.api("/signal", { target: member.id, instance: member.instance, connection: signal.connection, description });
    } else if (this.state.session.role === "player" && member.role === "mj" && signal.description.type === "answer") {
      const peer = this.peers.get(member.id);
      if (peer?.connection === signal.connection && peer.pc.signalingState === "have-local-offer") await peer.pc.setRemoteDescription(signal.description);
    }
  }
  private applyRoomPoll(poll: RoomPoll) {
    if (!this.state.session || (poll.roomRevision ?? 0) < this.lastRevision) return false;
    this.lastRevision = poll.roomRevision ?? 0;
    const role = poll.self?.role ?? this.state.session.role;
    const oldHost = this.state.members.find(member => member.role === 'mj')?.id;
    const newHost = poll.members.find(member => member.role === 'mj')?.id;
    const membershipChanged = this.state.members.map(member => member.id + member.role).join('|') !== poll.members.map(member => member.id + member.role).join('|');
    if (role !== this.state.session.role || (oldHost && oldHost !== newHost)) {
      for (const id of [...this.peers.keys()]) this.closePeer(id);
      this.assignments.clear(); this.publicHeroes.clear();
      this.persist();
      this.update({ projectName: undefined, sheetResources: {}, sheets: {}, privateRefs: [], savedSheets: {}, savedSheetResources: {} });
    }
    if (role !== this.state.session.role) this.save({ ...this.state.session, role });
    this.iceServers = poll.iceServers;
    if (role === 'mj' && !this.archive) {
      this.archive = this.handoff || { format: 'clapSalle', version: 1, id: crypto.randomUUID(), title: poll.room?.title || 'Salle de jeu', hostId: this.state.session.id, hostName: this.state.session.name, updatedAt: Date.now(), game: emptyGame(), privateRefs: [], heroes: [], resources: [], sheets: {}, sheetResources: {} };
      this.game = this.archive.game; this.handoff = undefined;
      this.save({ ...this.state.session, localRoomId: this.archive.id });
      this.persist();
    }
    if (role !== 'mj') this.archive = undefined;
    this.update({ roomInfo: poll.room || this.state.roomInfo, members: poll.members.map(member => ({ ...member, heroName: this.state.sheets[member.id]?.nom || this.publicHeroes.get(member.id)?.heroName || '', heroConcept: this.state.sheets[member.id]?.concept || this.publicHeroes.get(member.id)?.heroConcept || '' })), error: '', syncing: false, relayConfigured: poll.relayConfigured });
    if (role === 'mj') {
      this.update({ ...gameView(this.game, this.state.session), hideRolls: this.game.hideRolls });
      if (membershipChanged) this.publishGame();
    } else if (oldHost && oldHost !== newHost) this.update({ messages: [], requests: [], hideRolls: false });
    return true;
  }
  private async refreshRoom() {
    const session = this.state.session;
    if (!session) return;
    const poll = await this.api<RoomPoll>('/poll', { since: this.since, instance: this.instance }, session);
    if (this.state.session?.id === session.id) this.applyRoomPoll(poll);
  }
  async changePassword(password: string) {
    await this.api('/password', { password });
    const id = this.state.session?.localRoomId;
    if (id) rememberRoomSettings(id, password);
    await this.refreshRoom();
  }
  async createOwlbearInvite() { return this.api<{ code: string }>('/owlbear-invite', {}); }
  async kickPlayer(target: string) {
    await this.api('/kick', { target });
    if (this.peers.has(target)) this.closePeer(target);
    await this.refreshRoom();
  }
  async linkResource(playerId: string, resource: BundledResource) {
    const session = this.state.session;
    const hero = this.state.sheets[playerId];
    const peer = this.peers.get(playerId);
    if (session?.role !== 'mj' || !hero || !this.state.members.some(member => member.id === playerId && member.role === 'player')) throw new Error('Fiche du joueur indisponible.');
    if (peer?.transport?.channel.readyState !== 'open') throw new Error('Le joueur doit être connecté.');
    const operationId = crypto.randomUUID();
    const message: RoomMessage = { kind: 'link-resource', operationId, characterId: hero.id, resource: transferableRoomResource(resource) };
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { this.resourceOperations.delete(operationId); reject(new Error('Le joueur ne confirme pas la réception. Réessaie.')); }, 20000);
      this.resourceOperations.set(operationId, { playerId, resolve, reject, timer });
      if (!peer.transport!.send(message)) { clearTimeout(timer); this.resourceOperations.delete(operationId); reject(new Error('La carte ne peut pas être transmise.')); }
    });
  }
  async heroAction(playerId: string, action: Extract<RoomMessage, { kind?: 'hero-action' }>['action']) {
    const session = this.state.session;
    const hero = this.state.sheets[playerId];
    const peer = this.peers.get(playerId);
    if (session?.role !== 'mj' || !hero || !this.state.members.some(member => member.id === playerId && member.role === 'player')) throw new Error('Fiche indisponible.');
    if (peer?.transport?.channel.readyState !== 'open') throw new Error('Le joueur doit être connecté.');
    const operationId = crypto.randomUUID();
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { this.resourceOperations.delete(operationId); reject(new Error('Le joueur ne confirme pas la réception.')); }, 20000);
      this.resourceOperations.set(operationId, { playerId, resolve, reject, timer });
      if (!peer.transport!.send({ kind: 'hero-action', operationId, characterId: hero.id, action })) { clearTimeout(timer); this.resourceOperations.delete(operationId); reject(new Error('Transmission impossible.')); }
    });
  }
  private async receiveHeroAction(sender: string, message: Extract<RoomMessage, { kind?: 'hero-action' }>) {
    const session = this.state.session;
    if (session?.role !== 'player' || !this.state.members.some(member => member.id === sender && member.role === 'mj')) return;
    const acknowledge = (error?: string) => this.peers.get(sender)?.transport?.send({ kind: 'resource-linked', operationId: message.operationId, ...(error ? { error } : {}) });
    if (session.receivedResourceOps?.includes(message.operationId)) { acknowledge(); return; }
    try {
      if (session.characterId !== message.characterId) throw new Error('Le joueur a changé de héros.');
      let hero = await getCharacter(message.characterId);
      if (!hero || this.state.session?.id !== session.id || this.state.session.characterId !== hero.id || !this.state.members.some(member => member.id === sender && member.role === 'mj')) throw new Error('Fiche ou MJ indisponible.');
      const action = message.action;
      const previousHero = hero;
      let reward: { title: string; removed: boolean; item?: unknown; resource?: BundledResource };
      if (action.type === 'unlink-resource') {
        if (!hero.linkedResources.some(link => link.type === action.resourceType && link.id === action.id)) throw new Error('Liaison déjà retirée.');
        const { loadLinkedBundledResources } = await import('./resourceBundle');
        const resource = (await loadLinkedBundledResources(hero)).find(item => item.type === action.resourceType && item.item.id === action.id);
        hero = await getCharacter(message.characterId);
        if (!hero || !hero.linkedResources.some(link => link.type === action.resourceType && link.id === action.id)) throw new Error('La fiche ou la liaison a changé.');
        hero.linkedResources = hero.linkedResources.filter(link => link.type !== action.resourceType || link.id !== action.id);
        reward = { title: resource?.item.titre || 'Carte', removed: true, resource };
      } else if (action.type === 'edit-sheet') {
        if (action.expectedState ? roomHeroEditSignature(hero) !== action.expectedState : hero.updatedAt !== action.expectedUpdatedAt) throw new Error('La fiche a changé. Rouvre-la avant de modifier son état.');
        hero = { ...hero, ...roomHeroEditFields(action.character as Character) };
        reward = { title: 'Fiche mise à jour par le MJ', removed: false };
      } else if (action.type === 'add-item') {
        if (hero[action.category].length >= 100) throw new Error('Inventaire plein.');
        const item = action.category === 'armes' ? { nom: action.item.nom, degats: action.item.degats, proprietes: action.item.proprietes } : action.category === 'armures' ? { nom: action.item.nom, poids: action.item.poids, protection: action.item.protection, proprietes: action.item.proprietes } : { nom: action.item.nom, proprietes: action.item.proprietes };
        (hero[action.category] as unknown[]).push(item);
        reward = { title: item.nom, removed: false, item };
      } else {
        const item = hero[action.category][action.index];
        if (!item || JSON.stringify(item) !== action.expected) throw new Error('Cet objet a changé. Actualise la fiche.');
        hero[action.category].splice(action.index, 1);
        reward = { title: item.nom || 'Objet', removed: true, item };
      }
      if (this.state.session?.id !== session.id || this.state.session.characterId !== hero.id || !this.state.members.some(member => member.id === sender && member.role === 'mj')) throw new Error('Fiche ou MJ modifié.');
      await upsertCharacter(hero);
      this.save({ ...this.state.session!, receivedResourceOps: [...(this.state.session!.receivedResourceOps || []), message.operationId].slice(-200) });
      window.dispatchEvent(new CustomEvent('clap-room-character-assigned', { detail: { character: hero } }));
      if (action.type === 'edit-sheet') {
        for (const change of roomInventoryChanges(previousHero, hero)) window.dispatchEvent(new CustomEvent('clap-room-reward', { detail: change }));
      } else window.dispatchEvent(new CustomEvent('clap-room-reward', { detail: reward }));
      acknowledge();
      this.peers.forEach(peer => { peer.sheet = ''; void this.sendSheet(peer); });
    } catch (cause) { acknowledge(cause instanceof Error ? cause.message.slice(0, 250) : 'Action impossible.'); }
  }
  private async receiveLinkedResource(sender: string, message: Extract<RoomMessage, { kind?: 'link-resource' }>) {
    const session = this.state.session;
    if (session?.role !== 'player' || !this.state.members.some(member => member.id === sender && member.role === 'mj')) return;
    const acknowledge = (error?: string) => this.peers.get(sender)?.transport?.send({ kind: 'resource-linked', operationId: message.operationId, ...(error ? { error } : {}) });
    if (session.receivedResourceOps?.includes(message.operationId)) { acknowledge(); return; }
    try {
      if (session.characterId !== message.characterId) throw new Error('Le joueur a changé de héros.');
      const hero = await getCharacter(message.characterId);
      if (!hero) throw new Error('Fiche introuvable.');
      const link = await importRoomResource(message.resource as BundledResource, hero);
      if (this.state.session?.id !== session.id || this.state.session.characterId !== hero.id || !this.state.members.some(member => member.id === sender && member.role === 'mj')) throw new Error('La fiche ou le MJ a changé.');
      const latest = await getCharacter(hero.id);
      if (!latest) throw new Error('Fiche introuvable.');
      if (!latest.linkedResources.some(item => item.type === link.type && item.id === link.id)) latest.linkedResources = [...latest.linkedResources, link];
      if (latest.linkedResources.length > 200) throw new Error('La fiche contient trop de cartes.');
      await upsertCharacter(latest);
      this.save({ ...this.state.session, receivedResourceOps: [...(this.state.session.receivedResourceOps || []), message.operationId].slice(-200) });
      window.dispatchEvent(new CustomEvent('clap-room-character-assigned', { detail: { character: latest } }));
      window.dispatchEvent(new CustomEvent('clap-room-reward', { detail: { title: message.resource.item.titre || 'Carte', resource: message.resource, removed: false } }));
      acknowledge();
      this.peers.forEach(peer => { peer.sheet = ''; void this.sendSheet(peer); });
    } catch (cause) { acknowledge(cause instanceof Error ? cause.message.slice(0, 250) : 'Impossible de lier la carte.'); }
  }
  async transferMJ(target: string) {
    if (this.state.session?.role !== 'mj') throw new Error('Action réservée au MJ.');
    const peer = this.peers.get(target);
    if (peer?.transport?.channel.readyState !== 'open') throw new Error('Le nouveau MJ doit être connecté.');
    const successor = this.state.members.find(member => member.id === target && member.role === 'player');
    if (!successor) throw new Error('Joueur indisponible.');
    const game = { ...this.game, messages: gameView(this.game, successor).messages, requests: [], hideRolls: false };
    const id = crypto.randomUUID();
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { this.pendingCommands.delete(id); reject(new Error('Le nouveau MJ ne confirme pas la sauvegarde.')); }, 15000);
      this.pendingCommands.set(id, { peerId: target, resolve, reject, timer });
      if (!peer.transport!.send({ kind: 'game-handoff', id, game })) { clearTimeout(timer); this.pendingCommands.delete(id); reject(new Error('Transfert impossible.')); }
    });
    await this.api('/transfer', { target });
    await this.refreshRoom();
  }
  async setRollVisibility(hidden: boolean) {
    if (this.state.session?.role !== 'mj') throw new Error('Action réservée au MJ.');
    this.game = { ...this.game, hideRolls: hidden }; this.publishGame();
  }
  async requestRoll(target: string, label: string, attributes: RoomRollRequest['attributes'], die: RoomRollRequest['die']) {
    const session = this.state.session;
    if (session?.role !== 'mj') throw new Error('Action réservée au MJ.');
    const targets = this.state.members.filter(member => member.role === 'player' && (target === 'all' || member.id === target));
    if (!targets.length || targets.some(member => !this.state.connected.includes(member.id))) throw new Error('Les destinataires doivent être connectés.');
    if (this.game.requests.length + targets.length > 100) throw new Error('Trop de demandes en attente.');
    const requests = targets.map(member => rollRequestSchema.parse({ id: crypto.randomUUID(), requester: session.id, target: member.id, label, attributes, die, created: Date.now() }));
    this.game = { ...this.game, requests: [...this.game.requests, ...requests] }; this.publishGame();
  }
  private async tick(generation: number) {
    if (this.stopped || generation !== this.generation) return;
    try {
      const poll = await this.api<RoomPoll>("/poll", { since: this.since, instance: this.instance });
      if (this.stopped || generation !== this.generation) return;
      if (!this.applyRoomPoll(poll)) { if (!this.stopped && generation === this.generation) this.timer = setTimeout(() => void this.tick(generation), 3000); return; }
      for (const [id, peer] of this.peers) {
        const member = poll.members.find(m => m.id === id);
        if (!member?.online || member.instance !== peer.instance || (peer.transport?.channel.readyState !== "open" && Date.now() - peer.started > 30000)) this.closePeer(id);
      }
      if (this.state.session?.role === 'mj') {
        for (const [id, peer] of this.peers) this.sendAssignment(id, peer);
        for (const id of this.assignments.keys()) if (!poll.members.some(member => member.id === id)) this.assignments.delete(id);
      }
      for (const signal of poll.signals) {
        try { await this.signal(signal, generation); }
        catch { if (generation === this.generation) this.closePeer(signal.sender); }
        if (generation !== this.generation) return;
        this.since = Math.max(this.since, signal.seq);
      }
      if (this.state.session?.role === "player") {
        const mj = poll.members.find(m => m.role === "mj" && m.online);
        if (mj && !this.peers.has(mj.id)) await this.offer(mj, generation);
        if (generation !== this.generation) return;
        for (const peer of this.peers.values()) await this.sendSheet(peer);
      }
    } catch (error) {
      if (generation !== this.generation) return;
      if ((error as { status?: number }).status === 401) {
        const expelled = error instanceof Error && error.message.includes('expulsé');
        const notice = expelled ? 'Tu as été expulsé de la salle par le MJ.' : 'La salle a été fermée ou a expiré.';
        this.forget(); this.update({ exitNotice: notice });
        toast.info(localizeText(notice), { duration: 10000 }); return;
      }
      this.update({ error: error instanceof Error ? error.message : "Connexion interrompue. Nouvelle tentative en cours.", syncing: false });
    }
    if (!this.stopped && generation === this.generation) this.timer = setTimeout(() => void this.tick(generation), 3000);
  }
  private async sendSheet(peer: Peer) {
    const session = this.state.session;
    if (session?.role !== "player" || peer.transport?.channel.readyState !== "open") return;
    try {
      const character = session.characterId ? await getCharacter(session.characterId) : undefined;
      if (this.state.session !== session) return;
      const parsed = character ? roomCharacterSchema.safeParse({ ...character, portrait: character.portrait || undefined }) : null;
      if (parsed && !parsed.success) { this.update({ error: "Cette fiche contient un champ ou un portrait trop volumineux pour le partage." }); return; }
      const message: RoomMessage = { kind: "sheet", character: parsed?.success ? parsed.data : null };
      const json = JSON.stringify(message);
      if (json !== peer.sheet) {
        if (peer.transport.send(message)) peer.sheet = json;
        else this.update({ error: "La fiche n’a pas pu être transmise. Réduis la taille de son portrait." });
      }
      if (character && parsed?.success && character.linkedResources.length) {
        const { loadLinkedBundledResources } = await import('./resourceBundle');
        const resources = await loadLinkedBundledResources(character);
        if (this.state.session !== session || peer.transport?.channel.readyState !== 'open') return;
        peer.resources ??= new Map();
        for (const resource of resources) {
          const message: RoomMessage = { kind: 'sheet-resource', characterId: character.id, resource: transferableRoomResource(resource) };
          const key = character.id + ':' + resource.type + ':' + resource.item.id;
          const json = JSON.stringify(message);
          if (peer.resources.get(key) !== json) { if (peer.transport.send(message)) peer.resources.set(key, json); break; }
        }
      }
    } catch { this.update({ error: "Impossible de lire la fiche enregistrée sur cet appareil." }); }
  }
  private receive(sender: string, message: RoomMessage) {
    const session = this.state.session;
    if (!session) return;
    const source = this.state.members.find(value => value.id === sender);
    if (!source) return;
    if (message.kind === 'hero-select') {
      if (session.role !== 'mj' || source.role !== 'player') return;
      this.resourceQueue = this.resourceQueue.then(async () => {
        try { await this.assignCharacter(sender, message.characterId); this.peers.get(sender)?.transport?.send({ kind: 'game-result', id: message.id }); }
        catch (cause) { this.peers.get(sender)?.transport?.send({ kind: 'game-result', id: message.id, error: cause instanceof Error ? cause.message.slice(0, 250) : 'Choix impossible.' }); }
      });
      return;
    }
    if (message.kind === 'hero-proposal') {
      if (session.role !== 'mj' || source.role !== 'player') return;
      if (this.state.heroProposals.some(proposal => proposal.id === message.id)) return;
      this.update({ heroProposals: [...this.state.heroProposals.filter(value => value.playerId !== sender), { ...message, playerId: sender }] });
      return;
    }
    if (message.kind === 'hero-proposal-result') {
      if (session.role !== 'player' || source.role !== 'mj' || this.state.pendingHeroProposal !== message.id) return;
      this.update({ pendingHeroProposal: undefined });
      this.proposal = undefined;
      toast.info(localizeText(message.accepted ? 'Le MJ a accepté ton héros.' : 'Le MJ a refusé le changement de héros.'));
      return;
    }
    if (message.kind === 'game-handoff' && session.role === 'player' && source.role === 'mj') {
      const record: RoomArchive = { format: 'clapSalle', version: 1, id: crypto.randomUUID(), title: this.state.roomInfo?.title || 'Salle de jeu', owlbearUrl: this.state.owlbearUrl, hostId: session.id, hostName: session.name, updatedAt: Date.now(), game: message.game, privateRefs: [], heroes: [], resources: [], sheets: {}, sheetResources: {} };
      void saveLocalRoom(record).then(() => {
        if (this.state.session?.id !== session.id) return;
        this.handoff = record;
        this.peers.get(sender)?.transport?.send({ kind: 'game-handoff-ready', id: message.id });
      }).catch(() => this.update({ error: 'Impossible de sauvegarder la salle transmise sur cet appareil.' }));
      return;
    }
    if (message.kind === 'game-handoff-ready' || message.kind === 'game-result') {
      if (message.kind === 'game-result' && source.role !== 'mj') return;
      const pending = this.pendingCommands.get(message.id);
      if (pending?.peerId === sender) {
        clearTimeout(pending.timer); this.pendingCommands.delete(message.id);
        if (message.kind === 'game-result' && message.error) pending.reject(new Error(message.error)); else pending.resolve();
      }
      return;
    }
    if (message.kind === 'game-state') {
      if (session.role === 'player' && source.role === 'mj') {
        this.update({ availableHeroes: (message.roomHeroes || []) as Snapshot["availableHeroes"] });
        if (message.heroes) this.publicHeroes = new Map(message.heroes.map(hero => [hero.id, { heroName: hero.heroName, heroConcept: hero.heroConcept }]));
        this.update({ owlbearUrl: message.owlbearUrl, messages: message.messages, requests: message.requests.filter(request => !this.resolvedRequests.has(request.id)),
          members: this.state.members.map(member => ({ ...member, ...this.publicHeroes.get(member.id) })) });
      }
      return;
    }
    if (message.kind === 'game-command') {
      if (session.role !== 'mj' || source.role !== 'player') return;
      let error: string | undefined;
      try {
        const now = Date.now(); const limit = this.commandLimits.get(sender);
        const next = limit && limit.reset > now ? { ...limit, count: limit.count + 1 } : { count: 1, reset: now + 60000 };
        this.commandLimits.set(sender, next);
        if (next.count > 60) throw new Error('Trop de messages. Réessaie dans une minute.');
        this.game = applyGameCommand(this.game, message.command, source, this.state.members);
        this.publishGame();
      } catch (cause) { error = cause instanceof Error ? cause.message.slice(0, 250) : 'Action impossible.'; }
      if (error) this.peers.get(sender)?.transport?.send({ kind: 'game-result', id: message.command.id, error });
      else void this.persistence.then(() => this.peers.get(sender)?.transport?.send({ kind: 'game-result', id: message.command.id })).catch(() => this.peers.get(sender)?.transport?.send({ kind: 'game-result', id: message.command.id, error: 'Sauvegarde locale du MJ impossible.' }));
      return;
    }
    if (message.kind === 'hero-action') { this.resourceQueue = this.resourceQueue.then(() => this.receiveHeroAction(sender, message)).catch(() => {}); return; }
    if (message.kind === 'link-resource') { this.resourceQueue = this.resourceQueue.then(() => this.receiveLinkedResource(sender, message)).catch(() => {}); return; }
    if (message.kind === 'resource-linked') {
      const operation = this.resourceOperations.get(message.operationId);
      if (operation?.playerId === sender && session.role === 'mj') { clearTimeout(operation.timer); this.resourceOperations.delete(message.operationId); if (message.error) operation.reject(new Error(message.error)); else operation.resolve(); }
      return;
    }
    if (message.kind === 'sheet-resource') {
      const hero = this.state.sheets[sender];
      if (session.role !== 'mj' || hero?.id !== message.characterId || !hero.linkedResources.some(link => link.id === message.resource.item.id && link.type === message.resource.type)) return;
      const resources = this.state.sheetResources[sender] || [];
      if (this.archive) this.archive = { ...this.archive, resources: [...this.archive.resources.filter(resource => resource.type !== message.resource.type || resource.item.id !== message.resource.item.id), message.resource] };
      this.update({ sheetResources: { ...this.state.sheetResources, [sender]: [...resources.filter(resource => resource.type !== message.resource.type || resource.item.id !== message.resource.item.id), message.resource as BundledResource] } }); this.persist(); return;
    }
    if (message.kind === 'assign-sheet') { void this.receiveAssignment(sender, message); return; }
    if (message.kind === 'assigned-sheet') {
      if (session.role === 'mj' && this.assignments.get(sender)?.assignmentId === message.assignmentId) this.assignments.delete(sender);
      return;
    }
    if (message.kind === "sheet") {
      if (session.role !== "mj") return;
      const approved = this.approvedSheetIds.get(sender) || this.state.sheets[sender]?.id || this.archive?.sheets[sender]?.id;
      if (message.character && message.character.id !== approved) return;
      if (!message.character && approved) return;
      const sheets = { ...this.state.sheets };
      if (message.character) sheets[sender] = message.character as Character;
      else delete sheets[sender];
      const resources = this.state.sheets[sender]?.id === message.character?.id ? (this.state.sheetResources[sender] || []).filter(resource => message.character?.linkedResources.some(link => link.id === resource.item.id && link.type === resource.type)) : [];
      if (message.character && this.archive) {
        const current = this.archive.heroes.find(hero => hero.id === message.character!.id);
        const hero = { ...message.character, directoryId: current?.directoryId || message.character.directoryId };
        this.archive = { ...this.archive, heroes: [...this.archive.heroes.filter(value => value.id !== hero.id), hero] };
      }
      this.update({ sheets, sheetResources: { ...this.state.sheetResources, [sender]: resources } }); this.publishGame(); return;
    }
    if (message.kind !== 'roll') return;
    const roll = { ...message, sender: session.role === "mj" ? sender : message.sender };
    if (this.seenRolls.has(roll.id) || roll.sender === session.id) return;
    this.seenRolls.add(roll.id);
    if (this.seenRolls.size > 200) this.seenRolls.delete(this.seenRolls.values().next().value!);
    const member = this.state.members.find(m => m.id === roll.sender);
    if (!member) return;
    toast(localizeText(`${member.name} — ${roll.label}`), { description: roll.summary, duration: 6500 });
    if (session.role === "mj") this.peers.forEach((peer, id) => { if (id !== sender) peer.transport?.send(roll); });
  }
  async broadcastRoll(label: string, summary: string, options: { id?: string; requestId?: string; public?: boolean } = {}) {
    await this.command({ type: 'roll', id: options.id || crypto.randomUUID(), label, summary, ...(options.requestId ? { requestId: options.requestId } : {}), ...(options.public ? { public: true } : {}) });
    if (options.requestId) this.resolvedRequests.add(options.requestId);
  }
}

export const roomClient = sharedRoomClient(() => new RoomClient());
