import ApplicationTour from "@/components/ApplicationTour";
import { localizeText, localizeNode } from '@/i18n/localize';
import RoomPlayerWorkspace from '@/components/RoomPlayerWorkspace';
import RoomMJWorkspace from '@/components/RoomMJWorkspace';
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Users } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import RoleTabs from '@/components/RoleTabs';
import Logo from "@/components/clap/Logo";
import RoomLobby from "@/components/RoomLobby";
import RoomManagement from "@/components/RoomManagement";
import { useRoom } from "@/hooks/use-room";
import { roomClient } from "@/lib/roomClient";
import { roomCode } from "@/lib/roomProtocol";
import { loadCharacters, type Character } from "@/lib/characters";

export default function Room({ appView = false }: { appView?: boolean }) {
  const room = useRoom();
  const [params, setParams] = useSearchParams();
  const [name, setName] = useState("");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sessionRoom = room.session?.room;
  useEffect(() => {
    if (sessionRoom && params.get('room') && roomCode(params.get('room')!) === sessionRoom) setParams({}, { replace: true });
  }, [sessionRoom, params, setParams]);
  useEffect(() => { document.title = `${sessionRoom ? room.roomInfo?.title || "Salle de jeu" : "Salles de jeu"} — Clap & Role`; }, [sessionRoom, room.roomInfo?.title]);
  useEffect(() => {
    let active = true;
    const refresh = () => { void loadCharacters().then(items => { if (active) setCharacters(items); }).catch(() => { if (active) setError("Impossible de lire les héros de cet appareil."); }); };
    refresh(); window.addEventListener("focus", refresh); window.addEventListener("clap-room-character-assigned", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); window.removeEventListener("clap-room-character-assigned", refresh); };
  }, []);
  const enter = async (create: boolean, code: string, options: { title?: string; password?: string; localRoomId?: string } = {}) => {
    setError(""); setBusy(true);
    try {
      const normalized = roomCode(code);
      if (!create && !/^[A-F0-9]{12}$/.test(normalized)) throw new Error("Saisis un identifiant de 12 caractères ou un lien d’invitation.");
      if (!name.trim()) throw new Error("Choisis ton pseudo.");
      await roomClient.enter(name.trim(), create ? undefined : normalized, undefined, options);
      setParams({}, { replace: true });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Connexion impossible."); }
    finally { setBusy(false); }
  };
  const invitation = room.session ? `${window.location.origin}/app/salle?room=${room.session.room}` : "";
  const playerView = room.session?.role === "player";
  return <>
    {localizeNode(appView && !playerView && <AppHeader title={localizeText("Salles")} />)}
    <main className={playerView ? "min-h-screen bg-paper text-foreground" : `min-h-screen bg-paper px-4 text-foreground ${appView && !room.session ? "pb-32 sm:pb-12" : "pb-12"} ${appView ? "pt-24 sm:pt-6" : "pt-6"}`}>
      <div className={playerView ? "min-w-0" : "mx-auto max-w-7xl"}>
        {localizeNode(appView && !room.session && <RoleTabs />)}
        {localizeNode(!appView && !playerView && <header className="mb-6"><Link to="/" className="inline-flex items-center gap-3"><Logo className="h-10 w-10" /><span className="font-display text-2xl">{localizeText("Clap & Role")}</span></Link></header>)}
        {localizeNode((error || room.error) && <div role="alert" className="mb-5 border border-destructive bg-destructive/10 p-4 text-sm">{localizeNode(error || room.error)}</div>)}
        {localizeNode(!room.session && room.exitNotice && <p role="status" className="mb-5 border border-accent bg-accent/10 p-4 font-semibold">{localizeNode(room.exitNotice)}</p>)}
        <ApplicationTour key={room.session?.role || "rooms"} view={!room.session ? "rooms" : room.session.role === "mj" ? "room-mj" : "room-player"} />
        {localizeNode(!room.session ? <>
          <div className="mb-8 border-b-2 border-ink pb-5"><p className="typewriter text-xs uppercase tracking-widest text-accent">{localizeText("La partie commence ici")}</p><h1 className={`${appView ? "hidden sm:flex" : "flex"} mt-2 items-center gap-3 font-display text-4xl uppercase sm:text-5xl`}><Users size={32} />{localizeText("Salles de jeu")}</h1><p className="mt-3 max-w-2xl text-muted-foreground">{localizeText("Retrouve ta table ou crée une nouvelle salle pour jouer.")}</p></div>
          <RoomLobby error={error || room.error} name={name} onName={setName} busy={busy} invitation={params.get("room") || ""} onEnter={enter} />
        </> : <>
          {localizeNode(!playerView && <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b-2 border-ink pb-5"><div className="min-w-0"><h1 className="break-words font-display text-4xl sm:text-5xl">{localizeNode(room.roomInfo?.title || "Salle de jeu")}</h1><p className="mt-2 text-sm text-muted-foreground">{localizeNode(room.session.name)} · {localizeNode(room.session.role === "mj" ? "Maître du jeu" : "Joueur")}</p></div><RoomManagement invitation={invitation} /></header>)}
          {localizeNode(params.get("room") && roomCode(params.get("room")!) !== room.session.room && <p role="status" className="mb-5 border border-accent p-3 text-sm">{localizeText("Tu es déjà dans une autre salle. Quitte-la avant d’utiliser cette invitation.")}</p>)}
          {localizeNode(room.session.role === "player" ? <RoomPlayerWorkspace key={room.session.id} characters={characters} invitation={invitation} /> : <RoomMJWorkspace key={room.session.id} characters={characters} />)}
        </>)}
      </div>
    </main>
  </>;
}
