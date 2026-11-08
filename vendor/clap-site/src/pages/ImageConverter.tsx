import CropDragOverlay from "@/components/CropDragOverlay";
import { useImageJobQueue } from "@/hooks/useImageJobQueue";
import ImageEditorField from "@/components/ImageEditorField";
import ImageStyleLoader from "@/components/ImageStyleLoader";
import { bookImageKey, cachedBookImage } from "@/lib/bookStyledImage";
import { optimizeImageImport } from "@/lib/optimizeImageImport";
import TextCardEditor from "@/components/TextCardEditor";
import { renderTextCard, textCardArtwork, TEXT_CARD_WIDTH, TEXT_CARD_HEIGHT } from "@/lib/pokerTextCard";
import { localizeText, localizeNode } from '@/i18n/localize';
import { failExportProgress, withExportProgress } from "@/lib/exportProgress";
import CardBackImageEditor from "@/components/CardBackImageEditor";
import ToolDocumentBar from "@/components/ToolDocumentBar";
import type { ToolPayload } from "@/lib/toolDocuments";
import { resolvePokerBack, type PokerBackOptions } from "@/lib/pokerCardBack";
import ClapProjectActions from "@/components/ClapProjectActions";
import PokerCardBack from "@/components/PokerCardBack";
import PokerCardFrame from "@/components/PokerCardFrame";
import { useEffect, useRef, useState } from "react";
import { Download, Trash2, FileText } from "lucide-react";
import ToolsLayout from "@/components/ToolsLayout";
import ToolImageImport from "@/components/ToolImageImport";
import { downloadBlob } from "@/lib/characterPng";
import { automaticRotation, croppedImagePlacement, exportPokerPdf, type ImageFit, type PokerImage } from "@/lib/pokerCardsPdf";
import { createClapStyleBlob } from "@/lib/clapImageStyle";
import { blobDataUrl, loadEditingImage } from "@/lib/imageEditing";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cardTitleLayout, defaultImageTitle, imageTitle, titleFont, TITLE_FONTS, type TitleFont } from "@/lib/pokerCardTitle";

function CardImage({ image, fit, zoom, showTitles = true, backDefaults = {}, showLoader = true }: { image: PokerImage; fit: ImageFit; zoom: number; showTitles?: boolean; backDefaults?: PokerBackOptions; showLoader?: boolean }) {
  const [, refreshFont] = useState(0);
  const text = showTitles && image.showTitle !== false ? imageTitle(image) : "";
  useEffect(() => {
    if (!text.trim() || !document.fonts) return;
    let cancelled = false;
    const font = titleFont(image.titleFont);
    void document.fonts.load(`${font.weight} 16px ${font.family}`, text).then(() => {
      if (!cancelled) refreshFont(version => version + 1);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [text, image.titleFont]);
  const [textSource, setTextSource] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (image.kind === "text") void textCardArtwork(image, backDefaults).then(source => { if (!cancelled) setTextSource(source); }).catch(() => {});
    return () => { cancelled = true; };
  }, [image.kind, image.text, image.textFontSize, image.textFont, image.title, image.titleFont, image.name, image.frontImage, image.backImage, backDefaults.backImage, image.textVerticalAlign]);
  const p = croppedImagePlacement(image.width, image.height, image.kind === "text" ? "contain" : fit, image.rotation, image.kind === "text" ? 1 : fit === "cover" ? zoom : 1, image.kind === "text" ? undefined : image.crop);
  const context = text ? document.createElement("canvas").getContext("2d") : null;
  const title = cardTitleLayout(image.rotation, text, image.titleFont, context ? (font, text) => { context.font = font; return context.measureText(localizeText(text)).width; } : undefined);
  const pending = !!image.style && image.styledStrength !== image.style;
  return <div className="relative h-full w-full" aria-busy={pending}><PokerCardFrame>
    <g transform={`translate(31.5 44) rotate(${image.rotation})`}>
      <image href={image.kind === "text" && textSource ? textSource : image.style && image.styledUrl ? image.styledUrl : image.url} x={p.x - p.width / 2} y={p.y - p.height / 2} width={p.width} height={p.height} preserveAspectRatio="none" />
      {localizeNode(title.text && <>
        <rect {...title.background} fill="black" fillOpacity={0.5} data-card-title-background />
        <text x={title.x} y={title.y} fontFamily={title.family} fontWeight={title.weight} fontSize={title.size} textAnchor="end" fill="white" data-card-title>{localizeNode(title.text)}</text>
      </>)}
    </g>
  </PokerCardFrame>{pending && showLoader && <ImageStyleLoader />}</div>;
}

function FullImagePreview({ image, fit, zoom, showTitles, back, backDefaults, onCrop, disabled }: { image: PokerImage; fit: ImageFit; zoom: number; showTitles: boolean; back: boolean; backDefaults: PokerBackOptions; onCrop: (position: { x: number; y: number }) => void; disabled: boolean }) {
  const landscape = !back && image.rotation % 180 !== 0;
  const pending = !back && !!image.style && image.styledStrength !== image.style;
  const placement = croppedImagePlacement(image.width, image.height, fit, image.rotation, fit === "cover" ? zoom : 1, image.crop);
  const sideways = image.rotation % 180 !== 0;
  const tx = 1 - (sideways ? placement.height : placement.width) / 63;
  const ty = 1 - (sideways ? placement.width : placement.height) / 88;
  return <div className="relative mx-auto overflow-hidden bg-white shadow-lg" data-full-image-preview data-orientation={landscape ? "landscape" : "portrait"} style={{ width: landscape ? "min(100%, 34dvh, 340px)" : "min(100%, 24.3dvh, 243px)", aspectRatio: landscape ? "88 / 63" : "63 / 88" }} role="img" aria-label={localizeText(`${image.name}, rotation ${image.rotation} degrés`)}>
    <div className="absolute left-1/2 top-1/2" style={{ width: landscape ? `${63 / 88 * 100}%` : "100%", height: landscape ? `${88 / 63 * 100}%` : "100%", transform: `translate(-50%, -50%) rotate(${landscape ? -90 : 0}deg)` }}>
      {localizeNode(back ? <PokerCardBack image={resolvePokerBack(image, backDefaults)} /> : <CardImage image={image} fit={fit} zoom={zoom} showTitles={showTitles} backDefaults={backDefaults} showLoader={false} />)}
    </div>
    {!back && image.kind !== "text" && <CropDragOverlay disabled={disabled} value={landscape ? { x: image.crop?.y ?? .5, y: 1 - (image.crop?.x ?? .5) } : image.crop ?? { x: .5, y: .5 }} travelX={landscape ? ty : tx} travelY={landscape ? tx : ty} onChange={position => onCrop(landscape ? { x: 1 - position.y, y: position.x } : position)} />}
    {pending && <ImageStyleLoader />}
  </div>;
}

export default function ImageConverter() {
  const [images, setImages] = useState<PokerImage[]>([]);
  const [fit, setFit] = useState<ImageFit>("cover");
  const [zoom, setZoom] = useState(1);
  const [marks, setMarks] = useState(true);
  const [showTitles, setShowTitles] = useState(true);
  const [editingBack, setEditingBack] = useState(false);
  const [globalBack, setGlobalBack] = useState<PokerBackOptions>({});
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingImage = images.find(image => image.id === editingId);
  const urls = useRef(new Set<string>());
  useEffect(() => { const owned = urls.current; return () => owned.forEach(url => URL.revokeObjectURL(url)); }, []);
  const cards = images.flatMap(image => Array.from({ length: image.copies }, () => image));
  const frontPages = Math.ceil(cards.length / 9);
  const pages = frontPages * 2;
  const currentPage = Math.min(page, Math.max(0, pages - 1));
  const showingBacks = frontPages > 0 && currentPage >= frontPages;
  const sheetIndex = showingBacks ? currentPage - frontPages : currentPage;
  const pendingStyles = images.some(image => image.style && image.styledStrength !== image.style);
  useImageJobQueue(
    images.filter(image => image.style && image.styledStrength !== image.style).map(image => ({ id: image.id, source: image.url, strength: image.style!, width: image.width, height: image.height })),
    (job, signal) => createClapStyleBlob(job.source, job.strength, signal),
    (job, blob) => {
      const url = URL.createObjectURL(blob); urls.current.add(url);
      const previous = images.find(image => image.id === job.id)?.styledUrl;
      if (previous && urls.current.has(previous)) { URL.revokeObjectURL(previous); urls.current.delete(previous); }
      setImages(current => current.map(image => image.id === job.id && image.url === job.source && image.style === job.strength ? { ...image, styledUrl: url, styledStrength: job.strength } : image));
    },
    (job, error) => {
      setError(error instanceof Error ? error.message : "La stylisation a échoué.");
      setImages(current => current.map(image => image.id === job.id ? { ...image, style: 0 } : image));
    },
  );
  async function addFiles(files: File[]) {
    if (importing || busy) return;
    setImporting(true); setError("");
    const added: PokerImage[] = [], failed: string[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) { failed.push(file.name); continue; }
      let url = "";
      try {
        const optimized = await optimizeImageImport(file);
        url = URL.createObjectURL(optimized); urls.current.add(url);
        const image = await loadEditingImage(url);
        added.push({ id: crypto.randomUUID(), name: file.name, title: defaultImageTitle(file.name).slice(0, 120), url, copies: 1, width: image.naturalWidth, height: image.naturalHeight, rotation: automaticRotation(image.naturalWidth, image.naturalHeight), style: 40 });
      } catch { URL.revokeObjectURL(url); urls.current.delete(url); failed.push(file.name); }
    }
    setImages(previous => [...previous, ...added]);
    if (failed.length) setError(`Images non prises en charge : ${failed.join(", ")}`);
    setImporting(false);
  }
  function addTextCard() {
    if (busy || importing) return;
    const id = crypto.randomUUID();
    setImages(previous => {
      const name = localizeText("Carte texte") + " " + (previous.filter(item => item.kind === "text").length + 1);
      const source = renderTextCard("", 10, { title: name }).source;
      return [...previous, { id, name, title: name, titleFont: "courier-prime", textFont: "courier-prime", kind: "text", text: "", textFontSize: 10, url: source, width: TEXT_CARD_WIDTH, height: TEXT_CARD_HEIGHT, copies: 1, rotation: 0, style: 0, showTitle: false }]; });
    setEditingBack(false); setEditingId(id); setError("");
  }
  function remove(image: PokerImage) { for (const url of [image.url, image.styledUrl]) if (url) { URL.revokeObjectURL(url); urls.current.delete(url); } setImages(previous => previous.filter(item => item.id !== image.id)); }
  function adjust(image: PokerImage, values: Partial<PokerImage>) { setImages(previous => previous.map(item => item.id === image.id ? { ...item, ...values } : item)); }
  async function download() {
    return withExportProgress(async () => {
      setBusy(true); setError("");
      try { downloadBlob(await exportPokerPdf(images, fit, marks, zoom, showTitles, globalBack), "cartes-poker-A4.pdf"); }
      catch (err) { failExportProgress(); setError(err instanceof Error ? err.message : "L’export a échoué."); }
      finally { setBusy(false); }
    });
  }
  async function downloadPngZip() {
    return withExportProgress(async () => {
      setBusy(true); setError("");
      try {
        const { exportPokerFrontsZip } = await import("@/lib/pokerCardsZip");
        downloadBlob(await exportPokerFrontsZip(images, fit, zoom, showTitles, globalBack), "cartes-rectos-PNG.zip");
      } catch (err) { failExportProgress(); setError(err instanceof Error ? err.message : "Export PNG impossible."); }
      finally { setBusy(false); }
    }, "Export des rectos PNG");
  }
  const button = "border-2 border-ink px-4 py-3 font-bold flex items-center justify-center gap-2 hover:bg-ink hover:text-background disabled:opacity-50 disabled:cursor-not-allowed";
  const toolData = { tool: "a4-sheets", settings: { fit, zoom, marks, showTitles, ...globalBack }, images: images.map(image => ({ ...image, source: image.url, styledImage: image.styledUrl && image.styledStrength === image.style ? { source: image.styledUrl, strength: image.style ?? 0, originalKey: bookImageKey(image.url) } : undefined, style: image.style ?? 0, rotation: image.rotation as 0 | 90 | 180 | 270, crop: image.crop ?? { x: 0.5, y: 0.5, zoom: 1 } })) } satisfies ToolPayload;
  const restoreTool = (project: ToolPayload) => {
        if (project.tool !== "a4-sheets") return;
        urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current.clear();
        setImages(project.images.map(image => ({ ...image, ...(image.kind === "text" ? { name: imageTitle(image) } : {}), id: crypto.randomUUID(), url: image.source, styledUrl: cachedBookImage(image, image.style), styledStrength: cachedBookImage(image, image.style) ? image.style : undefined })));
        setFit(project.settings.fit); setZoom(project.settings.zoom); setMarks(project.settings.marks); setShowTitles(project.settings.showTitles ?? true);
        setGlobalBack({ backLabel: project.settings.backLabel, backImage: project.settings.backImage, backFilmTitle: project.settings.backFilmTitle, backEditing: project.settings.backEditing }); setAdjustmentOpen(false);
        setPage(0); setEditingId(null); setError("");

  };
  return <ToolsLayout title={localizeText("Planches A4")} back><p className="mb-4 text-sm opacity-70">{localizeText("Ajoutez une image ou une carte texte, puis cliquez sur une carte pour modifier son recto et son dos.")}</p>
      <p className="mb-6">{localizeText("Composez des planches A4 avec des cartes image ou texte. Cartes de 63 × 88 mm · 9 cartes par page.")}</p>
      <ToolDocumentBar kind="a4-sheets" data={toolData} onLoad={restoreTool} disabled={busy || importing || pendingStyles} />
      <ClapProjectActions disabled={busy || importing || pendingStyles} onBusyChange={setImporting} project={toolData} onImport={restoreTool} />
      <div className="grid gap-8 lg:grid-cols-2"><section className="space-y-5" aria-label={localizeText("Images et réglages")}>
        <ToolImageImport label={localizeText("Importer des images")} onImport={files => void addFiles(files)} disabled={busy || importing} importing={importing} />
        <button type="button" className={`${button} w-full`} disabled={busy || importing} onClick={addTextCard}><FileText size={18} />{localizeText("Ajouter une carte texte")}</button>
        <fieldset disabled={busy} className="space-y-3 border-2 border-ink p-4"><legend className="px-2 font-bold">{localizeText("Mise en page")}</legend>
          <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={showTitles} onChange={event => setShowTitles(event.target.checked)} />{localizeText("Afficher les titres")}</label>
          <button type="button" aria-expanded={adjustmentOpen} onClick={() => setAdjustmentOpen(!adjustmentOpen)} className={`${button} w-full`}>{localizeText("Changer l’ajustement des images")}</button>
          {adjustmentOpen && <fieldset className="space-y-2"><legend className="mb-2 font-bold">{localizeText("Ajustement des images")}</legend>
            {([
              { value: "width", label: "Remplir en largeur" },
              { value: "height", label: "Remplir en hauteur" },
              { value: "cover", label: "Remplir et couper — toute la carte, sans marges" },
              { value: "contain", label: "Conserver l’image entière" },
            ] as const).map(option => <label key={option.value} className={`flex cursor-pointer items-center gap-3 border-2 p-3 ${fit === option.value ? "border-accent bg-accent/10 font-bold" : "border-ink/20"}`}><input type="radio" name="image-fit" value={option.value} checked={fit === option.value} onChange={() => setFit(option.value)} />{localizeNode(option.label)}</label>)}
          </fieldset>}
          {localizeNode(fit === "cover" && <label className="block">{localizeText("Agrandissement supplémentaire : ")}{localizeNode(Math.round(zoom * 100))} %<input type="range" min="100" max="200" step="1" value={Math.round(zoom * 100)} onChange={event => setZoom(Number(event.target.value) / 100)} className="mt-2 block w-full" /><span className="mt-1 block text-sm opacity-70">{localizeText("Augmentez pour couper davantage, y compris une bordure blanche déjà présente dans l’image.")}</span></label>)}
          {localizeNode(adjustmentOpen && <p className="text-sm opacity-70">{localizeNode({ cover: "L’image remplit toute la carte. Ce qui dépasse est coupé au centre.", width: "La largeur de l’image s’ajuste à celle de la carte. Si elle est trop haute, le haut et le bas sont coupés ; sinon, des marges restent en haut et en bas.", height: "La hauteur de l’image s’ajuste à celle de la carte. Si elle est trop large, les côtés sont coupés ; sinon, des marges restent sur les côtés.", contain: "L’image reste entièrement visible, avec des marges si nécessaire." }[fit])}{localizeText(" Les proportions sont conservées dans l’aperçu et le PDF.")}</p>)}
          <label className="flex items-center gap-2"><input type="checkbox" checked={marks} onChange={event => setMarks(event.target.checked)} />{localizeText("Repères de découpe")}</label>
          <fieldset disabled={importing} className="space-y-3 border-t-2 border-ink/30 pt-4"><legend className="px-2 font-bold">{localizeText("Dos de toutes les cartes")}</legend>
            <label className="block font-bold">{localizeText("Titre du film")}<input aria-label={localizeText("Titre du film global")} value={globalBack.backFilmTitle ?? ""} maxLength={120} placeholder={localizeText("Facultatif")} onChange={event => setGlobalBack(current => ({ ...current, backFilmTitle: event.target.value }))} className="mt-2 min-h-11 w-full border-2 border-ink bg-paper px-3 py-2 font-normal" /></label>
            <label className="block font-bold">{localizeText("Texte global du dos")}<input aria-label={localizeText("Texte global du dos")} value={globalBack.backLabel ?? "Studio"} maxLength={120} onChange={event => setGlobalBack(current => ({ ...current, backLabel: event.target.value }))} className="mt-2 min-h-11 w-full border-2 border-ink bg-paper px-3 py-2 font-normal" /></label>
            <CardBackImageEditor value={globalBack.backImage} editing={globalBack.backEditing} label={localizeText("Fond global du dos")} inputLabel="Fond global du dos" disabled={busy || importing} onChange={(backImage, backEditing) => setGlobalBack(current => ({ ...current, backImage, backEditing }))} />
            <p className="text-sm opacity-70">{localizeText("Les choix individuels de texte ou de fond sont prioritaires. Ces réglages s’appliquent aussi aux prochaines images ajoutées.")}</p>
          </fieldset>
        </fieldset>
        {localizeNode(error && <p role="alert" className="border border-red-600 p-3 text-red-600">{localizeNode(error)}</p>)}
        {localizeNode(images.length > 0 && <><div className="flex items-center justify-between"><p>{localizeNode(images.length)}{localizeText(images.some(image => image.kind === "text") ? " élément(s) · " : " image(s) · ")}{localizeNode(cards.length)}{localizeText(" carte(s) · ")}{localizeNode(pages)}{localizeText(" page(s)")}</p><button disabled={busy || importing} className="underline" onClick={() => images.forEach(remove)}>{localizeText("Tout retirer")}</button></div>

        </>)}
        <button data-tour="tool-export" className={`${button} w-full bg-accent text-background`} disabled={!cards.length || busy || importing || pendingStyles} onClick={() => void download()}><Download size={18} />{localizeNode(busy ? "Création du PDF…" : pendingStyles ? "Stylisation en cours…" : "Exporter le PDF A4")}</button>
        <button type="button" className={`${button} w-full`} disabled={!cards.length || busy || importing || pendingStyles} onClick={() => void downloadPngZip()}><Download size={18} />{localizeText("Exporter les rectos en PNG (ZIP)")}</button>
        <p className="text-sm opacity-70">{localizeText("Un dos Studio est ajouté pour chaque carte, copies comprises, sur des pages séparées des rectos.")}</p>
        <p className="text-sm opacity-70">{localizeText("À l’impression, choisissez A4 et « Taille réelle » ou 100 % pour conserver les dimensions des cartes.")}</p>
      </section><section aria-label={localizeText("Aperçu des planches")}><div className="mb-3 flex items-center justify-between"><h2 className="font-display text-2xl">{localizeText("Aperçu A4")}</h2><span>{localizeNode(pages ? `${currentPage + 1} / ${pages} · ${showingBacks ? "Dos" : "Rectos"}` : "0 page")}</span></div>
        {localizeNode(frontPages > 0 && <button type="button" className={`${button} mb-3 w-full`} onClick={() => setPage(showingBacks ? sheetIndex : sheetIndex + frontPages)}>{localizeNode(showingBacks ? "Voir les rectos" : "Voir les dos")}</button>)}
        <div className="relative aspect-[210/297] w-full bg-white shadow-lg border border-black/20">
          {localizeNode(!cards.length && <p className="absolute inset-0 flex items-center justify-center text-gray-500">{localizeText("Vos cartes apparaîtront ici")}</p>)}
          {cards.slice(sheetIndex * 9, sheetIndex * 9 + 9).map((image, index) => <button type="button" disabled={busy} onClick={() => setEditingId(image.id)} aria-label={localizeText(`Modifier ${image.name}`)} title={localizeText("Ouvrir en grand")} key={`${image.id}-${index}`} className={marks ? "absolute overflow-hidden border-0 p-0 outline outline-1 outline-gray-300" : "absolute overflow-hidden border-0 p-0"} style={{ left: `${(7.5 + (showingBacks ? 2 - index % 3 : index % 3) * 66) / 210 * 100}%`, top: `${(13.5 + Math.floor(index / 3) * 91) / 297 * 100}%`, width: "30%", height: `${88 / 297 * 100}%` }}>{localizeNode(showingBacks ? <PokerCardBack image={resolvePokerBack(image, globalBack)} /> : <CardImage image={image} fit={fit} zoom={zoom} showTitles={showTitles} backDefaults={globalBack} />)}</button>)}
        </div>
        {localizeNode(pages > 1 && <div className="mt-4 flex justify-between"><button className={button} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{localizeText("Précédente")}</button><button className={button} disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}>{localizeText("Suivante")}</button></div>)}
      </section></div>

    <Dialog open={!!editingImage} onOpenChange={open => { if (!open) setEditingId(null); }}>
      <DialogContent className="flex h-[96dvh] max-h-[900px] w-[calc(100%-1rem)] max-w-2xl flex-col gap-0 overflow-hidden bg-paper p-0 [&>button]:right-2 [&>button]:top-2 [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center">
        {editingImage && <>
          <div className="shrink-0 border-b border-ink/20 p-3 pr-16"><DialogTitle className="truncate text-left" title={localizeText(editingImage.name)}>{localizeNode(editingImage.name)}</DialogTitle><DialogDescription className="mt-1 text-left text-xs">{localizeText("Réglages enregistrés pour toutes les copies.")}</DialogDescription></div>
          <div className="shrink-0 border-b border-ink/20 bg-ink/5 p-3">
            <div className="mb-3 grid grid-cols-2 gap-2"><button type="button" aria-pressed={!editingBack} onClick={() => setEditingBack(false)} className={`${button} ${!editingBack ? "bg-ink text-background" : ""}`}>{localizeText("Recto")}</button><button type="button" aria-pressed={editingBack} onClick={() => setEditingBack(true)} className={`${button} ${editingBack ? "bg-ink text-background" : ""}`}>{localizeText("Dos")}</button></div>
            <FullImagePreview disabled={busy || importing} onCrop={position => adjust(editingImage, { crop: { ...(editingImage.crop ?? { zoom: 1 }), ...position } })} image={editingImage} fit={fit} zoom={zoom} showTitles={showTitles} back={editingBack} backDefaults={globalBack} />
{!editingBack && editingImage.kind !== "text" && <div className="mx-auto mt-2 max-w-sm"><label className="block text-sm">{localizeText("Zoom")}<input aria-label={localizeText("Zoom du cadrage")} type="range" className="block min-h-11 w-full accent-accent" min="1" max="4" step="0.01" disabled={busy || importing} value={editingImage.crop?.zoom ?? 1} onChange={event => adjust(editingImage, { crop: { ...(editingImage.crop ?? { x: .5, y: .5 }), zoom: Number(event.target.value) } })} /></label><button type="button" disabled={busy || importing} className={button} onClick={() => adjust(editingImage, { crop: { x: .5, y: .5, zoom: 1 } })}>{localizeText("Recentrer")}</button></div>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6" aria-label={localizeText("Réglages de l’image")}>
            <fieldset disabled={busy || importing} className="space-y-5">
              {editingImage.kind === "text" ? <>
                <fieldset className="space-y-3 border-2 border-ink/30 p-3">
                <legend className="px-2 font-bold">{localizeText("Fond du recto")}</legend>
                <ImageEditorField value={editingImage.frontImage} editing={editingImage.frontEditing} label="Image de fond du recto" inputLabel="Image de fond du recto" removeLabel="Utiliser le fond du verso" aspectRatio={63 / 88} maxImageDimension={1039} disabled={busy || importing} onChange={(frontImage, frontEditing) => adjust(editingImage, { frontImage, frontEditing })} />
                <p className="text-xs opacity-70">{localizeText("Sans image de recto, le fond du verso est utilisé. Même estompage que les cartes de figurants et de rôles clés.")}</p>
                </fieldset>
                <TextCardEditor key={editingImage.id} text={editingImage.text ?? ""} fontSize={editingImage.textFontSize ?? 10} title={imageTitle(editingImage)} titleFont={editingImage.titleFont} textFont={editingImage.textFont} textVerticalAlign={editingImage.textVerticalAlign} onChange={values => adjust(editingImage, { ...values, name: values.title, style: 0 })} />
              </> : <>
              <label className="flex min-h-11 items-center gap-2 font-bold"><input type="checkbox" checked={editingImage.showTitle !== false} onChange={event => adjust(editingImage, { showTitle: event.target.checked })} />{localizeText("Afficher le titre de cette image")}</label>
              {localizeNode(!showTitles && <p className="text-sm opacity-70">{localizeText("Les titres sont actuellement masqués pour toute la planche.")}</p>)}
              <label className="block font-bold">{localizeText("Titre de la carte")}<input aria-label={localizeText(`Titre de ${editingImage.name}`)} type="text" maxLength={120} value={imageTitle(editingImage)} onChange={event => adjust(editingImage, { title: event.target.value })} placeholder={localizeText("Laisser vide pour masquer le titre")} className="mt-2 min-h-11 w-full border-2 border-ink bg-paper px-3 py-2 font-normal" /></label>
              <label className="block font-bold">{localizeText("Police du titre")}<select aria-label={localizeText(`Police du titre de ${editingImage.name}`)} value={editingImage.titleFont ?? TITLE_FONTS[0].value} onChange={event => adjust(editingImage, { titleFont: event.target.value as TitleFont })} className="mt-2 min-h-11 w-full border-2 border-ink bg-paper px-3 py-2 font-normal">{TITLE_FONTS.map(font => <option key={font.value} value={font.value}>{localizeNode(font.label)}</option>)}</select></label>
              <p className="text-sm opacity-70">{localizeText("Le titre reste en haut à droite dans le sens de lecture de l’image et suit sa rotation. Un titre long est réduit pour tenir sur la carte.")}</p>

              {localizeNode(error && <p role="alert" className="text-sm text-destructive">{localizeNode(error)}</p>)}
              <fieldset><legend className="mb-2 font-bold">{localizeText("Rotation")}</legend><div className="grid grid-cols-4 gap-2">{[0, 90, 180, 270].map(angle => <button key={angle} type="button" aria-pressed={editingImage.rotation === angle} onClick={() => adjust(editingImage, { rotation: angle })} className={`min-h-11 border-2 p-2 ${editingImage.rotation === angle ? "border-accent bg-accent text-background" : "border-ink/30"}`}>{localizeNode(angle)}°</button>)}</div></fieldset>
              <label className="block font-bold">{localizeText("Style Clap &amp; Role : ")}{localizeNode(editingImage.style ?? 0)} %<input aria-label={localizeText(`Style Clap & Role de ${editingImage.name}`)} type="range" min="0" max="100" step="1" value={editingImage.style ?? 0} onChange={event => adjust(editingImage, { style: Number(event.target.value) })} className="block min-h-11 w-full touch-pan-y accent-accent" /><span className="relative flex justify-between gap-2 text-xs font-normal opacity-70"><span>{localizeText("0 · Original")}</span><span className="absolute left-[40%] -translate-x-1/2">{localizeText("40 &#183; Clap &amp; Role")}</span><span>{localizeText("100 · Très simplifié")}</span></span></label>
              <div className="grid grid-cols-3 gap-2">{[{ value: 0, label: "Original" }, { value: 40, label: "Clap & Role" }, { value: 100, label: "Plus intense" }].map(preset => <button key={preset.value} type="button" onClick={() => adjust(editingImage, { style: preset.value })} className="min-h-11 border border-ink/30 px-2 py-2 text-sm">{localizeNode(preset.label)}</button>)}</div>
              <p role="status" className="min-h-5 text-sm opacity-70">{localizeNode(editingImage.style && editingImage.styledStrength !== editingImage.style ? "Stylisation en cours…" : "L’aperçu et le PDF utilisent ces réglages.")}</p>
              </>}
              <label className="flex items-center justify-between gap-3">{localizeText("Nombre de copies")}<input aria-label={localizeText(`Copies de ${editingImage.name}`)} type="number" inputMode="numeric" min="1" max="99" value={editingImage.copies} onChange={event => adjust(editingImage, { copies: Math.max(1, Math.min(99, Math.floor(Number(event.target.value) || 1))) })} className="min-h-11 w-20 border border-ink bg-paper p-2" /></label>
              <fieldset className="space-y-3 border-2 border-ink/30 p-3"><legend className="px-2 font-bold">{localizeText(editingImage.kind === "text" ? "Dos de cette carte" : "Dos de cette image")}</legend>
                <label className="block font-bold">{localizeText("Titre du film")}<input aria-label={localizeText(`Titre du film de ${editingImage.name}`)} value={resolvePokerBack(editingImage, globalBack).backFilmTitle ?? ""} maxLength={120} placeholder={localizeText("Facultatif")} onChange={event => adjust(editingImage, { backFilmTitle: event.target.value })} className="mt-2 min-h-11 w-full border-2 border-ink bg-paper px-3 py-2 font-normal" /></label>
                {editingImage.backFilmTitle !== undefined && <button type="button" className="min-h-11 border border-ink px-3 py-2 text-sm" onClick={() => adjust(editingImage, { backFilmTitle: undefined })}>{localizeText("Utiliser le titre du film global")}</button>}
                <p className="text-sm opacity-70">{localizeText("Le logo reste au centre du dos.")}</p>
                <label className="block font-bold">{localizeText("Texte du dos")}<input aria-label={localizeText(`Texte du dos de ${editingImage.name}`)} value={resolvePokerBack(editingImage, globalBack).backLabel} maxLength={120} onChange={event => adjust(editingImage, { backLabel: event.target.value })} className="mt-2 min-h-11 w-full border-2 border-ink bg-paper px-3 py-2 font-normal" /></label>
                {localizeNode(editingImage.backLabel !== undefined && <button type="button" className="min-h-11 border border-ink px-3 py-2 text-sm" onClick={() => adjust(editingImage, { backLabel: undefined })}>{localizeText("Utiliser le texte global")}</button>)}
                <CardBackImageEditor value={editingImage.backImage} editing={editingImage.backEditing} inputLabel={`Image de fond du dos de ${editingImage.name}`} disabled={busy || importing} onChange={(backImage, backEditing) => adjust(editingImage, { backImage, backEditing })} />
                <p className="text-sm opacity-70">{localizeText(editingImage.kind === "text" ? "Ces réglages s’appliquent à toutes les copies de cette carte." : "Ces réglages s’appliquent à toutes les copies de cette image.")}</p>
              </fieldset>
            </fieldset>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-ink/20 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"><button type="button" disabled={busy || importing} onClick={() => { remove(editingImage); setEditingId(null); }} className={`${button} text-destructive`}><Trash2 size={16} />{localizeText("Retirer")}</button><button type="button" onClick={() => setEditingId(null)} className={`${button} bg-accent text-background`}>{localizeText("Terminé")}</button></div>
        </>}
      </DialogContent>
    </Dialog>
  </ToolsLayout>;
}
