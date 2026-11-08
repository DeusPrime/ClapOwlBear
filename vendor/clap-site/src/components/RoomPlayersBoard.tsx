import SheetLoading from '@owlbear/SheetLoading';
import { localizeText, localizeNode } from '@/i18n/localize';
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, BookOpen, Dices, HeartPulse, Image, NotebookPen, Sparkles, UserRound, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import CharacterEditor, { CharacterCards } from "@/pages/CharacterEditor";
import { useRoom } from "@/hooks/use-room";
import { roomClient } from "@/lib/roomClient";
import { FACET_SKILLS, type Character, type Facet } from "@/lib/characters";
import type { RoomMember } from "@/lib/roomProtocol";
import { loadLinkedBundledResources, type BundledResource } from "@/lib/resourceBundle";
import RoomLibraryPicker from "./RoomLibraryPicker";
import RoomResourceView from "./RoomResourceView";
import RoomHeroAssignments from "./RoomHeroAssignments";
import RoomRollRequests from "./RoomRollRequests";
import RoomHeroActions from "./RoomHeroActions";
import RoomHeroStateEditor from './RoomHeroStateEditor';
import RollDialog, { type RollSelection } from "./RollDialog";
const tabs = [["identity", "Identité", UserRound], ["attributes", "Attributs", Sparkles], ["traits", "Traits et équipement", BookOpen], ["state", "Constantes", HeartPulse], ["notes", "Notes", NotebookPen], ["back", "Portrait", Image], ["resources", "Cartes", Archive]] as const;
export function PlayerSheet({ member, hero, onClose, initialTab = "identity" }: { member: RoomMember; hero: Character; onClose: () => void; initialTab?: (typeof tabs)[number][0] }) {
  const room = useRoom();
  const cardStage = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<(typeof tabs)[number][0]>(initialTab);
  const [selection, setSelection] = useState<RollSelection[]>([]);
  const [rolling, setRolling] = useState(false);
  const [localResources, setLocalResources] = useState<BundledResource[]>([]);
  const [openedResource, setOpenedResource] = useState<BundledResource | null>(null);
  const [error, setError] = useState("");
  const isMJ = room.session?.role === "mj";
  const own = room.session?.id === member.id;
  const permitted = isMJ || own;
  useEffect(() => { let active = true; if (own) void loadLinkedBundledResources(hero).then(resources => { if (active) setLocalResources(resources); }).catch(() => {}); return () => { active = false; }; }, [hero, own]);
  const resources = own ? localResources : room.sheetResources[member.id] || [];
  useLayoutEffect(() => {
    const stage = cardStage.current;
    if (!stage) return;
    const card = Array.from(stage.querySelectorAll<HTMLElement>('.hero-print-card')).find(card => card.offsetWidth > 0);
    if (!card) return;
    const measure = () => {
      const scale = Math.min(1, (stage.clientWidth - 12) / card.offsetWidth, (stage.clientHeight - 12) / card.offsetHeight);
      if (scale > 0) stage.style.setProperty('--room-sheet-card-scale', String(scale));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage); observer.observe(card);
    return () => observer.disconnect();
  }, [tab, hero.id]);
  function toggle(item: RollSelection) { setSelection(previous => { const exists = previous.some(value => value.facet === item.facet && value.name === item.name); const next = exists ? previous.filter(value => value.facet !== item.facet || value.name !== item.name) : [...previous, item].slice(-2); if (next.length === 2) setRolling(true); return next; }); }
  if (!permitted) return null;
  return <>
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="room-player-sheet-dialog bg-paper">
      <header className="room-sheet-heading">
        <DialogTitle className="break-words pr-10 font-display text-2xl sm:text-3xl">{hero.nom || "Héros sans nom"}</DialogTitle><DialogDescription className="mt-1">{localizeText("Fiche de ")}{localizeNode(member.name)}</DialogDescription>
        <div className="mt-2 flex items-center gap-3"><Button size="sm" variant="outline" onClick={() => setTab("attributes")}><Dices size={15} className="mr-2" />{localizeText("Préparer un jet")}</Button>{localizeNode(own && <Link to={`/characters/${hero.id}`} className="text-sm underline">{localizeText("Modifier ma fiche")}</Link>)}</div>
      </header>
      {isMJ && <div className="flex flex-wrap gap-2 px-4 py-2"><RoomHeroStateEditor hero={hero} /><RoomHeroActions enabled member={member} hero={hero} onRoll={() => setRolling(true)} toolbar><span /></RoomHeroActions></div>}
      <div className="room-sheet-content">
      {tab !== 'resources' && <div ref={cardStage} className="room-sheet-card-stage"><CharacterCards c={hero} activeCardTab={tab} onToggleSelect={toggle} selectedKeys={new Set(selection.map(item => `${item.facet}::${item.name}`))} canSelectMore={selection.length < 2} /></div>}
      {tab === 'resources' && <section className="space-y-3 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-display text-2xl">{localizeText("Cartes liées")}</h3>{localizeNode(isMJ && <RoomLibraryPicker label={localizeText("Ajouter une carte liée")} onSelect={async resource => { if (resource.type === "hero") return; await roomClient.linkResource(member.id, resource); toast.success(localizeText("Carte ajoutée à la fiche du joueur.")); }} />)}</div>
        {localizeNode(!hero.linkedResources.length && <p className="text-sm text-muted-foreground">{localizeText("Aucune carte liée à ce héros.")}</p>)}
        <ul className="divide-y divide-ink/15">{hero.linkedResources.map(link => { const resource = resources.find(resource => resource.type === link.type && resource.item.id === link.id); return <li key={`${link.type}:${link.id}`}><button type="button" disabled={!resource} className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left text-sm font-bold underline underline-offset-4 disabled:font-normal disabled:no-underline disabled:opacity-50" onClick={() => { if (resource) setOpenedResource(resource); }}>{resource?.item.titre || "Chargement de la carte…"}</button></li>; })}</ul>
      </section>}
      </div>
      {tab === "attributes" && <div className="room-sheet-roll-actions flex flex-wrap items-center justify-between gap-2 border-t border-ink/15 px-4 py-2"><p className="text-sm">{selection.length ? selection.map(item => item.name).join(" + ") : "Clique sur un ou deux attributs de la fiche."}</p><Button disabled={!selection.length} onClick={() => setRolling(true)}><Dices size={16} className="mr-2" />{localizeText("Lancer un jet")}</Button></div>}
      {tab === 'attributes' && isMJ && member.online && selection.length > 0 && selection.every(item => FACET_SKILLS[item.facet as Facet]?.includes(item.name)) && <Button variant="outline" onClick={async () => { try { await roomClient.requestRoll(member.id, `${hero.nom || member.name} · ${selection.map(item => item.name).join(" + ")}`, selection.map(item => ({ facet: item.facet as "corps" | "esprit" | "ame", name: item.name })), 6); toast.success(localizeText("Jet demandé au joueur.")); } catch (cause) { setError(cause instanceof Error ? cause.message : "Demande impossible."); } }}>{localizeText("Faire lancer ce jet au joueur")}</Button>}
      {localizeNode(error && <p role="alert" className="text-sm text-destructive">{localizeNode(error)}</p>)}
      <nav aria-label={localizeText("Navigation de la fiche du joueur")} className="room-sheet-tabs">{tabs.map(([id, label, Icon]) => <button type="button" key={id} aria-label={localizeText(label)} aria-current={tab === id ? 'page' : undefined} className="room-sheet-tab" onClick={() => setTab(id)}><Icon size={18} aria-hidden="true" /><span>{localizeNode(label)}</span></button>)}</nav>
    </DialogContent></Dialog>
    <RollDialog open={rolling} onOpenChange={setRolling} selection={selection} destinDiceCount={hero.destinDiceCount} mandatoryComplication={hero.mandatoryComplication} simple forcePublic contextLabel={isMJ ? `${member.name} · ${hero.nom || "Héros"}` : hero.nom || "Héros"} />
    {localizeNode(openedResource && <RoomResourceView resource={openedResource} onClose={() => setOpenedResource(null)} />)}
  </>;
}
export default function RoomPlayersBoard({ characters, onOpenOwnHero }: { characters: Character[]; onOpenOwnHero?: () => void }) {
  const room = useRoom();
  const [opened, setOpened] = useState<string | null>(null);
  const [rollTarget, setRollTarget] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  if (!room.session) return null;
  const session = room.session;
  const players = room.members.filter(member => member.role === "player");
  const getHero = (member: RoomMember) => member.id === session.id ? characters.find(hero => hero.id === session.characterId) : session.role === "mj" ? room.sheets[member.id] : undefined;
  const openedMember = players.find(member => member.id === opened);
  const openedHero = openedMember && getHero(openedMember);
  return <section aria-labelledby="room-players-title" className="space-y-6 border-2 border-ink bg-background/40 p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="room-players-title" className="font-display text-3xl sm:text-4xl">{localizeText("Les héros de la table")}</h2><p className="mt-2 text-sm text-muted-foreground">{localizeNode(session.role === "mj" ? "Clic droit ou appui long sur une fiche pour les actions du MJ." : "Retrouve ton héros et les autres membres de la table.")}</p></div>{localizeNode(session.role === "player" && !onOpenOwnHero && <Button variant="outline" onClick={() => setAssigning(session.id)}><UserRoundCheck size={16} className="mr-2" />{localizeText("Choisir ma fiche")}</Button>)}</div>
    <RoomRollRequests />
    {localizeNode(!players.length && <p className="border border-dashed border-ink/25 px-5 py-10 text-center text-sm text-muted-foreground">{localizeText("Les héros apparaîtront ici lorsque les joueurs rejoindront la salle.")}</p>)}
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">{players.map(member => { const hero = getHero(member); const accessible = Boolean(hero); const heroName = hero?.nom || member.heroName || "Héros à choisir"; return <RoomHeroActions key={member.id} enabled={session.role === "mj"} member={member} hero={hero} onRoll={() => { setRollTarget(member.id); setOpened(member.id); }}><article className="flex min-w-0 flex-col"><button type="button" disabled={!accessible} aria-label={localizeText(`Ouvrir la fiche de ${member.name}`)} onClick={() => { if (member.id === session.id && onOpenOwnHero) { onOpenOwnHero(); return; } setRollTarget(null); setOpened(member.id); }} className="group flex flex-1 flex-col overflow-hidden rounded-sm border-2 border-ink/40 bg-paper text-left hover:border-ink disabled:cursor-default"><div className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden bg-ink/5">{room.sheetTransfers?.includes(member.id) && <div className="absolute inset-0 z-10 flex items-center justify-center bg-paper/90"><SheetLoading /></div>}{localizeNode(hero?.portrait ? <img src={hero.portrait} alt="" className="h-full w-full object-cover object-top transition-transform group-hover:scale-105" /> : <UserRound size={48} className="text-foreground/25" />)}</div><div className="w-full flex-1 border-t border-ink/20 p-3"><h3 className="break-words font-display text-xl">{localizeNode(heroName)}</h3><p className="mt-1 break-all text-xs text-muted-foreground">{localizeNode(member.name)}{localizeNode(member.id === session.id ? " · toi" : "")} · {localizeNode(member.online || member.id === session.id ? "Connecté" : "Absent")}</p></div></button>{localizeNode(session.role === "mj" && <button type="button" onClick={() => setAssigning(member.id)} className="min-h-11 px-1 py-2 text-left text-xs underline underline-offset-4">{localizeNode(hero || member.heroName ? "Changer le héros" : "Attribuer une fiche")}</button>)}</article></RoomHeroActions>; })}</div>
    {localizeNode(openedMember && openedHero && openedMember.id === session.id && <div aria-label={localizeText("Ma fiche de héros")} className="max-h-[70dvh] min-w-0 overflow-auto overscroll-contain border-2 border-ink"><CharacterEditor key={openedHero.id} characterId={openedHero.id} onClose={() => { setOpened(null); window.dispatchEvent(new Event("clap-room-character-assigned")); }} /></div>)}
    {localizeNode(openedMember && openedHero && openedMember.id !== session.id && <PlayerSheet key={openedMember.id + openedHero.id} member={openedMember} hero={openedHero} initialTab={rollTarget === openedMember.id ? "attributes" : "identity"} onClose={() => { setOpened(null); setRollTarget(null); }} />)}
    <Dialog open={assigning !== null} onOpenChange={value => { if (!value) setAssigning(null); }}><DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto bg-paper"><DialogTitle className="font-display text-3xl">{localizeNode(session.role === "mj" ? "Attribuer une fiche de héros" : "Choisir mon héros")}</DialogTitle><DialogDescription>{localizeText("Choisis une fiche parmi tes cartes.")}</DialogDescription><RoomHeroAssignments characters={characters} playerId={assigning || undefined} /></DialogContent></Dialog>
  </section>;
}
