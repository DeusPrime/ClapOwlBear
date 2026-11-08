import { useEffect, useRef, useState, type ReactNode } from "react";
import { useCardTilt } from "@/hooks/use-card-tilt";
import { resourceBackImage } from "@/lib/directories";
import { useResourceBackDirectories } from "@/hooks/use-resource-back-directories";
import { RESOURCE_APPEARANCE } from "@/lib/resourceAppearance";
import type { ResourceKind } from "@/lib/dataValidation";
import PokerCardBack from "./PokerCardBack";

function ResourceBack({ type, directoryId }: { type: ResourceKind; directoryId: string }) {
  const directory = useResourceBackDirectories().find(item => item.id === directoryId);
  const appearance = RESOURCE_APPEARANCE[type];
  return <PokerCardBack image={{ backImage: resourceBackImage(directory, type), backFilmTitle: directory?.backFilmTitle, backLabel: appearance.label, borderColor: appearance.color }} />;
}

export default function InteractiveResourceCard({ children, type, directoryId, flipped = false, disabled = false, onFlip, onGestureMove, tiltAmplitude = 15 }: {
  children: ReactNode; type: ResourceKind; directoryId: string; flipped?: boolean; disabled?: boolean; onFlip?: () => void; onGestureMove?: () => void; tiltAmplitude?: number;
}) {
  const { host, tilt, reset, toggleSensor } = useCardTilt(disabled, tiltAmplitude);
  const gesture = useRef<{ x: number; y: number; moved: boolean; time: number } | null>(null);
  const lastTap = useRef<{ x: number; y: number; time: number } | null>(null);
  const flipDirection = useRef(1);
  const previousFlipped = useRef(flipped);
  const [turnAngle, setTurnAngle] = useState(flipped ? 180 : 0);
  useEffect(() => {
    if (previousFlipped.current === flipped) return;
    previousFlipped.current = flipped;
    const direction = flipDirection.current;
    setTurnAngle(angle => angle + direction * 180);
    flipDirection.current = 1;
  }, [flipped]);
  const suppressClick = useRef(false);
  const front = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLDivElement>(null);
  useEffect(() => {
    front.current?.toggleAttribute("inert", flipped);
    back.current?.toggleAttribute("inert", !flipped);
  }, [flipped]);
  return <div ref={host} className="interactive-resource-card" data-flipped={flipped} data-disabled={disabled}
    onDragStart={event => event.preventDefault()}
    onPointerDown={event => {
      suppressClick.current = false;
      const action = (event.target as HTMLElement).closest("button, a, input, select, textarea, [role='button']");
      if (event.button !== 0 || (action && event.currentTarget.contains(action))) return;
      gesture.current = { x: event.clientX, y: event.clientY, moved: false, time: performance.now() };
      event.currentTarget.setPointerCapture(event.pointerId);
      tilt(event);
    }}
    onPointerMove={event => {
      const start = gesture.current;
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) {
        start.moved = true;
        onGestureMove?.();
      }
      tilt(event);
    }}
    onPointerUp={event => {
      const start = gesture.current;
      gesture.current = null;
      if (start) {
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        suppressClick.current = start.moved;
        if (start.moved) lastTap.current = null;
        if (!disabled && Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.4) {
          flipDirection.current = dx > 0 ? 1 : -1;
          onFlip?.();
        } else if (!disabled && event.pointerType === "touch" && !start.moved && performance.now() - start.time < 300) {
          const now = performance.now();
          const previous = lastTap.current;
          if (previous && now - previous.time < 350 && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < 24) {
            toggleSensor();
            lastTap.current = null;
            suppressClick.current = true;
          } else lastTap.current = { x: event.clientX, y: event.clientY, time: now };
        }
      }
      if (event.pointerType === "touch") reset();
    }}
    onPointerLeave={reset}
    onPointerCancel={() => { gesture.current = null; lastTap.current = null; onGestureMove?.(); reset(); }}
    onClickCapture={event => {
      if (suppressClick.current && event.detail !== 0) {
        suppressClick.current = false;
        event.preventDefault(); event.stopPropagation();
      }
    }}>
    <div className="resource-card-motion"><div className="resource-card-turn" style={{ transform: `rotateY(${turnAngle}deg)` }}>
      <div ref={front} className="resource-card-front" aria-hidden={flipped}>{children}</div>
      <div ref={back} className="resource-card-back" aria-hidden={!flipped}>
        <ResourceBack type={type} directoryId={directoryId} />
      </div>
    </div></div>
  </div>;
}
