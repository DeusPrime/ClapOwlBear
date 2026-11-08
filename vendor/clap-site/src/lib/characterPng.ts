import { localizeText } from '@/i18n/localize';
import { migrateCharacter } from "./characters";
import { reportExportProgress } from "./exportProgress";
import { parseJsonData, validateImportedCharacter } from "./dataValidation";
// Renders the hero card back PNG, then embeds full character JSON.

import { Character } from "./characters";
import { writePngText, readPngText } from "./pngMeta";
import {
  RESOURCE_BUNDLE_PNG_KEY,
  importResourceBundlePayload,
  loadLinkedBundledResources,
  serializeResourceBundle,
} from "./resourceBundle";

const W = 1050;
const H = 1480;
const TITLE_BAND_H = 178;

const loadImg = (src: string): Promise<HTMLImageElement> =>
  new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });

const coverImage = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
  const r = Math.max(w / img.width, h / img.height);
  const iw = img.width * r;
  const ih = img.height * r;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
};

const fitFontSize = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startSize: number, minSize: number) => {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `800 ${size}px Impact, Anton, sans-serif`;
    if (ctx.measureText(localizeText(text)).width <= maxWidth) return size;
    size -= 4;
  }
  return minSize;
};

export const exportCharacterPng = async (c: Character): Promise<Blob> => {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const name = (c.nom || "Sans nom").toUpperCase();

  const x = 0;
  const y = 0;
  const w = W;
  const h = H;

  ctx.fillStyle = "#160d08";
  ctx.fillRect(x, y, w, h);

  if (c.portrait) {
    try {
      const img = await loadImg(c.portrait);
      coverImage(ctx, img, x, y, w, h);
    } catch {
      ctx.fillStyle = "#2b211c";
      ctx.fillRect(x, y, w, h);
    }
  } else {
    ctx.fillStyle = "#2b211c";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(255,248,238,0.38)";
    ctx.font = "700 54px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText(localizeText("PORTRAIT"), W / 2, H / 2);
  }

  const gradient = ctx.createLinearGradient(0, H * 0.48, 0, H);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.36)");
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = "#050505";
  ctx.fillRect(0, H - TITLE_BAND_H, W, TITLE_BAND_H);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fontSize = fitFontSize(ctx, name, W - 110, 64, 42);
  ctx.font = `800 ${fontSize}px Impact, Anton, sans-serif`;
  ctx.fillStyle = "#fff8ee";
  ctx.fillText(localizeText(name), W / 2, H - TITLE_BAND_H / 2 + 5);

  ctx.strokeStyle = c.cardInk || "#3a1307";
  ctx.lineWidth = 28;
  ctx.strokeRect(14, 14, W - 28, H - 28);

  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
  const json = JSON.stringify(c);
  const withCharacter = await writePngText(blob, "clap-role-character", json);
  const linkedResources = await loadLinkedBundledResources(c);
  if (linkedResources.length === 0) return withCharacter;
  return writePngText(withCharacter, RESOURCE_BUNDLE_PNG_KEY, serializeResourceBundle(linkedResources));
};

export const importCharacterPng = async (file: File): Promise<Character | null> => {
  const txt = await readPngText(file, "clap-role-character");
  if (!txt) return null;
  try {
    const c = migrateCharacter(validateImportedCharacter(parseJsonData(txt)));
    const resourcePayload = await readPngText(file, RESOURCE_BUNDLE_PNG_KEY);
    return resourcePayload ? await importResourceBundlePayload(resourcePayload, c) : c;
  } catch {
    return null;
  }
};

export const downloadBlob = (blob: Blob, filename: string) => {
  reportExportProgress(100, "Téléchargement du fichier…");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
