import CropDragOverlay from "./CropDragOverlay";
import { localizeText, localizeNode } from '@/i18n/localize';
import { useEffect, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { createClapStyleBlob } from "@/lib/clapImageStyle";
import { blobDataUrl, loadEditingImage, rotateImageDataUrl, type ImageEditing } from "@/lib/imageEditing";
import { dominantImageColor } from "@/lib/dominantImageColor";
import ImageStyleLoader from "./ImageStyleLoader";
import { optimizeImageImport } from "@/lib/optimizeImageImport";

type Props = { value?: string; editing?: ImageEditing; onChange: (value: string | undefined, editing: ImageEditing | undefined, dominantColor?: string) => void; label?: string; inputLabel?: string; removeLabel?: string; removable?: boolean; portrait?: boolean; aspectRatio?: number; disabled?: boolean; maxImageDimension?: number };

export default function ImageEditorField({ value, editing, onChange, label = "Image", inputLabel, removeLabel = "Retirer", removable = true, portrait = false, aspectRatio, disabled = false, maxImageDimension }: Props) {
  const [crop, setCrop] = useState({ x: 50, y: 50, zoom: 1 });
  const [draft, setDraft] = useState<ImageEditing | null>(null);
  const [preview, setPreview] = useState<{ source: string; style: number; url: string; width: number; height: number } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const openedSource = useRef<string>();
  const source = draft?.source;
  const style = draft?.style ?? 0;
  const pending = !!draft && (!preview || preview.source !== source || preview.style !== style);
  useEffect(() => {
    if (!source) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const image = await loadEditingImage(source);
        const styled = style ? await blobDataUrl(await createClapStyleBlob(source, style, controller.signal)) : source;
        if (!controller.signal.aborted) setPreview({ source, style, url: styled, width: image.naturalWidth, height: image.naturalHeight });
      } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Traitement impossible."); }
    }, 150);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [source, style]);
  async function importFile(file?: File) {
    if (!file || disabled || saving || importing) return;
    setImporting(true);
    setError("");
    try {
      if (aspectRatio && file.size > 8 * 1024 * 1024) throw new Error("Image trop volumineuse : maximum 8 Mo.");
      let source = await blobDataUrl(await optimizeImageImport(file));
      if (maxImageDimension) {
        const original = await loadEditingImage(source);
        if (Math.max(original.naturalWidth, original.naturalHeight) > maxImageDimension || source.length > 350000) {
          const scale = Math.min(1, maxImageDimension / Math.max(original.naturalWidth, original.naturalHeight));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(original.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(original.naturalHeight * scale));
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Préparation de l’image indisponible.");
          context.drawImage(original, 0, 0, canvas.width, canvas.height);
          source = canvas.toDataURL("image/webp", .9);
        }
      }
      const image = await loadEditingImage(source);
      setPreview({ source, style: 0, url: source, width: image.naturalWidth, height: image.naturalHeight });
      setDraft({ source, rotation: 0, style: 40 }); setCrop({ x: 50, y: 50, zoom: 1 });
    } catch (err) { setError(err instanceof Error ? err.message : "Import impossible."); }
    finally { setImporting(false); }
  }
  async function open() {
    if (disabled || importing) return;
    if (!value) { input.current?.click(); return; }
    setPreview(null); setError("");
    setCrop(editing?.crop ?? { x: 50, y: 50, zoom: 1 });
    try {
      const source = editing?.source ?? (value.startsWith("data:") ? value : await blobDataUrl(await (await fetch(value)).blob()));
      openedSource.current = source;
      setDraft(editing ?? { source, rotation: 0, style: 0 });
    } catch { setError("Impossible d’ouvrir cette image. Importe un nouveau fichier."); input.current?.click(); }
  }
  async function apply() {
    if (!draft || !preview || pending) return;
    setSaving(true); setError("");
    try {
      // Keep a bundled image as a shared asset when no settings changed.
      // Rasterizing it would store both a large PNG and its base64 original.
      if (value && !value.startsWith("data:") && !editing && draft.source === openedSource.current
        && draft.rotation === 0 && draft.style === 0 && crop.x === 50 && crop.y === 50 && crop.zoom === 1) {
        setDraft(null);
        return;
      }
      const newPortrait = portrait && draft.source !== (editing?.source ?? value);
      const dominantColor = newPortrait ? await dominantImageColor(draft.source) : undefined;
      let result = await rotateImageDataUrl(preview.url, draft.rotation);
      if (aspectRatio) {
        const image = await loadEditingImage(result);
        const w = Math.min(image.naturalWidth, image.naturalHeight * aspectRatio) / crop.zoom, h = w / aspectRatio;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(Math.min(1600, w))); canvas.height = Math.max(1, Math.round(canvas.width / aspectRatio));
        const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Cadrage indisponible.");
        ctx.drawImage(image, (image.naturalWidth - w) * crop.x / 100, (image.naturalHeight - h) * crop.y / 100, w, h, 0, 0, canvas.width, canvas.height);
        result = canvas.toDataURL("image/png");
      }
      onChange(result, aspectRatio ? { ...draft, crop } : draft, dominantColor);
      setDraft(null);
    }
    catch (err) { setError(err instanceof Error ? err.message : "Enregistrement impossible."); }
    finally { setSaving(false); }
  }
  const sideways = (draft?.rotation ?? 0) % 180 !== 0;
  const width = preview ? sideways ? preview.height : preview.width : 1;
  const height = preview ? sideways ? preview.width : preview.height : 1;
  const ratio = width / height;
  const previewRatio = aspectRatio ?? ratio;
  const button = "min-h-11 border-2 border-ink px-3 py-2 text-sm font-bold disabled:opacity-50";
  return <div className="space-y-3">
    {importing && <div role="status" className="flex items-center gap-2 text-sm"><LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />{localizeText("Import en cours…")}</div>}
    <input ref={input} type="file" accept="image/*" aria-label={localizeText(inputLabel ?? `Importer ${label.toLowerCase()}`)} className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void importFile(file); }} />
    <button type="button" disabled={disabled} onClick={() => void open()} aria-label={localizeText(value ? `Modifier ${label.toLowerCase()}` : `Ajouter ${label.toLowerCase()}`)} className={portrait ? "relative block aspect-[2/3] w-full overflow-hidden border-2 border-dashed border-ink/40 bg-paper-dark" : "flex min-h-24 w-full items-center gap-4 border border-ink/30 bg-paper-dark/30 p-3 text-left"}>
      {localizeNode(value ? <img src={value} alt={localizeText(label)} className={portrait ? "absolute inset-0 h-full w-full object-cover" : "h-24 w-20 shrink-0 object-contain"} /> : <ImagePlus size={32} className={portrait ? "mx-auto" : "shrink-0"} />)}
      <span className={portrait ? "absolute inset-x-0 bottom-0 bg-black/70 p-2 text-sm text-white" : "text-sm font-bold"}>{localizeNode(value ? "Ouvrir et régler l’image" : `Ajouter ${label.toLowerCase()}`)}</span>
    </button>
    {localizeNode(value && removable && <button type="button" disabled={disabled} onClick={() => onChange(undefined, undefined)} className="flex min-h-11 items-center gap-2 text-sm text-destructive"><X size={16} />{localizeNode(removeLabel)}</button>)}
    {localizeNode(!draft && error && <p role="alert" className="text-sm text-destructive">{localizeNode(error)}</p>)}
    <Dialog open={!!draft} onOpenChange={open => { if (!open && !saving) setDraft(null); }}>
      <DialogContent className="flex h-[96dvh] max-h-[900px] w-[calc(100%-1rem)] max-w-2xl flex-col gap-0 overflow-hidden bg-paper p-0 [&>button]:right-2 [&>button]:top-2 [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center">
        <div className="shrink-0 border-b border-ink/20 p-3 pr-16"><DialogTitle>{localizeText("Modifier ")}{localizeNode(label.toLowerCase())}</DialogTitle><DialogDescription className="mt-1 text-xs">{localizeText("Rotation, style et remplacement de l’image. Réglez le cadrage lorsque disponible.")}</DialogDescription></div>
        <div className="shrink-0 border-b border-ink/20 bg-ink/5 p-3">
          <div aria-label={localizeText("Image agrandie")} aria-busy={pending} className="relative mx-auto overflow-hidden" style={{ width: `min(100%, ${34 * previewRatio}dvh, ${340 * previewRatio}px)`, aspectRatio: `${previewRatio}` }}>
            {localizeNode(preview ? <svg viewBox={`0 0 ${width} ${height}`} style={aspectRatio ? { width: `${100 * Math.max(1, ratio / aspectRatio) * crop.zoom}%`, height: `${100 * Math.max(1, aspectRatio / ratio) * crop.zoom}%`, maxWidth: "none", position: "absolute", left: `${crop.x}%`, top: `${crop.y}%`, transform: `translate(-${crop.x}%, -${crop.y}%)` } : undefined} className="block h-full w-full" role="img" aria-label={localizeText(label)}><g transform={`translate(${width / 2} ${height / 2}) rotate(${draft?.rotation ?? 0})`}><image href={preview.url} x={-preview.width / 2} y={-preview.height / 2} width={preview.width} height={preview.height} /></g></svg> : <div className="flex h-full items-center justify-center text-sm">{localizeText("Chargement…")}</div>)}
            {aspectRatio && <CropDragOverlay disabled={saving || pending} value={{ x: crop.x / 100, y: crop.y / 100 }} travelX={1 - Math.max(1, ratio / aspectRatio) * crop.zoom} travelY={1 - Math.max(1, aspectRatio / ratio) * crop.zoom} onChange={position => setCrop(current => ({ ...current, x: position.x * 100, y: position.y * 100 }))} />}{pending && <ImageStyleLoader />}
          </div>
        </div>
        {aspectRatio && <label className="shrink-0 px-4 text-sm">{localizeText("Zoom")}<input aria-label={localizeText("Zoom du cadrage")} type="range" min="1" max="4" step="0.05" value={crop.zoom} disabled={saving} className="block min-h-11 w-full accent-accent" onChange={event => setCrop(current => ({ ...current, zoom: Number(event.target.value) }))} /></label>}
        {draft && <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4">
          <fieldset disabled={saving}><legend className="mb-2 font-bold">{localizeText("Rotation")}</legend><div className="grid grid-cols-4 gap-2">{[0, 90, 180, 270].map(angle => <button type="button" key={angle} aria-pressed={draft.rotation === angle} className={`${button} ${draft.rotation === angle ? "bg-accent text-background" : ""}`} onClick={() => setDraft(current => current && { ...current, rotation: angle })}>{localizeNode(angle)}°</button>)}</div></fieldset>
          <label className="block font-bold">{localizeText("Style Clap &amp; Role : ")}{localizeNode(draft.style)} %<input aria-label={localizeText("Style Clap & Role")} type="range" min="0" max="100" value={draft.style} disabled={saving} className="block min-h-11 w-full accent-accent" onChange={event => { const style = Number(event.target.value); setError(""); setDraft(current => current && { ...current, style }); }} /><span className="relative flex justify-between gap-2 text-xs font-normal opacity-70"><span>{localizeText("0 · Original")}</span><span className="absolute left-[40%] -translate-x-1/2">{localizeText("40 &#183; Clap &amp; Role")}</span><span>{localizeText("100 · Intense")}</span></span></label>
          <div className="grid grid-cols-3 gap-2">{[{ value: 0, label: "Original" }, { value: 40, label: "Clap & Role" }, { value: 100, label: "Intense" }].map(preset => <button key={preset.value} type="button" disabled={saving} aria-pressed={draft.style === preset.value} className={`${button} ${draft.style === preset.value ? "border-accent bg-accent text-background" : ""}`} onClick={() => { setError(""); setDraft(current => current && { ...current, style: preset.value }); }}>{localizeNode(preset.label)}</button>)}</div>
          <p role="status" className="text-sm opacity-70">{localizeNode(pending ? "Stylisation en cours…" : "Aperçu à jour.")}</p>
          <button type="button" disabled={saving} className={`${button} flex w-full items-center justify-center gap-2`} onClick={() => input.current?.click()}><Upload size={16} />{localizeText("Remplacer l’image")}</button>
          {localizeNode(error && <p role="alert" className="text-sm text-destructive">{localizeNode(error)}</p>)}
        </div>}
        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-ink/20 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"><button type="button" className={button} disabled={saving} onClick={() => setDraft(null)}>{localizeText("Annuler")}</button><button type="button" className={`${button} bg-accent text-background`} disabled={saving || pending || !!error} onClick={() => void apply()}>{localizeNode(saving ? "Enregistrement…" : "Appliquer")}</button></div>
      </DialogContent>
    </Dialog>
  </div>;
}
