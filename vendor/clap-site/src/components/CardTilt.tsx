import type { ReactNode } from "react";
import { useCardTilt } from "@/hooks/use-card-tilt";

export default function CardTilt({ children, disabled = false }: { children: ReactNode; disabled?: boolean }) {
  const { host, tilt, reset } = useCardTilt(disabled);
  return <div ref={host} className="hero-card-tilt" data-disabled={disabled}
    onPointerMove={tilt} onPointerLeave={reset} onPointerCancel={reset}
    onPointerUp={event => { if (event.pointerType === "touch") reset(); }}>
    <div className="hero-card-tilt-motion">{children}</div>
  </div>;
}
