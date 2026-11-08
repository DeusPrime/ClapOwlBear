import type { PreviewResource } from "@/components/ResourceCardPreview";
import { renderFigurantCardCanvas } from "./figurantPng";
import { renderKeyRoleCardCanvas } from "./keyRolePng";
import { renderPowerCardCanvas } from "./powerPng";
import { renderProfileCardCanvas } from "./profilePng";
import { renderVehicleCardCanvas } from "./vehiclePng";

const VERSION = 3;
const memory = new Map<string, Blob>();
const pending = new Map<string, Promise<Blob>>();
const imageUrls = new Map<Blob, { url: string; users: number }>();
let queue: Promise<unknown> = Promise.resolve();
let database: Promise<IDBDatabase> | undefined;

function trimImageUrls() {
  for (const [blob, image] of imageUrls) {
    if (imageUrls.size <= 64) break;
    if (image.users) continue;
    URL.revokeObjectURL(image.url);
    imageUrls.delete(blob);
  }
}

// Stable URLs allow the browser to reuse decoded PNGs on reopening the picker.
// Never revoke an image while a visible card is still using it.
export async function acquireResourcePreviewUrl(resource: PreviewResource) {
  const blob = await getResourcePreviewPng(resource);
  const image = imageUrls.get(blob) ?? { url: URL.createObjectURL(blob), users: 0 };
  imageUrls.delete(blob);
  imageUrls.set(blob, image);
  image.users++;
  trimImageUrls();
  let released = false;
  return { url: image.url, release() {
    if (released) return;
    released = true;
    image.users--;
    trimImageUrls();
  } };
}

function openCache() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("clap-resource-previews", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("previews");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return database;
}

async function renderPreview(resource: PreviewResource) {
  await document.fonts?.ready;
  let source: HTMLCanvasElement;
  switch (resource.type) {
    case "figurant": source = await renderFigurantCardCanvas(resource.item, 320); break;
    case "key-role": source = await renderKeyRoleCardCanvas(resource.item, 320); break;
    case "power": source = await renderPowerCardCanvas(resource.item, 320); break;
    case "profile": source = await renderProfileCardCanvas(resource.item, 320); break;
    case "vehicle": source = await renderVehicleCardCanvas(resource.item, 320); break;
  }
  try {
    return await new Promise<Blob>((resolve, reject) => source.toBlob(blob => blob ? resolve(blob) : reject(new Error("Aperçu indisponible")), "image/png"));
  } finally { source.width = source.height = 0; }
}

function idle() {
  return new Promise<void>(resolve => {
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(() => resolve(), { timeout: 500 });
    else window.setTimeout(resolve, 16);
  });
}

/** Small PNGs only: reuse across openings and reloads, invalidate on resource edits. */
export function getResourcePreviewPng(resource: PreviewResource): Promise<Blob> {
  const id = `${resource.type}:${resource.item.id}`;
  const revision = `${VERSION}:${resource.item.updatedAt}`;
  const key = `${id}:${revision}`;
  const cached = memory.get(key);
  if (cached) return Promise.resolve(cached);
  const active = pending.get(key);
  if (active) return active;
  const request = (async () => {
    try {
      const db = await openCache();
      const saved = await new Promise<{ revision: string; blob: Blob } | undefined>((resolve, reject) => {
        const read = db.transaction("previews").objectStore("previews").get(id);
        read.onsuccess = () => resolve(read.result);
        read.onerror = () => reject(read.error);
      });
      if (saved?.revision === revision) return saved.blob;
    } catch { /* A cache failure must not prevent displaying the resource. */ }
    const rendered = queue.catch(() => {}).then(idle).then(() => renderPreview(resource));
    queue = rendered;
    const blob = await rendered;
    try {
      const db = await openCache();
      const tx = db.transaction("previews", "readwrite");
      tx.objectStore("previews").put({ revision, blob }, id);
      tx.onerror = () => { /* Thumbnails remain available in memory if storage is full. */ };
    } catch { /* Optional persistent cache. */ }
    return blob;
  })().then(blob => {
    if (memory.size >= 64) memory.delete(memory.keys().next().value!);
    memory.set(key, blob);
    return blob;
  }).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
