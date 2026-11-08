import { localizeText, localizeNode } from '@/i18n/localize';
import { useEffect, useState, type ReactNode } from 'react';
import { UserRound } from 'lucide-react';
import { useRoom } from '@/hooks/use-room';
import type { Character } from '@/lib/characters';
import DirectoryMenu from './DirectoryMenu';
import { activeDirectory, selectDirectory, DIRECTORY_SELECTED } from '@/lib/directories';
import CharacterEditor from '@/pages/CharacterEditor';
import RoomChat from './RoomChat';
import RoomManagement from './RoomManagement';
import RoomHeroAssignments from './RoomHeroAssignments';
import RoomPlayersBoard from './RoomPlayersBoard';
import RoomRollRequests from './RoomRollRequests';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';

export default function RoomPlayerWorkspace({ characters, invitation }: { characters: Character[]; invitation: string }) {
  const room = useRoom();
  const [directoryId, setDirectoryId] = useState(activeDirectory);
  useEffect(() => { const refresh = () => setDirectoryId(activeDirectory()); window.addEventListener(DIRECTORY_SELECTED, refresh); return () => window.removeEventListener(DIRECTORY_SELECTED, refresh); }, []);
  const [heroesOpen, setHeroesOpen] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [requestId, setRequestId] = useState<string>();
  const [heroViewKey, setHeroViewKey] = useState(0);
  const [discussion, setDiscussion] = useState(false);
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1200px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1200px)');
    const refresh = () => setWide(query.matches);
    query.addEventListener('change', refresh); refresh();
    return () => query.removeEventListener('change', refresh);
  }, []);
  const [draft, setDraft] = useState('');
  const [recipient, setRecipient] = useState('');
  const characterId = room.session?.characterId;
  useEffect(() => { if (characterId) setChoosing(false); }, [characterId]);
  if (!room.session || room.session.role !== 'player') return null;
  const session = room.session;
  const showOwnHero = () => { setHeroesOpen(false); setDiscussion(false); setHeroViewKey(value => value + 1); };
  const menu = (actions?: ReactNode) => <RoomManagement invitation={invitation} compact onShowHeroes={() => setHeroesOpen(true)} onChooseHero={() => setChoosing(true)} extraActions={actions} />;
  const navigation = <DirectoryMenu value={directoryId} onChange={id => { selectDirectory(id); setDirectoryId(id); }} />;
  const chat = <RoomChat messages={room.messages} memberId={session.id} members={room.members} draft={draft} onDraftChange={setDraft} recipient={recipient} onRecipientChange={setRecipient} />;
  const requests = <RoomRollRequests onPerform={id => { setRequestId(id); showOwnHero(); }} />;
  return <div className="room-player-workspace min-w-0">
    {localizeNode(characterId ? <div aria-label={localizeText("Ma fiche de héros")} className="min-w-0 overflow-x-clip">
      <CharacterEditor key={characterId} characterId={characterId} primaryInRoom roomRequestId={requestId} roomDiscussion={chat} roomRequests={requests} roomContextLabel={room.roomInfo?.title || 'Salle de jeu'} roomHeroViewKey={heroViewKey} roomNavigation={navigation} renderRoomMenu={menu} onClose={() => setChoosing(true)} />
    </div> : <div className={`room-player-waiting min-h-dvh pb-24 min-[1200px]:pb-0 ${discussion && !wide ? "room-player-chat-open" : ""}`}>
      <header className="sticky top-0 z-10 border-b border-ink bg-paper"><div className="container flex h-16 items-center gap-4">{localizeNode(navigation)}<h1 className="min-w-0 flex-1 truncate font-display text-xl">{localizeNode(room.roomInfo?.title || 'Salle de jeu')}</h1><span data-mobile-help className="empty:hidden shrink-0 sm:hidden" />{localizeNode(menu())}</div></header>
      <div className="room-player-layout container py-8">{localizeNode(requests)}<div hidden={discussion && !wide} className="room-player-sheet space-y-3 border-2 border-dashed border-ink/25 p-6 text-center"><UserRound size={40} className="mx-auto text-muted-foreground" /><p className="font-bold">{localizeText("Ton héros apparaîtra ici.")}</p><p className="text-sm text-muted-foreground">{localizeText("Choisis une fiche depuis le menu ⋮ ou attends que le MJ t’en attribue une.")}</p></div><div hidden={!discussion && !wide} className="room-player-discussion">{localizeNode(chat)}</div></div>
      {localizeNode(!wide && <nav aria-label={localizeText("Navigation de la fiche")} className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t-2 border-ink bg-paper p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] room-player-waiting-tabs"><Button variant={discussion ? 'outline' : 'default'} onClick={() => setDiscussion(false)}>{localizeText("Mon héros")}</Button><Button variant={discussion ? 'default' : 'outline'} onClick={() => setDiscussion(true)}>{localizeText("Discussion")}</Button></nav>)}
    </div>)}
    <Dialog open={heroesOpen} onOpenChange={setHeroesOpen}><DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto bg-paper"><DialogTitle className="font-display text-3xl">{localizeText("Héros de la salle")}</DialogTitle><DialogDescription>{localizeText("Les joueurs et les héros de ta table.")}</DialogDescription><RoomPlayersBoard characters={characters} onOpenOwnHero={showOwnHero} /></DialogContent></Dialog>
    <Dialog open={choosing} onOpenChange={setChoosing}><DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto bg-paper"><DialogTitle className="font-display text-3xl">{localizeText("Choisir mon héros")}</DialogTitle><DialogDescription>{localizeText("Propose un héros au MJ. Il remplacera ta fiche après son accord.")}</DialogDescription><RoomHeroAssignments characters={characters} playerId={session.id} /></DialogContent></Dialog>
  </div>;
}
