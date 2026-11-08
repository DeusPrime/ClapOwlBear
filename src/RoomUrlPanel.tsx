import { useEffect, useState } from 'react';
import { roomClient } from '@/lib/roomClient';
import { useRoom } from '@/hooks/use-room';
import { Button } from '@/components/ui/button';
export default function RoomUrlPanel() {
  const room = useRoom();
  const [url, setUrl] = useState(room.owlbearUrl || ''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => setUrl(room.owlbearUrl || ''), [room.owlbearUrl]);
  if (room.session?.role !== 'mj') return null;
  return <form className="space-y-3 border border-ink/20 p-4" onSubmit={event => { event.preventDefault(); setBusy(true); setError(''); void roomClient.setOwlbearRoomUrl(url).catch(cause => setError(cause instanceof Error ? cause.message : 'Lien invalide.')).finally(() => setBusy(false)); }}>
    <label htmlFor="owlbear-room-url" className="block text-sm font-bold">Adresse de la salle Owlbear</label>
    <input id="owlbear-room-url" type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://www.owlbear.rodeo/room/.../..." className="min-h-11 w-full border border-ink bg-paper p-3" disabled={busy} />
    <p className="text-xs text-muted-foreground">Si le lien n'a pas pu être détecté automatiquement, colle l'adresse complète de la salle. Le lien apparaît dans CLAP! pour le MJ et les joueurs uniquement quand cette adresse est renseignée.</p>
    <Button type="submit" disabled={busy}>Enregistrer le lien de la salle</Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </form>;
}
