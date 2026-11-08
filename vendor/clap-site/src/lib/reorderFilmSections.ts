import type { BookSection } from './filmBooks';

export function reorderFilmSections(sections: BookSection[], sourceId: string, targetId: string) {
  const movable = sections.filter(section => !section.kind);
  const from = movable.findIndex(section => section.id === sourceId);
  const to = movable.findIndex(section => section.id === targetId);
  if (from < 0 || to < 0 || from === to) return sections;
  movable.splice(to, 0, movable.splice(from, 1)[0]);
  let index = 0;
  return sections.map(section => section.kind ? section : movable[index++]);
}
