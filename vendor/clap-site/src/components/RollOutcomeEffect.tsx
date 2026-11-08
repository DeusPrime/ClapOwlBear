import { useEffect, useRef, type ReactNode } from "react";

export type RollOutcome = "neutral" | "failure" | "success" | "prowess" | "complication" | "discarded";
const colors: Record<RollOutcome, string> = {
  neutral: "var(--accent)", failure: "var(--destructive)", success: "152 65% 45%",
  prowess: "212 90% 60%", complication: "40 95% 55%", discarded: "var(--muted-foreground)",
};
export default function RollOutcomeEffect({ outcome, active, children }: { outcome: RollOutcome; active: boolean; children: ReactNode }) {
  const element = useRef<HTMLDivElement>(null);
  const halo = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const target = element.current;
    const light = halo.current;
    if (!target || !light) return;
    target.style.transform = "none";
    target.style.opacity = "1";
    light.style.opacity = "0";
    if (!active || outcome === "neutral") return;
    if (typeof requestAnimationFrame !== "function") return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const motion = reduced ? .2 : 1;
    const start = performance.now();
    let frame: number;
    const tick = (time: number) => {
      const progress = Math.min(1, Math.max(0, (time - start) / 650));
      const fade = 1 - progress;
      const pulse = Math.sin(progress * Math.PI);
      let transform = "none";
      if (outcome === "failure") transform = `translateX(${Math.sin(progress * Math.PI * 8) * 6 * fade * motion}px)`;
      if (outcome === "success") transform = `scale(${1 + pulse * .06 * motion})`;
      if (outcome === "prowess") transform = `translateY(${-pulse * 5 * motion}px) scale(${1 + pulse * .14 * motion})`;
      if (outcome === "complication") transform = `rotate(${Math.sin(progress * Math.PI * 6) * 4 * fade * motion}deg) scale(${1 + pulse * .04 * motion})`;
      if (outcome === "discarded") {
        transform = `translateY(${pulse * 9 * motion}px) rotate(${-pulse * 12 * motion}deg) scale(${1 - pulse * .15 * motion})`;
        target.style.opacity = String(1 - .7 * (1 - fade * fade));
      }
      target.style.transform = progress === 1 ? "none" : transform;
      light.style.opacity = progress === 1 || outcome === "discarded" || outcome === "failure" || outcome === "complication" ? "0" : String(pulse * (outcome === "prowess" ? .8 : .45));
      light.style.transform = `scale(${.85 + progress * .3})`;
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, outcome]);
  return <div ref={element} data-roll-outcome={active ? outcome : "rolling"} className="relative min-w-0 max-w-full">
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"><span ref={halo} className="absolute inset-0 rounded-xl opacity-0" style={{ border: `2px solid hsl(${colors[outcome]} / .7)`, boxShadow: `0 0 ${outcome === "prowess" ? "24" : "12"}px hsl(${colors[outcome]} / .5)`, background: `radial-gradient(ellipse, hsl(${colors[outcome]} / .18), transparent 75%)` }} /></span>
    {children}
  </div>;
}
