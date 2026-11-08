import { loadEditingImage } from "./imageEditing";

export type BookSide = "left" | "right";
export type BookTone = "light" | "dark";
export type BookCrop = { x: number; y: number; zoom: number };
export const DEFAULT_BOOK_CROP: BookCrop = { x: 0.5, y: 0.5, zoom: 1 };
export function bookCropRect(imageWidth: number, imageHeight: number, frameWidth: number, frameHeight: number, crop: BookCrop = DEFAULT_BOOK_CROP) {
  const zoom = Math.max(1, Math.min(4, crop.zoom));
  const scale = Math.max(frameWidth / imageWidth, frameHeight / imageHeight) * zoom;
  const width = frameWidth / scale, height = frameHeight / scale;
  return { x: (imageWidth - width) * Math.max(0, Math.min(1, crop.x)), y: (imageHeight - height) * Math.max(0, Math.min(1, crop.y)), width, height, scale };
}
export const BOOK_WIDTH = 2480;
export const BOOK_HEIGHT = 3508;
export const bookTemplateUrl = (side: BookSide, tone: BookTone) => `${import.meta.env.BASE_URL}book-backgrounds/${side}-${tone}.png`;

// Coordinates in the supplied 2480 × 3508 templates. The grey countdown
// frame is deliberately excluded from both preview and export.
export function bookFrames(side: BookSide) {
  // Cover the template illustrations with a small bleed on every edge.
  const bleed = 4;
  const columns = [55, 402, 748, 1095, 1441, 1787, 2133];
  const frames = [42, 3297].flatMap((y, row) => columns.flatMap((x, column) =>
    row === 1 && column === (side === "left" ? 0 : 6) ? [] : [{ x: x - bleed, y: y - bleed, width: 292 + bleed * 2, height: 170 + bleed * 2 }],
  ));
  return side === "right" ? frames.reverse() : frames;
}

// Page-number slots consume an image without drawing it: slot 7 on the left,
// slot 0 on the right (where the frame order is reversed).
export function bookImageIndex(side: BookSide, frameIndex: number, imageCount: number) {
  const offset = side === "right" ? 14 : 0;
  const hiddenSlot = side === "right" || frameIndex >= 7 ? 1 : 0;
  return (offset + frameIndex + hiddenSlot) % imageCount;
}

export async function renderBookBackground(sources: string[], side: BookSide, tone: BookTone, crops: BookCrop[] = []) {
  const template = await loadEditingImage(bookTemplateUrl(side, tone));
  const images = await Promise.all(sources.map(loadEditingImage));
  const canvas = document.createElement("canvas");
  canvas.width = BOOK_WIDTH; canvas.height = BOOK_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Création du fond indisponible.");
  context.drawImage(template, 0, 0);
  bookFrames(side).forEach((frame, index) => {
    if (!images.length) return;
    const imageIndex = bookImageIndex(side, index, images.length);
    const image = images[imageIndex];
    const crop = bookCropRect(image.naturalWidth, image.naturalHeight, frame.width, frame.height, crops[imageIndex]);
    // Flatten transparent imports so the old template illustrations cannot show through.
    context.fillStyle = "#000";
    context.fillRect(frame.x, frame.y, frame.width, frame.height);
    context.drawImage(image, crop.x, crop.y, crop.width, crop.height, frame.x, frame.y, frame.width, frame.height);
  });
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Export PNG impossible.")), "image/png"));
}
