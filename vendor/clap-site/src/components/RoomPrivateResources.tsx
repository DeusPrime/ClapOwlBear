import { localizeText, localizeNode } from '@/i18n/localize';
import { roomClient } from '@/lib/roomClient';
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EyeOff, Trash2, UserRound } from "lucide-react";
import { useRoom } from "@/hooks/use-room";
import { loadAllBundledResources, type BundledResource } from "@/lib/resourceBundle";
import type { Character } from "@/lib/characters";
import ResourcePngPreview from "./ResourcePngPreview";
import RoomLibraryPicker, { roomLibraryTitle, type RoomLibraryItem } from "./RoomLibraryPicker";
import RoomResourceView from "./RoomResourceView";
type Ref = { type: RoomLibraryItem["type"]; id: string; count?: number };
function ResourceCounter({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <div className="mt-3 space-y-1">
    <label className="block text-xs font-bold">{localizeNode(label)}
      <span className="mt-1 flex items-center gap-1">
        <button type="button" aria-label={localizeText(`Diminuer ${label}`)} disabled={value === 0} onClick={() => onChange(Math.max(0, value - 1))} className="h-9 w-9 shrink-0 rounded border border-ink/30 bg-paper text-lg disabled:opacity-40">−</button>
        <input type="number" aria-label={localizeText(label)} min={0} step={1} value={value} onChange={event => { if (event.target.value === "") return; const next = Number(event.target.value); if (Number.isSafeInteger(next) && next >= 0) onChange(next); }} className="h-9 w-full min-w-0 rounded border border-ink/30 bg-paper px-1 text-center text-sm" />
        <button type="button" aria-label={localizeText(`Augmenter ${label}`)} onClick={() => onChange(value + 1)} className="h-9 w-9 shrink-0 rounded border border-ink/30 bg-paper text-lg">+</button>
      </span>
    </label>
  </div>;
}
export default function RoomPrivateResources({ characters }: { characters: Character[] }) {
  const room = useRoom();
  const refs = room.privateRefs;
  const [resources, setResources] = useState<BundledResource[]>([]);
  const [opened, setOpened] = useState<BundledResource | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; const load = () => { void loadAllBundledResources().then(items => { if (active) setResources(items); }).catch(() => { if (active) setError("Impossible de charger tes cartes."); }); }; load(); window.addEventListener("focus", load); return () => { active = false; window.removeEventListener("focus", load); }; }, []);
  if (room.session?.role !== "mj") return null;
  function save(next: Ref[]) { roomClient.setPrivateRefs(next); }
  async function add(resource: RoomLibraryItem) {
    if (resource.type === 'hero') { await roomClient.addRoomHero(resource.item); return; }
    await roomClient.addRoomResource(resource);
  }
  function updateCount(resource: RoomLibraryItem, count: number) {
    try { save(refs.map(ref => ref.type === resource.type && ref.id === resource.item.id ? { ...ref, count } : ref)); }
    catch { setError("Impossible d’enregistrer le compteur de la carte."); }
  }
  const all: RoomLibraryItem[] = [...(room.roomHeroes || []).map(item => ({ type: "hero" as const, item })), ...(room.roomResources || []), ...resources];
  const selected = refs.filter(ref => ref.type !== "hero").map(ref => all.find(item => item.type === ref.type && item.item.id === ref.id)).filter((item): item is RoomLibraryItem => Boolean(item));
  return <section aria-labelledby="room-private-title" className="space-y-5 border-2 border-ink bg-background/40 p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 id="room-private-title" className="font-display text-3xl">{localizeText("Mes cartes de salle")}</h2><p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><EyeOff size={14} />{localizeText("Visibles uniquement par toi. Choisis la visibilité de tes jets avant de les lancer.")}</p></div><RoomLibraryPicker characters={characters} onSelect={add} /></div>
    {localizeNode(!selected.length && <p className="py-6 text-center text-sm text-muted-foreground">{localizeText("Ajoute les héros, rôles clés ou figurants dont tu as besoin pour cette partie.")}</p>)}
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{selected.map(resource => { const hp = refs.find(ref => ref.type === resource.type && ref.id === resource.item.id)?.count ?? (resource.type === "key-role" ? Math.max(0, Number.parseInt(resource.item.pv, 10) || 0) : 1); return <article key={`${resource.type}:${resource.item.id}`} className="min-w-0"><div className="relative">
      {localizeNode(resource.type === "hero" ? <Link to={`/characters/${resource.item.id}?roomPublicRoll=1`} className="block"><div className="flex aspect-[744/1039] items-center justify-center overflow-hidden rounded bg-ink/5">{localizeNode(resource.item.portrait ? <img src={resource.item.portrait} alt="" className="h-full w-full object-cover" /> : <UserRound size={48} />)}</div><span className="mt-2 block break-words text-sm font-bold">{localizeNode(roomLibraryTitle(resource))}</span></Link> : <button type="button" onClick={() => setOpened(resource)} className="block w-full text-left" aria-label={localizeText(`Ouvrir ${roomLibraryTitle(resource)}`)}><div className={hp === 0 ? "opacity-40 grayscale" : ""}><ResourcePngPreview resource={resource} /></div>{hp === 0 && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded bg-black/35 p-2" aria-label="Carte désactivée"><span className="-rotate-12 border-2 border-white bg-black/70 px-3 py-2 text-center font-bold uppercase text-white">Désactivée</span></div>}<span className="mt-2 block break-words text-sm font-bold">{localizeNode(roomLibraryTitle(resource))}</span></button>)}
      <button type="button" aria-label={localizeText(`Retirer ${roomLibraryTitle(resource)} de la salle`)} onClick={async () => { try { if (resource.type === 'hero') await roomClient.removeRoomHero(resource.item.id); else save(refs.filter(ref => ref.type !== resource.type || ref.id !== resource.item.id)); } catch { setError("Impossible de retirer la carte."); } }} className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded border border-ink/20 bg-paper"><Trash2 size={15} /></button>
    </div><ResourceCounter label={`PV \u00b7 ${roomLibraryTitle(resource)}`} value={hp} onChange={value => updateCount(resource, value)} /></article>; })}</div>
    {localizeNode(error && <p role="alert" className="text-sm text-destructive">{localizeNode(error)}</p>)}
    {localizeNode(opened && <RoomResourceView resource={opened} onClose={() => setOpened(null)} />)}
  </section>;
}
