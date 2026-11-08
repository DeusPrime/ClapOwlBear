import { localizeNode } from '@/i18n/localize';
﻿import { useState } from "react";
import { UserRoundCheck } from "lucide-react";
import { useRoom } from "@/hooks/use-room";
import { roomClient } from "@/lib/roomClient";

export default function UseHeroInRoom({ characterId }: { characterId: string }) {
  const { session } = useRoom();
  const [error, setError] = useState("");
  if (session?.role !== "player") return null;
  const selected = session.characterId === characterId;
  return <div className="mt-3">
    <button type="button" disabled={selected} onClick={async () => { try { await roomClient.selectCharacter(characterId); setError(""); } catch { setError("Impossible de sélectionner ce héros."); } }} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-sm border border-ink/25 bg-paper px-3 py-2 text-sm hover:bg-ink/5 disabled:bg-ink/10 disabled:font-bold"><UserRoundCheck size={16} />{localizeNode(selected ? "Héros de la salle" : "Utiliser dans la salle")}</button>
    {localizeNode(error && <p role="alert" className="mt-2 text-xs text-destructive">{localizeNode(error)}</p>)}
  </div>;
}
