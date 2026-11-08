import { localizeText } from '@/i18n/localize';
import JSZip from "jszip";
import { exportRange, reportExportProgress } from "./exportProgress";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { loadCharacters, type Character } from "./characters";
import { loadDirectories, type Directory } from "./directories";
import { loadAllBundledResources, renderBundledResourcePng, type BundledResource } from "./resourceBundle";
import { loadToolDocuments, type ToolDocument } from "./toolDocuments";
import { renderHeroCardsA6PdfFromView } from "./heroCardsExport";
import { renderResourceCardsPdf } from "./resourceCardsPdf";
import { renderToolPdf } from "./toolPdf";

export type StudioProject = {
  format: "clap-studio"; version: 1; exportedAt: string;
  project: Directory; heroes: Character[]; resources: BundledResource[]; tools: ToolDocument[];
};
export async function collectStudioProject(directoryId: string): Promise<StudioProject> {
  const project = loadDirectories().find(item => item.id === directoryId);
  if (!project) throw new Error("Projet introuvable.");
  const [heroes, resources, tools] = await Promise.all([loadCharacters(), loadAllBundledResources(), loadToolDocuments()]);
  return {
    format: "clap-studio", version: 1, exportedAt: new Date().toISOString(), project: { ...project },
    heroes: heroes.filter(item => item.directoryId === directoryId),
    resources: resources.filter(resource => resource.item.directoryId === directoryId),
    tools: tools.filter(item => item.directoryId === directoryId),
  };
}
export async function exportStudioArchive(project: StudioProject): Promise<Uint8Array> {
  const json = JSON.stringify(project);
  const zip = new JSZip();
  zip.file("studio.json", json);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }, metadata => reportExportProgress(10 + metadata.percent * .9, "Compression du projet .clapStudio…"));
}

export async function exportStudioPdf(project: StudioProject, onProgress: (message: string) => void = () => {}, { includeBacks = true }: { includeBacks?: boolean } = {}): Promise<Blob> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(project.project.name);
  pdf.setCreator("Clap & Role Studio");
  const total = project.heroes.length + (project.resources.length ? 1 : 0) + project.tools.length;
  let completed = 0;
  async function section(task: () => Promise<void>) {
    await exportRange(5 + completed / Math.max(1, total) * 85, 5 + (completed + 1) / Math.max(1, total) * 85, task);
    completed++;
  }
  async function append(blob: Blob) {
    const source = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));
    for (const page of await pdf.copyPages(source, source.getPageIndices())) pdf.addPage(page);
  }
  for (const [index, hero] of project.heroes.entries()) {
    onProgress(`Héros ${index + 1}/${project.heroes.length} : ${hero.nom || "Sans nom"}`);
    // Each hero keeps their complete bundle, including resources shared with other heroes.
    await section(async () => append(await renderHeroCardsA6PdfFromView(hero, { includeBacks })));
  }
  if (project.resources.length) {
    onProgress(`Cartes : ${project.resources.length} cartes${includeBacks ? " et leurs dos" : ""}`);
    const cards = project.resources.map(bundle => ({ titre: bundle.item.titre, directoryId: bundle.item.directoryId, resourceType: bundle.type, bundle }));
    await section(async () => append(await renderResourceCardsPdf(cards, card => renderBundledResourcePng(card.bundle), false, undefined, { includeBacks })));
  }
  for (const [index, tool] of project.tools.entries()) {
    onProgress(`Ressource ${index + 1}/${project.tools.length} : ${tool.name}`);
    await section(async () => append(await renderToolPdf(tool, { includeBacks })));
  }
  if (!pdf.getPageCount()) {
    const page = pdf.addPage();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawText(localizeText("Ce projet ne contient pas encore de fiches ou de ressources."), { x: 40, y: 780, size: 13, font });
  }
  onProgress("Assemblage du PDF…");
  reportExportProgress(95, "Assemblage du projet PDF…");
  return new Blob([await pdf.save() as BlobPart], { type: "application/pdf" });
}
