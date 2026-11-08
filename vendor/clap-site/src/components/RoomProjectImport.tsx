import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { roomClient } from '@/lib/roomClient';
import { useRoom } from '@/hooks/use-room';
import { localizeText } from '@/i18n/localize';
import { Button } from './ui/button';

export default function RoomProjectImport() {
  const room = useRoom();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  if (room.session?.role !== 'mj') return null;
  const ready = Boolean(room.projectName || room.privateRefs.length || room.roomHeroes.length || Object.keys(room.savedSheets || {}).length);
  async function restore(file: File) {
    setBusy(true); setError(''); setNotice('');
    try {
      if (!/\.clapstudio$/i.test(file.name)) throw new Error('Choisis un fichier .clapStudio.');
      const result = await roomClient.importProject(await file.arrayBuffer());
      setNotice(`${result.name} : ${result.heroes} héros, ${result.resources} cartes et ${result.tools} ressources importés dans la salle.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Import impossible.'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 border-2 border-ink bg-background/40 p-5 sm:p-6" aria-label={localizeText('Projet de la salle')}>
    <h2 className="font-display text-3xl">{localizeText(ready ? 'Projet de la salle' : 'Importe ton projet pour commencer')}</h2>
    <p className="text-sm text-muted-foreground">{localizeText('Le MJ importe un fichier .clapStudio dans cette salle. Ses héros, cartes et ressources sont conservés dans un projet propre à la salle. Les joueurs n’ont rien à importer.')}</p>
    {room.projectName && <p className="font-bold">{room.projectName}</p>}
    <input ref={input} type="file" accept=".clapStudio,.clapstudio" aria-label={localizeText('Fichier projet de la salle .clapStudio')} className="hidden" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void restore(file); }} />
    <Button type="button" disabled={busy} onClick={() => input.current?.click()}><Upload size={16} className="mr-2" />{localizeText(busy ? 'Import du projet…' : ready ? 'Importer un autre projet .clapStudio' : 'Importer un projet .clapStudio')}</Button>
    {busy && <p role="status" className="text-sm">{localizeText('Import du projet dans la salle…')}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
