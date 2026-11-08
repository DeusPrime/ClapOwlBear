import { createDirectory, loadDirectories } from './directories';

/** Keep a room's local project even when its invitation or active project changes. */
export function ensureRoomProject(roomKey: string, title: string, currentDirectoryId?: string) {
  const directories = loadDirectories();
  const existing = directories.find(directory => directory.id === currentDirectoryId && directory.roomKey)
    || directories.find(directory => directory.roomKey === roomKey);
  if (existing) return existing;
  const base = ('Salle: ' + (title.trim().replace(/\s+/g, ' ') || 'Sans nom')).slice(0, 80);
  const reserved = base.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr') === 'general';
  let name = base;
  let number = 1;
  while (reserved && name === base || directories.some(directory => directory.name.toLocaleLowerCase('fr') === name.toLocaleLowerCase('fr'))) {
    const suffix = number++ === 1 ? ' (salle)' : ` (salle ${number - 1})`;
    name = base.slice(0, 80 - suffix.length) + suffix;
  }
  return createDirectory(name, { roomKey });
}
