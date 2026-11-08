export type BackgroundFocus = { x: number; y: number; width: number; height: number; amount: number };
export const DEFAULT_BACKGROUND_FOCUS: BackgroundFocus = { x: 0.5, y: 0.5, width: 0.7, height: 0.95, amount: 0.7 };

// Two sliding-window box filters: linear time regardless of blur radius.
// Premultiplied RGB prevents hidden colours from bleeding through transparency.
export function softenBackground(data: Uint8ClampedArray, width: number, height: number, focus: BackgroundFocus) {
  if (!focus.amount || width < 2 || height < 2) return new Uint8ClampedArray(data);
  const radius = Math.max(2, Math.min(20, Math.round(Math.min(width, height) * 0.014)));
  let pixels = new Float32Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) pixels[i + c] = data[i + c] * data[i + 3] / 255;
    pixels[i + 3] = data[i + 3];
  }
  for (const horizontal of [true, false, true, false]) {
    const next = new Float32Array(pixels.length);
    const length = horizontal ? width : height, lines = horizontal ? height : width;
    const index = (line: number, p: number) => (horizontal ? line * width + p : p * width + line) * 4;
    for (let line = 0; line < lines; line++) {
      const sum = [0, 0, 0, 0];
      for (let p = -radius; p <= radius; p++) {
        const i = index(line, Math.max(0, Math.min(length - 1, p)));
        for (let c = 0; c < 4; c++) sum[c] += pixels[i + c];
      }
      for (let p = 0; p < length; p++) {
        const i = index(line, p);
        for (let c = 0; c < 4; c++) next[i + c] = sum[c] / (2 * radius + 1);
        const remove = index(line, Math.max(0, p - radius));
        const add = index(line, Math.min(length - 1, p + radius + 1));
        for (let c = 0; c < 4; c++) sum[c] += pixels[add + c] - pixels[remove + c];
      }
    }
    pixels = next;
  }
  const output = new Uint8ClampedArray(data);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    if (!data[i + 3] || !pixels[i + 3]) continue;
    const distance = Math.hypot((x / width - focus.x) / Math.max(0.025, focus.width / 2), (y / height - focus.y) / Math.max(0.025, focus.height / 2));
    const t = Math.max(0, Math.min(1, (distance - 0.85) / 0.4));
    const weight = Math.max(0, Math.min(1, focus.amount)) * t * t * (3 - 2 * t);
    for (let c = 0; c < 3; c++) output[i + c] = data[i + c] * (1 - weight) + pixels[i + c] * 255 / pixels[i + 3] * weight;
  }
  return output;
}
