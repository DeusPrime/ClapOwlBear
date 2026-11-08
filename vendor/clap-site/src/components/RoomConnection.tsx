import { localizeText, localizeNode } from '@/i18n/localize';
import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Users } from "lucide-react";
import { roomClient } from "@/lib/roomClient";
import { useRoom } from "@/hooks/use-room";

export default function RoomConnection() {
  const { session, connected, error } = useRoom();
  const location = useLocation();
  useEffect(() => { roomClient.restore(); return () => roomClient.stop(); }, []);
  if (!session || ["/salle", "/app/salle"].includes(location.pathname)) return null;
  return <Link to="/app/salle" className="fixed bottom-24 right-3 z-40 flex items-center gap-2 border-2 border-ink bg-paper px-3 py-2 text-xs shadow-lg sm:bottom-4">
    <Users size={16} />{localizeText(" Salle · ")}{localizeNode(session.role === "mj" ? "MJ" : "Joueur")} · {localizeNode(error ? "Reconnexion…" : `${connected.length} connexion(s)`)}
  </Link>;
}
