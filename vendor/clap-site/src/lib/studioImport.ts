import { deleteDirectoryAppearance } from "./directoryAssets";
import JSZip from "jszip";
import { z } from 'zod/v3';
import { createDirectory, loadDirectories, removeDirectory, selectDirectory, updateDirectoryBack, updateDirectoryPoster, type Directory } from "./directories";
import { deleteCharacter, migrateCharacter, upsertCharacter } from "./characters";
import { deleteFigurant, migrateFigurant, upsertFigurant } from "./figurants";
import { deleteKeyRole, migrateKeyRole, upsertKeyRole } from "./keyRoles";
import { deletePower, migratePower, upsertPower } from "./powers";
import { deleteProfile, migrateProfile, upsertProfile } from "./profiles";
import { deleteVehicle, migrateVehicle, upsertVehicle } from "./vehicles";
import { deleteToolDocument, saveToolDocument, type ToolDocument, type ToolPayload } from "./toolDocuments";
import { imageEditingSchema, rasterImageSchema, validateImportedCharacter, validateImportedResource } from "./dataValidation";
import { textCardMetadataShape } from './textCardMetadataSchema';

const text = (max: number, min = 0) => z.string().min(min).max(max).refine(value => !Array.from(value).some(char => char.charCodeAt(0) < 32), "Caractère interdit.");
const id = text(100, 1);
const kind = z.enum(["key-role", "figurant", "profile", "power", "vehicle"]);
const toolKind = z.enum(["a4-sheets", "book-background", "image-conversion"]);
const rotation = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]);
const strength = z.number().finite().min(0).max(100);
const back = { backImage: rasterImageSchema.optional(), backLabel: text(120).optional(), backFilmTitle: text(120).optional(), backEditing: imageEditingSchema.optional() };
const artwork = z.object({
  id: id.optional(), name: text(500), source: rasterImageSchema,
  width: z.number().positive().max(16000), height: z.number().positive().max(16000),
  copies: z.number().int().min(1).max(99).default(1), rotation: rotation.default(0), style: strength.default(0),
  crop: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), zoom: z.number().min(1).max(4) }).default({ x: 0.5, y: 0.5, zoom: 1 }),
  title: text(120).optional(), titleFont: z.enum(["courier-prime", "anton", "typewriter", "sans", "serif", "mono"]).optional(), showTitle: z.boolean().optional(), ...back,
  ...textCardMetadataShape,
  frontImage: rasterImageSchema.optional(),
}).refine(image => image.width * image.height <= 40000000, "Image trop grande.");
const images = z.array(artwork).max(200);
const toolData = z.discriminatedUnion("tool", [
  z.object({ tool: z.literal("a4-sheets"), images, settings: z.object({ fit: z.enum(["cover", "contain", "width", "height"]), zoom: z.number().min(1).max(2), marks: z.boolean(), showTitles: z.boolean().optional(), ...back }) }),
  z.object({ tool: z.literal("book-background"), images, settings: z.object({ strength, side: z.enum(["left", "right"]), tone: z.enum(["light", "dark"]) }) }),
  z.object({ tool: z.literal("image-conversion"), images, settings: z.object({ style: strength, rotation }) }),
]);
const header = z.object({ id, directoryId: id });
const schema = z.object({
  format: z.literal("clap-studio"), version: z.literal(1),
  project: z.object({ id, name: text(80, 1), posterImage: rasterImageSchema.optional(), posterEditing: imageEditingSchema.optional(), backImage: rasterImageSchema.optional(), backFilmTitle: text(120).optional(), backImages: z.object({
    "key-role": rasterImageSchema.optional(), figurant: rasterImageSchema.optional(), profile: rasterImageSchema.optional(), power: rasterImageSchema.optional(), vehicle: rasterImageSchema.optional(),
  }).optional(), backImageEditings: z.record(kind, imageEditingSchema).optional() }),
  heroes: z.array(z.unknown()).max(2000), resources: z.array(z.object({ type: kind, item: z.unknown() })).max(10000),
  tools: z.array(z.object({ id, directoryId: id, name: text(120, 1), kind: toolKind, updatedAt: z.number().finite().nonnegative(), data: toolData.nullable(), preview: rasterImageSchema.nullable().optional() })).max(1000),
});
const resourceStores = {
  "key-role": { migrate: migrateKeyRole, save: upsertKeyRole, remove: deleteKeyRole },
  figurant: { migrate: migrateFigurant, save: upsertFigurant, remove: deleteFigurant },
  profile: { migrate: migrateProfile, save: upsertProfile, remove: deleteProfile },
  power: { migrate: migratePower, save: upsertPower, remove: deletePower },
  vehicle: { migrate: migrateVehicle, save: upsertVehicle, remove: deleteVehicle },
};

export function validateStudioImport(value: unknown) {
  const parsed = schema.parse(value);
  const seen = new Set<string>();
  function check(record: unknown, group: string) {
    const item = header.parse(record);
    if (item.directoryId !== parsed.project.id) throw new Error("Une fiche appartient à un autre projet.");
    const key = `${group}:${item.id}`;
    if (seen.has(key)) throw new Error("Le projet contient des identifiants en double.");
    seen.add(key);
  }
  const heroes = parsed.heroes.map(value => {
    check(value, "hero");
    return migrateCharacter(validateImportedCharacter(value));
  });
  const resources = parsed.resources.map(({ type, item }) => {
    check(item, type);
    return { type, item: resourceStores[type].migrate(validateImportedResource(type, item)) };
  });
  for (const tool of parsed.tools) {
    check(tool, "tool");
    if (tool.data && tool.data.tool !== tool.kind) throw new Error("Les données d’une ressource ne correspondent pas à son type.");
  }
  return { project: parsed.project as Directory, heroes, resources, tools: parsed.tools };
}

export async function readStudioArchive(bytes: ArrayBuffer) {
  try {
    const zip = await JSZip.loadAsync(bytes);
    const file = zip.file("studio.json");
    if (!file) throw new Error("Le fichier studio.json est absent.");
    const json = await file.async("string");
    return validateStudioImport(JSON.parse(json));
  } catch (cause) {
    if (cause instanceof Error && /volumineuse|absent|autre projet|double|correspondent/.test(cause.message)) throw cause;
    throw new Error("Fichier .clapStudio invalide, endommagé ou d’une version non prise en charge.");
  }
}

function availableName(original: string) {
  const reserved = original.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("fr") === "general";
  const base = original.trim().replace(/\s+/g, " ");
  const names = new Set(loadDirectories().map(project => project.name.toLocaleLowerCase("fr")));
  for (let index = 0; ; index++) {
    const suffix = index || reserved ? ` (importé${index > 1 ? ` ${index}` : ""})` : "";
    const name = `${base.slice(0, 80 - suffix.length)}${suffix}`;
    if (!names.has(name.toLocaleLowerCase("fr"))) return name;
  }
}

export async function importStudioArchive(bytes: ArrayBuffer, onProgress: (message: string) => void = () => {}, options: { directoryId?: string; maxHeroes?: number; maxResources?: number; maxEntries?: number; copyAppearance?: boolean } = {}) {
  onProgress("Vérification du projet…");
  const snapshot = await readStudioArchive(bytes);
  // Validate the entire archive before creating any data. Every imported record gets a new identity.
  if (snapshot.heroes.length > (options.maxHeroes ?? Infinity) || snapshot.resources.length > (options.maxResources ?? Infinity)) throw new Error('Le projet dépasse la capacité restante de la salle (100 héros et 500 cartes).');
  if (snapshot.heroes.length + snapshot.resources.length > (options.maxEntries ?? Infinity)) throw new Error('La salle ne peut pas contenir plus de 500 cartes et héros.');
  const target = options.directoryId ? loadDirectories().find(project => project.id === options.directoryId && project.roomKey) : undefined;
  if (options.directoryId && !target) throw new Error('Projet de salle introuvable.');
  const project = target || createDirectory(availableName(snapshot.project.name));
  const heroIds: string[] = [];
  const resourceRefs: { type: typeof snapshot.resources[number]['type']; id: string }[] = [];
  const cleanup: (() => Promise<unknown>)[] = [];
  let unresolvedLinks = 0;
  try {
    if (!target || options.copyAppearance) {
      await updateDirectoryBack(project.id, snapshot.project);
      await updateDirectoryPoster(project.id, snapshot.project.posterImage, snapshot.project.posterEditing);
    }
    const resourceIds = new Map<string, string>();
    for (const resource of snapshot.resources) resourceIds.set(`${resource.type}:${resource.item.id}`, crypto.randomUUID());
    for (const [index, resource] of snapshot.resources.entries()) {
      onProgress(`Carte ${index + 1}/${snapshot.resources.length}`);
      const store = resourceStores[resource.type];
      const item = { ...resource.item, id: resourceIds.get(`${resource.type}:${resource.item.id}`)!, directoryId: project.id };
      resourceRefs.push({ type: resource.type, id: item.id });
      cleanup.push(() => store.remove(item.id));
      // Dispatching the discriminated resource store preserves each resource's validated fields.
      switch (resource.type) {
        case "key-role": await upsertKeyRole(migrateKeyRole(item)); break;
        case "figurant": await upsertFigurant(migrateFigurant(item)); break;
        case "profile": await upsertProfile(migrateProfile(item)); break;
        case "power": await upsertPower(migratePower(item)); break;
        case "vehicle": await upsertVehicle(migrateVehicle(item)); break;
      }
    }
    for (const [index, hero] of snapshot.heroes.entries()) {
      onProgress(`Héros ${index + 1}/${snapshot.heroes.length}`);
      const id = crypto.randomUUID();
      heroIds.push(id);
      const linkedResources = hero.linkedResources.flatMap(link => {
        const mapped = resourceIds.get(`${link.type}:${link.id}`);
        if (!mapped) { unresolvedLinks++; return []; }
        return [{ type: link.type, id: mapped }];
      });
      cleanup.push(() => deleteCharacter(id));
      await upsertCharacter({ ...hero, id, directoryId: project.id, linkedResources });
    }
    for (const [index, tool] of snapshot.tools.entries()) {
      onProgress(`Ressource ${index + 1}/${snapshot.tools.length}`);
      const id = crypto.randomUUID();
      const data = tool.data ? { ...tool.data, images: tool.data.images.map(image => ({ ...image, id: crypto.randomUUID() })) } as ToolPayload : null;
      cleanup.push(() => deleteToolDocument(id));
      await saveToolDocument({ ...tool, id, directoryId: project.id, data } as ToolDocument);
    }
    selectDirectory(project.id);
    return { project, sourceName: snapshot.project.name, heroIds, resourceRefs, heroes: snapshot.heroes.length, resources: snapshot.resources.length, tools: snapshot.tools.length, unresolvedLinks };
  } catch (cause) {
    const rolledBack = [];
    for (const remove of cleanup.reverse()) { try { await remove(); rolledBack.push(true); } catch { rolledBack.push(false); } }
    if (rolledBack.every(Boolean)) {
      try { if (!target) { removeDirectory(project.id); await deleteDirectoryAppearance(project.id); } } catch { throw new Error(`Import interrompu. Le projet « ${project.name} » est incomplet ; les projets existants sont conservés.`); }
      throw new Error(`Import annulé ; les projets existants sont conservés. ${cause instanceof Error ? cause.message : "Stockage indisponible."}`);
    }
    throw new Error(`Import interrompu. Des données partielles restent dans « ${project.name} » ; les projets existants sont conservés.`);
  }
}
