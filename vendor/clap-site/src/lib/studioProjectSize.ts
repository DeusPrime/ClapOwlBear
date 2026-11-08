import type { StudioProject } from './studioProject';

// Measure the same UTF-8 JSON as the archive exporter, one record at a time.
// This avoids allocating a second complete, image-heavy project just to show its size.
type ProjectData = Omit<StudioProject, 'format' | 'version' | 'exportedAt'> & { exportedAt?: string };
function* projectByteChunks(project: ProjectData) {
  const encoder = new TextEncoder();
  const base = {
    format: 'clap-studio', version: 1, exportedAt: project.exportedAt ?? '2000-01-01T00:00:00.000Z',
    project: project.project, heroes: [], resources: [], tools: [],
  };
  yield encoder.encode(JSON.stringify(base)).byteLength;
  for (const records of [project.heroes, project.resources, project.tools]) {
    yield Math.max(0, records.length - 1); // JSON array commas.
    for (const record of records) yield encoder.encode(JSON.stringify(record)).byteLength;
  }
}

export function studioProjectBytes(project: ProjectData) {
  let bytes = 0;
  for (const chunk of projectByteChunks(project)) bytes += chunk;
  return bytes;
}

// Let clicks and navigation run between records instead of blocking the studio
// while serializing every project's images. Stop when the page is left.
export async function studioProjectBytesInBackground(project: ProjectData, signal?: AbortSignal) {
  let bytes = 0;
  let sliceStart = performance.now();
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  for (const chunk of projectByteChunks(project)) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    bytes += chunk;
    if (performance.now() - sliceStart >= 8) {
      await new Promise(resolve => setTimeout(resolve, 0));
      sliceStart = performance.now();
    }
  }
  return bytes;
}

export function formatStudioBytes(bytes: number, language = 'fr') {
  const units = language === 'en' ? ['B', 'KB', 'MB', 'GB'] : ['o', 'Ko', 'Mo', 'Go'];
  const unit = bytes > 0 ? Math.min(3, Math.floor(Math.log(bytes) / Math.log(1024))) : 0;
  return `${new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'fr-FR', { maximumFractionDigits: unit ? 1 : 0 }).format(bytes / 1024 ** unit)} ${units[unit]}`;
}
