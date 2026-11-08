import { deleteDirectoryAppearance } from "./directoryAssets";
import { loadCharacters, deleteCharacter, upsertCharacter } from "./characters";
import { loadKeyRoles, deleteKeyRole } from "./keyRoles";
import { loadFigurants, deleteFigurant } from "./figurants";
import { loadProfiles, deleteProfile } from "./profiles";
import { loadPowers, deletePower } from "./powers";
import { loadVehicles, deleteVehicle } from "./vehicles";
import { isProtectedDirectory, loadDirectories, removeDirectory } from "./directories";
import { loadToolDocuments, deleteToolDocument } from "./toolDocuments";

export async function deleteDirectoryWithContents(directoryId: string) {
  if (isProtectedDirectory(directoryId)) throw new Error("Le projet Général ne peut pas être supprimé.");
  if (!loadDirectories().some(item => item.id === directoryId)) throw new Error("Projet introuvable.");
  // Load everything before changing any records. Other directories can link to these resources.
  const [characters, roles, figurants, profiles, powers, vehicles, tools] = await Promise.all([
    loadCharacters(), loadKeyRoles(), loadFigurants(), loadProfiles(), loadPowers(), loadVehicles(), loadToolDocuments(),
  ]);
  const groups = [
    { type: "key-role", items: roles, remove: deleteKeyRole },
    { type: "figurant", items: figurants, remove: deleteFigurant },
    { type: "profile", items: profiles, remove: deleteProfile },
    { type: "power", items: powers, remove: deletePower },
    { type: "vehicle", items: vehicles, remove: deleteVehicle },
  ];
  const removedKeys = new Set(groups.flatMap(group => group.items.filter(item => item.directoryId === directoryId).map(item => `${group.type}:${item.id}`)));
  for (const character of characters) {
    if (character.directoryId === directoryId) continue;
    const linkedResources = character.linkedResources.filter(item => !removedKeys.has(`${item.type}:${item.id}`));
    if (linkedResources.length !== character.linkedResources.length) await upsertCharacter({ ...character, linkedResources, updatedAt: Date.now() });
  }
  for (const group of groups) {
    for (const item of group.items) if (item.directoryId === directoryId) await group.remove(item.id);
  }
  for (const character of characters) if (character.directoryId === directoryId) await deleteCharacter(character.id);
  for (const tool of tools) if (tool.directoryId === directoryId) await deleteToolDocument(tool.id);
  const remaining = removeDirectory(directoryId);
  await deleteDirectoryAppearance(directoryId);
  return remaining;
}
