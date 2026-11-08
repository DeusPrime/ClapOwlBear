import { localizeText, localizeNode } from '@/i18n/localize';
import { memo, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import ResourcePngPreview from "./ResourcePngPreview";
import type { PreviewResource } from "./ResourceCardPreview";

type PickerResource = PreviewResource & { href: string; label: string };
const PAGE_SIZE = 24;

// Keep opening/searching the picker independent of the hero's full card list.
export default memo(function HeroResourcePicker({ resources, onSelect }: {
  resources: PickerResource[]; onSelect: (resource: PickerResource) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr");
    return needle ? resources.filter(resource => `${resource.item.titre} ${resource.label}`.toLocaleLowerCase("fr").includes(needle)) : resources;
  }, [resources, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const start = currentPage * PAGE_SIZE;
  return <Dialog open={open} onOpenChange={value => {
    setOpen(value);
    if (value) { setQuery(""); setPage(0); }
  }}>
    <DialogTrigger asChild>
      <button type="button" disabled={!resources.length} className="flex min-h-11 items-center justify-center gap-2 border-2 border-ink bg-paper px-4 py-2 typewriter text-xs font-bold uppercase tracking-widest shadow-[3px_3px_0_hsl(var(--ink))] hover:bg-ink hover:text-background disabled:cursor-not-allowed disabled:opacity-45">
        <Plus size={18} strokeWidth={3} />
        {localizeNode(resources.length ? "Ajouter une carte" : "Toutes les cartes sont liées")}
      </button>
    </DialogTrigger>
    <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-5xl flex-col border-2 border-ink bg-paper p-4 sm:p-6">
      <div className="shrink-0 pr-6">
        <DialogTitle className="font-display text-2xl">{localizeText("Ajouter une carte liée")}</DialogTitle>
        <DialogDescription className="typewriter text-xs">{localizeText("Choisis une carte à lier à ce héros.")}</DialogDescription>
      </div>
      <label className="relative block shrink-0">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50" />
        <input value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} aria-label={localizeText("Rechercher une carte à lier")} placeholder={localizeText("Rechercher par nom ou type")} className="min-h-11 w-full border-2 border-ink bg-paper py-2 pl-10 pr-3 typewriter text-sm" />
      </label>
      <div className="min-h-0 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.slice(start, start + PAGE_SIZE).map(resource => {
            const title = resource.item.titre || localizeText("Sans nom");
            return <button key={`${resource.type}:${resource.item.id}`} type="button" data-resource-choice
              aria-label={localizeText(`Ajouter ${title}`)} onClick={() => { onSelect(resource); setOpen(false); }}
              className="group relative block min-w-0 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
              <ResourcePngPreview resource={resource} />
              <span className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded border border-ink bg-paper text-foreground group-hover:bg-accent group-hover:text-background"><Plus size={18} /></span>
              <span className="mt-1 block truncate typewriter text-xs">{localizeNode(title)}</span>
            </button>;
          })}
        </div>
        {localizeNode(!filtered.length && <p className="py-8 text-center typewriter text-sm text-foreground/60">{localizeText("Aucune carte trouvée.")}</p>)}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-ink/20 pt-3 typewriter text-xs">
        <span aria-live="polite">{localizeNode(filtered.length ? `${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} sur ${filtered.length}` : "0 carte")}</span>
        {localizeNode(pages > 1 && <div className="flex gap-2">
          <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="min-h-10 border border-ink px-3 disabled:opacity-40">{localizeText("Précédent")}</button>
          <button type="button" disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)} className="min-h-10 border border-ink px-3 disabled:opacity-40">{localizeText("Suivant")}</button>
        </div>)}
      </div>
    </DialogContent>
  </Dialog>;
});
