import { loadCharacters } from './characters';
import { loadAllBundledResources } from './resourceBundle';
import { loadToolDocuments, toolUrl } from './toolDocuments';
import { loadDirectories } from './directories';
import { studioProjectBytesInBackground } from './studioProjectSize';

export type StudioItem = { id: string; directoryId: string; title: string; kind: string; url: string; updatedAt: number; text: string; image?: string };
const sections = { 'key-role': ['Rôle clé', 'key-roles'], figurant: ['Figurant', 'figurants'], profile: ['Profil', 'profils'], power: ['Pouvoir', 'pouvoirs'], vehicle: ['Véhicule', 'vehicules'] };
export const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
export function searchStudio(items: StudioItem[], query: string, kind = '') {
  const words = normalizeSearch(query).trim().split(/\s+/).filter(Boolean);
  return items.filter(item => (!kind || item.kind === kind) && words.every(word => normalizeSearch(`${item.title} ${item.kind} ${item.text}`).includes(word))).sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function loadStudioItems(): Promise<StudioItem[]> {
  const { items } = await loadStudioOverview(false);
  return [
    ...loadDirectories().map(project => ({
      id: project.id,
      directoryId: project.id,
      title: project.name,
      kind: 'Projet',
      url: '/characters',
      updatedAt: items.reduce((latest, item) => item.directoryId === project.id ? Math.max(latest, item.updatedAt) : latest, 0),
      text: project.backFilmTitle || '',
      image: project.posterImage,
    })),
    ...items,
  ];
}
export async function loadStudioOverview(includeSizes = true, signal?: AbortSignal) {
  const [heroes, resources, tools] = await Promise.all([loadCharacters(), loadAllBundledResources(), loadToolDocuments()]);
  const items: StudioItem[] = [
    ...heroes.map(item => ({ id: item.id, directoryId: item.directoryId, title: item.nom || 'Héros sans nom', kind: 'Héros', url: `/characters/${item.id}`, updatedAt: item.updatedAt, text: item.concept || '', image: item.portrait })),
    ...resources.map(({ type, item }) => ({ id: item.id, directoryId: item.directoryId, title: item.titre || 'Sans titre', kind: sections[type][0], url: `/${sections[type][1]}/${item.id}`, updatedAt: item.updatedAt, text: item.description || '', image: item.image })),
    ...tools.map(item => ({ id: item.id, directoryId: item.directoryId, title: item.name, kind: 'Ressource', url: toolUrl(item), updatedAt: item.updatedAt, text: '', image: item.preview || item.data?.images[0]?.source })),
  ];
  const sizes: Record<string, number> = {};
  let sliceStart = performance.now();
  for (const project of includeSizes ? loadDirectories() : []) {
    sizes[project.id] = await studioProjectBytesInBackground({
      project,
      heroes: heroes.filter(item => item.directoryId === project.id),
      resources: resources.filter(({ item }) => item.directoryId === project.id),
      tools: tools.filter(item => item.directoryId === project.id),
    }, signal);
    if (performance.now() - sliceStart >= 8) {
      await new Promise(resolve => setTimeout(resolve, 0));
      sliceStart = performance.now();
    }
  }
  return { items, sizes };
}
