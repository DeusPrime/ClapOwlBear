import { textCardArtwork } from "./pokerTextCard";
import type { TextCardFields } from "./pokerTextCard";
import { PDFDocument, rgb, type PDFImage, type PDFPage } from "pdf-lib";
import { drawCardTitle, imageTitle, titleFont, type TitleFont } from "./pokerCardTitle";
import { renderPokerBackPng, resolvePokerBack, type PokerBackOptions } from "./pokerCardBack";
import { beginPokerCard, finishPokerCard } from "./pokerCardFrame";
import { mirroredSheetSlot } from "./duplexLayout";
import { reportExportProgress } from "./exportProgress";
export type PokerImage = PokerBackOptions & TextCardFields & { id: string; name: string; url: string; copies: number; width: number; height: number; rotation: number; style?: number; styledUrl?: string; styledStrength?: number; title?: string; titleFont?: TitleFont; showTitle?: boolean; crop?: { x: number; y: number; zoom: number } };
export type ImageFit = "contain" | "cover" | "width" | "height";
export function automaticRotation(width: number, height: number) {
  const target = 63 / 88;
  return Math.abs(Math.log(height / width / target)) < Math.abs(Math.log(width / height / target)) ? 90 : 0;
}
export function rotatedImagePlacement(width: number, height: number, fit: ImageFit, rotation: number, zoom = 1) {
  const sideways = rotation % 180 !== 0;
  const p = imagePlacement(sideways ? height : width, sideways ? width : height, fit);
  return { width: (sideways ? p.height : p.width) * zoom, height: (sideways ? p.width : p.height) * zoom };
}
export function croppedImagePlacement(width: number, height: number, fit: ImageFit, rotation: number, zoom = 1, crop = { x: 0.5, y: 0.5, zoom: 1 }) {
  const p = rotatedImagePlacement(width, height, fit, rotation, zoom * crop.zoom);
  const sideways = rotation % 180 !== 0;
  const dx = (63 - (sideways ? p.height : p.width)) * (crop.x - 0.5);
  const dy = (88 - (sideways ? p.width : p.height)) * (crop.y - 0.5);
  const angle = rotation * Math.PI / 180;
  return { ...p, x: dx * Math.cos(angle) + dy * Math.sin(angle), y: -dx * Math.sin(angle) + dy * Math.cos(angle) };
}
export function imagePlacement(width: number, height: number, fit: ImageFit) {
  const scale = fit === "width" ? 63 / width : fit === "height" ? 88 / height : (fit === "cover" ? Math.max : Math.min)(63 / width, 88 / height);
  return { width: width * scale, height: height * scale, x: (63 - width * scale) / 2, y: (88 - height * scale) / 2 };
}
export async function renderPokerFrontPng(source: PokerImage, fit: ImageFit, zoom = 1, showTitles = true, backDefaults: PokerBackOptions = {}): Promise<Blob> {
  await document.fonts?.ready;
  if (showTitles && source.showTitle !== false && imageTitle(source).trim()) {
    const font = titleFont(source.titleFont);
    await document.fonts?.load(`${font.weight} 16px ${font.family}`, imageTitle(source));
  }
  if (source.style && (!source.styledUrl || source.styledStrength !== source.style)) throw new Error("Attendez la fin de la stylisation avant d’exporter.");
  const artwork = source.kind === "text" ? await textCardArtwork(source, backDefaults) : source.style ? source.styledUrl! : source.url;
  const image = await new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error(`Impossible de lire ${source.name}`)); img.src = artwork; });
  const canvas = document.createElement("canvas");
  canvas.width = 744; canvas.height = 1039;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Conversion indisponible dans ce navigateur.");
  const p = croppedImagePlacement(image.naturalWidth, image.naturalHeight, source.kind === "text" ? "contain" : fit, source.rotation, source.kind === "text" ? 1 : fit === "cover" ? zoom : 1, source.kind === "text" ? undefined : source.crop);
  ctx.scale(canvas.width / 63, canvas.height / 88);
  beginPokerCard(ctx);
  ctx.save();
  ctx.translate(63 / 2, 88 / 2);
  ctx.rotate(source.rotation * Math.PI / 180);
  ctx.drawImage(image, p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
  if (showTitles && source.showTitle !== false) drawCardTitle(ctx, source.rotation, imageTitle(source), source.titleFont);
  ctx.restore();
  finishPokerCard(ctx);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Conversion impossible.")), "image/png"));
  return blob;
}
export async function exportPokerPdf(images: PokerImage[], fit: ImageFit, marks: boolean, zoom = 1, showTitles = true, backDefaults: PokerBackOptions = {}, { includeBacks = true }: { includeBacks?: boolean } = {}) {
  await document.fonts?.ready;
  for (const image of images) if (showTitles && image.showTitle !== false && imageTitle(image).trim()) {
    const font = titleFont(image.titleFont);
    await document.fonts?.load(`${font.weight} 16px ${font.family}`, imageTitle(image));
  }
  const pdf = await PDFDocument.create();
  const mm = 72 / 25.4;
  const drawCard = (page: PDFPage, image: PDFImage, slot: number) => {
    const x = (7.5 + slot % 3 * 66) * mm;
    const y = (297 - 13.5 - 88 - Math.floor(slot / 3) * 91) * mm;
    page.drawImage(image, { x, y, width: 63 * mm, height: 88 * mm });
    if (marks) for (const cx of [x, x + 63 * mm]) for (const cy of [y, y + 88 * mm]) {
      const dx = cx === x ? -1 : 1, dy = cy === y ? -1 : 1;
      page.drawLine({ start: { x: cx + dx * .3 * mm, y: cy }, end: { x: cx + dx * 1.2 * mm, y: cy }, thickness: .3, color: rgb(.4, .4, .4) });
      page.drawLine({ start: { x: cx, y: cy + dy * .3 * mm }, end: { x: cx, y: cy + dy * 1.2 * mm }, thickness: .3, color: rgb(.4, .4, .4) });
    }
  };
  let index = 0;
  for (const [sourceIndex, source] of images.entries()) {
    reportExportProgress(10 + sourceIndex / images.length * 40, `Rectos ${sourceIndex + 1}/${images.length}`);
    const blob = await renderPokerFrontPng(source, fit, zoom, showTitles, backDefaults);
    const embedded = await pdf.embedPng(await blob.arrayBuffer());
    for (let copy = 0; copy < source.copies; copy++, index++) {
      const slot = index % 9;
      const page = slot === 0 ? pdf.addPage([210 * mm, 297 * mm]) : pdf.getPages()[pdf.getPageCount() - 1];
      drawCard(page, embedded, slot);
    }
  }
  if (!index) throw new Error("Ajoutez au moins une image.");
  const backs = new Map<string, PDFImage>();
  let backIndex = 0;
  for (const [sourceIndex, source] of (includeBacks ? images : []).entries()) {
    reportExportProgress(50 + sourceIndex / images.length * 40, `Dos ${sourceIndex + 1}/${images.length}`);
    const options = resolvePokerBack(source, backDefaults);
    const key = JSON.stringify([options.backLabel, options.backImage, options.backFilmTitle ?? ""]);
    let back = backs.get(key);
    if (!back) {
      back = await pdf.embedPng(await (await renderPokerBackPng(options)).arrayBuffer());
      backs.set(key, back);
    }
    for (let copy = 0; copy < source.copies; copy++, backIndex++) {
      const slot = backIndex % 9;
      const page = slot === 0 ? pdf.addPage([210 * mm, 297 * mm]) : pdf.getPages()[pdf.getPageCount() - 1];
      drawCard(page, back, mirroredSheetSlot(slot, 3));
    }
  }
  reportExportProgress(95, "Assemblage du PDF A4…");
  return new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" });
}
