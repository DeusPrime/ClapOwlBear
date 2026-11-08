import type { ProjectArtwork } from "./clapProject";
import { bookImageKey, cachedBookImage } from "./bookStyledImage";
import { createClapStyleBlob } from "./clapImageStyle";
import { blobDataUrl } from "./imageEditing";

export async function prepareA4Image(image: Pick<ProjectArtwork, "source" | "style" | "styledImage" | "kind">) {
  if (!image.style || image.kind === "text") return image.source;
  const cached = cachedBookImage(image, image.style);
  if (cached) return cached;
  const source = await blobDataUrl(await createClapStyleBlob(image.source, image.style));
  image.styledImage = { source, strength: image.style, originalKey: bookImageKey(image.source) };
  return source;
}
