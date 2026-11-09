import { localizeText } from '@/i18n/localize';
import { useState } from 'react';
import { useRoom } from '@/hooks/use-room';
import { roomClient } from '@/lib/roomClient';
import type { Character } from '@/lib/characters';
import RoomLibraryPicker from './RoomLibraryPicker';
import RoomSavedHeroCard from './RoomSavedHeroCard';
import { PlayerSheet } from './RoomPlayersBoard';
import RoomRollRequests from './RoomRollRequests';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';

export default function RoomHeroReserve({ characters }: { characters: Character[] }) {
  const room = useRoom();
  const [error, setError] = useState('');
  const [assigning, setAssigning] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sheets = { ...room.savedSheets, ...room.sheets };
  const heroes = [...new Map([...(room.roomHeroes || []), ...Object.values(sheets)].map(hero => [hero.id, hero as Character])).values()];
  const players = room.members.filter(member => member.role === 'player');
  const owner = (id: string) => players.find(member => sheets[member.id]?.id === id);
  const openedMember = opened ? owner(opened) : undefined;
  const openedHero = openedMember && sheets[openedMember.id] as Character;
  async function assign(playerId: string) {
    if (!assigning) return;
    setBusy(true); setError('');
    try { await roomClient.assignCharacter(playerId, assigning); setAssigning(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Attribution impossible.'); }
    finally { setBusy(false); }
  }
  return <section data-tour="room-heroes" className="space-y-4 border-2 border-ink p-5" aria-label={localizeText('Héros de la salle')}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-3xl">{localizeText('Héros de la salle')}</h2><RoomLibraryPicker label={localizeText('Ajouter un héros à la salle')} characters={characters} includeHeroes allowedTypes={['hero']} onSelect={async resource => { if (resource.type === 'hero') await roomClient.addRoomHero(resource.item); }} /></div>
    <RoomRollRequests />
    {!heroes.length && <p className="text-sm text-muted-foreground">{localizeText('Ajoute un héros depuis tes projets pour préparer la partie.')}</p>}
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{heroes.map(hero => {
      const member = owner(hero.id);
      const previousOwner = Object.entries(sheets).find(([, sheet]) => sheet.id === hero.id)?.[0];
      const previousName = previousOwner && room.savedPlayers?.[previousOwner]?.name;
      return <RoomSavedHeroCard key={hero.id} hero={hero} status={member ? `${member.name} · ${member.online ? 'Connecté' : 'Absent'}` : previousName ? previousName + ' · Absent' : 'Disponible'} removable={!member} onOpen={member ? () => setOpened(hero.id) : undefined} onRemove={async () => { try { await roomClient.removeRoomHero(hero.id); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Suppression impossible.'); } }}>
        {!member && <Button variant="outline" className="w-full" onClick={() => { setError(''); setAssigning(hero.id); }}>{localizeText('Attribuer')}</Button>}
      </RoomSavedHeroCard>;
    })}</ul>
    {error && !assigning && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {openedMember && openedHero && <PlayerSheet key={openedHero.id} member={openedMember} hero={openedHero} onClose={() => setOpened(null)} />}
    <Dialog open={Boolean(assigning)} onOpenChange={open => { if (!open && !busy) setAssigning(null); }}><DialogContent className="max-h-[85dvh] overflow-y-auto bg-paper"><DialogTitle>{localizeText('Attribuer le héros')} · {heroes.find(hero => hero.id === assigning)?.nom}</DialogTitle><DialogDescription>{localizeText('Choisis le joueur qui recevra cette fiche.')}</DialogDescription>
      {!players.length && <p>{localizeText('Aucun joueur dans la salle.')}</p>}
      <ul className="space-y-2">{players.map(player => <li key={player.id}><Button variant="outline" className="h-auto min-h-12 w-full justify-between whitespace-normal text-left" disabled={busy || !room.connected.includes(player.id) || sheets[player.id]?.id === assigning} onClick={() => void assign(player.id)}><span>{player.name}</span><span className="ml-2 text-xs">{sheets[player.id]?.id === assigning ? 'Déjà attribué' : !room.connected.includes(player.id) ? 'Absent' : sheets[player.id]?.nom || 'Sans héros'}</span></Button></li>)}</ul>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </DialogContent></Dialog>
  </section>;
}
