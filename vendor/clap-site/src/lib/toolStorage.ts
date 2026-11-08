import type { ToolDocument } from "./toolDocuments";

// Keep every original, styled render and preview, but store image bytes rather
// than their larger base64 text representation. Identical sources share a Blob.
export type StoredToolDocument = Omit<ToolDocument, "data" | "preview"> & {
  data: unknown; preview?: unknown;
  imageStorage?: { version: 1; assets: Blob[] };
};
export function packToolDocument(document: ToolDocument): StoredToolDocument {
  const assets: Blob[] = [], references = new Map<string, { __clapImageAsset: number }>();
  function pack(value: unknown): unknown {
    if (typeof value === "string" && /^data:image\/(png|jpeg|webp|gif);base64,/.test(value)) {
      const existing = references.get(value); if (existing) return existing;
      const comma = value.indexOf(","), binary = atob(value.slice(comma + 1));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const reference = { __clapImageAsset: assets.length };
      assets.push(new Blob([bytes], { type: value.slice(5, value.indexOf(";")) }));
      references.set(value, reference); return reference;
    }
    if (Array.isArray(value)) return value.map(pack);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, pack(entry)]));
    return value;
  }
  const stored: StoredToolDocument = { ...document, data: pack(document.data), ...("preview" in document ? { preview: pack(document.preview) } : {}) };
  stored.imageStorage = { version: 1, assets };
  return stored;
}

export async function unpackToolDocument(stored: StoredToolDocument | ToolDocument): Promise<ToolDocument> {
  if (!("imageStorage" in stored) || stored.imageStorage?.version !== 1) return stored as ToolDocument;
  const references = new Map<number, string>();
  await Promise.all(stored.imageStorage.assets.map((blob, index) => new Promise<void>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { references.set(index, String(reader.result)); resolve(); };
    reader.onerror = () => reject(new Error("Lecture d’une image du projet impossible."));
    reader.readAsDataURL(blob);
  })));
  function unpack(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(unpack);
    if (value && typeof value === "object") {
      if (Object.keys(value).length === 1 && "__clapImageAsset" in value && typeof value.__clapImageAsset === "number") {
        const source = references.get(value.__clapImageAsset);
        if (!source) throw new Error("Une image du projet est manquante.");
        return source;
      }
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, unpack(entry)]));
    }
    return value;
  }
  const { imageStorage: _, ...document } = stored;
  return { ...document, data: unpack(document.data), ...("preview" in document ? { preview: unpack(document.preview) } : {}) } as ToolDocument;
}
