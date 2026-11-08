/** Shared fading used by key-role, extra and text-card backgrounds. */
export const CARD_BACKGROUND_OPACITY = .35;
export const CARD_BACKGROUND_WHITE_WASH = .35;
export const CARD_BACKGROUND_EDGE_OPACITY = .92;
export const CARD_BACKGROUND_EDGE = 86;
export function drawFadedCardBackground(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number, edge = CARD_BACKGROUND_EDGE) {
  ctx.save();
  const ratio = Math.max(w / image.width, h / image.height);
  const iw = image.width * ratio, ih = image.height * ratio;
  ctx.globalAlpha = CARD_BACKGROUND_OPACITY;
  ctx.drawImage(image, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  ctx.globalAlpha = 1;
  const gradients = [
    [ctx.createLinearGradient(x, y, x + edge, y), x, y, edge, h],
    [ctx.createLinearGradient(x + w, y, x + w - edge, y), x + w - edge, y, edge, h],
    [ctx.createLinearGradient(x, y, x, y + edge), x, y, w, edge],
    [ctx.createLinearGradient(x, y + h, x, y + h - edge), x, y + h - edge, w, edge],
  ] as const;
  for (const [gradient, gx, gy, gw, gh] of gradients) {
    gradient.addColorStop(0, `rgba(255,255,255,${CARD_BACKGROUND_EDGE_OPACITY})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient; ctx.fillRect(gx, gy, gw, gh);
  }
  ctx.fillStyle = `rgba(255,255,255,${CARD_BACKGROUND_WHITE_WASH})`; ctx.fillRect(x, y, w, h);
  ctx.restore();
}
