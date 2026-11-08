import { activeDirectory } from "./directories";
import { parseJsonData, validateImportedResource, MAX_PAYLOAD_LENGTH } from "./dataValidation";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import type { Character, LinkedResource, LinkedResourceType } from "./characters";
import { migrateFigurant, loadFigurants, upsertFigurant, type Figurant } from "./figurants";
import { migrateKeyRole, loadKeyRoles, upsertKeyRole, type KeyRole } from "./keyRoles";
import { migratePower, loadPowers, upsertPower, type Power } from "./powers";
import { migrateProfile, loadProfiles, upsertProfile, type Profile } from "./profiles";
import { migrateVehicle, loadVehicles, upsertVehicle, type Vehicle } from "./vehicles";
import { exportFigurantPng } from "./figurantPng";
import { exportKeyRolePng } from "./keyRolePng";
import { exportPowerPng } from "./powerPng";
import { exportProfilePng } from "./profilePng";
import { exportVehiclePng } from "./vehiclePng";

export const RESOURCE_BUNDLE_ATTACHMENT_NAME = "clap-role-resources.json";
export const RESOURCE_BUNDLE_PNG_KEY = "clap-role-resources";

export type BundledResource =
  | { type: "key-role"; item: KeyRole }
  | { type: "figurant"; item: Figurant }
  | { type: "profile"; item: Profile }
  | { type: "power"; item: Power }
  | { type: "vehicle"; item: Vehicle };

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== "id" && key !== "updatedAt")
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
};

export const resourceContentHash = async (type: LinkedResourceType, item: object) => {
  const bytes = new TextEncoder().encode(JSON.stringify({ type, data: stableValue(item) }));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const resourceContentId = async (type: LinkedResourceType, item: object) =>
  `${type}-${(await resourceContentHash(type, item)).slice(0, 32)}`;

export const loadAllBundledResources = async (): Promise<BundledResource[]> => {
  const [roles, figurants, profiles, powers, vehicles] = await Promise.all([
    loadKeyRoles(), loadFigurants(), loadProfiles(), loadPowers(), loadVehicles(),
  ]);
  return [
    ...roles.map((item): BundledResource => ({ type: "key-role", item })),
    ...figurants.map((item): BundledResource => ({ type: "figurant", item })),
    ...profiles.map((item): BundledResource => ({ type: "profile", item })),
    ...powers.map((item): BundledResource => ({ type: "power", item })),
    ...vehicles.map((item): BundledResource => ({ type: "vehicle", item })),
  ];
};

export const loadLinkedBundledResources = async (character: Character) => {
  const wanted = new Set(character.linkedResources.map((resource) => `${resource.type}:${resource.id}`));
  return (await loadAllBundledResources()).filter((resource) => wanted.has(`${resource.type}:${resource.item.id}`));
};

export const renderBundledResourcePng = (resource: BundledResource) =>
  resource.type === "key-role" ? exportKeyRolePng(resource.item)
  : resource.type === "figurant" ? exportFigurantPng(resource.item)
  : resource.type === "profile" ? exportProfilePng(resource.item)
  : resource.type === "power" ? exportPowerPng(resource.item)
  : exportVehiclePng(resource.item);

export const attachResourceBundle = async (pdf: PDFDocument, resources: BundledResource[]) => {
  if (resources.length === 0) return;
  await pdf.attach(new TextEncoder().encode(JSON.stringify({ version: 1, resources })), RESOURCE_BUNDLE_ATTACHMENT_NAME, {
    mimeType: "application/json",
    description: "Cartes liees Clap & Role",
    creationDate: new Date(),
    modificationDate: new Date(),
  });
};

export const serializeResourceBundle = (resources: BundledResource[]) =>
  JSON.stringify({ version: 1, resources });

const readAttachment = (pdf: PDFDocument, attachmentName: string): Uint8Array | null => {
  try {
    const names = pdf.catalog.lookupMaybe(PDFName.of("Names"), PDFDict);
    const embeddedFiles = names?.lookupMaybe(PDFName.of("EmbeddedFiles"), PDFDict);
    const fileNames = embeddedFiles?.lookupMaybe(PDFName.of("Names"), PDFArray);
    if (!fileNames) return null;
    for (let index = 0; index < fileNames.size(); index += 2) {
      const fileName = fileNames.lookup(index) as { decodeText?: () => string } | undefined;
      if (fileName?.decodeText?.() !== attachmentName) continue;
      const fileSpec = fileNames.lookup(index + 1, PDFDict);
      const ef = fileSpec.lookupMaybe(PDFName.of("EF"), PDFDict);
      const stream = ef?.lookup(PDFName.of("F"));
      if (stream instanceof PDFRawStream) {
        const bytes = decodePDFRawStream(stream).decode();
        if (bytes.length > MAX_PAYLOAD_LENGTH) return null;
        return bytes;
      }
    }
  } catch { /* Invalid or absent attachment. */ }
  return null;
};

const migrations = { "key-role": migrateKeyRole, figurant: migrateFigurant, profile: migrateProfile, power: migratePower, vehicle: migrateVehicle };

export const upsertBundledResource = async (resource: BundledResource) => {
  if (resource.type === "key-role") await upsertKeyRole(resource.item);
  else if (resource.type === "figurant") await upsertFigurant(resource.item);
  else if (resource.type === "profile") await upsertProfile(resource.item);
  else if (resource.type === "power") await upsertPower(resource.item);
  else await upsertVehicle(resource.item);
};

export const importResourceBundlePayload = async (payloadText: string, character: Character) => {
  try {
    const payload = parseJsonData(payloadText) as { resources?: unknown };
    if (!Array.isArray(payload?.resources) || payload.resources.length > 200) return character;
    const incoming = payload.resources.map((value: any): BundledResource => {
      if (!value || !Object.prototype.hasOwnProperty.call(migrations, value.type)) throw new Error("Invalid resource type");
      const item = validateImportedResource(value.type, value.item);
      return { type: value.type, item: { ...migrations[value.type as keyof typeof migrations](item), directoryId: activeDirectory() } } as BundledResource;
    });
    const existing = await loadAllBundledResources();
    const existingHashes = new Map<string, BundledResource>();
    for (const resource of existing) {
      existingHashes.set(`${resource.type}:${await resourceContentHash(resource.type, resource.item)}`, resource);
    }
    const linkedResources: LinkedResource[] = [];
    for (const resource of incoming) {
      if (!resource?.item || !["key-role", "figurant", "profile", "power", "vehicle"].includes(resource.type)) continue;
      const hash = await resourceContentHash(resource.type, resource.item);
      const match = existingHashes.get(`${resource.type}:${hash}`);
      if (match) {
        linkedResources.push({ type: match.type, id: match.item.id });
        continue;
      }
      resource.item.id = `${resource.type}-${hash.slice(0, 32)}`;
      resource.item.updatedAt = Date.now();
      await upsertBundledResource(resource);
      existingHashes.set(`${resource.type}:${hash}`, resource);
      linkedResources.push({ type: resource.type, id: resource.item.id });
    }
    character.linkedResources = linkedResources;
  } catch { /* Keep character import usable if the resource bundle is damaged. */ }
  return character;
};

export const importResourceBundle = async (pdf: PDFDocument, character: Character) => {
  const bytes = readAttachment(pdf, RESOURCE_BUNDLE_ATTACHMENT_NAME);
  if (!bytes) return character;
  return importResourceBundlePayload(new TextDecoder().decode(bytes), character);
};
