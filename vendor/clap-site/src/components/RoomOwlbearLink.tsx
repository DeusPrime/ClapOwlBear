import { useRoom } from '@/hooks/use-room';
import { owlbearRoomUrlSchema } from '@/lib/roomProtocol';
import { ExternalLink } from 'lucide-react';

export default function RoomOwlbearLink({ compact = false }: { compact?: boolean }) {
  const { owlbearUrl } = useRoom();
  if (!owlbearUrl || !owlbearRoomUrlSchema.safeParse(owlbearUrl).success) return null;
  return <a href={owlbearUrl} target="_blank" rel="noopener noreferrer" aria-label="Ouvrir la salle Owlbear" title="Ouvrir la salle Owlbear" className="inline-flex min-h-11 shrink-0 items-center gap-2 text-xs underline underline-offset-4"><ExternalLink size={15} /><span className={compact ? 'hidden sm:inline' : ''}>Ouvrir la salle Owlbear</span></a>;
}
