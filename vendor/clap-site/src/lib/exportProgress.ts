type State = { active: boolean; percent: number; label: string; detail: string };
let state: State = { active: false, percent: 0, label: "Export en cours", detail: "" };
const listeners = new Set<() => void>();
let range: [number, number] = [0, 95];
let running = false;
let failed = false;
export function failExportProgress() { failed = true; }
export const subscribeExportProgress = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getExportProgress = () => state;
function update(next: Partial<State>) { state = { ...state, ...next }; listeners.forEach(listener => listener()); }
export function reportExportProgress(percent: number, detail = "") {
  if (!running) return;
  const mapped = range[0] + Math.max(0, Math.min(100, percent)) / 100 * (range[1] - range[0]);
  update({ percent: Math.max(state.percent, Math.round(mapped)), detail: detail || state.detail });
}
export async function exportRange<T>(start: number, end: number, task: () => Promise<T>): Promise<T> {
  const parent = range;
  range = [parent[0] + start / 100 * (parent[1] - parent[0]), parent[0] + end / 100 * (parent[1] - parent[0])];
  try { const value = await task(); reportExportProgress(100); return value; }
  finally { range = parent; }
}
/** Percentages follow completed rendering/compression steps, never an elapsed-time timer. */
export async function withExportProgress<T>(task: () => Promise<T>, label = "Export en cours"): Promise<T | undefined> {
  if (running) return;
  running = true; failed = false; range = [0, 95];
  update({ active: true, percent: 0, label, detail: "Préparation du fichier…" });
  try {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    reportExportProgress(5, "Préparation des images et des données…");
    const result = await task();
    if (failed) return result;
    update({ percent: 100, detail: "Fichier prêt." });
    await new Promise<void>(resolve => setTimeout(resolve, 250));
    return result;
  } finally { running = false; update({ active: false }); }
}
