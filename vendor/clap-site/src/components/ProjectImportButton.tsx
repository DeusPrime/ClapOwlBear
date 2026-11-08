import { localizeText, localizeNode } from '@/i18n/localize';
import { useRef, useState, type ReactNode, type DragEvent } from "react";
import { Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import type { importStudioArchive } from "@/lib/studioImport";

type ImportResult = Awaited<ReturnType<typeof importStudioArchive>>;

export default function ProjectImportButton({ className, children, onImported }: { className?: string; children?: ReactNode; onImported?: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const restoring = useRef(false);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const button = className ?? "flex min-h-11 items-center gap-2 border-2 border-ink px-3 py-2 typewriter text-xs disabled:opacity-50";
  const showProject = () => window.location.assign("/characters");
  async function restore(file: File) {
    if (restoring.current) return;
    restoring.current = true;
    setOpen(true); setBusy(true); setError(""); setResult(null); setProgress("Lecture du fichier…");
    try {
      if (!/\.clapstudio$/i.test(file.name)) throw new Error('Choisis un fichier .clapStudio.');
      const { importStudioArchive } = await import("@/lib/studioImport");
      setResult(await importStudioArchive(await file.arrayBuffer(), setProgress));
      setProgress("");
      onImported?.();
    } catch (cause) { setProgress(""); setError(cause instanceof Error ? cause.message : "Import impossible."); }
    finally { restoring.current = false; setBusy(false); }
  }
  function drop(event: DragEvent<HTMLDivElement>) {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    event.preventDefault(); event.stopPropagation(); dragDepth.current = 0; setDragging(false);
    if (restoring.current) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length !== 1) {
      setOpen(true); setResult(null); setProgress(''); setError('Dépose un seul fichier .clapStudio à la fois.');
      return;
    }
    void restore(files[0]);
  }
  const importButton = <button type="button" disabled={busy} className={button} onClick={() => input.current?.click()}><Upload size={16} />{localizeText("Importer un projet .clapStudio")}</button>;
  return <>
    {children ? <div aria-label={localizeText('Liste des projets')} aria-busy={busy} className={`space-y-4 rounded-lg transition-shadow ${dragging ? 'bg-accent/10 ring-2 ring-accent ring-offset-4' : ''}`}
      onDragEnter={event => { if (!Array.from(event.dataTransfer.types).includes('Files')) return; event.preventDefault(); dragDepth.current++; setDragging(true); }}
      onDragOver={event => { if (!Array.from(event.dataTransfer.types).includes('Files')) return; event.preventDefault(); event.dataTransfer.dropEffect = busy ? 'none' : 'copy'; }}
      onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); }}
      onDrop={drop}>
      {children}
    </div> : importButton}
    <input ref={input} type="file" accept=".clapStudio,.clapstudio" aria-label={localizeText("Fichier projet .clapStudio")} className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void restore(file); }} />
    <Dialog open={open} onOpenChange={next => { if (busy) return; if (!next && result && !onImported) showProject(); else setOpen(next); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto bg-paper">
        <DialogTitle>{localizeText("Importer un projet")}</DialogTitle>
        <DialogDescription>{localizeText("La restauration crée un nouveau projet. Vos projets existants sont conservés.")}</DialogDescription>
        {localizeNode(progress && <p role="status" className="text-sm">{localizeNode(progress)}</p>)}
        {localizeNode(error && <p role="alert" className="text-sm text-destructive">{localizeNode(error)}</p>)}
        {localizeNode(result && <div className="space-y-3">
          <p role="status" className="font-bold">{localizeText("Le projet « ")}{localizeNode(result.project.name)}{localizeText(" » a été importé.")}</p>
          <p className="text-sm">{localizeNode(result.heroes)}{localizeText(" héros · ")}{localizeNode(result.resources)}{localizeText(" cartes · ")}{localizeNode(result.tools)}{localizeText(" ressources")}</p>
          {localizeNode(result.unresolvedLinks > 0 && <p className="text-sm">{localizeNode(result.unresolvedLinks)}{localizeText(" lien(s) vers des cartes absentes du fichier n’ont pas été repris.")}</p>)}
          <button type="button" className="min-h-11 border-2 border-ink bg-ink px-4 py-2 font-bold text-background" onClick={showProject}>{localizeText("Ouvrir le projet")}</button>
        </div>)}
        {localizeNode(!busy && !result && <button type="button" className="min-h-11 border-2 border-ink px-4 py-2 font-bold" onClick={() => input.current?.click()}>{localizeText("Choisir un autre fichier")}</button>)}
      </DialogContent>
    </Dialog>
  </>;
}
