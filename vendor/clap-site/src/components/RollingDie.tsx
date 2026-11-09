import { useEffect, useRef, type ReactNode } from "react";
import DiceModel, { type DiceSides } from "./DiceModel";

/** Drive the dice themselves so application-wide CSS cannot cancel their movement. */
export default function RollingDie({ sides, index, className, rolling = true, compact = false, children }: { sides: DiceSides; index: number; className: string; rolling?: boolean; compact?: boolean; children?: ReactNode }) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const die = element.current;
    if (!die) return;
    if (!rolling) { die.style.transform = "translateY(0px) rotate(0deg)"; return; }
    if (typeof die.animate !== 'function') { die.style.transform = 'none'; return; }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const direction = index % 2 === 0 ? 1 : -1;
    const frames = Array.from({ length: 25 }, (_, step) => {
      const progress = step / 24;
      const remaining = 1 - progress;
      const turn = (reduced ? -45 : -640) * remaining ** 3;
      const bounce = reduced ? 0 : -Math.abs(Math.sin(progress * Math.PI * 3)) * 30 * remaining;
      return { transform: `translate3d(0, ${bounce}px, 0) rotate(${turn * direction}deg)` };
    });
    const animation = die.animate(frames, { duration: 760, delay: Math.min(index, 5) * 20, fill: 'both' });
    return () => animation.cancel();
  }, [sides, index, rolling]);
  return <div ref={element} data-rolling-die className={`will-change-transform ${className}`}>
    <DiceModel sides={sides} className={compact ? "!h-12 !w-12 sm:!h-16 sm:!w-16" : "!h-16 !w-16 sm:!h-20 sm:!w-20"}>{children}</DiceModel>
  </div>;
}
