import { PDFDocument, type PDFImage } from "pdf-lib";
import { renderPokerBackPng } from "./pokerCardBack";
import { loadDirectories, resourceBackImage } from "./directories";
import type { ResourceKind } from "./dataValidation";
import { RESOURCE_APPEARANCE } from "./resourceAppearance";
import { mirroredSheetSlot } from "./duplexLayout";
import { reportExportProgress } from "./exportProgress";

type ResourceCard = { titre: string; image?: string; directoryId?: string; resourceType?: ResourceKind };
const MM = 2.83465;
const PAGE_W = 210 * MM, PAGE_H = 297 * MM;
const WIDTH = 63 * MM, HEIGHT = 88 * MM, GAP = 3 * MM;
const marginX = (PAGE_W - 3 * WIDTH - 2 * GAP) / 2;
const marginY = (PAGE_H - 3 * HEIGHT - 2 * GAP) / 2;
function position(index: number, centered: boolean) {
  return centered
    ? { x: (PAGE_W - WIDTH) / 2, y: PAGE_H - 9 * MM - HEIGHT }
    : { x: marginX + index % 3 * (WIDTH + GAP), y: PAGE_H - marginY - HEIGHT - Math.floor(index / 3) * (HEIGHT + GAP) };
}
export async function appendResourceBackPages<T extends ResourceCard>(pdf: PDFDocument, resources: readonly T[], centered = false, resourceType?: ResourceKind) {
  if (!resources.length) return;
  const directories = loadDirectories();
  const backs = new Map<string, PDFImage>();
  const perPage = centered ? 1 : 9;
  for (let start = 0; start < resources.length; start += perPage) {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    for (const [index, resource] of resources.slice(start, start + perPage).entries()) {
      reportExportProgress(65 + (start + index) / resources.length * 25, `Dos ${start + index + 1}/${resources.length}`);
      const { x, y } = position(centered ? index : mirroredSheetSlot(index, 3), centered);
      const directory = directories.find(item => item.id === resource.directoryId);
      const type = resource.resourceType ?? resourceType;
      const appearance = type ? RESOURCE_APPEARANCE[type] : { label: "Carte", color: "black" };
      const options = { backLabel: appearance.label, borderColor: appearance.color, backImage: type ? resourceBackImage(directory, type) : directory?.backImage, backFilmTitle: directory?.backFilmTitle };
      const key = JSON.stringify(options);
      let back = backs.get(key);
      if (!back) {
        const blob = await renderPokerBackPng(options);
        back = await pdf.embedPng(new Uint8Array(await blob.arrayBuffer()));
        backs.set(key, back);
      }
      page.drawImage(back, { x, y, width: WIDTH, height: HEIGHT });
    }
  }
}

export async function renderResourceCardsPdf<T extends ResourceCard>(resources: readonly T[], renderFront: (resource: T) => Promise<Blob>, centered = false, resourceType?: ResourceKind, { includeBacks = true }: { includeBacks?: boolean } = {}): Promise<Blob> {
  const pdf = await PDFDocument.create();
  const perPage = centered ? 1 : 9;
  for (let start = 0; start < resources.length; start += perPage) {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    for (const [index, resource] of resources.slice(start, start + perPage).entries()) {
      reportExportProgress(10 + (start + index) / resources.length * 55, `Cartes ${start + index + 1}/${resources.length}`);
      const blob = await renderFront(resource);
      const png = await pdf.embedPng(new Uint8Array(await blob.arrayBuffer()));
      page.drawImage(png, { ...position(index, centered), width: WIDTH, height: HEIGHT });
    }
  }
  if (includeBacks) await appendResourceBackPages(pdf, resources, centered, resourceType);
  reportExportProgress(95, "Assemblage du PDF…");
  return new Blob([await pdf.save() as BlobPart], { type: "application/pdf" });
}
