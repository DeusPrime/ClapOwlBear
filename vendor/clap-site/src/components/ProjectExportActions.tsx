import { localizeText, localizeNode } from '@/i18n/localize';
import { failExportProgress, withExportProgress } from "@/lib/exportProgress";
import { useState } from "react";
import { Download, FileDown } from "lucide-react";
import { downloadBlob } from "@/lib/characterPng";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export default function ProjectExportActions({ directoryId, className }: { directoryId: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [pdfOpen, setPdfOpen] = useState(false);
  const [includeBacks, setIncludeBacks] = useState(true);
  async function run(format: "archive" | "pdf", backs = true) {
    return withExportProgress(async () => {
      setBusy(true); setError(""); setProgress("Lecture du projet…");
      try {
        const { collectStudioProject, exportStudioArchive, exportStudioPdf } = await import("@/lib/studioProject");
        const project = await collectStudioProject(directoryId);
        const name = project.project.name.replace(/[^\p{L}\p{N}_-]+/gu, "_") || "projet";
        const blob = format === "archive"
          ? new Blob([await exportStudioArchive(project) as BlobPart], { type: "application/zip" })
          : await exportStudioPdf(project, setProgress, { includeBacks: backs });
        downloadBlob(blob, `${name}.${format === "archive" ? "clapStudio" : "pdf"}`);
        setProgress("Export terminé.");
      } catch (cause) { failExportProgress(); setProgress(""); setError(cause instanceof Error ? cause.message : "Export impossible."); }
      finally { setBusy(false); }
    });
  }
  const button = className ?? "flex min-h-11 items-center gap-2 border-2 border-ink px-3 py-2 text-sm disabled:opacity-50";
  return <div className={className ? "space-y-1" : "contents"}>
    <button type="button" className={button} disabled={busy} onClick={() => void run("archive")}><Download size={16} />{localizeText("Exporter le projet .clapStudio")}</button>
    <button type="button" className={button} disabled={busy} onClick={() => { setIncludeBacks(true); setPdfOpen(true); }}><FileDown size={16} />{localizeText("Exporter tout le projet en PDF")}</button>
    <Dialog open={pdfOpen} onOpenChange={setPdfOpen}><DialogContent className="bg-paper">
      <DialogTitle>{localizeText("Exporter tout le projet en PDF")}</DialogTitle>
      <DialogDescription>{localizeText("L’export de tous les héros, cartes et ressources peut prendre plusieurs minutes selon la taille du projet. Gardez cette page ouverte pendant la préparation.")}</DialogDescription>
      <label className="flex min-h-12 cursor-pointer items-center gap-3 border-2 border-ink/30 p-3 text-sm font-bold"><input type="checkbox" checked={includeBacks} onChange={event => setIncludeBacks(event.target.checked)} className="h-5 w-5 accent-accent" />{localizeText("Inclure les versos des cartes")}</label>
      <p className="text-xs text-foreground/60">{localizeText("Décochez cette option pour exporter uniquement les rectos des héros, des cartes et des planches A4.")}</p>
      <DialogFooter><button type="button" className="min-h-11 border-2 border-ink px-4 py-2 font-bold" onClick={() => setPdfOpen(false)}>{localizeText("Annuler")}</button><button type="button" disabled={busy} className="min-h-11 bg-accent px-4 py-2 font-bold text-background" onClick={() => { setPdfOpen(false); void run("pdf", includeBacks); }}>{localizeText("Lancer l’export PDF")}</button></DialogFooter>
    </DialogContent></Dialog>
    {localizeNode(progress && <p role="status" className="px-3 py-2 text-xs">{localizeNode(progress)}</p>)}
    {localizeNode(error && <p role="alert" className="px-3 py-2 text-xs text-destructive">{localizeNode(error)}</p>)}
  </div>;
}
