import { type Character, type LinkedResource } from "./characters";
import { roomResourceSchema } from "./roomProtocol";
import { loadAllBundledResources, resourceContentHash, upsertBundledResource, type BundledResource } from "./resourceBundle";

export function transferableRoomResource(resource: BundledResource) {
  const { imageEditing: _editing, ...item } = resource.item;
  const parsed = roomResourceSchema.safeParse({ type: resource.type, item });
  if (!parsed.success) throw new Error("Cette carte est invalide ou trop volumineuse pour être transmise.");
  return parsed.data;
}
export async function importRoomResource(resource: BundledResource, hero: Character): Promise<LinkedResource> {
  const incoming = transferableRoomResource(resource);
  const item = { ...incoming.item, directoryId: hero.directoryId };
  const digest = await resourceContentHash(incoming.type, item);
  const existing = await loadAllBundledResources();
  for (const candidate of existing) {
    if (candidate.type === incoming.type && candidate.item.directoryId === hero.directoryId && await resourceContentHash(candidate.type, candidate.item) === digest) return { type: candidate.type, id: candidate.item.id };
  }
  let id = `${incoming.type}-${digest.slice(0, 32)}`;
  if (existing.some(candidate => candidate.type === incoming.type && candidate.item.id === id)) id = crypto.randomUUID();
  await upsertBundledResource({ type: incoming.type, item: { ...item, id, updatedAt: Date.now() } } as BundledResource);
  return { type: incoming.type, id };
}
