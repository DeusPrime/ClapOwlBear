import { imageEditingSchema, rasterImageSchema } from "./dataValidation";
import type { ImageEditing } from "./imageEditing";
import type { ResourceKind } from "./dataValidation";
import { DEFAULT_RESOURCE_BACK_IMAGES } from "./resourceAppearance";
export const DEFAULT_DIRECTORY = "general";
export const DIRECTORY_BACK_CHANGED = "clap-directory-back-changed";
export type Directory = { id: string; name: string; roomKey?: string; posterImage?: string; posterEditing?: ImageEditing; backImage?: string; backImages?: Partial<Record<ResourceKind, string>>; backImageEditings?: Partial<Record<ResourceKind, ImageEditing>>; backFilmTitle?: string };
export const DIRECTORY_POSTER_CHANGED = 'clap-directory-poster-changed';
export function updateDirectoryPoster(id: string, posterImage?: string, posterEditing?: ImageEditing) {
  const directories = loadDirectories();
  if (!directories.some(item => item.id === id)) throw new Error('Projet introuvable.');
  if (posterImage && !rasterImageSchema.safeParse(posterImage).success) throw new Error('Image d’affiche invalide.');
  if (posterEditing && !imageEditingSchema.safeParse(posterEditing).success) throw new Error('Réglages de l’affiche invalides.');
  try { localStorage.setItem(KEY, JSON.stringify(directories.map(item => item.id === id ? { ...item, posterImage, posterEditing: posterImage ? posterEditing : undefined } : item))); }
  catch { throw new Error('Espace de stockage insuffisant. Choisis une image moins volumineuse.'); }
  window.dispatchEvent(new Event(DIRECTORY_POSTER_CHANGED));
}
export function resourceBackImage(directory: Directory | undefined, type: ResourceKind) {
  return directory?.backImages?.[type] || directory?.backImage || DEFAULT_RESOURCE_BACK_IMAGES[type];
}
const KEY = "clap-directories";
const ACTIVE = "clap-active-directory";
let cachedSource: string | null | undefined;
let cachedDirectories: Directory[] = [];
export function loadDirectories(): Directory[] {
  const source = localStorage.getItem(KEY);
  // Posters and card backgrounds make this JSON large. Read storage for freshness
  // across tabs, but only parse it again when its contents actually change.
  if (source !== cachedSource) {
    const saved = JSON.parse(source || "[]") as Directory[];
    cachedDirectories = saved.length ? saved : [{ id: DEFAULT_DIRECTORY, name: "Général" }];
    cachedSource = source;
  }
  return cachedDirectories;
}
export function activeDirectory() {
  const selected = localStorage.getItem(ACTIVE);
  const directories = loadDirectories();
  return directories.some(item => item.id === selected) ? selected! : directories[0].id;
}
export const DIRECTORY_SELECTED = 'clap-directory-selected';
export function selectDirectory(id: string) { localStorage.setItem(ACTIVE, id); window.dispatchEvent(new Event(DIRECTORY_SELECTED)); }
export function directoryName(id: string) { return loadDirectories().find(item => item.id === id)?.name || "Projet importé"; }
export function isProtectedDirectory(id: string) {
  return id === DEFAULT_DIRECTORY || loadDirectories().some(item => item.id === id && item.name.trim().toLocaleLowerCase("fr") === "général");
}
export function createDirectory(name: string, options?: { roomKey: string }) {
  const normalized = validateDirectoryName(name);
  const directories = loadDirectories();
  const directory = { id: crypto.randomUUID(), name: normalized, ...(options ? { roomKey: options.roomKey } : {}) };
  localStorage.setItem(KEY, JSON.stringify([...directories, directory]));
  return directory;
}
function validateDirectoryName(name: string, exceptId?: string) {
  const normalized = name.trim().replace(/\s+/g, " ");
  if (normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr") === "general") throw new Error("Le nom Général est réservé au projet par défaut.");
  if (!normalized || normalized.length > 80 || Array.from(normalized).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) throw new Error("Le nom doit contenir entre 1 et 80 caractères.");
  const directories = loadDirectories();
  if (directories.some(item => item.id !== exceptId && item.name.toLocaleLowerCase("fr") === normalized.toLocaleLowerCase("fr"))) throw new Error("Ce projet existe déjà.");
  return normalized;
}
export function renameDirectory(id: string, name: string) {
  if (isProtectedDirectory(id)) throw new Error("Le projet Général ne peut pas être renommé.");
  const directories = loadDirectories();
  if (!directories.some(item => item.id === id)) throw new Error("Projet introuvable.");
  const normalized = validateDirectoryName(name, id);
  localStorage.setItem(KEY, JSON.stringify(directories.map(item => item.id === id ? { ...item, name: normalized } : item)));
}
export function updateDirectoryBack(id: string, settings: Pick<Directory, "backImage" | "backImages" | "backImageEditings" | "backFilmTitle">) {
  const directories = loadDirectories();
  if (!directories.some(item => item.id === id)) throw new Error("Projet introuvable.");
  const backFilmTitle = (settings.backFilmTitle ?? "").trim().replace(/\s+/g, " ");
  if (backFilmTitle.length > 120) throw new Error("Le titre du film doit contenir au maximum 120 caractères.");
  if (settings.backImage && !rasterImageSchema.safeParse(settings.backImage).success) throw new Error("Fond de carte invalide.");
  const backImages: Partial<Record<ResourceKind, string>> = {};
  const backImageEditings: Partial<Record<ResourceKind, ImageEditing>> = {};
  for (const [type, editing] of Object.entries(settings.backImageEditings ?? {})) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_RESOURCE_BACK_IMAGES, type) || !imageEditingSchema.safeParse(editing).success) throw new Error("Réglages du dos de carte invalides.");
    if (settings.backImages?.[type as ResourceKind]) backImageEditings[type as ResourceKind] = imageEditingSchema.parse(editing) as ImageEditing;
  }
  if (settings.backImages) {
    for (const [type, source] of Object.entries(settings.backImages)) {
      if (!Object.prototype.hasOwnProperty.call(DEFAULT_RESOURCE_BACK_IMAGES, type) || !rasterImageSchema.safeParse(source).success) throw new Error("Fond de carte invalide.");
      backImages[type as ResourceKind] = source;
    }
  }
  const next = directories.map(item => item.id === id ? {
    ...item, backFilmTitle, backImage: settings.backImage || undefined,
    ...(settings.backImages !== undefined ? { backImages } : {}),
    ...(settings.backImages !== undefined || settings.backImageEditings !== undefined ? { backImageEditings } : {}),
  } : item);
  try { localStorage.setItem(KEY, JSON.stringify(next)); }
  catch { throw new Error("Espace de stockage insuffisant. Choisis une image de fond moins volumineuse."); }
  window.dispatchEvent(new Event(DIRECTORY_BACK_CHANGED));
}
// Called only after its heroes and resources have been deleted successfully.
export function removeDirectory(id: string) {
  if (isProtectedDirectory(id)) throw new Error("Le projet Général ne peut pas être supprimé.");
  const remaining = loadDirectories().filter(item => item.id !== id);
  if (!remaining.length) remaining.push({ id: DEFAULT_DIRECTORY, name: "Général" });
  localStorage.setItem(KEY, JSON.stringify(remaining));
  if (localStorage.getItem(ACTIVE) === id) selectDirectory(remaining[0].id);
  return remaining[0].id;
}
export function moveToDirectory<T extends { directoryId: string }>(items: readonly T[], directoryId: string): T[] {
  return items.map(item => ({ ...item, directoryId, updatedAt: Date.now() }));
}
