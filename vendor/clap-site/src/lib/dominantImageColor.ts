import { loadEditingImage } from "./imageEditing";

export function dominantPixelColor(pixels: Uint8ClampedArray): string | undefined {
  const buckets = new Map<number, { weight: number; r: number; g: number; b: number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3] / 255;
    if (alpha < .1) continue;
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const key = (r >> 5) * 64 + (g >> 5) * 8 + (b >> 5);
    const bucket = buckets.get(key) ?? { weight: 0, r: 0, g: 0, b: 0 };
    bucket.weight += alpha; bucket.r += r * alpha; bucket.g += g * alpha; bucket.b += b * alpha;
    buckets.set(key, bucket);
  }
  let dominant: { weight: number; r: number; g: number; b: number } | undefined;
  for (const bucket of buckets.values()) if (!dominant || bucket.weight > dominant.weight) dominant = bucket;
  if (!dominant) return undefined;
  const { weight, r, g, b } = dominant;
  return "#" + [r, g, b].map(value => Math.round(value / weight).toString(16).padStart(2, "0")).join("");
}

export async function dominantImageColor(source: string) {
  const image = await loadEditingImage(source);
  const scale = Math.min(1, 96 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return undefined;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return dominantPixelColor(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
}
