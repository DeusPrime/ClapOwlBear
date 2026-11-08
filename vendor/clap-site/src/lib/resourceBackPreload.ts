import { loadDirectories, resourceBackImage } from "./directories";
import { DEFAULT_RESOURCE_BACK_IMAGES } from "./resourceAppearance";
import { POKER_BACK_FONT, POKER_BACK_LOGO } from "./pokerCardBack";
import type { ResourceKind } from "./dataValidation";

const decoded = new Map<string, Promise<HTMLImageElement>>();
export function preloadBackImage(source: string): Promise<HTMLImageElement> {
  const cached = decoded.get(source);
  if (cached) return cached;
  const image = new Image();
  image.loading = "eager";
  const ready = new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = async () => {
      try { if (image.decode) await image.decode(); resolve(image); }
      catch (error) { reject(error); }
    };
    image.onerror = () => reject(new Error("Chargement du dos de carte impossible."));
  });
  decoded.set(source, ready);
  if (decoded.size > 64) decoded.delete(decoded.keys().next().value!);
  void ready.catch(() => decoded.delete(source));
  image.src = source;
  return ready;
}
export async function preloadResourceBacks(directoryId: string) {
  const directory = loadDirectories().find(item => item.id === directoryId);
  const sources = new Set([POKER_BACK_LOGO, ...Object.keys(DEFAULT_RESOURCE_BACK_IMAGES).map(type => resourceBackImage(directory, type as ResourceKind))]);
  await Promise.allSettled([
    ...[...sources].map(preloadBackImage),
    document.fonts?.load(`700 16px ${POKER_BACK_FONT}`) ?? Promise.resolve(),
  ]);
}
