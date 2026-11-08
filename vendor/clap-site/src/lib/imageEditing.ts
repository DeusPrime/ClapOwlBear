import { MAX_IMPORT_BYTES, rasterImageSchema } from "./dataValidation";
export type ImageEditing = { source: string; rotation: number; style: number; crop?: { x: number; y: number; zoom: number } };

export function assertImageDimensions(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width > 16000 || height > 16000 || width * height > 40000000) {
    throw new Error("Image trop grande : maximum 40 millions de pixels.");
  }
}

export async function validateImageFile(blob: Blob) {
  if (blob.size > MAX_IMPORT_BYTES) throw new Error("Image trop volumineuse : maximum 50 Mo.");
  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  const type = bytes[0] === 137 && ascii(1, 4) === "PNG" && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10 ? "image/png"
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? "image/jpeg"
    : ["GIF87a", "GIF89a"].includes(ascii(0, 6)) ? "image/gif"
    : ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP" ? "image/webp" : "";
  if (!type || (blob.type && blob.type !== type)) throw new Error("Utilise une image PNG, JPEG, WebP ou GIF valide.");
  return type;
}

export async function blobDataUrl(blob: Blob) {
  const type = await validateImageFile(blob);
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = rasterImageSchema.safeParse(reader.result);
      if (result.success) resolve(result.data);
      else reject(new Error("Image invalide ou trop volumineuse pour être enregistrée."));
    };
    reader.onerror = () => reject(new Error("Impossible de lire cette image."));
    reader.readAsDataURL(blob.type ? blob : new Blob([blob], { type }));
  });
}

export function loadEditingImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    // Local templates and app-created blob URLs are also used by the image tools.
    const localTemplate = ["left-light", "left-dark", "right-light", "right-dark"].some(name => source === `${import.meta.env.BASE_URL}book-backgrounds/${name}.png`);
    if (!localTemplate && !source.startsWith("blob:") && !rasterImageSchema.safeParse(source).success) {
      reject(new Error("Source d’image non autorisée.")); return;
    }
    const image = new Image(); image.onload = () => {
      try { assertImageDimensions(image.naturalWidth, image.naturalHeight); resolve(image); }
      catch (error) { reject(error); }
    }; image.onerror = () => reject(new Error("Image non prise en charge.")); image.src = source;
  });
}

export async function rotateImageDataUrl(source: string, rotation: number) {
  if (!rotation) return source;
  const image = await loadEditingImage(source);
  const sideways = rotation % 180 !== 0;
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const canvas = document.createElement("canvas"); canvas.width = sideways ? height : width; canvas.height = sideways ? width : height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Rotation indisponible.");
  ctx.imageSmoothingEnabled = false;
  ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(rotation * Math.PI / 180); ctx.drawImage(image, -width / 2, -height / 2, width, height);
  return canvas.toDataURL("image/png");
}

export async function imagePngBlob(source: string, rotation: number) {
  const image = await loadEditingImage(source);
  // Preserve even the original PNG bytes (including colour profiles and bit depth)
  // when conversion does not require a rotation or another pixel operation.
  if (rotation % 360 === 0 && source.startsWith("data:image/png;base64,")) {
    return (await fetch(source)).blob();
  }
  const sideways = rotation % 180 !== 0;
  const canvas = document.createElement("canvas");
  canvas.width = sideways ? image.naturalHeight : image.naturalWidth;
  canvas.height = sideways ? image.naturalWidth : image.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Export PNG indisponible.");
  ctx.imageSmoothingEnabled = false;
  ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(rotation * Math.PI / 180);
  ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Export PNG impossible.")), "image/png"));
}
