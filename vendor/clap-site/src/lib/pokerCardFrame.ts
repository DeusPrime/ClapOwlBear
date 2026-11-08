export const POKER_CARD_RADIUS = 3;
// Resource cards use an 18 px border on a 744 px wide, 63 mm card.
export const POKER_CARD_BORDER = 18 * 63 / 744;

export function beginPokerCard(context: CanvasRenderingContext2D) {
  context.save();
  context.beginPath(); context.roundRect(0, 0, 63, 88, POKER_CARD_RADIUS); context.clip();
  context.fillStyle = "white"; context.fillRect(0, 0, 63, 88);
}
export function finishPokerCard(context: CanvasRenderingContext2D, color = "black") {
  context.restore();
  const inset = POKER_CARD_BORDER / 2;
  context.beginPath();
  context.roundRect(inset, inset, 63 - POKER_CARD_BORDER, 88 - POKER_CARD_BORDER, POKER_CARD_RADIUS - inset);
  context.strokeStyle = color; context.lineWidth = POKER_CARD_BORDER; context.stroke();
}
