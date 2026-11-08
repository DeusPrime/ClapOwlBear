import JSZip from 'jszip';
import { z } from 'zod/v3';
import { rasterImageSchema, imageEditingSchema } from './dataValidation';
import type { ImageEditing } from './imageEditing';
import { localGameSchema } from './localRoomGame';
import { roomCharacterSchema, roomResourceSchema } from './roomProtocol';
import { openListDatabase } from './listDatabase';
import { activeDirectory } from './directories';
import { upsertCharacter, type Character } from './characters';
import { loadAllBundledResources, upsertBundledResource, type BundledResource } from './resourceBundle';

export const privateRefSchema = z.object({ type: z.enum(['hero', 'key-role', 'figurant', 'profile', 'power', 'vehicle']), id: z.string().min(1).max(100), count: z.number().int().nonnegative().optional() });
export type PrivateRoomRef = { type: 'hero' | 'key-role' | 'figurant' | 'profile' | 'power' | 'vehicle'; id: string; count?: number };
export const roomArchiveSchema = z.object({
  format: z.literal('clapSalle'), version: z.literal(1), id: z.string().uuid(), title: z.string().trim().min(1).max(80),
  updatedAt: z.number().finite().nonnegative(), hostId: z.string().max(100), hostName: z.string().max(40),
  posterImage: rasterImageSchema.optional(), posterEditing: imageEditingSchema.optional(),
  projectName: z.string().min(1).max(80).optional(),
  game: localGameSchema, privateRefs: z.array(privateRefSchema).max(500),
  heroes: z.array(roomCharacterSchema).max(100), resources: z.array(roomResourceSchema).max(500),
  heroSources: z.record(z.string().max(100), z.string().max(100)).optional(),
  players: z.record(z.string().max(100), z.object({ name: z.string().min(1).max(40) })).refine(value => Object.keys(value).length <= 200).optional(),
  sheets: z.record(z.string().max(100), roomCharacterSchema).refine(value => Object.keys(value).length <= 16),
  sheetResources: z.record(z.string().max(100), z.array(roomResourceSchema).max(200)).refine(value => Object.keys(value).length <= 16),
});
export type RoomArchive = Omit<z.infer<typeof roomArchiveSchema>, 'privateRefs'> & { privateRefs: PrivateRoomRef[] };
const MAX_BYTES = 64 * 1024 * 1024;
interface ZipStream {
  on(event: 'data', callback: (chunk: Uint8Array) => void): ZipStream;
  on(event: 'error', callback: (error: Error) => void): ZipStream;
  on(event: 'end', callback: () => void): ZipStream;
  pause(): void;
  resume(): void;
}
const database = () => openListDatabase('clap-local-rooms', 'rooms');
async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('rooms', mode);
    const request = action(tx.objectStore('rooms'));
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || new Error('Sauvegarde locale indisponible.')); };
  });
}
export const saveLocalRoom = async (room: RoomArchive) => { await transaction('readwrite', store => {
    const request = store.get(room.id);
    request.onsuccess = () => { const current = request.result as RoomArchive | undefined; store.put(current ? { ...room, posterImage: current.posterImage, posterEditing: current.posterEditing } : room); };
    return request;
  }); window.dispatchEvent(new Event('clap-local-rooms-changed')); };
export const loadLocalRoom = (id: string) => transaction<RoomArchive | undefined>('readonly', store => store.get(id));
export async function updateLocalRoomPoster(id: string, posterImage?: string, posterEditing?: ImageEditing) {
  if (posterImage) rasterImageSchema.parse(posterImage);
  if (posterEditing) imageEditingSchema.parse(posterEditing);
  await transaction('readwrite', store => {
    const request = store.get(id);
    request.onsuccess = () => {
      if (!request.result) { store.transaction.abort(); return; }
      store.put({ ...request.result, posterImage, posterEditing: posterImage ? posterEditing : undefined });
    };
    return request;
  });
  window.dispatchEvent(new Event('clap-local-rooms-changed'));
}
export const listLocalRooms = async () => (await transaction<RoomArchive[]>('readonly', store => store.getAll())).sort((a, b) => b.updatedAt - a.updatedAt);
export const deleteLocalRoom = async (id: string) => { await transaction('readwrite', store => store.delete(id)); window.dispatchEvent(new Event('clap-local-rooms-changed')); };
export async function exportRoomArchive(room: RoomArchive) {
  const value = roomArchiveSchema.parse(room);
  const json = JSON.stringify(value);
  if (new TextEncoder().encode(json).byteLength > MAX_BYTES) throw new Error('La salle dépasse la taille maximale de 64 Mo.');
  return new JSZip().file('salle.json', json).generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
export async function parseRoomArchive(file: File): Promise<RoomArchive> {
  if (file.size > MAX_BYTES) throw new Error('Le fichier .clapSalle dépasse 64 Mo.');
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entry = zip.file('salle.json');
    if (!entry) throw new Error();
    // Stream and bound decompression rather than trusting ZIP size metadata.
    const json = await new Promise<string>((resolve, reject) => {
      const chunks: Uint8Array[] = []; let size = 0;
      const stream = (entry as unknown as { internalStream(type: 'uint8array'): ZipStream }).internalStream('uint8array');
      stream.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_BYTES) { stream.pause(); reject(new Error('Salle trop volumineuse.')); return; }
        chunks.push(chunk);
      }).on('error', reject).on('end', () => {
        const bytes = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        resolve(new TextDecoder().decode(bytes));
      }).resume();
    });
    return roomArchiveSchema.parse(JSON.parse(json)) as RoomArchive;
  } catch { throw new Error('Fichier .clapSalle invalide, incompatible ou trop volumineux.'); }
}
export async function importRoomArchive(file: File) {
  const source = await parseRoomArchive(file);
  const directoryId = activeDirectory();
  const ids = new Map<string, string>();
  for (const resource of source.resources) ids.set(resource.type + ':' + resource.item.id, crypto.randomUUID());
  for (const resources of Object.values(source.sheetResources)) for (const resource of resources) {
    const key = resource.type + ':' + resource.item.id;
    if (!ids.has(key)) ids.set(key, crypto.randomUUID());
  }
  for (const hero of source.heroes) ids.set('hero:' + hero.id, crypto.randomUUID());
  const remapHero = (hero: RoomArchive['heroes'][number]) => ({ ...hero, id: ids.get('hero:' + hero.id) || hero.id, directoryId, linkedResources: hero.linkedResources.filter(link => ids.has(link.type + ':' + link.id)).map(link => ({ ...link, id: ids.get(link.type + ':' + link.id)! })) });
  const resources = source.resources.map(resource => ({ ...resource, item: { ...resource.item, id: ids.get(resource.type + ':' + resource.item.id)!, directoryId } })) as BundledResource[];
  const heroes = source.heroes.map(remapHero);
  // New identities ensure imports never overwrite the recipient's library.
  for (const resource of resources) await upsertBundledResource(resource);
  for (const hero of heroes) await upsertCharacter(hero as Character);
  const room: RoomArchive = { ...source, id: crypto.randomUUID(), updatedAt: Date.now(), resources: resources.map(resource => ({ ...resource, item: { ...resource.item, imageEditing: undefined } })) as RoomArchive['resources'], heroes,
    heroSources: source.heroSources && Object.fromEntries(Object.entries(source.heroSources).map(([id, target]) => [id, ids.get('hero:' + target) || target])),
    privateRefs: source.privateRefs.map(ref => ({ ...ref, id: ids.get(ref.type + ':' + ref.id) || ref.id })),
    sheets: Object.fromEntries(Object.entries(source.sheets).map(([id, hero]) => [id, remapHero(hero)])),
    sheetResources: Object.fromEntries(Object.entries(source.sheetResources).map(([id, values]) => [id, values.map(resource => ({ ...resource, item: { ...resource.item, id: ids.get(resource.type + ':' + resource.item.id)!, directoryId } }))])),
  };
  await saveLocalRoom(room);
  window.dispatchEvent(new Event('clap-room-character-assigned'));
  return room;
}
export async function captureRoomLibrary(room: RoomArchive): Promise<RoomArchive> {
  const { getCharacter } = await import('./characters');
  const heroes = (await Promise.all(room.privateRefs.filter(ref => ref.type === 'hero').map(async ref => {
    const saved = room.heroes.find(hero => hero.id === ref.id) as Character | undefined;
    const local = await getCharacter(ref.id);
    return saved && (!local || saved.updatedAt >= local.updatedAt) ? saved : local;
  }))).filter((hero): hero is Character => Boolean(hero));
  const current = await loadAllBundledResources();
  const resources = [...current, ...room.resources.filter(resource => !current.some(value => value.type === resource.type && value.item.id === resource.item.id))];
  const needed = new Set(room.privateRefs.filter(ref => ref.type !== 'hero').map(ref => ref.type + ':' + ref.id));
  for (const hero of heroes) for (const link of hero.linkedResources) needed.add(link.type + ':' + link.id);
  return roomArchiveSchema.parse({ ...room, heroes: heroes.map(hero => ({ ...hero, portrait: hero.portrait || undefined })), resources: resources.filter(resource => needed.has(resource.type + ':' + resource.item.id)).map(resource => ({ ...resource, item: { ...resource.item, image: resource.item.image || undefined, imageEditing: undefined } })) }) as RoomArchive;
}
