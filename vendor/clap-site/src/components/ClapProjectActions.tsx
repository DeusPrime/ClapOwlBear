import { localizeText, localizeNode } from '@/i18n/localize';
import { failExportProgress, withExportProgress } from "@/lib/exportProgress";
import { useEffect, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { downloadBlob } from "@/lib/characterPng";
import { exportClapProject, importClapProject, type ClapProject, type ProjectInput } from "@/lib/clapProject";

export default function ClapProjectActions({ disabled, project, onImport, onBusyChange }: { disabled: boolean; project: ProjectInput; onImport: (project: ClapProject) => void; onBusyChange: (busy: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const button = "flex min-h-11 items-center justify-center gap-2 border-2 border-ink px-4 py-2 font-bold disabled:opacity-50";
  const save = async () => {
    return withExportProgress(async () => {
      setBusy(true); onBusyChange(true); setError("");
      try {
        const bytes = await exportClapProject(project);
        downloadBlob(new Blob([bytes as BlobPart], { type: "application/zip" }), project.tool === "book-background" ? "fond-livre.clap" : project.tool === "image-conversion" ? "conversion-images.clap" : "planche-A4.clap");
      } catch (cause) { failExportProgress(); setError(cause instanceof Error ? cause.message : "Export du projet impossible."); }
      finally { setBusy(false); onBusyChange(false); }
    });
  };
  const open = async (file: File) => {
    setBusy(true); onBusyChange(true); setError("");
    try { onImport(await importClapProject(await file.arrayBuffer(), project.tool)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Import du projet impossible."); }
    finally { setBusy(false); onBusyChange(false); }
  };
  useEffect(() => {
    const area = root.current?.closest('main');
    if (!area) return;
    const dragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) {
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled || busy ? 'none' : 'copy';
      }
    };
    const drop = (event: DragEvent) => {
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (!files.some(file => /\.clap$/i.test(file.name))) return;
      event.preventDefault(); event.stopPropagation();
      if (disabled || busy) return;
      if (files.length !== 1) { setError('Dépose un seul fichier .clap à la fois.'); return; }
      void open(files[0]);
    };
    area.addEventListener('dragover', dragOver, true);
    area.addEventListener('drop', drop, true);
    return () => { area.removeEventListener('dragover', dragOver, true); area.removeEventListener('drop', drop, true); };
  });
  return <div ref={root} className="mb-6 space-y-2">
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={disabled || busy} className={button} onClick={() => void save()}><Download size={16} />{localizeText("Exporter le projet .clap")}</button>
      <button type="button" disabled={disabled || busy} className={button} onClick={() => input.current?.click()}><Upload size={16} />{localizeText("Ouvrir un projet .clap")}</button>
    </div>
    <input ref={input} type="file" accept=".clap" disabled={disabled || busy} aria-label={localizeText("Ouvrir un projet .clap")} className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void open(file); }} />
    <p className="text-xs text-foreground/60">{localizeText("Dépose aussi un fichier .clap n’importe où dans la ressource pour l’ouvrir. Il remplacera le contenu courant.")}</p>
    {localizeNode(busy && <p role="status" className="text-sm">{localizeText("Traitement du projet…")}</p>)}
    {localizeNode(error && <p role="alert" className="text-sm text-destructive">{localizeNode(error)}</p>)}
  </div>;
}
