import { imagePngBlob, loadEditingImage } from "./imageEditing";
import type { BackgroundFocus } from "./backgroundFocus";

export async function createClapStyleBlob(url: string, strength: number, signal?: AbortSignal, maxDimension?: number, focus?: BackgroundFocus): Promise<Blob> {
  return processImage(url, strength, signal, maxDimension, focus);
}

export async function createBackgroundFocusBlob(url: string, focus: BackgroundFocus, signal?: AbortSignal): Promise<Blob> {
  return processImage(url, 1, signal, undefined, focus, true);
}

async function processImage(url: string, strength: number, signal?: AbortSignal, maxDimension?: number, focus?: BackgroundFocus, focusOnly = false): Promise<Blob> {
  if (!Number.isFinite(strength) || strength < 0 || strength > 100) throw new Error("Intensité de style invalide.");
  if (signal?.aborted) throw new DOMException("Traitement annulé", "AbortError");
  if (strength === 0) return imagePngBlob(url, 0);
  const image = await loadEditingImage(url);
  const canvas = document.createElement("canvas");
  const scale = maxDimension ? Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight)) : 1;
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Stylisation indisponible dans ce navigateur.");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (signal?.aborted) throw new DOMException("Traitement annulé", "AbortError");
  const worker = new Worker(new URL("./clapImagePosterize.worker.ts", import.meta.url), { type: "module" });
  let abort: (() => void) | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const output = await new Promise<Uint8ClampedArray>((resolve, reject) => {
      abort = () => { worker.terminate(); reject(new DOMException("Traitement annulé", "AbortError")); };
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) { abort(); return; }
      timeout = setTimeout(() => reject(new Error("Le traitement de l?image prend trop de temps. R?essayez ou choisissez Original.")), 30000);
      worker.onmessageerror = () => reject(new Error("Impossible de lire le r?sultat de la stylisation."));
      worker.onmessage = event => resolve(event.data);
      worker.onerror = () => reject(new Error("La stylisation a échoué. Réessayez ou remettez le curseur à zéro."));
      worker.postMessage({ data: pixels.data, width: canvas.width, height: canvas.height, strength, focus, focusOnly }, [pixels.data.buffer]);
    });
    ctx.putImageData(new ImageData(new Uint8ClampedArray(output), canvas.width, canvas.height), 0, 0);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Conversion impossible.")), "image/png"));
  } finally { clearTimeout(timeout); if (abort) signal?.removeEventListener("abort", abort); worker.terminate(); }
}
