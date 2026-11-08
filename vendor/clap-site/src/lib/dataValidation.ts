import { z } from 'zod/v3';
import { richTextToHtml } from "./richText";


export const MAX_TEXT_LENGTH = 100000;
export const MAX_IMAGE_LENGTH = 32 * 1024 * 1024;
export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;
export const MAX_PAYLOAD_LENGTH = 48 * 1024 * 1024;
const text = z.string().max(MAX_TEXT_LENGTH).refine(value => !value.includes("\0"), "Caractère interdit.");
const rich = text.transform(value => /<\/?[a-z][\s\S]*>/i.test(value) ? richTextToHtml(value) : value).pipe(text);
const id = z.string().min(1).max(100).refine(value => !/[\x00-\x1f]/.test(value));
const score = z.number().finite().min(-10000).max(10000);
const key = z.string().max(80).refine(value => !["__proto__", "constructor", "prototype"].includes(value));
export const rasterImageSchema = z.string().max(MAX_IMAGE_LENGTH).regex(/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/);
export const imageEditingSchema = z.object({ source: rasterImageSchema, rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]), style: z.number().finite().min(0).max(100), crop: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100), zoom: z.number().min(1).max(4) }).optional() });
const editing = imageEditingSchema;
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const checkColor = z.union([z.literal(""), color]);
const checks = z.array(z.boolean()).max(7);
const colors = z.array(checkColor).max(7);
const boundedRecord = <T extends z.ZodTypeAny>(value: T) => z.record(key, value).refine(record => Object.keys(record).length <= 100);
const facet = z.object({ core: score, skills: boundedRecord(score), supernatural: boundedRecord(score) }).partial();
const weapon = z.object({ nom: text.default(""), degats: text.default("") });
export const directoryIdSchema = id;
const base = {
  directoryId: directoryIdSchema,
  id, titre: text, description: text, special: rich, citation: text, notes: text,
  image: rasterImageSchema.optional(), imageEditing: editing.optional(), updatedAt: z.number().finite().nonnegative(),
};
export const resourceSchemas = {
  "key-role": z.object({ ...base, pv: text, corps: text, esprit: text, ame: text, armure: text, armes: z.array(weapon).max(100) }).partial(),
  figurant: z.object({ ...base, potentiel: text, armure: text, armes: z.array(weapon).max(4) }).partial(),
  profile: z.object({ ...base, facetteForteLabel: text, facetteNeutreLabel: text, facetteFaibleLabel: text, facetteForte: text, facetteNeutre: text, facetteFaible: text, traitPlus: text, traitMoins: text }).partial(),
  power: z.object({ ...base, limitations: rich, activation: text, attribut: text, discretion: text }).partial(),
  vehicle: z.object({ ...base, coque: text, maniabilite: text, potentiel: text, vitesse: text, blindage: z.object({ avant: text, gauche: text, droit: text, arriere: text }).partial(), armes: z.array(weapon).max(4) }).partial(),
};
export type ResourceKind = keyof typeof resourceSchemas;
export const linkedResourceSchema = z.object({ type: z.enum(["key-role", "figurant", "profile", "power", "vehicle"]), id });
const heroWeapon = z.object({ nom: text.default(""), degats: text.default(""), proprietes: rich.default("") });
const armor = z.object({ nom: text.default(""), poids: text.default(""), protection: text.default(""), proprietes: rich.default("") });
export const characterInputSchema = z.object({
  directoryId: directoryIdSchema,
  id, nom: text, age: text, taille: text, poids: text, concept: text, replique: text,
  portrait: rasterImageSchema.optional(), portraitEditing: editing.optional(),
  facets: z.object({ corps: facet, esprit: facet, ame: facet }).partial(),
  traits: rich, specialite: rich, lore: text, notes: text,
  armes: z.array(heroWeapon).max(100), accessoires: z.array(heroWeapon).max(100),
  armures: z.array(armor).max(100), protections: z.array(armor).max(100),
  autresAccessoires: z.array(z.object({ nom: text.default(""), proprietes: rich.default(""), quantite: z.number().int().min(0).max(999999).optional() })).max(100),
  injuries: boundedRecord(checks), stress: checks, griefs: checks, cardInk: color,
  cardCheckColors: z.object({ injuries: boundedRecord(colors), stress: colors, griefs: colors }).partial(),
  criticalStates: z.object({ agony: boundedRecord(z.boolean()), mentalBreak: z.boolean(), emotionalBreak: z.boolean() }).partial(),
  pointsRecits: score, destinDiceCount: z.number().finite().min(0).max(100),
  supernaturalEnabled: z.boolean(), mandatoryComplication: z.boolean(), climaxUsed: z.boolean(),
  linkedResources: z.array(linkedResourceSchema).max(200), updatedAt: z.number().finite().nonnegative(),
}).partial();

export function parseData<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error("Données invalides ou trop volumineuses. Vérifie les champs et le fichier importé.");
  return result.data;
}

export function parseJsonData(value: string): unknown {
  if (value.length > MAX_PAYLOAD_LENGTH) throw new Error("Fichier importé trop volumineux.");
  return JSON.parse(value);
}

export function validateResource<K extends ResourceKind>(kind: K, value: unknown): z.infer<(typeof resourceSchemas)[K]> {
  return parseData(resourceSchemas[kind], value) as z.infer<(typeof resourceSchemas)[K]>;
}

export function validateImportedCharacter(value: unknown) {
  return parseData(characterInputSchema.extend({ id, nom: text }), value);
}

export function validateImportedResource<K extends ResourceKind>(kind: K, value: unknown) {
  return parseData(resourceSchemas[kind].extend({ id, titre: text }), value);
}
