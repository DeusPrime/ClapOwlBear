import { loadDirectories, removeDirectory } from './directories';

/** Delete only editable copies owned by this room, never its source projects. */
export async function removeRoomCopies(roomId: string) {
  const projects = loadDirectories().filter(project => project.roomKey === roomId);
  const ids = new Set(projects.map(project => project.id));
  if (!ids.size) return;
  const { loadCharacters, deleteCharacter } = await import('./characters');
  const { loadAllBundledResources } = await import('./resourceBundle');
  const { loadToolDocuments, deleteToolDocument } = await import('./toolDocuments');
  const [heroes, resources, tools] = await Promise.all([loadCharacters(), loadAllBundledResources(), loadToolDocuments()]);
  for (const hero of heroes) if (ids.has(hero.directoryId)) await deleteCharacter(hero.id);
  const removers = {
    'key-role': (await import('./keyRoles')).deleteKeyRole,
    figurant: (await import('./figurants')).deleteFigurant,
    profile: (await import('./profiles')).deleteProfile,
    power: (await import('./powers')).deletePower,
    vehicle: (await import('./vehicles')).deleteVehicle,
  };
  for (const resource of resources) if (ids.has(resource.item.directoryId)) await removers[resource.type](resource.item.id);
  for (const tool of tools) if (ids.has(tool.directoryId)) await deleteToolDocument(tool.id);
  for (const project of projects) removeDirectory(project.id);
}
