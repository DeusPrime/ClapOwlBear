import { localizeText, localizeNode } from '@/i18n/localize';
import { useState } from 'react';
import { useRoom } from '@/hooks/use-room';
import { roomClient } from '@/lib/roomClient';
import type { Character } from '@/lib/characters';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';

function Hero({ label, hero }: { label: string; hero?: Character }) {
  return <div className="min-w-0 space-y-2 rounded border border-ink/20 p-3"><h3 className="text-sm font-semibold">{localizeNode(label)}</h3>{localizeNode(hero?.portrait && <img src={hero.portrait} alt="" className="mx-auto h-40 max-w-full rounded object-contain" />)}<p className="break-words font-display text-2xl">{hero?.nom || 'Aucun héros'}</p><p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{localizeNode(hero?.concept)}</p></div>;
}

export default function RoomHeroProposalDialog() {
  const room = useRoom();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const proposal = room.heroProposals?.[0];
  async function decide(accepted: boolean) {
    if (!proposal) return;
    setBusy(true); setError('');
    try { await roomClient.resolveHeroProposal(proposal.id, accepted); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Décision impossible.'); }
    finally { setBusy(false); }
  }
  return <Dialog open={Boolean(proposal)}><DialogContent className="max-h-[90dvh] overflow-y-auto bg-paper [&>button]:hidden" onEscapeKeyDown={event => event.preventDefault()} onPointerDownOutside={event => event.preventDefault()}>
    <DialogTitle>{localizeText("Demande de changement de héros")}</DialogTitle><DialogDescription>{localizeNode(room.members.find(member => member.id === proposal?.playerId)?.name || 'Un joueur')}{localizeText(" souhaite remplacer son héros.")}</DialogDescription>
    <div className="grid gap-3 sm:grid-cols-2"><Hero label={localizeText("Héros actuel")} hero={proposal ? room.sheets[proposal.playerId] || room.savedSheets?.[proposal.playerId] as Character : undefined} /><Hero label={localizeText("Héros proposé")} hero={proposal?.character as Character | undefined} /></div>
    {localizeNode(error && <p role="alert" className="text-sm text-destructive">{localizeNode(error)}</p>)}
    <div className="flex justify-end gap-3"><Button variant="outline" disabled={busy} onClick={() => void decide(false)}>{localizeText("Refuser")}</Button><Button disabled={busy} onClick={() => void decide(true)}>{localizeNode(busy ? 'En cours…' : 'Autoriser')}</Button></div>
  </DialogContent></Dialog>;
}
