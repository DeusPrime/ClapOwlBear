import { localizeText } from '@/i18n/localize';
import { useRef } from "react";
import { LoaderCircle, Upload } from "lucide-react";

export default function ToolImageImport({ label, onImport, disabled = false, importing = false }: { label: string; onImport: (files: File[]) => void; disabled?: boolean; importing?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return <section data-tour="tool-import" aria-label={localizeText("Import des images")} aria-busy={importing} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!disabled && !importing) onImport(Array.from(event.dataTransfer.files)); }} className="space-y-3 border-2 border-dashed border-ink bg-paper-dark/30 p-5 text-center">
    <Upload className="mx-auto" aria-hidden="true" />
    <p className="text-sm">{localizeText("Glissez vos images ici ou sélectionnez plusieurs fichiers.")}</p>
    <button type="button" disabled={disabled || importing} onClick={() => input.current?.click()} className="min-h-11 border-2 border-ink px-4 py-2 font-bold disabled:opacity-50">{importing ? <span role="status" className="inline-flex items-center gap-2"><LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />{localizeText("Import en cours…")}</span> : localizeText("Ajouter des images")}</button>
    <input ref={input} type="file" multiple accept="image/*" aria-label={localizeText(label)} disabled={disabled || importing} className="hidden" onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; if (!disabled && !importing) onImport(files); }} />
    <p className="text-xs opacity-60">{localizeText("PNG, JPEG, WebP… Traitement local dans votre navigateur.")}</p>
    <p className="text-xs opacity-60">{localizeText("PNG optimisés sans perte à l’import, uniquement si le fichier devient plus léger. Dimensions et couleurs conservées.")}</p>
  </section>;
}
