import { drawFadedCardBackground, CARD_BACKGROUND_EDGE } from "./fadedCardBackground";
import { POKER_BACK_BACKGROUND, resolvePokerBack, type PokerBackOptions } from "./pokerCardBack";
import { loadEditingImage, type ImageEditing } from "./imageEditing";
import { richTextToBlocks, type RichTextRun, type RichTextBlock } from './richText';
import { titleFont, imageTitle, type TitleFont } from './pokerCardTitle';

export const TEXT_CARD_WIDTH = 756;
export const TEXT_CARD_HEIGHT = 1056;
export type TextVerticalAlign = "top" | "middle" | "bottom";
export type TextCardFields = { kind?: 'text'; text?: string; textFontSize?: number; textFont?: TitleFont; textVerticalAlign?: TextVerticalAlign; frontImage?: string; frontEditing?: ImageEditing };
export type TextCardOptions = { title?: string; titleFont?: TitleFont; textFont?: TitleFont; textVerticalAlign?: TextVerticalAlign; background?: HTMLImageElement };
type Token = RichTextRun & { x: number; width: number };
type Line = { tokens: Token[]; width: number; align?: RichTextBlock['align'] };
export async function loadTextCardFonts(options: TextCardOptions) {
  const header = titleFont(options.titleFont), body = titleFont(options.textFont);
  await Promise.all([document.fonts?.load(`${header.weight} 16px ${header.family}`), document.fonts?.load(`400 16px ${body.family}`), document.fonts?.load(`700 16px ${body.family}`), document.fonts?.load(`italic 400 16px ${body.family}`), document.fonts?.load(`italic 700 16px ${body.family}`)]);
}
export function textCardBackground(card: TextCardFields & PokerBackOptions, defaults: PokerBackOptions = {}) {
  return card.frontImage || resolvePokerBack(card, defaults).backImage || POKER_BACK_BACKGROUND;
}
export async function textCardArtwork(card: TextCardFields & PokerBackOptions & { name: string; title?: string; titleFont?: TitleFont }, defaults: PokerBackOptions = {}) {
  const options = { title: imageTitle(card), titleFont: card.titleFont, textFont: card.textFont, textVerticalAlign: card.textVerticalAlign };
  const [, background] = await Promise.all([loadTextCardFonts(options), loadEditingImage(textCardBackground(card, defaults))]);
  return renderTextCard(card.text ?? '', card.textFontSize ?? 10, { ...options, background }).source;
}
/** Shared print artwork: a centered white heading on black, then formatted text. */
export function renderTextCard(html: string, requestedSize = 10, options: TextCardOptions = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = TEXT_CARD_WIDTH; canvas.height = TEXT_CARD_HEIGHT;
  const ctx = canvas.getContext('2d')!;
  if (!ctx) throw new Error('Conversion indisponible dans ce navigateur.');
  ctx.scale(12, 12);
  ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 63, 88);
  if (options.background) drawFadedCardBackground(ctx, options.background, 0, 0, 63, 88, CARD_BACKGROUND_EDGE * 63 / 744);
  ctx.fillStyle = 'black'; ctx.fillRect(0, 0, 63, 14);
  const header = titleFont(options.titleFont), body = titleFont(options.textFont);
  const title = (options.title ?? '').replace(/\s+/g, ' ').trim();
  ctx.font = `${header.weight} 3.4px ${header.family}`;
  const titleWidth = ctx.measureText(title).width;
  const titleSize = titleWidth > 53 ? 3.4 * 53 / titleWidth : 3.4;
  ctx.font = `${header.weight} ${titleSize}px ${header.family}`;
  ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(title, 31.5, 7.5);
  ctx.textAlign = 'left';
  const font = (size: number, run: RichTextRun) => `${run.italic ? 'italic ' : ''}${run.bold ? '700' : '400'} ${size}px ${body.family}`;
  const blocks = richTextToBlocks(html, { allowAlignment: true, preserveLineBreaks: true });
  function layout(points: number) {
    const size = points * 25.4 / 72;
    const lines: Line[] = [];
    for (const block of blocks) {
      let line: Token[] = [], width = 0;
      const push = () => { lines.push({ tokens: line, width, align: block.align }); line = []; width = 0; };
      const runs: RichTextRun[] = block.listItem ? [{ text: block.listKind === 'ol' ? `${block.listIndex ?? 1}. ` : '• ', bold: true }, ...block.runs] : block.runs;
      for (const run of runs) {
        ctx.font = font(size, run);
        for (const word of run.text.split(/(\s+)/).filter(Boolean)) {
          const whitespace = /^\s+$/.test(word);
          if (whitespace && !line.length) continue;
          const wordWidth = ctx.measureText(word).width;
          if (width + wordWidth > 53 && line.length) push();
          if (whitespace && !line.length) continue;
          const pieces = wordWidth > 53 ? [...word] : [word];
          for (const text of pieces) {
            const measured = ctx.measureText(text).width;
            if (width + measured > 53 && line.length) push();
            line.push({ ...run, text, x: width, width: measured }); width += measured;
          }
        }
      }
      push();
    }
    return { lines, size, height: lines.length * size * 1.25 };
  }
  let fontSize = Math.max(6, Math.min(20, requestedSize));
  let result = layout(fontSize);
  while (result.height > 66 && fontSize > 6) { fontSize = Math.max(6, fontSize - .5); result = layout(fontSize); }
  ctx.save(); ctx.beginPath(); ctx.rect(5, 17, 53, 66); ctx.clip();
  ctx.fillStyle = '#111'; ctx.textBaseline = 'top';
  const freeHeight = Math.max(0, 66 - result.height);
  const verticalOffset = options.textVerticalAlign === "middle" ? freeHeight / 2 : options.textVerticalAlign === "bottom" ? freeHeight : 0;
  result.lines.forEach((line, index) => {
    const offset = line.align === 'center' ? (53 - line.width) / 2 : line.align === 'right' ? 53 - line.width : 0;
    line.tokens.forEach(run => {
      const y = 17 + verticalOffset + index * result.size * 1.25, x = 5 + offset + run.x;
      ctx.font = font(result.size, run); ctx.fillText(run.text, x, y);
      if (run.underline) { ctx.strokeStyle = '#111'; ctx.lineWidth = result.size / 18; ctx.beginPath(); ctx.moveTo(x, y + result.size); ctx.lineTo(x + run.width, y + result.size); ctx.stroke(); }
    });
  });
  ctx.restore();
  return { source: canvas.toDataURL('image/png'), overflow: result.height > 66, fontSize };
}
