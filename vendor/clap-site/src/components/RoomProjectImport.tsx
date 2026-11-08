import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { roomClient } from '@/lib/roomClient';
import { useRoom } from '@/hooks/use-room';
import { Button } from './ui/button';
import { loadDirectories } from '@/lib/directories';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from './ui/alert-dialog';

type Choice = { type: 'project'; id: string; name: string } | { type: 'file'; file: File; name: string };
export default function RoomProjectImport({ management = false, onComplete }: { management?: boolean; onComplete?: () => void }) {
  const room = useRoom();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  useEffect(() => {
    const update = (event: Event) => { const message = (event as CustomEvent).detail?.message; if (typeof message === 'string') setProgress(message); };
    window.addEventListener('clap-room-import-progress', update);
    return () => window.removeEventListener('clap-room-import-progress', update);
  }, []);
  const [directories, setDirectories] = useState(loadDirectories);
  const [selected, setSelected] = useState('');
  const [pending, setPending] = useState<Choice | null>(null);
  useEffect(() => {
    const refresh = () => setDirectories(loadDirectories());
    window.addEventListener('focus', refresh); window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); };
  }, []);
  if (room.session?.role !== 'mj') return null;
  if (!management) return <section aria-label="Projet de la salle" className="space-y-2 border-2 border-ink bg-background/40 p-5 sm:p-6"><h2 className="font-display text-3xl">Projet de la salle</h2>{room.projectName ? <p className="font-bold">{room.projectName}</p> : <p>Charge un projet depuis « Gérer la salle → Changer de projet » pour commencer.</p>}<p className="text-sm text-muted-foreground">Les changements de la partie restent dans la salle. Le projet d’origine est conservé.</p></section>;
  const projects = directories.filter(project => !project.roomKey);
  async function confirm() {
    if (!pending) return;
    setBusy(true); setError(''); setProgress('Transmission du projet au moteur de salle…');
    try {
      if (pending.type === 'file') {
        if (!/\.clapstudio$/i.test(pending.file.name)) throw new Error('Choisis un fichier .clapStudio.');
        await roomClient.importProject(await pending.file.arrayBuffer(), undefined, true);
      } else await roomClient.useProject(pending.id, true);
      setPending(null); setSelected(''); onComplete?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Changement de projet impossible.'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-4">
    {room.projectName && <p className="text-sm">Projet actuel : <strong>{room.projectName}</strong></p>}
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); const project = projects.find(item => item.id === selected); if (project) { setError(''); setPending({ type: 'project', id: project.id, name: project.name }); } }}>
      <label htmlFor="room-linked-project" className="block space-y-2 text-sm font-bold"><span>Nouveau projet</span><select aria-label="Nouveau projet" id="room-linked-project" value={selected} onChange={event => setSelected(event.target.value)} disabled={busy} className="min-h-11 w-full border border-ink bg-paper px-3 font-normal"><option value="">Choisir un projet…</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      <Button type="submit" disabled={busy || !selected}>Changer de projet</Button>
    </form>
    <input ref={input} type="file" accept=".clapStudio,.clapstudio" aria-label="Fichier projet de la salle .clapStudio" className="hidden" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) { setError(''); setPending({ type: 'file', file, name: file.name }); } }} />
    <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}><Upload size={16} className="mr-2" />Importer un projet .clapStudio</Button>
    <p className="text-sm text-muted-foreground">Le nouveau projet sera copié dans une salle propre. La progression de la partie actuelle ne sera pas conservée.</p>
    <AlertDialog open={Boolean(pending)} onOpenChange={open => { if (!open && !busy) setPending(null); }}><AlertDialogContent className="bg-paper"><AlertDialogHeader><AlertDialogTitle>Changer de projet et remettre la salle à zéro ?</AlertDialogTitle><AlertDialogDescription>Toute la progression en cours sera définitivement supprimée : héros attribués, blessures, inventaires, cartes, PV, discussion et jets. La salle repartira de zéro avec le projet « {pending?.name} ». Le projet d’origine est conservé.</AlertDialogDescription></AlertDialogHeader>
      {busy && <p role="status" aria-live="polite" className="text-sm">{progress || "Import en cours…"}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <AlertDialogFooter><AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel><AlertDialogAction disabled={busy} className="bg-destructive text-destructive-foreground" onClick={event => { event.preventDefault(); void confirm(); }}>{busy ? 'Remise à zéro…' : 'Confirmer et remettre à zéro'}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </div>;
}
