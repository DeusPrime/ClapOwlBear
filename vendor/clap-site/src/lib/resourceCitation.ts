import { localizeText } from '@/i18n/localize';
import { estimatePlainTextLines } from './richText';

export const CITATION_HORIZONTAL_PADDING = 6;
let canvas: HTMLCanvasElement | undefined;

/** Wrap the complete citation, including overlong words and explicit newlines. */
export function wrapCitation(ctx: Pick<CanvasRenderingContext2D, 'measureText'>, text: string, width: number): string[] {
  const lines: string[] = [];
  const maxWidth = Math.max(1, width - 2 * CITATION_HORIZONTAL_PADDING);
  for (const paragraph of localizeText(text).replace(/\r\n?/g, '\n').split('\n')) {
    let line = '';
    for (const token of paragraph.split(/(\s+)/).filter(Boolean)) {
      if (!token.trim()) {
        line += token;
        continue;
      }
      if (line && ctx.measureText(line + token).width > maxWidth) {
        lines.push(line.trimEnd());
        line = '';
      }
      if (ctx.measureText(token).width > maxWidth) {
        for (const char of token) {
          if (line && ctx.measureText(line + char).width > maxWidth) {
            lines.push(line);
            line = '';
          }
          line += char;
        }
      } else line += token;
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

export function measureCitationLines(text: string, width: number, font: string) {
  if (typeof document !== 'undefined') {
    canvas ??= document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = font;
      return wrapCitation(ctx, text, width).length;
    }
  }
  return estimatePlainTextLines(text, Math.max(1, Math.floor((width - 12) / 20)));
}

export function drawCitation(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lineHeight: number) {
  wrapCitation(ctx, text, width).forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
}
