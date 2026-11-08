import { localizeText, localizeNode } from '@/i18n/localize';
import { useState } from 'react';
import { useRoom } from '@/hooks/use-room';
import { roomClient } from '@/lib/roomClient';
import type { Character } from '@/lib/characters';
import RoomLibraryPicker from './RoomLibraryPicker';
import RoomSavedHeroCard from './RoomSavedHeroCard';

export default function RoomHeroReserve({ characters }: { characters: Character[] }) {
  const room = useRoom();
  const [error, setError] = useState('');
  const heroes = [...new Map([...(room.roomHeroes || []), ...Object.values(room.savedSheets || {}), ...Object.values(room.sheets)].map(hero => [hero.id, hero as Character])).values()];
  const owner = (id: string) => Object.entries({ ...room.savedSheets, ...room.sheets }).find(([playerId, hero]) => hero.id === id && room.members.some(member => member.id === playerId && member.role === 'player'))?.[0];
  async function removeSaved(id: string) {
    try { await roomClient.removeRoomHero(id); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Suppression impossible.'); }
  }
  return <section className="space-y-4 border-2 border-ink p-5" aria-label={localizeText("Héros disponibles dans la salle")}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-3xl">{localizeText("Héros de la salle")}</h2><RoomLibraryPicker label={localizeText("Ajouter un héros à la salle")} characters={characters} includeHeroes allowedTypes={['hero']} onSelect={async resource => { if (resource.type === 'hero') await roomClient.addRoomHero(resource.item); }} /></div>
    <p className="text-sm text-muted-foreground">{localizeText("Chaque héros existe une seule fois dans la salle, avec sa progression. Il peut être choisi par un joueur lorsqu’il est disponible.")}</p>
    {localizeNode(!heroes.length && <p className="text-sm text-muted-foreground">{localizeText("Ajoute un héros depuis tes projets pour préparer la partie.")}</p>)}
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{heroes.map(hero => {
      const ownerId = owner(hero.id);
      const name = room.members.find(member => member.id === ownerId)?.name;
      return <RoomSavedHeroCard key={hero.id} hero={hero} status={name ? 'Attribué à ' + name : 'Disponible'} removable={!ownerId} onRemove={() => removeSaved(hero.id)} />;
    })}</ul>
    {localizeNode(error && <p role="alert" className="text-sm text-destructive">{localizeNode(error)}</p>)}
  </section>;
}
