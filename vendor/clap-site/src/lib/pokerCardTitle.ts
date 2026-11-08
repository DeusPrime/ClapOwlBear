import { localizeText } from '@/i18n/localize';
export const TITLE_FONTS = [
  { value: "courier-prime", label: "Courier Prime", family: '"Courier Prime", "Courier New", monospace', weight: 700 },
  { value: "anton", label: "Anton — Cinéma", family: '"Anton", Impact, sans-serif', weight: 400 },
  { value: "typewriter", label: "Special Elite — Machine à écrire", family: '"Special Elite", "Courier New", monospace', weight: 400 },
  { value: "sans", label: "Arial", family: 'Arial, sans-serif', weight: 700 },
  { value: "serif", label: "Georgia", family: 'Georgia, serif', weight: 700 },
  { value: "mono", label: "Courier New", family: '"Courier New", monospace', weight: 700 },
] as const;
export type TitleFont = typeof TITLE_FONTS[number]["value"];
export function titleFont(value?: TitleFont) { return TITLE_FONTS.find(font => font.value === value) ?? TITLE_FONTS[0]; }
export function defaultImageTitle(name: string) { return name.replace(/\.[^.]+$/, "") || name; }
export function imageTitle(image: { name: string; title?: string; kind?: "text" }) { return image.title ?? (image.kind === "text" ? image.name : defaultImageTitle(image.name)); }

// Coordinates in the card's own reading direction, before its rotation onto the sheet.
export function cardTitleLayout(rotation: number, title: string, fontKey?: TitleFont, measure?: (font: string, text: string) => number) {
  const sideways = rotation % 180 !== 0;
  const width = sideways ? 88 : 63, height = sideways ? 63 : 88;
  const font = titleFont(fontKey);
  const text = title.replace(/\s+/g, " ").trim();
  let size = 3.4;
  const measured = measure?.(`${font.weight} ${size}px ${font.family}`, text) ?? text.length * size * 0.6;
  if (measured > width - 5) size *= (width - 5) / measured;
  const textWidth = measured * size / 3.4;
  const x = width / 2 - 2.5, y = -height / 2 + 2.5 + size;
  return { text, x, y, size, family: font.family, weight: font.weight,
    background: { x: x - textWidth - 1, y: y - size - 0.6, width: textWidth + 2, height: size * 1.4 + 1.2 } };
}

export function drawCardTitle(context: CanvasRenderingContext2D, rotation: number, title: string, fontKey?: TitleFont) {
  if (!title.trim()) return;
  const layout = cardTitleLayout(rotation, title, fontKey, (font, text) => { context.font = font; return context.measureText(localizeText(text)).width; });
  context.save();
  context.font = `${layout.weight} ${layout.size}px ${layout.family}`;
  context.textAlign = "right"; context.textBaseline = "alphabetic";
  context.globalAlpha = 1;
  context.fillStyle = "rgba(0, 0, 0, 0.5)";
  context.fillRect(layout.background.x, layout.background.y, layout.background.width, layout.background.height);
  context.fillStyle = "#fff";
  context.fillText(localizeText(layout.text), layout.x, layout.y);
  context.restore();
}
