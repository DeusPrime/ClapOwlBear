import { localizeText, localizeNode } from '@/i18n/localize';
import { useEffect, useState } from "react";
import { useRoom } from "@/hooks/use-room";
import { loadAllBundledResources } from "@/lib/resourceBundle";
import { FACET_LABELS, type Facet } from "@/lib/characters";
import { roomActorRoll, type RoomActor, type RoomActorEquipment } from "@/lib/roomActorRolls";
import RoomLibraryPicker from "./RoomLibraryPicker";
import ResourcePngPreview from "./ResourcePngPreview";
import RollDialog, { type RollSelection } from "./RollDialog";
import { Button } from "./ui/button";

type Ref = { type: "power" | "vehicle"; id: string };
export default function RoomActorLinks({ actor }: { actor: RoomActor }) {
  const { session } = useRoom();
  const key = session ? `clap-room-links:${session.room}:${session.id}:${actor.type}:${actor.item.id}` : "";
  const [refs, setRefs] = useState<Ref[]>([]);
  const [equipment, setEquipment] = useState<RoomActorEquipment[]>([]);
  const [facet, setFacet] = useState<Facet>("corps");
  const [selection, setSelection] = useState<RollSelection[]>([]);
  const [title, setTitle] = useState("");
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    try { const saved = JSON.parse(localStorage.getItem(key) || "[]"); setRefs(Array.isArray(saved) ? saved : []); }
    catch { setRefs([]); }
    void loadAllBundledResources().then(items => { if (active) setEquipment(items.filter((item): item is RoomActorEquipment => item.type === "power" || item.type === "vehicle")); }).catch(() => { if (active) setError("Impossible de charger les cartes liées."); });
    return () => { active = false; };
  }, [key]);
  if (session?.role !== "mj") return null;
  function save(next: Ref[]) { localStorage.setItem(key, JSON.stringify(next)); setRefs(next); }
  function useEquipment(item: RoomActorEquipment, stat?: "maniabilite" | "vitesse") {
    try { setSelection(roomActorRoll(actor, item, facet, stat)); setTitle(`${actor.item.titre} · ${item.item.titre}`); setError(""); setRolling(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Jet impossible."); }
  }
  return <section className="space-y-3 border-t border-ink/20 pt-4">
    <h3 className="font-display text-2xl">{localizeText("Pouvoirs et véhicules liés")}</h3>
    <p className="text-xs text-muted-foreground">{localizeText("Ces liaisons sont conservées uniquement pour cette salle, sur ce navigateur.")}</p>
    <RoomLibraryPicker label={localizeText("Lier un pouvoir ou un véhicule")} allowedTypes={["power", "vehicle"]} onSelect={resource => {
      if (resource.type !== "power" && resource.type !== "vehicle") return;
      save(refs.some(ref => ref.type === resource.type && ref.id === resource.item.id) ? refs : [...refs, { type: resource.type, id: resource.item.id }]);
      setEquipment(previous => [...previous.filter(item => item.type !== resource.type || item.item.id !== resource.item.id), resource]);
    }} />
    {actor.type === "key-role" && refs.some(ref => ref.type === "vehicle") && <label className="block text-sm">{localizeText("Aspect utilisé avec les véhicules")}<select value={facet} onChange={event => setFacet(event.target.value as Facet)} className="ml-2 rounded border border-ink bg-paper p-2">{(Object.keys(FACET_LABELS) as Facet[]).map(key => <option key={key} value={key}>{localizeNode(FACET_LABELS[key])}</option>)}</select></label>}
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">{refs.map(ref => {
      const item = equipment.find(item => item.type === ref.type && item.item.id === ref.id);
      return <article key={`${ref.type}:${ref.id}`} className="min-w-0 space-y-2">
        {item ? <><ResourcePngPreview resource={item} /><p className="break-words text-sm font-bold">{item.item.titre || localizeText("Sans nom")}</p>
          {localizeNode(item.type === "power" ? <Button variant="outline" className="w-full" onClick={() => useEquipment(item)}>{localizeText("Utiliser le pouvoir")}</Button> : <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => useEquipment(item, "maniabilite")}>{localizeText("Maniabilité")}</Button><Button size="sm" variant="outline" onClick={() => useEquipment(item, "vitesse")}>{localizeText("Vitesse")}</Button></div>)}
        </> : <p className="text-sm">{localizeText("Carte indisponible")}</p>}
        <button type="button" className="text-xs underline" onClick={() => { try { save(refs.filter(value => value.type !== ref.type || value.id !== ref.id)); } catch { setError("Impossible de retirer la liaison."); } }}>{localizeText("Retirer la liaison")}</button>
      </article>;
    })}</div>
    {localizeNode(error && <p role="alert" className="text-sm text-destructive">{localizeNode(error)}</p>)}
    <RollDialog figurantGroup={actor.type === "figurant"} cardPotential open={rolling} onOpenChange={setRolling} selection={selection} simple destinDiceCount={actor.type === "figurant" ? 0 : 1} contextLabel={title} />
  </section>;
}
