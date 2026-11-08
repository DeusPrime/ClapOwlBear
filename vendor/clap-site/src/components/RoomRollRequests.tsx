import { localizeText, localizeNode } from '@/i18n/localize';
﻿import { Link } from "react-router-dom";
import { Dices } from "lucide-react";
import { useRoom } from "@/hooks/use-room";
export default function RoomRollRequests({ onPerform }: { onPerform?: (id: string) => void } = {}) {
  const room = useRoom();
  if (!room.session || !room.requests?.length) return null;
  const session = room.session;
  return <section aria-labelledby="room-requests-title" className="space-y-3 border-2 border-accent bg-accent/5 p-5">
    <h2 id="room-requests-title" className="flex items-center gap-2 font-display text-2xl"><Dices size={22} />{localizeText("Jets demandés par le MJ")}</h2>
    <ul className="space-y-3">{room.requests.map(request => <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/15 pt-3"><div><p className="break-words font-bold">{localizeNode(request.label)}</p><p className="text-sm text-muted-foreground">{request.attributes.map(attribute => attribute.name).join(" + ")} · D{localizeNode(request.die)}{localizeNode(session.role === "mj" ? ` · ${room.members.find(member => member.id === request.target)?.name || "Joueur"}` : "")}</p></div>{localizeNode(request.target === session.id && (session.characterId ? onPerform ? <button type="button" onClick={() => onPerform(request.id)} className="inline-flex min-h-11 items-center border-2 border-ink bg-paper px-4 text-sm font-bold hover:bg-ink/5">{localizeText("Effectuer le jet")}</button> : <Link to={`/characters/${session.characterId}?roomRoll=${request.id}`} className="inline-flex min-h-11 items-center border-2 border-ink bg-paper px-4 text-sm font-bold hover:bg-ink/5">{localizeText("Effectuer le jet")}</Link> : <p className="text-sm">{localizeText("Choisis d’abord ta fiche de héros dans la salle.")}</p>))}</li>)}</ul>
  </section>;
}
