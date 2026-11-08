import { localizeText, localizeNode } from '@/i18n/localize';
import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Plus, Save, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useExitConfirmation } from "@/hooks/use-exit-confirmation";
import { communityRequest } from "@/lib/community";
import type { CreditsDocument } from "@/lib/credits";

export default function CreditsEditor({ initial, onSaved, onClose }: {
  initial: CreditsDocument; onSaved: (credits: CreditsDocument) => void; onClose: () => void;
}) {
  const [fields, setFields] = useState(() => ({ ...initial, sections: initial.sections.map(section => ({ role: section.role, role_en: section.role_en ?? "", names: section.names.join("\n") })) }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { requestExit, dialog } = useExitConfirmation();
  const original = { ...initial, sections: initial.sections.map(section => ({ role: section.role, role_en: section.role_en ?? "", names: section.names.join("\n") })) };
  const close = () => { if (!busy) requestExit(JSON.stringify(fields) !== JSON.stringify(original), onClose); };
  const move = (index: number, direction: number) => setFields(previous => {
    const sections = [...previous.sections];
    [sections[index], sections[index + direction]] = [sections[index + direction], sections[index]];
    return { ...previous, sections };
  });
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const document = { ...fields, sections: fields.sections.map(section => ({ role: section.role, ...(section.role_en.trim() ? { role_en: section.role_en.trim() } : {}), names: section.names.split(/\r?\n/).map(name => name.trim()).filter(Boolean) })) };
      const saved = await communityRequest<CreditsDocument>("/admin/credits", document);
      onSaved(saved);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible d’enregistrer les crédits."); }
    finally { setBusy(false); }
  }
  const field = (key: "title" | "subtitle" | "thanks" | "ending", label: string, maxLength: number) => <label className="block space-y-2 text-sm"><span>{localizeNode(label)}</span><Input required maxLength={maxLength} value={fields[key]} onChange={event => setFields(previous => ({ ...previous, [key]: event.target.value }))} /></label>;
  return <>
    <Dialog open onOpenChange={open => { if (!open) close(); }}>
      <DialogContent className="flex max-h-[90dvh] max-w-3xl flex-col gap-0 overflow-hidden bg-paper p-0 [&>button]:hidden">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-ink/20 p-4 sm:p-6">
          <div><DialogTitle className="font-display text-2xl">{localizeText("Modifier les crédits")}</DialogTitle><DialogDescription>{localizeText("Les modifications seront visibles par tous après enregistrement.")}</DialogDescription></div>
          <div className="flex shrink-0 gap-2"><Button form="credits-editor" type="submit" disabled={busy} aria-label={localizeText(busy ? "Enregistrement" : "Sauvegarder")}><Save size={16} /><span className="hidden sm:inline">{localizeNode(busy ? "Enregistrement…" : "Sauvegarder")}</span><span className="sr-only sm:hidden">{localizeText("Sauvegarder")}</span></Button><Button type="button" variant="ghost" size="icon" aria-label={localizeText("Fermer l’édition des crédits")} disabled={busy} onClick={close}><X size={18} /></Button></div>
        </div>
        <form id="credits-editor" onSubmit={save} className="min-h-0 overflow-y-auto p-4 sm:p-6" aria-busy={busy}>
          <fieldset disabled={busy} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">{localizeNode(field("title", "Titre du générique", 160))}{field("subtitle", "Sous-titre", 300)}{localizeNode(field("thanks", "Message de remerciement final", 160))}{localizeNode(field("ending", "Mention de fin", 80))}</div>
            <div className="space-y-4">{fields.sections.map((section, index) => <section key={index} className="space-y-3 border-2 border-ink/25 p-4">
              <div className="flex items-center justify-between gap-2"><h3 className="font-bold">{localizeText("Rubrique ")}{localizeNode(index + 1)}</h3><div className="flex gap-1">
                <Button type="button" variant="ghost" size="icon" aria-label={localizeText(`Monter la rubrique ${index + 1}`)} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} /></Button>
                <Button type="button" variant="ghost" size="icon" aria-label={localizeText(`Descendre la rubrique ${index + 1}`)} disabled={index === fields.sections.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} /></Button>
                <Button type="button" variant="ghost" size="icon" className="text-destructive" aria-label={localizeText(`Supprimer la rubrique ${index + 1}`)} disabled={fields.sections.length === 1} onClick={() => setFields(previous => ({ ...previous, sections: previous.sections.filter((_, position) => position !== index) }))}><Trash2 size={16} /></Button>
              </div></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2 text-sm"><span>{localizeText("Titre FR de la rubrique ")}{index + 1}</span><Input required maxLength={120} value={section.role} onChange={event => setFields(previous => ({ ...previous, sections: previous.sections.map((item, position) => position === index ? { ...item, role: event.target.value } : item) }))} /></label>
                <label className="block space-y-2 text-sm"><span>{localizeText("Titre EN de la rubrique ")}{index + 1}</span><Input maxLength={120} value={section.role_en} onChange={event => setFields(previous => ({ ...previous, sections: previous.sections.map((item, position) => position === index ? { ...item, role_en: event.target.value } : item) }))} /></label>
              </div>
              <p className="text-xs text-muted-foreground">{localizeText("Si le titre anglais est vide, le titre français sera affiché.")}</p>
              <label className="block space-y-2 text-sm"><span>{localizeText("Noms de la rubrique ")}{localizeNode(index + 1)}{localizeText(" — un nom par ligne")}</span><Textarea required rows={3} maxLength={10049} value={section.names} onChange={event => setFields(previous => ({ ...previous, sections: previous.sections.map((item, position) => position === index ? { ...item, names: event.target.value } : item) }))} /></label>
            </section>)}</div>
            <Button type="button" variant="outline" disabled={fields.sections.length >= 40} onClick={() => setFields(previous => ({ ...previous, sections: [...previous.sections, { role: "", role_en: "", names: "" }] }))}><Plus size={16} />{localizeText("Ajouter une rubrique")}</Button>
            {localizeNode(error && <p role="alert" className="text-sm text-destructive">{localizeNode(error)}</p>)}
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
    {localizeNode(dialog)}
  </>;
}
