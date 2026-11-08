import { useEffect, useRef, type ReactNode } from "react";
import DiceModel, { type DiceSides } from "./DiceModel";

/** Drive the dice themselves so application-wide CSS cannot cancel their movement. */
export default function RollingDie({ sides, index, className, rolling = true, compact = false, children }: { sides: DiceSides; index: number; className: string; rolling?: boolean; compact?: boolean; children?: ReactNode }) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const die = element.current;
    if (!die) return;
    if (!rolling) { die.style.transform = "translateY(0px) rotate(0deg)"; return; }
    if (typeof requestAnimationFrame !== "function") return;
    const direction = index % 2 === 0 ? 1 : -1;
    const start = performance.now() + Math.min(index, 5) * 20;
    let frame: number;
    const tick = (time: number) => {
      const progress = Math.max(0, Math.min(1, (time - start) / 760));
      const remaining = 1 - progress;
      const turn = -640 * remaining ** 3;
      const bounce = -Math.abs(Math.sin(progress * Math.PI * 3)) * 30 * remaining;
      die.style.transform = `translateY(${bounce}px) rotate(${turn * direction}deg)`;
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [sides, index, rolling]);
  return <div ref={element} data-rolling-die className={`will-change-transform ${className}`}>
    <DiceModel sides={sides} className={compact ? "!h-12 !w-12 sm:!h-16 sm:!w-16" : "!h-16 !w-16 sm:!h-20 sm:!w-20"}>{children}</DiceModel>
  </div>;
}
