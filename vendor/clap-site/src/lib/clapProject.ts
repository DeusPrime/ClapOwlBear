import type { BackgroundFocus } from "./backgroundFocus";
import { cachedBookImage, bookImageKey } from "./bookStyledImage";
import type { TextCardFields } from "./pokerTextCard";
import JSZip from "jszip";
import { reportExportProgress } from "./exportProgress";
import { z } from 'zod/v3';
import { blobDataUrl, loadEditingImage } from "./imageEditing";
import type { TitleFont } from "./pokerCardTitle";
import { imageEditingSchema } from "./dataValidation";
import type { ImageEditing } from "./imageEditing";
import { textCardMetadataShape } from './textCardMetadataSchema';

const crop = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), zoom: z.number().min(1).max(4) });
const image = z.object({
  name: z.string().max(500), asset: z.string().regex(/^images\/\d+$/),
  copies: z.number().int().min(1).max(99).default(1),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
  style: z.number().min(0).max(100).default(40),
  title: z.string().max(120).optional(),
  titleFont: z.enum(["courier-prime", "anton", "typewriter", "sans", "serif", "mono"]).optional(),
  showTitle: z.boolean().optional(),
  ...textCardMetadataShape,
  backLabel: z.string().max(120).optional(),
  backFilmTitle: z.string().max(120).optional(),
  backAsset: z.string().regex(/^backs\/\d+$/).optional(),
  frontAsset: z.string().regex(/^fronts\/\d+$/).optional(),
  styledAsset: z.string().regex(/^styles\/\d+$/).optional(),
  styledStrength: z.number().min(0).max(100).optional(),
  backEditing: imageEditingSchema.optional(),
  crop: crop.default({ x: 0.5, y: 0.5, zoom: 1 }),
});
const common = { format: z.literal("clap-project"), version: z.literal(1), images: z.array(image).max(200) };
const projectSchema = z.discriminatedUnion("tool", [
  z.object({ ...common, tool: z.literal("image-conversion"), settings: z.object({ style: z.number().min(0).max(100), rotation: z.number().refine(value => [0, 90, 180, 270].includes(value)), focus: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().min(0.1).max(1.5), height: z.number().min(0.1).max(1.5), amount: z.number().min(0).max(1) }).optional() }) }),
  z.object({ ...common, tool: z.literal("book-background"), settings: z.object({ strength: z.number().min(0).max(100), side: z.enum(["left", "right"]), tone: z.enum(["light", "dark"]) }) }),
  z.object({ ...common, tool: z.literal("a4-sheets"), settings: z.object({ fit: z.enum(["cover", "contain", "width", "height"]), zoom: z.number().min(1).max(2), marks: z.boolean(), showTitles: z.boolean().optional(), backLabel: z.string().max(120).optional(), backFilmTitle: z.string().max(120).optional(), backAsset: z.literal("global-back").optional(), backEditing: imageEditingSchema.optional() }) }),
]);
type Manifest = z.infer<typeof projectSchema>;
export type ProjectArtwork = TextCardFields & {
  styledImage?: { source: string; strength: number; originalKey: string };
  name: string; source: string; width: number; height: number; copies: number;
  rotation: 0 | 90 | 180 | 270; style: number; crop: { x: number; y: number; zoom: number };
  title?: string; titleFont?: TitleFont;
  showTitle?: boolean; backLabel?: string; backImage?: string; backFilmTitle?: string; backEditing?: ImageEditing;
};
export type ProjectInput =
  | { tool: "image-conversion"; settings: { style: number; rotation: number; focus?: BackgroundFocus }; images: { id: string; name: string; source: string; width: number; height: number }[] }
  | { tool: "book-background"; settings: { strength: number; side: "left" | "right"; tone: "light" | "dark" }; images: ProjectArtwork[] }
  | { tool: "a4-sheets"; settings: { fit: "cover" | "contain" | "width" | "height"; zoom: number; marks: boolean; showTitles?: boolean; backLabel?: string; backImage?: string; backFilmTitle?: string; backEditing?: ImageEditing }; images: ProjectArtwork[] };
export type ClapProject = ProjectInput & { format: "clap-project"; version: 1 };

export async function exportClapProject(project: ProjectInput): Promise<Uint8Array> {
  const globalBackImage = project.tool === "a4-sheets" ? project.settings.backImage : undefined;
  const caches = project.tool === "a4-sheets" ? project.images.map(image => cachedBookImage(image, image.style)) : [];
  const sourcesByGroup = new Map<string, Map<string, string>>();
  const assetsToWrite = new Map<string, string>();
  const assetPath = (group: string, index: number, source: string) => {
    let sources = sourcesByGroup.get(group);
    if (!sources) { sources = new Map(); sourcesByGroup.set(group, sources); }
    const existing = sources.get(source); if (existing) return existing;
    const path = `${group}/${index}`;
    sources.set(source, path); assetsToWrite.set(path, source); return path;
  };
  const manifest = projectSchema.parse({ ...project, settings: { ...project.settings, ...(globalBackImage ? { backAsset: "global-back" } : {}) }, format: "clap-project", version: 1, images: project.images.map((item, index) => ({ ...item, asset: assetPath("images", index, item.source), ...("backImage" in item && item.backImage ? { backAsset: assetPath("backs", index, item.backImage) } : {}), ...("frontImage" in item && item.frontImage ? { frontAsset: assetPath("fronts", index, item.frontImage) } : {}), ...(caches[index] && "style" in item ? { styledAsset: assetPath("styles", index, caches[index]!), styledStrength: item.style } : {}) })) });
  const zip = new JSZip();
  let written = 0;
  for (const [path, source] of assetsToWrite) {
      if (!source.startsWith("blob:") && !/^data:image\/(png|jpeg|webp|gif);base64,/.test(source)) throw new Error("Source d’image invalide.");
      const bytes = new Uint8Array(await (await fetch(source)).arrayBuffer());
      zip.file(path, bytes);
    written++;
    reportExportProgress(10 + written / Math.max(1, assetsToWrite.size) * 50, `Images ${written}/${assetsToWrite.size}`);
  }
  if (globalBackImage) {
    if (!globalBackImage.startsWith("blob:") && !/^data:image\/(png|jpeg|webp|gif);base64,/.test(globalBackImage)) throw new Error("Source d’image invalide.");
    const bytes = new Uint8Array(await (await fetch(globalBackImage)).arrayBuffer());
    zip.file("global-back", bytes);
  }
  const json = JSON.stringify(manifest);
  zip.file("project.json", json);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }, metadata => reportExportProgress(60 + metadata.percent * .4, "Compression de l’archive .clap…"));
}

export async function importClapProject(bytes: ArrayBuffer, expectedTool: Manifest["tool"]): Promise<ClapProject> {
  try {
    const zip = await JSZip.loadAsync(bytes);
    // Validate archive structure before reading entries.
    const entries = Object.values(zip.files);
    if (entries.length > 806) throw new Error("Archive trop volumineuse.");
    const file = zip.file("project.json");
    if (!file) throw new Error("Projet manquant.");
    const manifest = projectSchema.parse(JSON.parse(await file.async("string")));
    if (manifest.tool !== expectedTool) throw new Error(manifest.tool === "book-background" ? "Ce projet doit être ouvert dans Fonds de livre." : manifest.tool === "image-conversion" ? "Ce projet doit être ouvert dans Conversion d’images." : "Ce projet doit être ouvert dans Planches d’images A4.");
    const images: ProjectArtwork[] = [];
    for (const item of manifest.images) {
      const asset = zip.file(item.asset);
      if (!asset) throw new Error("Une image du projet est manquante.");
      const data = await asset.async("arraybuffer");
      const source = await blobDataUrl(new Blob([data]));
      const loaded = await loadEditingImage(source);
      const { asset: _, backAsset, frontAsset, styledAsset, styledStrength, ...metadata } = item;
      let styledImage: ProjectArtwork["styledImage"];
      if (styledAsset && styledStrength === item.style) {
        const cached = zip.file(styledAsset);
        if (cached) {
          try {
            const styledSource = await blobDataUrl(new Blob([await cached.async("arraybuffer")]));
            await loadEditingImage(styledSource);
            styledImage = { source: styledSource, strength: styledStrength, originalKey: bookImageKey(source) };
          } catch { /* Optional cache: regenerate if it cannot be decoded. */ }
        }
      }
      let backImage: string | undefined;
      if (backAsset) {
        const back = zip.file(backAsset);
        if (!back) throw new Error("Une image de dos du projet est manquante.");
        backImage = await blobDataUrl(new Blob([await back.async("arraybuffer")]));
        await loadEditingImage(backImage);
      }
      let frontImage: string | undefined;
      if (frontAsset) {
        const front = zip.file(frontAsset);
        if (!front) throw new Error("Une image de recto du projet est manquante.");
        frontImage = await blobDataUrl(new Blob([await front.async("arraybuffer")]));
        await loadEditingImage(frontImage);
      }
      images.push({ ...metadata, ...(styledImage ? { styledImage } : {}), ...(frontImage ? { frontImage } : {}), source, width: loaded.naturalWidth, height: loaded.naturalHeight, ...(backImage ? { backImage } : {}) } as ProjectArtwork);
    }
    if (manifest.tool === "a4-sheets") {
      const { backAsset, ...settings } = manifest.settings;
      let backImage: string | undefined;
      if (backAsset) {
        const asset = zip.file(backAsset);
        if (!asset) throw new Error("L’image du dos global est manquante.");
        backImage = await blobDataUrl(new Blob([await asset.async("arraybuffer")]));
        await loadEditingImage(backImage);
      }
      return { ...manifest, settings: { ...settings, ...(backImage ? { backImage } : {}) }, images } as ClapProject;
    }
    return { ...manifest, images: manifest.tool === "image-conversion" ? images.map(image => ({ ...image, id: crypto.randomUUID() })) : images } as ClapProject;
  } catch (error) {
    if (error instanceof Error && /Ce projet doit|manquante|volumineuse/.test(error.message)) throw error;
    throw new Error("Archive .clap invalide, endommagée ou d’une version non prise en charge.");
  }
}
