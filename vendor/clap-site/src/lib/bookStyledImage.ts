import type { ProjectArtwork } from "./clapProject";
import { createClapStyleBlob } from "./clapImageStyle";
import { blobDataUrl } from "./imageEditing";

export function bookImageKey(source: string) {
  let hash = 2166136261;
  for (let index = 0; index < source.length; index++) hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
  return `${source.length}:${hash >>> 0}`;
}
export function cachedBookImage(image: Pick<ProjectArtwork, "source" | "styledImage">, strength: number) {
  const cache = image.styledImage;
  return cache?.strength === strength && cache.originalKey === bookImageKey(image.source) ? cache.source : undefined;
}
export async function prepareBookImage(image: Pick<ProjectArtwork, "source" | "styledImage">, strength: number) {
  if (!strength) return image.source;
  const cached = cachedBookImage(image, strength);
  if (cached) return cached;
  const source = await blobDataUrl(await createClapStyleBlob(image.source, strength, undefined, 1200));
  image.styledImage = { source, strength, originalKey: bookImageKey(image.source) };
  return source;
}
