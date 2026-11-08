import { useSyncExternalStore } from "react";

const query = "(display-mode: standalone)";
const getSnapshot = () => window.matchMedia(query).matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};

export function useAppMode() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
