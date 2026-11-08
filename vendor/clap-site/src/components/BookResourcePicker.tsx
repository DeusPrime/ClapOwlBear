import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { loadToolDocuments, type ToolDocument } from '@/lib/toolDocuments';
import { loadDirectories } from '@/lib/directories';
import { blobDataUrl } from '@/lib/imageEditing';
import { loadKeyRoles } from '@/lib/keyRoles';
import { loadFigurants } from '@/lib/figurants';
import { loadProfiles } from '@/lib/profiles';
import { loadPowers } from '@/lib/powers';
import { loadVehicles } from '@/lib/vehicles';
import defaultProjectPoster from '@/assets/project-poster-default.webp';
import type { BackgroundVariants } from '@/lib/filmBooks';

type Choice = { id: string; name: string; preview: string; source?: string; tool?: ToolDocument };
export default function BookResourcePicker({ directoryId, choose, close, background = false }: { directoryId: string; choose: (source: string, variants?:BackgroundVariants) => void; close: () => void; background?:boolean }) {
  const [progress, setProgress] = useState('');
  const [items, setItems] = useState<Choice[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  useEffect(() => {
    let disposed = false;
    void (async () => {
      const results = await Promise.allSettled(background ? [loadToolDocuments()] : [loadToolDocuments(), loadKeyRoles(), loadFigurants(), loadProfiles(), loadPowers(), loadVehicles()]);
      const choices: Choice[] = [];
      const poster = loadDirectories().find(d => d.id === directoryId)?.posterImage || defaultProjectPoster;
      if (poster && !background) choices.push({ id: 'poster', name: 'Image du projet', preview: poster, source: poster });
      results.forEach((result, index) => {
        if (result.status === 'rejected') { setError('Certaines ressources n’ont pas pu être chargées.'); return; }
        if (index === 0) for (const tool of result.value as ToolDocument[]) {
          if (tool.directoryId !== directoryId || !tool.data) continue;
          if (background && (tool.kind !== 'book-background' || !tool.data.images.length)) continue;
          if (tool.kind === 'book-background') choices.push({ id: tool.id, name: `${tool.name} · Fond composé`, preview: tool.preview || tool.data.images[0]?.source || '', tool });
          if (!background) for (const [i, image] of tool.data.images.entries()) choices.push({ id: `${tool.id}-${i}`, name: `${tool.name} · ${image.name}`, preview: image.source, source: image.source });
        } else for (const card of result.value as { id: string; directoryId: string; titre: string; image?: string }[]) {
          if (card.directoryId === directoryId && card.image) choices.push({ id: `${index}-${card.id}`, name: card.titre || 'Illustration de carte', preview: card.image, source: card.image });
        }
      });
      if (!disposed) { setItems(choices); setLoading(false); }
    })().catch(e => { if (!disposed) { setError(String(e)); setLoading(false); } });
    return () => { disposed = true; };
  }, [directoryId,background]);
  async function select(item: Choice) {
    if (busy) return;
    setBusy(true); setError(''); setProgress('');
    try {
      const { exportToolResult } = item.tool ? await import('@/lib/toolOutput') : { exportToolResult: null };
      if(background && item.tool?.data?.tool==='book-background') {
        const { exportBookBackgroundVariants } = await import('@/lib/toolOutput');
        const variants = await exportBookBackgroundVariants(item.tool, setProgress);
        choose(variants['right-light'],variants);
      } else { const source=item.tool ? await blobDataUrl((await exportToolResult!(item.tool)).blob) : item.source!;choose(source); }
      close();
    }
    catch(e) { setError(String(e)); } finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) close(); }}><DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto bg-paper"><DialogTitle>Choisir dans les ressources</DialogTitle><DialogDescription>Images et fonds enregistrés dans le projet actif.</DialogDescription>
    {!background && <label className="inline-flex min-h-11 cursor-pointer items-center justify-center border-2 border-ink p-3 font-bold">Parcourir l’ordinateur<input type="file" className="hidden" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={async e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 15*1024*1024 || !['image/png','image/jpeg','image/webp'].includes(file.type)) { setError('Choisissez un PNG, JPEG ou WebP de moins de 15 Mo.'); return; } setBusy(true); try { choose(await blobDataUrl(file)); close(); } catch(err) { setError(String(err)); } finally { setBusy(false); } }} /></label>}
    {error && <p role="alert" className="text-destructive">{error}</p>}{loading ? <p>Chargement…</p> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{items.map(item => <button key={item.id} disabled={busy} className="border border-ink/30 p-2 text-left disabled:opacity-40" onClick={() => void select(item)}>{item.preview && <img src={item.preview} alt="" className="mb-2 h-32 w-full object-contain" />}<span className="text-sm">{item.name}</span></button>)}</div>}
    {!loading && !items.length && <p>{background ? 'Créez d’abord une ressource fond de livre dans Ressources.' : 'Aucune image enregistrée dans ce projet. Vous pouvez en choisir une sur l’ordinateur.'}</p>}{busy && <p role="status">Préparation de l’image…</p>}
  </DialogContent></Dialog>;
}
