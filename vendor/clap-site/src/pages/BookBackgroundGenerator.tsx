import { ImageJobQueue } from "@/lib/imageJobQueue";
import { bookImageKey, cachedBookImage } from "@/lib/bookStyledImage";
import type { ProjectArtwork } from "@/lib/clapProject";
import { localizeText, localizeNode } from '@/i18n/localize';
import { failExportProgress, reportExportProgress, withExportProgress } from "@/lib/exportProgress";
import ToolImageImport from "@/components/ToolImageImport";
import ToolDocumentBar from "@/components/ToolDocumentBar";
import type { ToolPayload } from "@/lib/toolDocuments";
import ClapProjectActions from "@/components/ClapProjectActions";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Download, GripHorizontal, X } from "lucide-react";
import JSZip from "jszip";
import BookCropEditor from "@/components/BookCropEditor";
import { optimizeImageImport } from "@/lib/optimizeImageImport";
import ToolsLayout from "@/components/ToolsLayout";
import { createClapStyleBlob } from "@/lib/clapImageStyle";
import { blobDataUrl, loadEditingImage } from "@/lib/imageEditing";
import { downloadBlob } from "@/lib/characterPng";
import { BOOK_HEIGHT, BOOK_WIDTH, bookFrames, bookImageIndex, bookCropRect, DEFAULT_BOOK_CROP, bookTemplateUrl, renderBookBackground, type BookCrop, type BookSide, type BookTone } from "@/lib/bookBackground";

type Artwork = { id: string; name: string; source: string; width: number; height: number; styledImage?: ProjectArtwork["styledImage"] };
const button = "min-h-11 border-2 border-ink px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-50";

export default function BookBackgroundGenerator() {
  const [images, setImages] = useState<Artwork[]>([]);
  const [strength, setStrength] = useState(40);
  const [side, setSide] = useState<BookSide>("left");
  const [tone, setTone] = useState<BookTone>("light");
  const [processed, setProcessed] = useState<{ images: Artwork[]; strength: number; sources: string[] } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [crops, setCrops] = useState<Record<string, BookCrop>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingIndex = images.findIndex(image => image.id === editingId);
  const editingImage = images[editingIndex];
  const pending = images.length > 0 && strength > 0 && (processed?.images !== images || processed?.strength !== strength);
  const sources = images.length && strength && !pending ? processed!.sources : images.map(image => image.source);
  function thumbnailCropStyle(image: Artwork) {
    const crop = bookCropRect(image.width, image.height, 292, 170, crops[image.id]);
    return { left: `${-crop.x * crop.scale / 292 * 100}%`, top: `${-crop.y * crop.scale / 170 * 100}%`, width: `${image.width * crop.scale / 292 * 100}%`, height: `${image.height * crop.scale / 170 * 100}%` };
  }

  useEffect(() => {
    if (!images.length || !strength || (processed?.images === images && processed.strength === strength)) return;
    setFailed(false);
    const sources = images.map(image => cachedBookImage(image, strength));
    const indexes = new Map(images.map((image, index) => [image.id, index]));
    const jobs = images.filter((_, index) => !sources[index]).map(image => ({ id: image.id, source: image.source, strength, width: image.width, height: image.height, maxDimension: 1200 }));
    let remaining = jobs.length;
    const finish = () => { setProcessed({ images, strength, sources: sources as string[] }); setError(""); };
    const queue = new ImageJobQueue<string>(
      async (job, signal) => blobDataUrl(await createClapStyleBlob(job.source, job.strength, signal, job.maxDimension)),
      (job, source) => { sources[indexes.get(job.id)!] = source; if (--remaining === 0) finish(); },
      (_job, error) => { queue.dispose(); setStrength(0); setFailed(true); setError(error instanceof Error ? error.message : "Stylisation impossible. Choisissez Original pour continuer."); },
    );
    if (remaining) queue.update(jobs); else finish();
    return () => queue.dispose();
  }, [images, strength, processed]);

  function moveImage(id: string, targetId: string) {
    if (busy || importing || id === targetId) return;
    const from = images.findIndex(image => image.id === id);
    const to = images.findIndex(image => image.id === targetId);
    if (from < 0 || to < 0) return;
    const reordered = [...images];
    reordered.splice(to, 0, reordered.splice(from, 1)[0]);
    if (processed?.images === images && processed.strength === strength) {
      const sourcesById = new Map(images.map((image, index) => [image.id, processed.sources[index]]));
      setProcessed({ images: reordered, strength, sources: reordered.map(image => sourcesById.get(image.id)!) });
    }
    setImages(reordered);
  }

  async function importImages(files: File[]) {
    if (!files.length || busy || importing) return;
    setImporting(true); setError("");
    try {
      const added: Artwork[] = [];
      for (const file of files) {
        const source = await blobDataUrl(await optimizeImageImport(file));
        const loaded = await loadEditingImage(source);
        added.push({ id: crypto.randomUUID(), name: file.name, source, width: loaded.naturalWidth, height: loaded.naturalHeight });
      }
      setImages(current => [...current, ...added]);
    } catch (err) { setError(err instanceof Error ? err.message : "Import impossible."); }
    finally { setImporting(false); }
  }

  async function exportPages(all: boolean) {
    return withExportProgress(async () => {
      if (!images.length || pending || busy || importing) return;
      setBusy(true); setError("");
      try {
        if (all) {
          const zip = new JSZip();
          for (const pageSide of ["left", "right"] as const) for (const pageTone of ["light", "dark"] as const) {
            reportExportProgress(10 + Object.keys(zip.files).length / 4 * 65);
            zip.file(`fond-clap-${pageSide === "left" ? "gauche" : "droite"}-${pageTone === "light" ? "blanc" : "noir"}.png`, await renderBookBackground(sources, pageSide, pageTone, images.map(image => crops[image.id] ?? DEFAULT_BOOK_CROP)));
          }
          downloadBlob(await zip.generateAsync({ type: "blob" }, metadata => reportExportProgress(75 + metadata.percent * .25)), "fonds-livre-clap.zip");
        } else downloadBlob(await renderBookBackground(sources, side, tone, images.map(image => crops[image.id] ?? DEFAULT_BOOK_CROP)), `fond-clap-${side === "left" ? "gauche" : "droite"}-${tone === "light" ? "blanc" : "noir"}.png`);
      } catch (err) { failExportProgress(); setError(err instanceof Error ? err.message : "Export impossible."); }
      finally { setBusy(false); }
    });
  }

  const disabled = busy || importing;
  const toolData = { tool: "book-background", settings: { strength, side, tone }, images: images.map((image, index) => ({ ...image, styledImage: !pending && strength ? { source: sources[index], strength, originalKey: bookImageKey(image.source) } : image.styledImage, copies: 1, rotation: 0, style: strength, crop: crops[image.id] ?? DEFAULT_BOOK_CROP })) } satisfies ToolPayload;
  const restoreTool = (project: ToolPayload) => {
      if (project.tool !== "book-background") return;
      const restored = project.images.map(image => ({ ...image, id: crypto.randomUUID() }));
      setImages(restored); setCrops(Object.fromEntries(restored.map(image => [image.id, image.crop])));
      setStrength(project.settings.strength); setSide(project.settings.side); setTone(project.settings.tone);
      setProcessed(null); setEditingId(null); setError("");

  };
  return <ToolsLayout title={localizeText("Fonds de livre")} back>
    <p className="mb-6">{localizeText("Créez vos fonds avec vos images répétées dans les bandes de pellicule. La vignette grise reste réservée au numéro de page.")}</p>
    <ToolDocumentBar kind="book-background" data={toolData} onLoad={restoreTool} disabled={busy || importing} />
      <ClapProjectActions disabled={disabled} onBusyChange={setImporting} project={toolData} onImport={restoreTool} />
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="space-y-3" aria-label={localizeText("Aperçu du fond de livre")}>
        <svg viewBox={`0 0 ${BOOK_WIDTH} ${BOOK_HEIGHT}`} className="mx-auto block max-h-[70dvh] w-full border border-ink" style={{ aspectRatio: `${BOOK_WIDTH}/${BOOK_HEIGHT}` }} role="img" aria-label={localizeText(`Fond ${side === "left" ? "gauche" : "droite"}, ${tone === "light" ? "blanc" : "noir"}`)}>
          <defs>{bookFrames(side).map((frame, index) => <clipPath key={index} id={`book-frame-${index}`}><rect {...frame} /></clipPath>)}</defs>
          <image href={bookTemplateUrl(side, tone)} width={BOOK_WIDTH} height={BOOK_HEIGHT} />
          {sources.length > 0 && bookFrames(side).map((frame, index) => {
            const imageIndex = bookImageIndex(side, index, sources.length);
            const image = images[imageIndex];
            const crop = bookCropRect(image.width, image.height, frame.width, frame.height, crops[image.id]);
            return <g key={index} clipPath={`url(#book-frame-${index})`}><rect {...frame} fill="black" /><image href={sources[imageIndex]} x={frame.x - crop.x * crop.scale} y={frame.y - crop.y * crop.scale} width={image.width * crop.scale} height={image.height * crop.scale} preserveAspectRatio="none" /><rect {...frame} fill="transparent" role="button" tabIndex={disabled ? -1 : 0} aria-label={localizeText(`Cadrer la vignette ${index + 1} : ${image.name}`)} className="cursor-pointer" onClick={() => { if (!disabled) setEditingId(image.id); }} onKeyDown={event => { if (!disabled && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setEditingId(image.id); } }} /></g>;
          })}
        </svg>
        <p className="text-center text-sm opacity-70">{localizeText("A4 · 2480 × 3508 px · 13 vignettes · cliquez sur une vignette pour la cadrer")}</p>
      </section>
      <section aria-label={localizeText("Images et réglages")} className="min-w-0 space-y-6">
        <ToolImageImport label={localizeText("Importer les images des vignettes")} onImport={files => void importImages(files)} disabled={disabled} importing={importing} />
        {images.length > 0 && <div>
          <p className="mb-3 text-sm">{localizeText("Glissez les images entre elles pour changer leur ordre, ou utilisez les flèches. La suite continue de gauche à droite et de haut en bas sur la page gauche, puis de droite à gauche et de bas en haut sur la page droite. Cliquez sur une image pour choisir son cadrage.")}</p>
          <ol aria-label={localizeText("Ordre des images")} className="grid grid-cols-3 gap-3 sm:grid-cols-4">{images.map((image, index) => <li
            key={image.id}
            draggable={!disabled}
            onDragStart={event => {
              if (disabled) { event.preventDefault(); return; }
              event.dataTransfer.setData("application/x-clap-artwork", image.id);
              event.dataTransfer.effectAllowed = "move";
              setDraggedId(image.id);
            }}
            onDragOver={event => {
              if (!draggedId || disabled) return;
              event.preventDefault(); event.dataTransfer.dropEffect = "move";
              setDropId(image.id);
            }}
            onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropId(null); }}
            onDrop={event => {
              event.preventDefault(); event.stopPropagation();
              moveImage(event.dataTransfer.getData("application/x-clap-artwork"), image.id);
              setDraggedId(null); setDropId(null);
            }}
            onDragEnd={() => { setDraggedId(null); setDropId(null); }}
            className={`relative min-w-0 border border-ink p-2 ${disabled ? "" : "cursor-grab active:cursor-grabbing"} ${draggedId === image.id ? "opacity-50" : ""} ${dropId === image.id && draggedId !== image.id ? "ring-2 ring-accent" : ""}`}
          >
            <button type="button" disabled={disabled} aria-label={localizeText(`Cadrer ${image.name}`)} className="relative block aspect-[292/170] w-full overflow-hidden bg-black" onClick={() => setEditingId(image.id)}><img draggable={false} src={sources[index]} alt={localizeText(image.name)} className="absolute max-w-none" style={thumbnailCropStyle(image)} /></button>
            <p title={localizeText(image.name)} className="mt-1 truncate text-xs">{localizeNode(index + 1)}. {localizeNode(image.name)}</p>
            <div className="mt-1 flex items-center justify-between">
              <button type="button" disabled={disabled || index === 0} aria-label={localizeText(`Avancer ${image.name}`)} className="flex min-h-11 min-w-8 items-center justify-center disabled:opacity-30" onClick={() => moveImage(image.id, images[index - 1].id)}><ArrowLeft size={16} /></button>
              <GripHorizontal size={16} aria-hidden="true" className="opacity-60" />
              <button type="button" disabled={disabled || index === images.length - 1} aria-label={localizeText(`Reculer ${image.name}`)} className="flex min-h-11 min-w-8 items-center justify-center disabled:opacity-30" onClick={() => moveImage(image.id, images[index + 1].id)}><ArrowRight size={16} /></button>
            </div>
            <button type="button" disabled={disabled} aria-label={localizeText(`Retirer ${image.name}`)} className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center bg-paper" onClick={() => setImages(current => current.filter(item => item.id !== image.id))}><X size={16} /></button>
          </li>)}</ol>
        </div>}
        <fieldset disabled={disabled} className="space-y-5">
          <fieldset><legend className="mb-2 font-bold">{localizeText("Côté de la page")}</legend><div className="grid grid-cols-2 gap-2">{([['left', 'Gauche'], ['right', 'Droite']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={side === value} onClick={() => setSide(value)} className={`${button} ${side === value ? "bg-accent text-background" : ""}`}>{localizeNode(label)}</button>)}</div></fieldset>
          <fieldset><legend className="mb-2 font-bold">{localizeText("Fond")}</legend><div className="grid grid-cols-2 gap-2">{([['light', 'Blanc'], ['dark', 'Noir']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={tone === value} onClick={() => setTone(value)} className={`${button} ${tone === value ? "bg-accent text-background" : ""}`}>{localizeNode(label)}</button>)}</div></fieldset>
          <label className="block font-bold">{localizeText("Style Clap &amp; Role : ")}{localizeNode(strength)} %<input type="range" aria-label={localizeText("Style Clap & Role")} min="0" max="100" value={strength} onChange={event => setStrength(Number(event.target.value))} className="block min-h-11 w-full accent-accent" /></label>
          <div className="grid grid-cols-3 gap-2">{([{ value: 0, label: "Original" }, { value: 40, label: "Clap & Role" }, { value: 100, label: "Intense" }]).map(preset => <button key={preset.value} type="button" aria-pressed={strength === preset.value} onClick={() => setStrength(preset.value)} className={`${button} px-2 text-sm ${strength === preset.value ? "bg-accent text-background" : ""}`}>{localizeNode(preset.label)}</button>)}</div>
        </fieldset>
        <p role="status" className="text-sm opacity-70">{localizeNode(busy ? "Génération en cours…" : importing ? "Import en cours…" : failed ? "La stylisation a ?chou?. Les images originales restent disponibles pour l?export." : pending ? "Stylisation en cours…" : images.length ? "Aperçu à jour. La vignette du numéro de page est préservée." : "Importez vos images pour remplacer les illustrations du modèle.")}</p>
        {localizeNode(error && <p role="alert" className="text-destructive">{localizeNode(error)}</p>)}
        <div className="grid gap-3"><button data-tour="tool-export" type="button" disabled={disabled || pending || !images.length} className={`${button} flex items-center justify-center gap-2 bg-accent text-background`} onClick={() => void exportPages(false)}><Download size={18} />{localizeText("Exporter cette page en PNG")}</button><button type="button" disabled={disabled || pending || !images.length} className={button} onClick={() => void exportPages(true)}>{localizeText("Exporter les 4 variantes (ZIP)")}</button></div>
      </section>
    </div>
    {localizeNode(editingImage && <BookCropEditor key={editingImage.id} source={sources[editingIndex]} name={editingImage.name} width={editingImage.width} height={editingImage.height} initial={crops[editingImage.id] ?? DEFAULT_BOOK_CROP} onClose={() => setEditingId(null)} onSave={crop => { setCrops(current => ({ ...current, [editingImage.id]: crop })); setEditingId(null); }} />)}
  </ToolsLayout>;
}
