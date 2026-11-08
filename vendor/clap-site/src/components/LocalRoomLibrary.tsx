import { localizeText, localizeNode } from '@/i18n/localize';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { DoorOpen, Download, ImagePlus } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import ImageEditorField from './ImageEditorField';
import defaultPoster from '@/assets/project-poster-default.webp';
import { importRoomArchive, listLocalRooms, exportRoomArchive, captureRoomLibrary, updateLocalRoomPoster, type RoomArchive } from '@/lib/roomArchive';

export default function LocalRoomLibrary({ busy, onOpen, importInput }: { busy: boolean; onOpen: (room: RoomArchive) => void; importInput?: RefObject<HTMLInputElement> }) {
  const [rooms, setRooms] = useState<RoomArchive[]>([]);
  const [working, setWorking] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const localInput = useRef<HTMLInputElement>(null);
  const input = importInput ?? localInput;
  const root = useRef<HTMLElement>(null);
  const importing = useRef(false);
  const selected = rooms.find(room => room.id === editing);
  useEffect(() => {
    let active = true;
    const refresh = () => { void listLocalRooms().then(value => { if (active) setRooms(value); }).catch(() => { if (active) setError('Sauvegardes locales indisponibles sur cet appareil.'); }); };
    refresh(); window.addEventListener('clap-local-rooms-changed', refresh);
    return () => { active = false; window.removeEventListener('clap-local-rooms-changed', refresh); };
  }, []);
  async function run(action: () => Promise<void>) {
    setWorking(true); setError('');
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Action impossible.'); }
    finally { setWorking(false); }
  }
  const tileButton = 'flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-md border border-ink/15 px-2 py-2 text-xs font-semibold hover:bg-ink/5 disabled:opacity-50';
  async function importFiles(files: File[]) {
    if (busy || working || importing.current) return;
    if (files.length !== 1 || !/\.clapSalle$/i.test(files[0].name)) { setError('Choisis un seul fichier .clapSalle à importer.'); return; }
    importing.current = true;
    try { await run(async () => { await importRoomArchive(files[0]); }); }
    finally { importing.current = false; }
  }
  useEffect(() => {
    const area = root.current?.closest('main');
    if (!area) return;
    const over = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = busy || working ? 'none' : 'copy'; }
    };
    const drop = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault(); event.stopPropagation();
      void importFiles(Array.from(event.dataTransfer.files));
    };
    area.addEventListener('dragover', over, true); area.addEventListener('drop', drop, true);
    return () => { area.removeEventListener('dragover', over, true); area.removeEventListener('drop', drop, true); };
  });
  return <section ref={root} className="space-y-4" aria-labelledby="saved-rooms-title">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="saved-rooms-title" className="font-display text-3xl">{localizeText("Mes salles sur cet appareil")}</h2>
      <input ref={input} hidden type="file" accept=".clapSalle" aria-label={localizeText("Fichier salle .clapSalle")} onChange={event => {
        const file = event.target.files?.[0]; event.target.value = '';
        if (file) void importFiles([file]);
      }} />
    </div>
    <p className="text-sm text-muted-foreground">{localizeText("Tes salles sauvegardées : retrouve ta table ou exporte ta partie pour la conserver.")}</p>
    <p className="text-xs text-muted-foreground">{localizeText("Glisse un fichier .clapSalle sur cette page pour ajouter une salle.")}</p>
    {localizeNode(working && <p role="status" className="text-sm">{localizeText("Traitement de la salle…")}</p>)}
    {localizeNode(!rooms.length && <p className="rounded-lg border border-dashed border-ink/20 p-8 text-center text-sm text-muted-foreground">{localizeText("Aucune salle sauvegardée sur cet appareil.")}</p>)}
    <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">{rooms.map(room => <li key={room.id} className="overflow-hidden rounded-xl border border-ink/15 bg-paper" data-room-tile={room.id}>
      <div className="relative aspect-[3/4] overflow-hidden bg-ink">
        <img src={room.posterImage || defaultPoster} alt="" loading="lazy" className="h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 to-transparent px-3 pb-4 pt-16 text-white"><p className="mb-2 text-[10px] uppercase tracking-widest text-white/75">{localizeText("Salle sauvegardée")}</p><h3 className="break-words font-display text-2xl leading-tight sm:text-3xl">{localizeNode(room.title)}</h3><p className="mt-2 text-xs text-white/80">{localizeText("MJ : ")}{localizeNode(room.hostName || 'MJ')}</p></div>
        <button type="button" disabled={busy || working} aria-label={localizeText(`Modifier l’image de ${room.title}`)} title={localizeText("Modifier l’image")} className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/65 text-white hover:bg-black/90 disabled:opacity-50" onClick={() => { setError(''); setEditing(room.id); }}><ImagePlus size={18} /></button>
      </div>
      <div className="space-y-3 p-2.5 sm:p-3"><p className="text-[10px] text-muted-foreground">{localizeText("Enregistrée le ")}{localizeNode(new Date(room.updatedAt).toLocaleDateString('fr-FR'))}</p><div className="grid grid-cols-2 gap-2">
        <button type="button" className={tileButton} disabled={busy || working} title={localizeText("Ouvrir la salle")} onClick={() => onOpen(room)}><DoorOpen size={15} className="shrink-0" /><span>{localizeText("Ouvrir")}</span></button>
        <button type="button" className={tileButton} disabled={busy || working} aria-label={localizeText(`Exporter ${room.title} en .clapSalle`)} title={localizeText("Exporter .clapSalle")} onClick={() => void run(async () => {
          const blob = await exportRoomArchive(await captureRoomLibrary(room));
          const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url;
          link.download = room.title.replace(/[^\p{L}\p{N}_-]+/gu, '_') + '.clapSalle'; link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        })}><Download size={15} className="shrink-0" /><span>{localizeText("Export")}</span></button>
      </div></div>
    </li>)}</ul>
    {localizeNode(error && !selected && <p role="alert" className="text-sm text-destructive">{localizeNode(error)}</p>)}
    <Dialog open={!!selected} onOpenChange={open => { if (!open && !working) setEditing(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto bg-paper"><DialogTitle>{localizeText("Image de la salle")}</DialogTitle><DialogDescription>{localizeNode(selected?.title)}</DialogDescription>
      {localizeNode(selected && <ImageEditorField label={localizeText("Affiche de la salle")} inputLabel="Importer une image de salle" value={selected.posterImage || defaultPoster} editing={selected.posterEditing} removable={!!selected.posterImage} removeLabel="Rétablir l’affiche par défaut" aspectRatio={3 / 4} maxImageDimension={1000} disabled={working} onChange={(image, editing) => void run(() => updateLocalRoomPoster(selected.id, image, editing))} />)}
      {localizeNode(error && <p role="alert" className="text-sm text-destructive">{localizeNode(error)}</p>)}
    </DialogContent></Dialog>
  </section>;
}
