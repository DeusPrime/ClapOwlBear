import { localizeText, localizeNode } from '@/i18n/localize';
﻿import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRoom } from "@/hooks/use-room";
import { roomClient } from "@/lib/roomClient";
import { directoryName } from "@/lib/directories";
import type { Character } from "@/lib/characters";
import RoomLibraryPicker from './RoomLibraryPicker';

export default function RoomHeroAssignments({ characters, playerId }: { characters: Character[]; playerId?: string }) {
  const room = useRoom();
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  if (!room.session) return null;
  const session = room.session;
  const available = session.role === "mj" ? [...new Map([...(room.roomHeroes || []), ...Object.values(room.savedSheets || {}) as Character[]].map(hero => [hero.id, hero])).values()] : characters;
  const options = available.map(character => <option key={character.id} value={character.id}>{character.nom || "Héros sans nom"} — {localizeNode(directoryName(character.directoryId))}</option>);
  const players = room.members.filter(member => member.role === "player" && (!playerId || member.id === playerId));
  async function assign(id: string) {
    if (!choices[id] || busy) return;
    setBusy(id); setError("");
    try { await roomClient.assignCharacter(id, choices[id]); toast.success(localizeText("Fiche envoyée au joueur.")); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible d’attribuer la fiche."); }
    finally { setBusy(null); }
  }
  return <section aria-labelledby="room-heroes-title" className="space-y-4 border-2 border-ink bg-background/40 p-5">
    <h2 id="room-heroes-title" className="flex items-center gap-2 font-display text-3xl"><UserRoundCheck size={24} />{localizeNode(session.role === "mj" ? "Attribuer les héros" : "Ma fiche de héros")}</h2>
    {session.role === "player" ? <>
      <label htmlFor="room-existing-hero" className="block text-sm font-bold">{localizeText("Choisir un héros de la salle")}</label>
      <select id="room-existing-hero" className="min-h-11 w-full rounded-sm border border-ink bg-paper px-3 text-sm" value={session.characterId || ''} disabled={Boolean(busy)} onChange={async event => {
        const id = event.target.value; if (!id) return;
        setBusy(session.id); setError('');
        try { await roomClient.selectRoomHero(id); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Choix impossible.'); } finally { setBusy(null); }
      }}><option value="">{localizeText("Choisir un héros disponible…")}</option>{room.availableHeroes?.map(hero => <option key={hero.id} value={hero.id} disabled={Boolean(hero.ownerId && hero.ownerId !== session.id)}>{localizeNode(hero.name)}{localizeNode(hero.ownerId && hero.ownerId !== session.id ? ' — Déjà attribué' : '')}</option>)}</select>
      <label htmlFor="room-own-hero" className="block text-sm font-bold">{localizeText("Choisir dans mes cartes")}</label>
      <select id="room-own-hero" className="min-h-11 w-full min-w-0 rounded-sm border border-ink bg-paper px-3 text-sm" value="" disabled={Boolean(room.pendingHeroProposal)} onChange={event => { const id = event.target.value; if (id) void roomClient.selectCharacter(id).catch(cause => setError(cause instanceof Error ? cause.message : "Envoi impossible.")); }}>
        <option value="">{localizeText("Proposer un héros au MJ")}</option>{localizeNode(options)}
      </select>
      <p className="text-xs text-muted-foreground">{localizeText("Le MJ doit accepter ta proposition. Ton héros actuel reste en place en attendant.")}</p>
      {localizeNode(session.characterId && <Link to={`/characters/${session.characterId}`} className="inline-flex min-h-11 items-center gap-2 text-sm underline"><BookOpen size={16} />{localizeText("Ouvrir et modifier ma fiche")}</Link>)}
    </> : <>
      <p className="text-sm text-muted-foreground">{localizeText("Attribue un héros disponible de la salle, ou ajoute-le directement depuis un projet.")}</p>
      {localizeNode(!players.length && <p className="text-sm text-muted-foreground">{localizeText("Les joueurs apparaîtront ici lorsqu’ils rejoindront la salle.")}</p>)}
      <ul className="space-y-4">{players.map(player => <li key={player.id} className="space-y-2 border-t border-ink/15 pt-4">
        <label htmlFor={`room-hero-${player.id}`} className="block break-words text-sm font-bold">{localizeText("Fiche de ")}{localizeNode(player.name)}</label>
        <p className="text-xs text-muted-foreground">{room.sheets[player.id] ? `Héros actuel : ${room.sheets[player.id].nom || localizeText("Sans nom")}` : "Aucune fiche reçue"}</p>
        <div className="flex flex-col gap-3 sm:flex-row"><select id={`room-hero-${player.id}`} className="min-h-11 min-w-0 flex-1 rounded-sm border border-ink bg-paper px-3 text-sm" value={choices[player.id] || ""} onChange={event => setChoices(previous => ({ ...previous, [player.id]: event.target.value }))} disabled={Boolean(busy)}><option value="">{localizeText("Choisir parmi les héros de la salle…")}</option>{localizeNode(options)}</select><Button disabled={Boolean(busy) || !choices[player.id] || !room.connected.includes(player.id)} onClick={() => void assign(player.id)}>{localizeNode(busy === player.id ? "Envoi…" : "Attribuer la fiche")}</Button></div>
        {localizeNode(!room.connected.includes(player.id) && <p className="text-xs text-muted-foreground">{localizeText("En attente de connexion du joueur pour transmettre la fiche.")}</p>)}
        <RoomLibraryPicker characters={characters} includeHeroes allowedTypes={['hero']} label={localizeText("Attribuer depuis un projet")} onSelect={async resource => { if (resource.type !== 'hero') return; const hero = await roomClient.addRoomHero(resource.item); await roomClient.assignCharacter(player.id, hero.id); }} />
      </li>)}</ul>
    </>}
    {localizeNode(room.pendingHeroProposal && session.role === "player" && <p role="status">{localizeText("En attente de la décision du MJ.")}</p>)}
    {localizeNode(!available.length && <p className="text-sm text-muted-foreground">{localizeText("Aucun héros disponible.")}</p>)}
    <Link to="/characters" className="inline-flex min-h-11 items-center gap-2 text-sm underline"><BookOpen size={16} />{localizeText("Parcourir mes héros")}</Link>
    {localizeNode(error && <p role="alert" className="text-sm text-destructive">{localizeNode(error)}</p>)}
  </section>;
}
