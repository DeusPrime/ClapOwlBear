import { useRef } from "react";
import { localizeText } from "@/i18n/localize";

type Position = { x: number; y: number };
export default function CropDragOverlay({ value, onChange, disabled = false, travelX = -1, travelY = -1 }: { value: Position; onChange: (position: Position) => void; disabled?: boolean; travelX?: number; travelY?: number }) {
  const drag = useRef<{ clientX: number; clientY: number; value: Position }>();
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const update = (x: number, y: number) => onChange({ x: clamp(x), y: clamp(y) });
  return <div role="group" tabIndex={disabled ? -1 : 0} aria-label={localizeText("Déplacer le cadrage avec les flèches ou par glissement")} className="absolute inset-0 z-10 touch-none cursor-grab focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent active:cursor-grabbing" onPointerDown={event => {
    if (disabled || event.button !== 0) return;
    event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { clientX: event.clientX, clientY: event.clientY, value };
  }} onPointerMove={event => {
    if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    update(drag.current.value.x + (Math.abs(travelX) < .0001 ? 0 : (event.clientX - drag.current.clientX) / bounds.width / travelX), drag.current.value.y + (Math.abs(travelY) < .0001 ? 0 : (event.clientY - drag.current.clientY) / bounds.height / travelY));
  }} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); drag.current = undefined; }} onPointerCancel={() => { drag.current = undefined; }} onKeyDown={event => {
    if (disabled || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault(); const step = event.shiftKey ? .1 : .01;
    update(value.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0), value.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0));
  }}><div className="pointer-events-none absolute inset-0 border border-white/70"><div className="absolute inset-x-1/3 inset-y-0 border-x border-white/30" /><div className="absolute inset-x-0 inset-y-1/3 border-y border-white/30" /></div></div>;
}
