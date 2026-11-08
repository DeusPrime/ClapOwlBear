import { localizeText } from '@/i18n/localize';
import { beginPokerCard, finishPokerCard } from "./pokerCardFrame";
import type { ImageEditing } from "./imageEditing";
export const POKER_BACK_BACKGROUND = `${import.meta.env.BASE_URL}card-back-background.png`;
export const POKER_BACK_LOGO = `${import.meta.env.BASE_URL}card-back-logo.svg`;
export const POKER_BACK_LABEL = "Studio";
export const POKER_BACK_FONT = '"Courier Prime", "Courier New", monospace';
export const POKER_BACK_LOGO_Y = (88 - 40) / 2;
export const POKER_BACK_TITLE_MARGIN = 2.7;
export type PokerBackOptions = { backLabel?: string; backImage?: string; backFilmTitle?: string; borderColor?: string; backEditing?: ImageEditing };
export function resolvePokerBack(image: PokerBackOptions, defaults: PokerBackOptions = {}): PokerBackOptions {
  const backFilmTitle = image.backFilmTitle ?? defaults.backFilmTitle;
  const backEditing = image.backImage !== undefined ? image.backEditing : defaults.backEditing;
  return { backLabel: image.backLabel ?? defaults.backLabel ?? POKER_BACK_LABEL, backImage: image.backImage ?? defaults.backImage ?? "", ...(backFilmTitle !== undefined ? { backFilmTitle } : {}), ...(backEditing ? { backEditing } : {}) };
}
export function pokerBackLogoY(_filmTitle?: string) { return POKER_BACK_LOGO_Y; }
export function pokerBackLabel(label = POKER_BACK_LABEL, measure?: (text: string) => number) {
  const text = label.replace(/\s+/g, " ").trim();
  const width = measure?.(text) ?? text.length * 5.2 * 0.6;
  return { text, size: width > 55 ? 5.2 * 55 / width : 5.2 };
}

function loadAsset(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Impossible de charger le dos de carte Studio."));
    image.src = url;
  });
}

export async function renderPokerBackPng(options: PokerBackOptions = {}): Promise<Blob> {
  const label = options.backLabel ?? POKER_BACK_LABEL;
  await document.fonts?.load(`700 16px ${POKER_BACK_FONT}`, `${label} ${options.backFilmTitle ?? ""}`.trim() || "Studio");
  const [background, logo] = await Promise.all([loadAsset(options.backImage || POKER_BACK_BACKGROUND), loadAsset(POKER_BACK_LOGO)]);
  const canvas = document.createElement("canvas");
  canvas.width = 744; canvas.height = 1039;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Création du dos de carte indisponible.");
  context.scale(canvas.width / 63, canvas.height / 88);
  beginPokerCard(context);
  const scale = Math.max(63 / background.naturalWidth, 88 / background.naturalHeight);
  const width = background.naturalWidth * scale, height = background.naturalHeight * scale;
  context.drawImage(background, (63 - width) / 2, (88 - height) / 2, width, height);
  context.fillStyle = "rgba(0, 0, 0, 0.5)"; context.fillRect(0, 0, 63, 88);
  context.drawImage(logo, 11.5, pokerBackLogoY(options.backFilmTitle), 40, 40);
  context.font = `700 5.2px ${POKER_BACK_FONT}`;
  const title = pokerBackLabel(label, text => context.measureText(localizeText(text)).width);
  context.font = `700 ${title.size}px ${POKER_BACK_FONT}`;
  context.fillStyle = "white"; context.textAlign = "center";
  context.textBaseline = "bottom";
  if (title.text) context.fillText(localizeText(title.text), 31.5, 88 - POKER_BACK_TITLE_MARGIN);
  context.font = `700 5.2px ${POKER_BACK_FONT}`;
  const film = pokerBackLabel(options.backFilmTitle ?? "", text => context.measureText(localizeText(text)).width);
  context.font = `700 ${film.size}px ${POKER_BACK_FONT}`;
  context.textBaseline = "top";
  if (film.text) context.fillText(localizeText(film.text), 31.5, POKER_BACK_TITLE_MARGIN);
  finishPokerCard(context, options.borderColor);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Export du dos de carte impossible.")), "image/png"));
}
