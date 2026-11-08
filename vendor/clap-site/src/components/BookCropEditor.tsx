import { localizeText, localizeNode } from '@/i18n/localize';
import { useState, type PointerEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { bookCropRect, DEFAULT_BOOK_CROP, type BookCrop } from "@/lib/bookBackground";

type Props = { source: string; name: string; width: number; height: number; initial: BookCrop; onSave: (crop: BookCrop) => void; onClose: () => void };

export default function BookCropEditor({ source, name, width, height, initial, onSave, onClose }: Props) {
  const [crop, setCrop] = useState(initial);
  const rect = bookCropRect(width, height, 292, 170, crop);
  function position(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - bounds.left) / bounds.width * width;
    const py = (event.clientY - bounds.top) / bounds.height * height;
    setCrop(current => ({ ...current,
      x: width === rect.width ? 0.5 : Math.max(0, Math.min(1, (px - rect.width / 2) / (width - rect.width))),
      y: height === rect.height ? 0.5 : Math.max(0, Math.min(1, (py - rect.height / 2) / (height - rect.height))),
    }));
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="flex max-h-[95dvh] flex-col gap-0 overflow-hidden bg-paper p-0 sm:max-w-xl">
      <div className="shrink-0 space-y-2 border-b border-ink/20 p-4 pr-12">
      <DialogTitle>{localizeText("Cadrer la vignette")}</DialogTitle>
      <DialogDescription>{localizeNode(name)}{localizeText(" — Cliquez ou glissez le cadre pour choisir la zone visible. Ce cadrage s’applique à toutes les répétitions de cette image.")}</DialogDescription>
      </div>
      <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4">
      <div tabIndex={0} role="group" aria-label={localizeText("Déplacer le cadrage avec les flèches ou par glissement")} onKeyDown={event => { if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return; event.preventDefault(); const step = event.shiftKey ? .1 : .01; setCrop(current => ({ ...current, x: Math.max(0, Math.min(1, current.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0))), y: Math.max(0, Math.min(1, current.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0))) })); }} className="relative mx-auto touch-none cursor-move overflow-hidden bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" style={{ width: `min(100%, ${40 * width / height}dvh)`, aspectRatio: `${width}/${height}` }}
        onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); position(event); }}
        onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) position(event); }}
        onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}>
        <img src={source} alt={localizeText("Image complète à cadrer")} draggable={false} className="block h-full w-full select-none" />
        <div className="pointer-events-none absolute border-2 border-white" style={{ left: `${rect.x / width * 100}%`, top: `${rect.y / height * 100}%`, width: `${rect.width / width * 100}%`, height: `${rect.height / height * 100}%`, boxShadow: "0 0 0 9999px rgb(0 0 0 / .55)" }} />
      </div>
      <div className="space-y-2">
        <label className="block text-sm">{localizeText("Zoom : ")}{localizeNode(crop.zoom.toFixed(2))}×<input aria-label={localizeText("Zoom du cadrage")} type="range" min="1" max="4" step="0.05" value={crop.zoom} onChange={event => setCrop(current => ({ ...current, zoom: Number(event.target.value) }))} className="block min-h-11 w-full accent-accent" /></label>
      </div>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-ink/20 p-4">
        <button type="button" className="min-h-11 border border-ink px-3" onClick={() => setCrop({ ...DEFAULT_BOOK_CROP })}>{localizeText("Recentrer")}</button>
        <button type="button" className="min-h-11 border border-ink px-3" onClick={onClose}>{localizeText("Annuler")}</button>
        <button type="button" className="min-h-11 border border-ink bg-accent px-3 font-bold text-background" onClick={() => onSave(crop)}>{localizeText("Valider le cadrage")}</button>
      </div>
    </DialogContent>
  </Dialog>;
}
