import { localizeText, localizeNode } from '@/i18n/localize';
import defaultPoster from '@/assets/project-poster-default.webp';
import LocalRoomLibrary from './LocalRoomLibrary';
import { previousRoomNickname } from "@/lib/roomNickname";
import { ownedRoom } from '@/lib/roomResume';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { DoorOpen, LockKeyhole, Plus, RefreshCw, Upload, Users } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { useQuery } from "@tanstack/react-query";
import { roomClient } from "@/lib/roomClient";
import { roomCode, type RoomListing } from "@/lib/roomProtocol";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = { error?: string; name: string; onName: (name: string) => void; busy: boolean; invitation: string; onEnter: (create: boolean, code: string, options: { title?: string; password?: string; localRoomId?: string }) => Promise<void> };
export default function RoomLobby({ error, name, onName, busy, invitation, onEnter }: Props) {
  const query = useQuery({ queryKey: ["rooms", "list"], queryFn: () => roomClient.list(), refetchInterval: 15000 });
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<RoomListing | null>(null);
  const [code, setCode] = useState(invitation);
  const [joining, setJoining] = useState(() => Boolean(invitation && !ownedRoom(roomCode(invitation))));
  const [title, setTitle] = useState("");
  const importInput = useRef<HTMLInputElement>(null);

  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState("");
  const [resuming, setResuming] = useState(false);
  const [resumeError, setResumeError] = useState('');
  const resume = useCallback(async (action: () => Promise<void>) => {
    setResuming(true); setResumeError('');
    try { await action(); }
    catch (cause) { setResumeError(cause instanceof Error ? cause.message : 'Reprise impossible.'); }
    finally { setResuming(false); }
  }, []);
  useEffect(() => {
    if (!invitation) return;
    setCode(invitation); setCreating(false);
    const code = roomCode(invitation);
    if (ownedRoom(code)) { setJoining(false); void resume(() => roomClient.resumeOwnedRoom(code)); }
    else void resume(async () => {
      try { await roomClient.rejoin(code); }
      catch (cause) {
        if (![400, 403, 404].includes((cause as { status?: number }).status || 0)) throw cause;
        setJoining(true);
      }
    });
  }, [invitation, resume]);
  const choose = (room: RoomListing) => { if (ownedRoom(room.id)) { void resume(() => roomClient.resumeOwnedRoom(room.id)); return; } void resume(async () => {
    try { await roomClient.rejoin(room.id); }
    catch (cause) {
      if (![400, 403, 404].includes((cause as { status?: number }).status || 0)) throw cause;
      setSelected(room); setCode(room.id); setJoining(true); setCreating(false); setPassword(''); onName(previousRoomNickname(room.id)); setNicknameOpen(true);
    }
  }); };
  const targetRoom = selected || query.data?.rooms.find(room => room.id === roomCode(code));
  return <div className="space-y-6">
    <div data-tour="room-library"><LocalRoomLibrary importInput={importInput} busy={busy || resuming} onOpen={room => { void resume(() => roomClient.resumeLocalRoom(room.id)); }} /></div>
    {localizeNode(resumeError && <p role="alert" className="text-sm text-destructive">{localizeNode(resumeError)}</p>)}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-display text-3xl">{localizeText("Salles actuelles")}</h2>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw size={16} className="mr-2" />{localizeText("Actualiser")}</Button><Button data-tour="room-create" className="hidden sm:inline-flex" onClick={() => { setTitle(""); setCreating(true); setJoining(false); setPassword(""); }}><Plus size={16} className="mr-2" />{localizeText("Créer une salle")}</Button></div>
    </div>
    {localizeNode(query.isPending && <p role="status">{localizeText("Chargement des salles…")}</p>)}
    {localizeNode(query.isError && <p role="alert" className="border border-destructive p-4 text-sm text-destructive">{localizeText("Impossible de charger les salles. Réessaie avec le bouton Actualiser.")}</p>)}
    {localizeNode(query.isSuccess && !query.data.rooms.length && <div className="border-2 border-dashed border-ink/25 p-8 text-center"><Users className="mx-auto mb-3 text-muted-foreground" /><p className="font-bold">{localizeText("Aucune salle pour le moment")}</p><p className="mt-2 text-sm text-muted-foreground">{localizeText("Crée une salle et invite ta table à te rejoindre.")}</p></div>)}
    <ul data-tour="room-list" className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">{query.data?.rooms.map(room => <li key={room.id} className="flex min-w-0 flex-col gap-3 overflow-hidden rounded-xl border border-ink/15 bg-paper pb-4"><div className="relative aspect-[3/4] overflow-hidden"><img src={defaultPoster} alt="" loading="lazy" className="h-full w-full object-cover" /><span className="absolute left-3 top-3 rounded bg-black/70 px-2 py-1 text-xs text-white">{localizeText("En ligne")}</span></div>
      <div className="flex items-start justify-between gap-3 px-3"><div><h3 className="break-words font-display text-2xl">{localizeNode(room.title || `Salle de ${room.host}`)}</h3><p className="mt-1 text-sm text-muted-foreground">{localizeText("MJ : ")}{localizeNode(room.host)}</p></div>{localizeNode(room.locked && <LockKeyhole size={20} aria-label={localizeText("Salle protégée par un mot de passe")} className="shrink-0" />)}</div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 px-3"><span className="text-sm text-muted-foreground">{localizeNode(room.participants)}{localizeText(" / 16 participants · ")}{localizeNode(room.locked ? "Protégée" : "Accès libre")}</span><Button variant="outline" disabled={busy || resuming || (room.participants >= 16 && !ownedRoom(room.id) && !room.returning)} onClick={() => choose(room)}><DoorOpen size={16} className="mr-2" />{localizeNode(ownedRoom(room.id) ? "Reprendre comme MJ" : room.returning ? "Retrouver ma place" : room.participants >= 16 ? "Complète" : "Rejoindre")}</Button></div>
    </li>)}</ul>
    <Button data-tour="room-join" type="button" variant="outline" disabled={busy} onClick={() => { setSelected(null); setCreating(false); setJoining(true); setCode(""); setPassword(""); }}><DoorOpen size={16} className="mr-2" />{localizeText("Par identifiant")}</Button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><button data-tour="room-create" type="button" aria-label={localizeText("Ajouter une salle")} disabled={busy || resuming} className="fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full border-2 border-ink bg-accent text-background shadow-lg disabled:opacity-50 sm:hidden"><Plus size={28} strokeWidth={3} /></button></DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" sideOffset={10}>
        <DropdownMenuItem className="min-h-11" onSelect={() => { setTitle(''); setCreating(true); setJoining(false); setNicknameOpen(false); setPassword(''); }}><Plus size={16} className="mr-2" />{localizeText("Créer une salle vide")}</DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" onSelect={() => importInput.current?.click()}><Upload size={16} className="mr-2" />{localizeText("À partir d’un fichier .clapSalle")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={creating || joining} onOpenChange={open => { if (!open && !busy) { setCreating(false); setJoining(false); setNicknameOpen(false); setPassword(""); } }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto bg-paper">
      {!nicknameOpen ? <><DialogTitle className="font-display text-3xl">{localizeNode(creating ? "Créer une salle" : selected ? `Rejoindre ${selected.title || selected.host}` : "Rejoindre une salle")}</DialogTitle>
      <DialogDescription>{localizeNode(creating ? "Prépare ta salle avant d’accueillir les joueurs." : "Renseigne l’identifiant de la salle à rejoindre.")}</DialogDescription>
      <form className="space-y-5" onSubmit={event => { event.preventDefault(); if (!creating && ownedRoom(roomCode(code))) { setJoining(false); void resume(() => roomClient.resumeOwnedRoom(roomCode(code))); return; } if (!creating) {
        void resume(async () => {
          try { await roomClient.rejoin(roomCode(code)); }
          catch (cause) {
            if (![400, 403, 404].includes(cause?.status || 0)) throw cause;
            onName(previousRoomNickname(code)); setNicknameOpen(true);
          }
        });
        return;
      }
      onName(name); setNicknameOpen(true); }}>
      <fieldset disabled={busy || resuming} className="space-y-5">
        {localizeNode(creating ? <>
          <div className="max-w-md space-y-2"><label htmlFor="room-title" className="text-sm font-bold">{localizeText("Nom de la salle")}</label><Input id="room-title" required maxLength={80} placeholder={localizeText("Ex. Le dernier clap")} value={title} onChange={event => setTitle(event.target.value)} /></div>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={locked} onChange={event => { setLocked(event.target.checked); setPassword(""); }} />{localizeText("Protéger la salle par un mot de passe")}</label>
        </> : <><div className="max-w-md space-y-2"><label htmlFor="room-code" className="text-sm font-bold">{localizeText("Identifiant de la salle")}</label><Input id="room-code" required maxLength={500} value={code} onChange={event => { setCode(event.target.value); setSelected(null); }} /></div></>)}
        {localizeNode((creating && locked) && <div className="max-w-md space-y-2"><label htmlFor="room-password" className="text-sm font-bold">{localizeText("Mot de passe")}{localizeNode(!creating && !selected ? " (si la salle est protégée)" : "")}</label><Input id="room-password" type="password" autoComplete={creating ? "new-password" : "current-password"} required={creating || Boolean(selected?.locked)} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} /></div>)}
        <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy}>{localizeNode(busy ? "Connexion…" : creating ? "Créer en tant que MJ" : "Rejoindre comme joueur")}</Button><Button type="button" variant="outline" onClick={() => { setCreating(false); setJoining(false); setNicknameOpen(false); setPassword(""); }}>{localizeText("Annuler")}</Button></div>
      </fieldset>
    </form></> : <>
        <DialogTitle className="font-display text-3xl">{localizeText("Ton pseudo dans la salle")}</DialogTitle>
        <DialogDescription>{localizeText("Choisis le nom qui sera affiché aux autres participants.")}</DialogDescription>
        <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (name.trim()) void onEnter(creating, code, { ...(creating ? { title } : {}), password }); }}>
          <label htmlFor="room-name" className="block text-sm font-bold">{localizeText("Ton pseudo")}</label>
          <Input id="room-name" autoFocus required maxLength={40} autoComplete="nickname" disabled={busy} value={name} onChange={event => onName(event.target.value)} />
          {localizeNode(joining && targetRoom?.locked !== false && <div className="space-y-2"><label htmlFor="room-join-password" className="text-sm font-bold">{localizeText("Mot de passe")}{localizeNode(!targetRoom ? " (si la salle est protégée)" : "")}</label><Input id="room-join-password" type="password" autoComplete="current-password" required={Boolean(targetRoom?.locked)} maxLength={128} disabled={busy} value={password} onChange={event => setPassword(event.target.value)} /></div>)}
          {localizeNode(error && <p role="alert" className="text-sm text-destructive">{localizeNode(error)}</p>)}
          <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy || !name.trim()}>{localizeNode(busy ? "Connexion…" : creating ? "Créer la salle" : "Entrer dans la salle")}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => { if (joining && selected) { setJoining(false); setSelected(null); setPassword(""); } setNicknameOpen(false); }}>{localizeText("Annuler")}</Button></div>
        </form>
      </>}
      </DialogContent>
    </Dialog>
    <p className="text-sm text-muted-foreground">{localizeText("Les salles ouvertes sont accessibles tant que le MJ est connecté. Leur état reste sauvegardé sur son appareil.")}</p>
  </div>;
}
