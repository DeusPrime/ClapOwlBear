import { localizeText } from '@/i18n/localize';
import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Users } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRoom } from '@/hooks/use-room';
import type { Character } from '@/lib/characters';
import RoomChat from './RoomChat';
import RoomPrivateResources from './RoomPrivateResources';
import RoomProjectImport from './RoomProjectImport';
import RoomHeroReserve from './RoomHeroReserve';
import RoomOwlbearLink from './RoomOwlbearLink';
import RoomHeroProposalDialog from './RoomHeroProposalDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

export default function RoomMJWorkspace({ characters }: { characters: Character[] }) {
  const room = useRoom();
  const mobile = useIsMobile();
  const [pane, setPane] = useState('room');
  const workspace = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mobile || pane !== 'chat') return;
    const root = workspace.current;
    const composer = root?.querySelector<HTMLElement>('.room-chat-composer');
    const messages = root?.querySelector<HTMLElement>('.room-chat-messages');
    const navigation = root?.querySelector<HTMLElement>('[role="tablist"]');
    if (!root || !composer || !navigation) return;
    const measure = () => {
      root.style.setProperty('--mj-composer-height', `${composer.offsetHeight}px`);
      root.style.setProperty('--mj-tabs-height', `${navigation.offsetHeight}px`);
      if (messages) root.style.setProperty('--mj-messages-top', `${Math.max(0, messages.getBoundingClientRect().top)}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(composer);
    observer.observe(navigation);
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [mobile, pane]);
  if (!room.session || room.session.role !== 'mj') return null;
  const session = room.session;
  return <Tabs ref={workspace} value={pane} onValueChange={setPane} className="room-mj-workspace pb-24 md:pb-0">
    <RoomHeroProposalDialog />
    <TabsList aria-label={localizeText("Navigation de la salle MJ")} className="fixed inset-x-0 bottom-0 z-30 grid h-auto grid-cols-2 gap-2 rounded-none border-t border-ink/15 bg-paper/95 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-[0_-3px_18px_hsl(var(--ink)_/_0.04)] backdrop-blur md:hidden">
      <TabsTrigger value="room" className="min-h-14 gap-2 rounded-lg data-[state=active]:bg-accent/10 data-[state=active]:text-accent data-[state=active]:shadow-none"><Users size={18} />{localizeText("Salle")}</TabsTrigger>
      <TabsTrigger value="chat" className="min-h-14 gap-2 rounded-lg data-[state=active]:bg-accent/10 data-[state=active]:text-accent data-[state=active]:shadow-none"><MessageSquare size={18} />{localizeText("Discussion")}</TabsTrigger>
    </TabsList>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
      <TabsContent value="room" forceMount hidden={mobile && pane !== 'room'} className="mt-0 min-w-0 space-y-6">
        <RoomProjectImport />
        <RoomOwlbearLink />
        <div data-tour="room-players"><RoomHeroReserve characters={characters} /></div>
        {Boolean(room.projectName || room.privateRefs.length || room.roomHeroes.length || Object.keys(room.savedSheets || {}).length) && <div data-tour="room-private-cards"><RoomPrivateResources characters={characters} /></div>}
      </TabsContent>
      <TabsContent value="chat" forceMount hidden={mobile && pane !== 'chat'} className="room-mj-chat mt-0 min-w-0 lg:sticky lg:top-24">
        <div data-tour="room-chat"><RoomChat messages={room.messages} memberId={session.id} members={room.members} /></div>
      </TabsContent>
    </div>
  </Tabs>;
}
