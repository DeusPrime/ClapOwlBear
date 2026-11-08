import type { BackgroundFocus } from "./backgroundFocus";
import { prepareBookImage, bookImageKey, cachedBookImage } from "./bookStyledImage";
import { prepareA4Image } from "./a4StyledImage";
import type { ProjectInput } from "./clapProject";
import { blobDataUrl } from "./imageEditing";
import { packToolDocument, unpackToolDocument, type StoredToolDocument } from "./toolStorage";

export type ToolKind = "a4-sheets" | "book-background" | "image-conversion";
export type ConversionArtwork = { id: string; source: string; name: string; width: number; height: number };
export type ToolPayload = ProjectInput | { tool: "image-conversion"; settings: { style: number; rotation: number; focus?: BackgroundFocus }; images: ConversionArtwork[] };
export type ToolDocument = { id: string; directoryId: string; name: string; kind: ToolKind; updatedAt: number; data: ToolPayload | null; preview?: string | null };
export const TOOL_TYPES = [
  { kind: "a4-sheets" as const, label: "Planche A4", path: "/outils/cartes-poker" },
  { kind: "book-background" as const, label: "Couverture / fond de livre", path: "/outils/fonds-livre" },
  { kind: "image-conversion" as const, label: "Conversion d’images", path: "/outils/conversion-image" },
];
export function toolUrl(tool: Pick<ToolDocument, "id" | "kind">) {
  return `${TOOL_TYPES.find(type => type.kind === tool.kind)!.path}?outil=${encodeURIComponent(tool.id)}`;
}
export function emptyToolPayload(kind: ToolKind): ToolPayload {
  if (kind === "a4-sheets") return { tool: kind, settings: { fit: "cover", zoom: 1, marks: true, showTitles: true }, images: [] };
  if (kind === "book-background") return { tool: kind, settings: { strength: 40, side: "left", tone: "light" }, images: [] };
  return { tool: kind, settings: { style: 40, rotation: 0 }, images: [] };
}

async function storeRequest<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("clap-tools-db", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("tools", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction("tools", mode);
    const request = action(transaction.objectStore("tools"));
    transaction.oncomplete = () => { db.close(); resolve(request.result); };
    transaction.onabort = transaction.onerror = () => { db.close(); reject(transaction.error ?? request.error ?? new Error("Stockage des ressources indisponible.")); };
  });
}
export const loadToolDocuments = async () => Promise.all((await storeRequest<StoredToolDocument[]>("readonly", store => store.getAll())).map(unpackToolDocument));
export const getToolDocument = async (id: string) => {
  const stored = await storeRequest<StoredToolDocument | undefined>("readonly", store => store.get(id));
  return stored ? unpackToolDocument(stored) : undefined;
};
export const deleteToolDocument = (id: string) => storeRequest("readwrite", store => store.delete(id));
// Backfill old records atomically, without overwriting a newer edit or recreating a deleted tool.
export async function persistToolPreview(id: string, updatedAt: number, preview: string | null) {
  await storeRequest("readwrite", store => {
    const request = store.get(id);
    request.onsuccess = () => {
      const current = request.result as StoredToolDocument | undefined;
      if (current && current.updatedAt === updatedAt && current.preview === undefined) store.put({ ...current, preview });
    };
    return request;
  });
}

async function portableImage(source: string): Promise<string> {
  if (/^data:image\/(png|jpeg|webp|gif);base64,/.test(source)) return source;
  if (!source.startsWith("blob:")) throw new Error("Source d’image invalide.");
  const response = await fetch(source);
  if (!response.ok) throw new Error("Impossible de conserver une image de la ressource.");
  return blobDataUrl(await response.blob());
}
// Resolve temporary object URLs before persisting: all sources remain usable after closing the editor.
export async function portableToolPayload(data: ToolPayload): Promise<ToolPayload> {
  const copy = structuredClone(data);
  for (const image of copy.images) {
    const strength = copy.tool === "book-background" ? copy.settings.strength : copy.tool === "a4-sheets" && "style" in image ? image.style : 0;
    const cached = strength && "styledImage" in image ? cachedBookImage(image, strength) : undefined;
    image.source = await portableImage(image.source);
    if (cached && "styledImage" in image) image.styledImage = { source: await portableImage(cached), strength, originalKey: bookImageKey(image.source) };
    else Reflect.deleteProperty(image, "styledImage");
    if ("frontImage" in image && image.frontImage) image.frontImage = await portableImage(image.frontImage);
    if ("backImage" in image && image.backImage) image.backImage = await portableImage(image.backImage);
    // Only the validated portable cache survives; temporary editor URLs do not.
    for (const key of ["url", "styledUrl", "styledStrength"]) Reflect.deleteProperty(image, key);
  }
  if (copy.tool === "a4-sheets" && copy.settings.backImage) copy.settings.backImage = await portableImage(copy.settings.backImage);
  return copy;
}
export async function saveToolDocument(document: ToolDocument) {
  if (!document.name.trim() || document.name.length > 120) throw new Error("Le nom doit contenir entre 1 et 120 caractères.");
  if (document.data && document.data.tool !== document.kind) throw new Error("Le type de la ressource ne correspond pas à ses données.");
  const saved: ToolDocument = { ...document, name: document.name.trim(), data: document.data ? await portableToolPayload(document.data) : null };
  if (saved.data?.tool === "book-background") {
    for (const image of saved.data.images) await prepareBookImage(image, saved.data.settings.strength);
  }
  if (saved.data?.tool === "a4-sheets") {
    for (const image of saved.data.images) await prepareA4Image(image);
  }
  if (saved.preview === undefined) {
    if (!saved.data?.images.length) saved.preview = null;
    else {
      try { saved.preview = await (await import("./toolOutput")).renderToolPreview(saved); }
      catch { /* Preserve the edited data even if the optional snapshot cannot be generated. */ }
    }
  }
  const packed = packToolDocument(saved);
  await storeRequest("readwrite", store => store.put(packed));
  return saved;
}
