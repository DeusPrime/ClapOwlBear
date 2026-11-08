import { localizeText } from "@/i18n/localize";

export const facetNames: Record<string, string> = { corps: "Corps", esprit: "Esprit", ame: "Âme", vehicle: "Véhicule", potentiel: "Potentiel" };
const tones: Record<string, string> = {
  corps: "text-red-800 dark:text-red-300",
  esprit: "text-green-800 dark:text-green-300",
  ame: "text-blue-800 dark:text-blue-300",
  vehicle: "text-orange-800 dark:text-orange-300",
};
/** Miniature reel: the radial ring echoes the character sheet's attribute dials. */
export default function RollAttributeDial({ name, value, facet, selected = false }: { name: string; value: number; facet: string; selected?: boolean }) {
  return <span className="flex min-w-0 flex-col items-center gap-1.5">
    <span className={`relative flex h-16 w-16 shrink-0 items-center justify-center ${tones[facet] ?? "text-accent"}`}>
      <svg aria-hidden="true" viewBox="0 0 64 64" className="absolute inset-0 h-full w-full" fill="none" stroke="currentColor">
        <circle cx="32" cy="32" r="29" strokeWidth={selected ? 3 : 1.5} fill="currentColor" fillOpacity={selected ? .15 : .05} />
        {Array.from({ length: 6 }, (_, i) => <path key={i} d="M32 4V12" transform={`rotate(${i * 60} 32 32)`} strokeWidth="2" opacity=".5" />)}
        <circle cx="32" cy="32" r="20" strokeWidth="1" opacity=".4" />
      </svg>
      <b className="relative font-sans text-2xl tabular-nums">{value}</b>
    </span>
    <span className="w-full break-words text-center font-sans text-sm font-bold leading-tight text-foreground">{localizeText(name)}</span>
    <span className="text-xs text-muted-foreground">{localizeText(facetNames[facet] ?? facet)}</span>
  </span>;
}
