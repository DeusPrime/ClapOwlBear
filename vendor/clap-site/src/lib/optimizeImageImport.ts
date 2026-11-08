import { validateImageFile } from "./imageEditing";

export async function optimizeImageImport(file: File): Promise<File> {
  const type = await validateImageFile(file);
  // JPEG/WebP/GIF are already compressed: keep their exact bytes, profiles,
  // orientation and animation rather than introducing a lossy conversion.
  if (type !== "image/png" || file.size < 4096 || file.size > 12 * 1024 * 1024 || typeof Worker === "undefined") return file;
  let worker: Worker | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const bytes = await file.arrayBuffer();
    const result = await new Promise<ArrayBuffer>((resolve, reject) => {
      worker = new Worker(new URL("./losslessImage.worker.ts", import.meta.url), { type: "module" });
      timer = setTimeout(() => reject(new Error("Optimisation interrompue.")), 2500);
      worker.onmessage = event => resolve(event.data);
      worker.onerror = () => reject(new Error("Optimisation indisponible."));
      worker.onmessageerror = () => reject(new Error("Optimisation indisponible."));
      worker.postMessage(bytes, [bytes]);
    });
    if (result.byteLength >= file.size) return file;
    return new File([result], file.name, { type, lastModified: file.lastModified });
  } catch { return file; }
  finally { if (timer) clearTimeout(timer); worker?.terminate(); }
}
