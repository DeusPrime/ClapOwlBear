import type { PokerBackOptions } from "./pokerCardBack";
import JSZip from "jszip";
import { renderPokerFrontPng, type ImageFit, type PokerImage } from "./pokerCardsPdf";
import { blobDataUrl, imagePngBlob } from "./imageEditing";
import { defaultImageTitle, imageTitle } from "./pokerCardTitle";
import { reportExportProgress } from "./exportProgress";

export function cardPngFileName(title: string, used: Set<string>) {
  const base = Array.from(title).map(char => char.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(char) ? "_" : char).join("").trim().replace(/[. ]+$/, "").slice(0, 120) || "carte";
  let name = `${base}.png`, index = 2;
  while (used.has(name.toLocaleLowerCase("fr"))) name = `${base}-${index++}.png`;
  used.add(name.toLocaleLowerCase("fr"));
  return name;
}

/** Each printed front, copies included, with the sheet rotation undone for readable standalone PNGs. */
export async function exportPokerFrontsZip(images: PokerImage[], fit: ImageFit, zoom = 1, showTitles = true, backDefaults: PokerBackOptions = {}): Promise<Blob> {
  const total = images.reduce((sum, image) => sum + image.copies, 0);
  if (!total) throw new Error("Ajoutez au moins une image.");
  const zip = new JSZip(), used = new Set<string>();
  let completed = 0;
  for (const image of images) {
    reportExportProgress(5 + completed / total * 75, `Rectos PNG ${completed + 1}/${total}`);
    const front = await renderPokerFrontPng(image, fit, zoom, showTitles, backDefaults);
    const rotation = (360 - image.rotation % 360) % 360;
    const upright = rotation ? await imagePngBlob(await blobDataUrl(front), rotation) : front;
    const bytes = await upright.arrayBuffer();
    const title = imageTitle(image).trim() || defaultImageTitle(image.name);
    for (let copy = 0; copy < image.copies; copy++) {
      zip.file(cardPngFileName(title, used), bytes);
      completed++;
    }
  }
  return zip.generateAsync({ type: "blob" }, metadata => reportExportProgress(80 + metadata.percent * .2, "Assemblage du ZIP des rectos…"));
}
