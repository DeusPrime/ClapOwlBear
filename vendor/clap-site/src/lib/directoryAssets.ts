import type { Directory } from './directories';

const KEY = 'clap-directories';
const fields = ['posterImage', 'posterEditing', 'backImage', 'backImages', 'backImageEditings'] as const;
type Appearance = Pick<Directory, typeof fields[number]>;
const cache = new Map<string, Appearance>();
let revision = 0;
let initializing: Promise<void> | undefined;
let channel: BroadcastChannel | undefined;
export const directoryAssetsRevision = () => revision;
export function directoryAppearance(directory: Directory): Directory {
  return { ...cache.get(directory.id), ...directory };
}
export function directoryMetadata(directories: Directory[]) {
  return directories.map(directory => {
    if (!cache.has(directory.id)) return directory; // Legacy images remain until their durable migration succeeds.
    const metadata = { ...directory };
    for (const field of fields) delete metadata[field];
    return metadata;
  });
}
function appearance(directory: Directory): Appearance {
  return Object.fromEntries(fields.map(field => [field, directory[field]]));
}
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('clap-project-assets', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('appearance', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function readAll() {
  const db = await database();
  return new Promise<Array<{ id: string; value: Appearance }>>((resolve, reject) => {
    const transaction = db.transaction('appearance', 'readonly');
    const request = transaction.objectStore('appearance').getAll();
    transaction.oncomplete = () => { db.close(); resolve(request.result); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };
  });
}
async function put(id: string, value: Appearance) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('appearance', 'readwrite');
    transaction.objectStore('appearance').put({ id, value });
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onabort = () => { db.close(); reject(transaction.error || new Error('Stockage des images indisponible.')); };
  });
  cache.set(id, value); revision++;
}
export function initializeDirectoryAssets(): Promise<void> {
  if (initializing) return initializing;
  initializing = (async () => {
    const records = await readAll();
    cache.clear();
    for (const record of records) cache.set(record.id, record.value);
    revision++;
    const source = localStorage.getItem(KEY);
    const directories = JSON.parse(source || '[]') as Directory[];
    let migrated = false;
    for (const directory of directories) if (fields.some(field => directory[field] !== undefined)) {
      await put(directory.id, appearance(directory)); migrated = true;
    }
    if (migrated) {
      // Never remove the only copy of an image before the IndexedDB transaction commits.
      const current = JSON.parse(localStorage.getItem(KEY) || '[]') as Directory[];
      localStorage.setItem(KEY, JSON.stringify(directoryMetadata(current)));
    }
    if (!channel && typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('clap-project-assets');
      channel.onmessage = () => { void initializeDirectoryAssets().then(() => window.dispatchEvent(new Event('focus'))).catch(() => {}); };
    }
  })().finally(() => { initializing = undefined; });
  return initializing;
}
export async function saveDirectoryAppearance(id: string, patch: Appearance) {
  await initializeDirectoryAssets();
  await put(id, { ...cache.get(id), ...patch });
  channel?.postMessage({ id });
}
export async function deleteDirectoryAppearance(id: string) {
  if (!cache.has(id)) return;
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('appearance', 'readwrite');
    transaction.objectStore('appearance').delete(id);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };
  });
  cache.delete(id); revision++; channel?.postMessage({ id });
}
