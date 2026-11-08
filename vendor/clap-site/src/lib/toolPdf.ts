import { prepareA4Image } from "./a4StyledImage";
import { localizeText } from '@/i18n/localize';
import { PDFDocument, StandardFonts } from "pdf-lib";
import { exportRange, reportExportProgress } from "./exportProgress";
import type { ToolDocument } from "./toolDocuments";
import { createClapStyleBlob } from "./clapImageStyle";
import { blobDataUrl, imagePngBlob } from "./imageEditing";
import { exportPokerPdf } from "./pokerCardsPdf";
import { renderBookBackground } from "./bookBackground";

export async function renderToolPdf(tool: ToolDocument, { includeBacks = true }: { includeBacks?: boolean } = {}): Promise<Blob> {
  const data = tool.data;
  const pdf = await PDFDocument.create();
  pdf.setTitle(tool.name);
  async function imagePage(blob: Blob) {
    const image = await pdf.embedPng(await blob.arrayBuffer());
    const page = pdf.addPage([595.28, 841.89]);
    const scale = Math.min((page.getWidth() - 28) / image.width, (page.getHeight() - 28) / image.height);
    const width = image.width * scale, height = image.height * scale;
    page.drawImage(image, { x: (page.getWidth() - width) / 2, y: (page.getHeight() - height) / 2, width, height });
  }
  if (!data?.images.length) {
    const page = pdf.addPage();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const title = tool.name.replace(/[^\x20-\x7e\xa0-\xff]/g, "?").slice(0, 75);
    page.drawText(localizeText(title), { x: 40, y: 780, size: 16, font });
    page.drawText(localizeText("Aucune image enregistree dans cette ressource."), { x: 40, y: 750, size: 12, font });
  } else if (data.tool === "a4-sheets") {
    const images: Parameters<typeof exportPokerPdf>[0] = [];
    for (const [index, image] of data.images.entries()) {
      reportExportProgress(5 + index / data.images.length * 35, `Stylisation ${index + 1}/${data.images.length}`);
      const styledUrl = await prepareA4Image(image);
      images.push({ ...image, id: String(index), url: image.source, styledUrl, styledStrength: image.style });
    }
    return exportRange(40, 100, () => exportPokerPdf(images, data.settings.fit, data.settings.marks, data.settings.zoom, data.settings.showTitles, data.settings, { includeBacks }));
  } else if (data.tool === "book-background") {
    const sources = [];
    for (const [index, image] of data.images.entries()) {
      reportExportProgress(10 + index / data.images.length * 65, `Images du fond ${index + 1}/${data.images.length}`);
      sources.push(data.settings.strength ? await blobDataUrl(await createClapStyleBlob(image.source, data.settings.strength)) : image.source);
    }
    await imagePage(await renderBookBackground(sources, data.settings.side, data.settings.tone, data.images.map(image => image.crop)));
  } else {
    for (const [index, image] of data.images.entries()) {
      reportExportProgress(10 + index / data.images.length * 80, `Images ${index + 1}/${data.images.length}`);
      const source = data.settings.style ? await blobDataUrl(await createClapStyleBlob(image.source, data.settings.style)) : image.source;
      await imagePage(await imagePngBlob(source, data.settings.rotation));
    }
  }
  reportExportProgress(95, "Assemblage du PDF de la ressource…");
  return new Blob([await pdf.save() as BlobPart], { type: "application/pdf" });
}
