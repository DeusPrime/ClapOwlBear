import { useImageJobQueue } from "@/hooks/useImageJobQueue";
import { localizeText, localizeNode } from '@/i18n/localize';
import { failExportProgress, reportExportProgress, withExportProgress } from "@/lib/exportProgress";
import ToolImageImport from "@/components/ToolImageImport";
import ClapProjectActions from "@/components/ClapProjectActions";
import type { ToolPayload } from "@/lib/toolDocuments";
import ToolDocumentBar from "@/components/ToolDocumentBar";
import { useRef, useState } from "react";
import { Download, Maximize2, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import JSZip from "jszip";
import ToolsLayout from "@/components/ToolsLayout";
import { createClapStyleBlob } from "@/lib/clapImageStyle";
import { blobDataUrl, loadEditingImage, imagePngBlob } from "@/lib/imageEditing";
import { downloadBlob } from "@/lib/characterPng";
import { convertedImageName } from "@/lib/imageBatch";
import ImageStyleLoader from "@/components/ImageStyleLoader";
import { optimizeImageImport } from "@/lib/optimizeImageImport";

type Artwork = { id: string; source: string; name: string; width: number; height: number };
export default function SingleImageConverter() {
  const [images, setImages] = useState<Artwork[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [expandedPreview, setExpandedPreview] = useState(false);
  const image = images.find(item => item.id === selectedId) ?? images[0];
  const [style, setStyle] = useState(40);
  const processingKey = String(style);
  const [rotation, setRotation] = useState(0);
  const [processed, setProcessed] = useState<Record<string, { key: string; url: string }>>({});
  const styledCache = useRef<Record<string, { style: number; url: string }>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");
  const pending = !!style && images.some(item => processed[item.id]?.key !== processingKey);
  const imagePending = (item: Artwork) => !!style && processed[item.id]?.key !== processingKey;
  const previewFor = (item: Artwork) => style && processed[item.id]?.key === processingKey ? processed[item.id].url : item.source;
  useImageJobQueue(
    style ? images.filter(item => processed[item.id]?.key !== processingKey).map(item => ({ id: item.id, source: item.source, strength: style, width: item.width, height: item.height })) : [],
    async (job, signal) => {
      const cached = styledCache.current[job.id];
      if (cached?.style === job.strength) return cached.url;
      const url = await blobDataUrl(await createClapStyleBlob(job.source, job.strength, signal));
      if (!signal.aborted) styledCache.current[job.id] = { style: job.strength, url };
      return url;
    },
    (job, url) => setProcessed(current => ({ ...current, [job.id]: { key: String(job.strength), url } })),
    (_job, error) => { setError(error instanceof Error ? error.message : "Stylisation impossible."); setStyle(0); },
  );
  async function importImages(files: File[]) {
    if (!files.length || busy || importing) return;
    setImporting(true); setError("");
    const added: Artwork[] = [], failed: string[] = [];
    try {
      for (const file of files) {
        try {
          const source = await blobDataUrl(await optimizeImageImport(file));
          const loaded = await loadEditingImage(source);
          added.push({ id: crypto.randomUUID(), source, name: file.name, width: loaded.naturalWidth, height: loaded.naturalHeight });
        } catch { failed.push(file.name); }
      }
      setImages(current => [...current, ...added]);
      if (added.length) setSelectedId(added[0].id);
      if (failed.length) setError(`Images non prises en charge : ${failed.join(", ")}`);
    } finally { setImporting(false); }
  }
  function remove(id: string) {
    delete styledCache.current[id];
    setImages(current => current.filter(item => item.id !== id));
    setProcessed(current => { const next = { ...current }; delete next[id]; return next; });
  }
  async function exportPng(all: boolean) {
    return withExportProgress(async () => {
      if (!image || pending || busy || importing) return;
      setBusy(true); setError("");
      try {
        const items = all ? images : [image];
        const zip = new JSZip();
        const used = new Set<string>();
        for (let index = 0; index < items.length; index++) {
          setProgress(`Conversion ${index + 1} / ${items.length}`);
          reportExportProgress(10 + index / items.length * 65, `Conversion ${index + 1}/${items.length}`);
          const item = items[index];
          const blob = await imagePngBlob(previewFor(item), rotation);
          const name = convertedImageName(item.name, used);
          if (all) zip.file(name, await blob.arrayBuffer());
          else downloadBlob(blob, name);
        }
        if (all) downloadBlob(await zip.generateAsync({ type: "blob" }, metadata => reportExportProgress(75 + metadata.percent * .25)), "images-clap-role.zip");
      } catch (err) { failExportProgress(); setError(err instanceof Error ? err.message : "Export impossible."); }
      finally { setBusy(false); setProgress(""); }
    });
  }
  const sideways = rotation % 180 !== 0;
  const width = image ? sideways ? image.height : image.width : 1;
  const height = image ? sideways ? image.width : image.height : 1;
  const imagePreview = () => image && <div className="relative h-full w-full" aria-busy={imagePending(image)}><svg viewBox={`0 0 ${width} ${height}`} className="block h-full w-full" role="img" aria-label={localizeText("Image convertie")}><g transform={`translate(${width / 2} ${height / 2}) rotate(${rotation})`}><image href={previewFor(image)} x={-image.width / 2} y={-image.height / 2} width={image.width} height={image.height} preserveAspectRatio="none" /></g></svg>{imagePending(image) && <ImageStyleLoader />}</div>;
  const button = "min-h-11 border-2 border-ink px-4 py-3 font-bold disabled:opacity-50 disabled:cursor-not-allowed";
  const disabled = busy || importing;
  const toolData = { tool: "image-conversion" as const, settings: { style, rotation }, images };
  const restoreTool = (project: ToolPayload) => {
    if (project.tool !== "image-conversion") return;
    setImages(project.images); setSelectedId(project.images[0]?.id ?? ""); setStyle(project.settings.style); setRotation(project.settings.rotation); setProcessed({}); setError("");
    styledCache.current = {};
  };
  return <ToolsLayout title={localizeText("Conversion d’images")} back>
    <ToolDocumentBar kind="image-conversion" data={toolData} disabled={disabled} onLoad={restoreTool} />
    <ClapProjectActions disabled={disabled} onBusyChange={setImporting} project={toolData} onImport={restoreTool} />
    <p className="mb-6">{localizeText("Importez plusieurs images, appliquez le même style et la même rotation à tout le lot, puis téléchargez vos PNG dans un ZIP. Traitement local dans votre navigateur.")}</p>
    <p className="mb-6 text-sm opacity-70">{localizeText("Résolution d’origine conservée, export PNG sans compression avec perte. La stylisation modifie uniquement l’apparence ; choisissez « Original » pour conserver le rendu source.")}</p>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem] lg:gap-8">
      <section aria-label={localizeText("Aperçu des images")} className="min-w-0 space-y-4">
        <ToolImageImport label={localizeText("Importer des images à convertir")} onImport={files => void importImages(files)} disabled={disabled} importing={importing} />
        <div className={`relative flex items-center justify-center overflow-hidden border-2 border-dashed border-ink bg-paper-dark/30 p-2 sm:p-3 ${image ? "h-[65dvh] min-h-80 lg:h-[75dvh]" : "min-h-60"}`}>
          {localizeNode(image ? <>{localizeNode(imagePreview())}<button type="button" onClick={() => setExpandedPreview(true)} aria-label={localizeText("Agrandir l’aperçu")} className="absolute right-3 top-3 flex min-h-11 items-center gap-2 border-2 border-ink bg-paper px-3 py-2 text-sm font-bold hover:bg-paper-dark"><Maximize2 size={18} /><span className="hidden sm:inline">{localizeText("Agrandir")}</span></button></> : <div className="text-center"><p>{localizeText("Vos images apparaîtront ici.")}</p></div>)}
        </div>
        {localizeNode(image && <p className="break-all text-sm opacity-70">{localizeNode(image.name)} · {localizeNode(images.length)}{localizeText(" image(s)")}</p>)}
        <ul className="grid max-h-72 grid-cols-2 gap-3 overflow-auto sm:grid-cols-3">{images.map(item => <li key={item.id} className={`relative border-2 p-2 ${image?.id === item.id ? "border-accent" : "border-ink/30"}`}>
          <button type="button" disabled={disabled} onClick={() => setSelectedId(item.id)} aria-label={localizeText(`Voir ${item.name}`)} className="relative w-full" aria-busy={imagePending(item)}><img src={previewFor(item)} alt="" className="h-24 w-full object-contain" /><span className="block truncate text-xs">{localizeNode(item.name)}</span>{imagePending(item) && <ImageStyleLoader compact />}</button>
          <button type="button" disabled={disabled} onClick={() => remove(item.id)} aria-label={localizeText(`Retirer ${item.name}`)} className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center bg-paper"><X size={16} /></button>
        </li>)}</ul>
      </section>
      <section aria-label={localizeText("Réglages de conversion")} className="min-w-0 space-y-6 lg:sticky lg:top-24">
        <p className="text-sm font-bold">{localizeText("Réglages appliqués à toutes les images")}</p>
        <fieldset disabled={!image || disabled} className="space-y-6">
          <fieldset><legend className="mb-3 font-bold">{localizeText("Rotation")}</legend><div className="grid grid-cols-4 gap-2">{[0, 90, 180, 270].map(angle => <button type="button" key={angle} aria-pressed={rotation === angle} className={`${button} px-2 ${rotation === angle ? "bg-accent text-background" : ""}`} onClick={() => setRotation(angle)}>{localizeNode(angle)}°</button>)}</div></fieldset>
          <label className="block font-bold">{localizeText("Style Clap &amp; Role : ")}{localizeNode(style)} %<input type="range" aria-label={localizeText("Style Clap & Role")} min="0" max="100" step="1" value={style} onChange={event => setStyle(Number(event.target.value))} className="block min-h-11 w-full accent-accent" /><span className="grid grid-cols-3 gap-2 text-xs font-normal opacity-70"><span>{localizeText("0 · Original")}</span><span className="text-center">{localizeText("40 · Clap &amp; Role")}</span><span className="text-right">{localizeText("100 · Intense")}</span></span></label>
          <div className="grid grid-cols-3 gap-2">{[{ value: 0, label: "Original" }, { value: 40, label: "Clap & Role" }, { value: 100, label: "Intense" }].map(preset => <button type="button" key={preset.value} aria-pressed={style === preset.value} className={`${button} px-2 text-sm ${style === preset.value ? "bg-accent text-background" : ""}`} onClick={() => setStyle(preset.value)}>{localizeNode(preset.label)}</button>)}</div>
        </fieldset>
        <p role="status" className="text-sm opacity-70">{localizeNode(busy ? progress : pending ? `Stylisation : ${images.filter(item => processed[item.id]?.key === processingKey).length} / ${images.length}` : image ? "Aperçus à jour." : "Importez des images pour commencer.")}</p>
        {localizeNode(error && <p role="alert" className="text-destructive">{localizeNode(error)}</p>)}
        <button data-tour="tool-export" type="button" disabled={!image || pending || disabled} onClick={() => void exportPng(false)} className={`${button} flex w-full items-center justify-center gap-2`}><Download size={18} />{localizeText("Exporter cette image en PNG")}</button>
        <button type="button" disabled={!image || pending || disabled} onClick={() => void exportPng(true)} className={`${button} flex w-full items-center justify-center gap-2 bg-accent text-background`}><Download size={18} />{localizeNode(busy ? "Export en cours…" : "Exporter toutes les images (ZIP)")}</button>
      </section>
    </div>
    <Dialog open={expandedPreview && !!image} onOpenChange={setExpandedPreview}>
      <DialogContent className="flex h-[92dvh] w-[96vw] max-w-none flex-col gap-3 bg-paper p-4 sm:p-6" aria-describedby={undefined}>
        <DialogTitle className="pr-8 text-lg">{localizeText("Aperçu de l’image")}</DialogTitle>
        <div className="min-h-0 flex-1 overflow-hidden">{localizeNode(imagePreview())}</div>
      </DialogContent>
    </Dialog>
  </ToolsLayout>;
}
