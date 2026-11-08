import { localizeText, localizeNode } from '@/i18n/localize';
import { useRef, useState } from "react";
import { Pipette } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export default function PortraitColorPicker({ source, onSelect }: { source?: string; onSelect: (color: string) => void }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(100);
  const img = useRef<HTMLImageElement>(null);
  const button = "min-h-11 border-2 border-ink px-3 py-2 typewriter text-xs font-bold disabled:opacity-50";
  function sample(clientX: number, clientY: number, keyboard: boolean) {
    const image = img.current;
    if (!image?.complete || !image.naturalWidth) return;
    const bounds = image.getBoundingClientRect();
    const scale = Math.min(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight);
    const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
    const left = bounds.left + (bounds.width - width) / 2;
    const top = bounds.top + (bounds.height - height) / 2;
    const x = keyboard ? width / 2 : clientX - left;
    const y = keyboard ? height / 2 : clientY - top;
    if (x < 0 || x > width || y < 0 || y > height) return;
    try {
      const canvas = document.createElement("canvas"); canvas.width = 1; canvas.height = 1;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Pipette indisponible.");
      ctx.fillStyle = "white"; ctx.fillRect(0, 0, 1, 1);
      ctx.drawImage(image, Math.min(image.naturalWidth - 1, Math.floor(x / scale)), Math.min(image.naturalHeight - 1, Math.floor(y / scale)), 1, 1, 0, 0, 1, 1);
      const pixel = ctx.getImageData(0, 0, 1, 1).data;
      setSelected("#" + Array.from(pixel.slice(0, 3), channel => channel.toString(16).padStart(2, "0")).join(""));
      setPoint({ x: (x + (bounds.width - width) / 2) / bounds.width * 100, y: (y + (bounds.height - height) / 2) / bounds.height * 100 });
      setError("");
    } catch { setError("Impossible de lire la couleur de cette image."); }
  }
  return <>
    <button type="button" disabled={!source} onClick={() => { setSelected(null); setPoint(null); setError(""); setZoom(100); setOpen(true); }} className={`${button} flex items-center gap-2`}><Pipette size={15} />{localizeText("Pipette")}</button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex h-[96dvh] w-[calc(100%-1rem)] max-w-5xl flex-col gap-2 overflow-hidden bg-paper p-3 [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center [&>button]:right-1 [&>button]:top-1">
        <div className="shrink-0 pr-12"><DialogTitle>{localizeText("Pipette du portrait")}</DialogTitle><DialogDescription className="mt-2">{localizeText("Cliquez ou appuyez sur une zone de l’image pour choisir la couleur de la carte.")}</DialogDescription></div>
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain bg-white" aria-label={localizeText("Portrait agrandi pour la pipette")}>
        <button type="button" aria-label={localizeText("Choisir une couleur dans le portrait")} onClick={event => sample(event.clientX, event.clientY, event.detail === 0)} className="relative block border-0 bg-white p-0 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" style={{ width: `${zoom}%`, height: `${zoom}%` }}>
          <img ref={img} src={source} alt={localizeText("Portrait pour sélectionner une couleur")} draggable={false} onError={() => setError("Impossible de charger le portrait.")} className="block h-full w-full cursor-crosshair object-contain" />
          {localizeNode(point && <span aria-hidden="true" className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_black]" style={{ left: `${point.x}%`, top: `${point.y}%` }} />)}
        </button>
        </div>
        <label className="flex shrink-0 items-center gap-3 text-xs font-bold">{localizeText("Zoom ")}{localizeNode(zoom)} %<input type="range" aria-label={localizeText("Zoom de la pipette")} min="100" max="300" step="10" value={zoom} onChange={event => { setZoom(Number(event.target.value)); setPoint(null); }} className="min-h-11 min-w-0 flex-1 accent-accent" /></label>
        <div role="status" className="flex min-h-11 shrink-0 items-center gap-3">{localizeNode(selected ? <><span className="h-8 w-8 border border-ink" style={{ backgroundColor: selected }} /><span className="font-bold uppercase">{localizeNode(selected)}</span></> : <span className="text-sm opacity-70">{localizeText("Aucune couleur sélectionnée.")}</span>)}</div>
        {localizeNode(error && <p role="alert" className="text-sm text-destructive">{localizeNode(error)}</p>)}
        <div className="grid shrink-0 grid-cols-2 gap-2 pb-[env(safe-area-inset-bottom)]"><button type="button" className={button} onClick={() => setOpen(false)}>{localizeText("Annuler")}</button><button type="button" className={`${button} bg-accent text-background`} disabled={!selected} onClick={() => { if (selected) onSelect(selected); setOpen(false); }}>{localizeText("Appliquer")}</button></div>
      </DialogContent>
    </Dialog>
  </>;
}
