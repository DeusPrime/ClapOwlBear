import { useSyncExternalStore } from "react";
import { DIRECTORY_BACK_CHANGED, loadDirectories, type Directory } from "@/lib/directories";

let snapshot: Directory[] | undefined;
const listeners = new Set<() => void>();
const read = () => snapshot ??= loadDirectories();
function refresh() { snapshot = loadDirectories(); listeners.forEach(listener => listener()); }
function subscribe(listener: () => void) {
  if (!listeners.size) window.addEventListener(DIRECTORY_BACK_CHANGED, refresh);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { window.removeEventListener(DIRECTORY_BACK_CHANGED, refresh); snapshot = undefined; }
  };
}
// Eagerly mounted backs share one settings snapshot rather than parsing image data once per card.
export function useResourceBackDirectories() { return useSyncExternalStore(subscribe, read, read); }
