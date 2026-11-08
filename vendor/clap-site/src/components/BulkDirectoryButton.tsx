import { localizeText, localizeNode } from '@/i18n/localize';
import { useState } from "react";
import { FolderInput } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { activeDirectory } from "@/lib/directories";
import DirectoryPicker from "./DirectoryPicker";

export default function BulkDirectoryButton({ count, disabled, onApply }: { count: number; disabled: boolean; onApply: (id: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [directoryId, setDirectoryId] = useState(activeDirectory);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const apply = async () => {
    setBusy(true); setError("");
    try { await onApply(directoryId); setOpen(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Déplacement impossible."); }
    finally { setBusy(false); }
  };
  return <>
    <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="flex min-h-10 items-center gap-2 border-2 border-ink px-3 py-2 text-xs font-bold disabled:opacity-50"><FolderInput size={16} />{localizeText("Déplacer vers…")}</button>
    <Dialog open={open} onOpenChange={next => { if (!busy) setOpen(next); }}><DialogContent className="bg-paper">
      <DialogTitle>{localizeText("Déplacer dans un projet")}</DialogTitle>
      <DialogDescription>{localizeNode(count)}{localizeText(" fiche")}{localizeNode(count > 1 ? "s" : "")}{localizeText(" seront placées dans le projet choisi.")}</DialogDescription>
      <fieldset disabled={busy}><DirectoryPicker value={directoryId} onChange={setDirectoryId} /></fieldset>
      {localizeNode(error && <p role="alert" className="text-destructive">{localizeNode(error)}</p>)}
      <button type="button" disabled={busy} onClick={() => void apply()} className="border-2 border-ink bg-ink px-4 py-2 text-background disabled:opacity-50">{localizeNode(busy ? "Déplacement…" : "Déplacer")}</button>
    </DialogContent></Dialog>
  </>;
}
