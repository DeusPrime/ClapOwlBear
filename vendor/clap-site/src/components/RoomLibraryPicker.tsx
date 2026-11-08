import { localizeText, localizeNode } from '@/i18n/localize';
﻿import { useState } from "react";
import { Plus, Search, UserRound } from "lucide-react";
import ResourcePngPreview from "./ResourcePngPreview";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { loadAllBundledResources, type BundledResource } from "@/lib/resourceBundle";
import type { Character } from "@/lib/characters";
import { DEFAULT_DIRECTORY, directoryName, loadDirectories } from "@/lib/directories";
export type RoomLibraryItem = BundledResource | { type: "hero"; item: Character };
export const roomLibraryLabels = { hero: "Héros", "key-role": "Rôle clé", figurant: "Figurant", profile: "Profil", power: "Pouvoir", vehicle: "Véhicule" };
export const roomLibraryTitle = (resource: RoomLibraryItem) => resource.type === "hero" ? resource.item.nom || "Héros sans nom" : resource.item.titre || localizeText("Sans nom");
export default function RoomLibraryPicker({ characters = [], includeHeroes = false, allowedTypes, label = "Ajouter une carte", onSelect }: { characters?: Character[]; includeHeroes?: boolean; allowedTypes?: RoomLibraryItem["type"][]; label?: string; onSelect: (resource: RoomLibraryItem) => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [resources, setResources] = useState<BundledResource[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [project, setProject] = useState("all");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  async function load() { setOpen(true); setQuery(""); setCategory("all"); setProject("all"); setPage(0); setError(""); setLoading(true); try { setResources(await loadAllBundledResources()); } catch { setError("Impossible de lire tes cartes."); } finally { setLoading(false); } }
  async function pick(resource: RoomLibraryItem) { setBusy(true); setError(""); try { await onSelect(resource); setOpen(false); } catch (cause) { setError(cause instanceof Error ? cause.message : "Ajout impossible."); } finally { setBusy(false); } }
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const items: RoomLibraryItem[] = [...(includeHeroes ? characters.map(item => ({ type: "hero" as const, item })) : []), ...resources].filter(item => !allowedTypes || allowedTypes.includes(item.type));
  const projects = new Map(loadDirectories().map(directory => [directory.id, directory.name]));
  for (const resource of items) {
    const id = resource.item.directoryId || DEFAULT_DIRECTORY;
    if (!projects.has(id)) projects.set(id, directoryName(id));
  }
  const filtered = items.filter(resource => (project === "all" || (resource.item.directoryId || DEFAULT_DIRECTORY) === project) && (category === "all" || resource.type === category) && normalize(roomLibraryTitle(resource)).includes(normalize(query.trim())));
  return <Dialog open={open} onOpenChange={value => { if (!busy) { if (value) void load(); else setOpen(false); } }}><DialogTrigger asChild><Button variant="outline"><Plus size={16} className="mr-2" />{localizeNode(label)}</Button></DialogTrigger><DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl flex-col bg-paper">
    <DialogTitle className="pr-6 font-display text-3xl">{localizeNode(label)}</DialogTitle><DialogDescription>{localizeText("Choisis dans tes cartes.")}</DialogDescription>
    <label htmlFor="room-library-search" className="flex items-center gap-2 text-sm font-bold"><Search size={16} />{localizeText("Rechercher une carte")}</label><input id="room-library-search" type="search" autoFocus value={query} disabled={busy} onChange={event => { setQuery(event.target.value); setPage(0); }} className="min-h-11 shrink-0 border border-ink bg-paper px-3" />
    <div className="grid shrink-0 gap-3 sm:grid-cols-2">
      <label className="space-y-2 text-sm font-bold" htmlFor="room-library-project"><span>{localizeText("Projet")}</span><select id="room-library-project" value={project} disabled={busy} onChange={event => { setProject(event.target.value); setPage(0); }} className="min-h-11 w-full min-w-0 border border-ink bg-paper px-3 font-normal"><option value="all">{localizeText("Tous les projets")}</option>{[...projects].sort((a, b) => a[1].localeCompare(b[1], "fr")).map(([id, name]) => <option key={id} value={id}>{localizeNode(name)}</option>)}</select></label>
      <label className="space-y-2 text-sm font-bold" htmlFor="room-library-type"><span>{localizeText("Type de carte")}</span><select id="room-library-type" value={category} disabled={busy} onChange={event => { setCategory(event.target.value); setPage(0); }} className="min-h-11 w-full min-w-0 border border-ink bg-paper px-3 font-normal"><option value="all">{localizeText("Tous les types")}</option>{Object.entries(roomLibraryLabels).filter(([type]) => (includeHeroes || type !== "hero") && (!allowedTypes || allowedTypes.includes(type as RoomLibraryItem["type"]))).map(([type, name]) => <option key={type} value={type}>{localizeNode(name)}</option>)}</select></label>
    </div>
    {localizeNode(loading && <p role="status">{localizeText("Chargement…")}</p>)}
    <ul className="grid min-h-0 grid-cols-2 gap-4 overflow-y-auto p-1 sm:grid-cols-3 lg:grid-cols-4">{filtered.slice(page * 20, page * 20 + 20).map(resource => <li key={`${resource.type}:${resource.item.id}`} className="min-w-0"><button type="button" disabled={busy} onClick={() => void pick(resource)} className="group block w-full rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50">
      <div className="relative">
        {localizeNode(resource.type === "hero" ? <div className="flex aspect-[744/1039] items-center justify-center overflow-hidden rounded-lg bg-ink/5">{localizeNode(resource.item.portrait ? <img src={resource.item.portrait} alt="" className="h-full w-full object-cover object-top" /> : <UserRound size={48} className="text-foreground/30" />)}</div> : <ResourcePngPreview resource={resource} />)}
        <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded border border-ink/30 bg-paper text-foreground transition-colors group-hover:bg-ink group-hover:text-background"><Plus size={18} /></span>
      </div>
      <span className="mt-2 block break-words text-sm font-bold">{localizeNode(roomLibraryTitle(resource))}</span><span className="block text-xs text-muted-foreground">{localizeNode(roomLibraryLabels[resource.type])}</span>
    </button></li>)}</ul>
    {localizeNode(!loading && !filtered.length && <p className="py-5 text-sm text-muted-foreground">{localizeText("Aucune carte trouvée.")}</p>)}
    {localizeNode(filtered.length > 20 && <div className="flex items-center justify-between gap-3 text-sm"><Button variant="outline" disabled={page === 0 || busy} onClick={() => setPage(value => value - 1)}>{localizeText("Précédent")}</Button><span>{localizeNode(page + 1)} / {localizeNode(Math.ceil(filtered.length / 20))}</span><Button variant="outline" disabled={(page + 1) * 20 >= filtered.length || busy} onClick={() => setPage(value => value + 1)}>{localizeText("Suivant")}</Button></div>)}
    {localizeNode(busy && <p role="status" className="text-sm">{localizeText("Ajout en cours…")}</p>)}{localizeNode(error && <p role="alert" className="text-sm text-destructive">{localizeNode(error)}</p>)}
  </DialogContent></Dialog>;
}
