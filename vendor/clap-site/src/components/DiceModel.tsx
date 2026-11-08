import type { ReactNode } from "react";
import d4 from "@/assets/dice/d4.svg?raw";
import d6 from "@/assets/dice/d6.svg?raw";
import d8 from "@/assets/dice/d8.svg?raw";
import d10 from "@/assets/dice/d10.svg?raw";
import d12 from "@/assets/dice/d12.svg?raw";
import d20 from "@/assets/dice/d20.svg?raw";

export type DiceSides = 4 | 6 | 8 | 10 | 12 | 20;
const models: Record<DiceSides, string> = { 4: d4, 6: d6, 8: d8, 10: d10, 12: d12, 20: d20 };
// Adapted from jpneok's CC0 Polyhedral RPG Gaming Dice (see assets/dice/README.md).
export default function DiceModel({ sides, children, className = "" }: { sides: DiceSides; children?: ReactNode; className?: string }) {
  return <span data-dice-sides={sides} className={`relative inline-flex h-16 w-16 shrink-0 items-center justify-center ${className}`}>
    <span aria-hidden="true" className="absolute inset-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: models[sides] }} />
    {children != null && <span className={`relative flex items-center justify-center px-0.5 font-display font-bold leading-none ${sides === 4 ? "mt-4" : ""}`}>{children}</span>}
  </span>;
}
