import { prepareA4Image } from "./a4StyledImage";
import { prepareBookImage } from "./bookStyledImage";
import { textCardArtwork } from "./pokerTextCard";
import JSZip from "jszip";
import { exportRange, reportExportProgress } from "./exportProgress";
import { createClapStyleBlob } from "./clapImageStyle";
import { blobDataUrl, imagePngBlob, loadEditingImage } from "./imageEditing";
import { renderBookBackground } from "./bookBackground";
import { renderToolPdf } from "./toolPdf";
import { convertedImageName } from "./imageBatch";
import { croppedImagePlacement } from "./pokerCardsPdf";
import { beginPokerCard, finishPokerCard } from "./pokerCardFrame";
import { drawCardTitle, imageTitle, titleFont } from "./pokerCardTitle";
import type { ToolDocument } from "./toolDocuments";

async function styled(source: string, strength: number, maxDimension?: number) {
  return strength ? blobDataUrl(await createClapStyleBlob(source, strength, undefined, maxDimension)) : source;
}
async function bookOutput(data: Extract<NonNullable<ToolDocument["data"]>, { tool: "book-background" }>, onProgress: (percent: number, detail: string) => void = () => {}) {
  const sources = [];
  for (const [index, image] of data.images.entries()) {
    onProgress(10 + index / data.images.length * 65, `Images du fond ${index + 1}/${data.images.length}`);
    sources.push(await prepareBookImage(image, data.settings.strength));
  }
  onProgress(80, "Composition du fond de livre…");
  return renderBookBackground(sources, data.settings.side, data.settings.tone, data.images.map(image => image.crop));
}
export async function exportBookBackgroundVariants(tool: ToolDocument, onProgress: (detail: string) => void = () => {}) {
  const data = tool.data;
  if (data?.tool !== "book-background" || !data.images.length) throw new Error("Ajoutez des images dans ce fond de livre.");
  const sources: string[] = [];
  for (const [index, image] of data.images.entries()) {
    onProgress(`Stylisation ${index + 1}/${data.images.length}`);
    sources.push(await prepareBookImage(image, data.settings.strength));
  }
  const variants = {} as Record<"left-light" | "left-dark" | "right-light" | "right-dark", string>;
  for (const side of ["left", "right"] as const) for (const tone of ["light", "dark"] as const) {
    onProgress(`Composition ${side === "left" ? "gauche" : "droite"} · ${tone === "light" ? "blanc" : "noir"}`);
    variants[`${side}-${tone}`] = await blobDataUrl(await renderBookBackground(sources, side, tone, data.images.map(image => image.crop)));
  }
  return variants;
}
export async function exportToolResult(tool: ToolDocument, format: "render" | "png-zip" = "render"): Promise<{ blob: Blob; name: string }> {
  const data = tool.data;
  if (!data?.images.length) throw new Error("Ajoutez des images dans cette ressource avant de l’exporter.");
  const name = Array.from(tool.name.replace(/[<>:"/\\|?*]/g, "_")).map(char => char.charCodeAt(0) < 32 ? "_" : char).join("") || "ressource";
  if (data.tool === "a4-sheets" && format === "png-zip") {
    const { exportPokerFrontsZip } = await import("./pokerCardsZip");
    const images: Parameters<typeof exportPokerFrontsZip>[0] = [];
    for (const [index, image] of data.images.entries()) {
      reportExportProgress(5 + index / data.images.length * 25, `Stylisation ${index + 1}/${data.images.length}`);
      images.push({ ...image, id: String(index), url: image.source, styledUrl: await prepareA4Image(image), styledStrength: image.style });
    }
    return { blob: await exportRange(30, 100, () => exportPokerFrontsZip(images, data.settings.fit, data.settings.zoom, data.settings.showTitles, data.settings)), name: `${name}.zip` };
  }
  if (data.tool === "a4-sheets") return { blob: await renderToolPdf(tool), name: `${name}.pdf` };
  if (data.tool === "book-background") return { blob: await bookOutput(data, reportExportProgress), name: `${name}.png` };
  const zip = new JSZip(), used = new Set<string>();
  for (const [index, image] of data.images.entries()) {
    reportExportProgress(10 + index / data.images.length * 65, `Conversion ${index + 1}/${data.images.length}`);
    const blob = await imagePngBlob(await styled(image.source, data.settings.style), data.settings.rotation);
    if (data.images.length === 1) return { blob, name: `${name}.png` };
    zip.file(convertedImageName(image.name, used), await blob.arrayBuffer());
  }
  return { blob: await zip.generateAsync({ type: "blob" }, metadata => reportExportProgress(75 + metadata.percent * .25, "Compression des PNG…")), name: `${name}.zip` };
}

/** Small first-page snapshot using the same layout, framing and title helpers as the exports. */
export async function renderToolPreview(tool: ToolDocument): Promise<string | null> {
  const data = tool.data;
  if (!data?.images.length) return null;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Aperçu indisponible.");
  if (data.tool === "a4-sheets") {
    canvas.width = 420; canvas.height = 594;
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, 420, 594);
    ctx.scale(2, 2);
    let slot = 0;
    for (const artwork of data.images) {
      if (slot >= 9) break;
      const image = await loadEditingImage(artwork.kind === "text" ? await textCardArtwork(artwork, data.settings) : await prepareA4Image(artwork));
      if (data.settings.showTitles !== false && artwork.showTitle !== false) {
        const font = titleFont(artwork.titleFont);
        await document.fonts?.load(`${font.weight} 16px ${font.family}`, imageTitle(artwork));
      }
      const p = croppedImagePlacement(image.naturalWidth, image.naturalHeight, artwork.kind === "text" ? "contain" : data.settings.fit, artwork.rotation, artwork.kind === "text" ? 1 : data.settings.fit === "cover" ? data.settings.zoom : 1, artwork.kind === "text" ? undefined : artwork.crop);
      for (let copy = 0; copy < artwork.copies && slot < 9; copy++, slot++) {
        ctx.save(); ctx.translate(7.5 + slot % 3 * 66, 13.5 + Math.floor(slot / 3) * 91);
        beginPokerCard(ctx); ctx.save(); ctx.translate(31.5, 44); ctx.rotate(artwork.rotation * Math.PI / 180);
        ctx.drawImage(image, p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
        if (data.settings.showTitles !== false && artwork.showTitle !== false) drawCardTitle(ctx, artwork.rotation, imageTitle(artwork), artwork.titleFont);
        ctx.restore(); finishPokerCard(ctx);
        if (data.settings.marks) {
          ctx.strokeStyle = "#666"; ctx.lineWidth = .3;
          for (const x of [0, 63]) for (const y of [0, 88]) {
            const dx = x === 0 ? -1 : 1, dy = y === 0 ? -1 : 1;
            ctx.beginPath(); ctx.moveTo(x + dx * .3, y); ctx.lineTo(x + dx * 1.2, y); ctx.moveTo(x, y + dy * .3); ctx.lineTo(x, y + dy * 1.2); ctx.stroke();
          }
        }
        ctx.restore();
      }
    }
  } else {
    const source = data.tool === "book-background" ? await blobDataUrl(await bookOutput(data)) : await blobDataUrl(await imagePngBlob(await styled(data.images[0].source, data.settings.style), data.settings.rotation));
    const image = await loadEditingImage(source);
    const scale = Math.min(420 / image.naturalWidth, 594 / image.naturalHeight, 1);
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  }
  return canvas.toDataURL("image/webp", .85);
}
