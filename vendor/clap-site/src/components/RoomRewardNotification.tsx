import { localizeNode } from '@/i18n/localize';
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import ResourcePngPreview from "./ResourcePngPreview";
import type { BundledResource } from "@/lib/resourceBundle";
import { useRoom } from "@/hooks/use-room";
type Reward = { title: string; removed: boolean; resource?: BundledResource; item?: Record<string, string> };
export default function RoomRewardNotification() {
  const { session } = useRoom();
  return session?.role === "player" ? <RewardQueue key={session.id} /> : null;
}
function RewardQueue() {
  const [queue, setQueue] = useState<Reward[]>([]);
  useEffect(() => { const receive = (event: Event) => setQueue(previous => [...previous, (event as CustomEvent<Reward>).detail]); window.addEventListener('clap-room-reward', receive); return () => window.removeEventListener('clap-room-reward', receive); }, []);
  const reward = queue[0];
  return <Dialog open={Boolean(reward)} onOpenChange={open => { if (!open) setQueue(previous => previous.slice(1)); }}><DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto bg-paper">
    <DialogTitle>{localizeNode(reward?.removed ? 'Le MJ a retiré un élément' : 'Tu as gagné un élément !')}</DialogTitle><DialogDescription>{localizeNode(reward?.title)}{localizeNode(reward?.removed ? ' a été retiré de ta fiche.' : ' a été ajouté à ta fiche.')}</DialogDescription>
    {reward && <div key={`${queue.length}:${reward.title}`} className={reward.removed ? 'room-reward-destroy' : 'room-reward-gain'}>{reward.resource ? <div className="mx-auto max-w-56"><ResourcePngPreview resource={reward.resource} /></div> : <div className="space-y-2 rounded border-2 border-ink bg-paper p-6"><p className="font-display text-3xl">{localizeNode(reward.title)}</p>{Object.entries(reward.item || {}).filter(([key, value]) => key !== 'nom' && value).map(([key, value]) => <p key={key} className="break-words text-sm">{localizeNode(({ proprietes: 'Propriétés', degats: 'Dégâts', poids: 'Poids', protection: 'Protection' } as Record<string, string>)[key] || key)} : {localizeNode(value)}</p>)}</div>}</div>}
  </DialogContent></Dialog>;
}
