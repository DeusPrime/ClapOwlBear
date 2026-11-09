import type { Character } from './characters';

export const roomHeroEditFields = (hero: Character) => ({ cardCheckColors:hero.cardCheckColors,facets:hero.facets,criticalStates:hero.criticalStates,pointsRecits:hero.pointsRecits,destinDiceCount:hero.destinDiceCount,supernaturalEnabled:hero.supernaturalEnabled,mandatoryComplication:hero.mandatoryComplication,climaxUsed:hero.climaxUsed,injuries: hero.injuries, stress: hero.stress, griefs: hero.griefs, notes: hero.notes, armes: hero.armes, armures: hero.armures, autresAccessoires: hero.autresAccessoires });
export function roomHeroEditSignature(hero: Character) {
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value;
  return JSON.stringify(canonical(roomHeroEditFields(hero)));
}

/** Compare multisets so identical objects still produce one notification per change. */
export function roomInventoryChanges(before: Character, after: Character) {
  const changes: { title: string; removed: boolean; item: Record<string, string | number> }[] = [];
  const key = (item: object) => JSON.stringify(Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))));
  for (const category of ['armes', 'armures', 'autresAccessoires'] as const) {
    const remaining = after[category].map(key);
    for (const item of before[category]) {
      const index = remaining.indexOf(key(item));
      if (index >= 0) remaining.splice(index, 1);
      else changes.push({ title: item.nom || 'Objet', removed: true, item: { ...item } });
    }
    for (const serialized of remaining) {
      const item = JSON.parse(serialized) as Record<string, string | number>;
      changes.push({ title: String(item.nom || 'Objet'), removed: false, item });
    }
  }
  return changes;
}
