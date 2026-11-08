import { localizeText } from '@/i18n/localize';
import { useId, type ReactNode } from "react";
import { POKER_CARD_BORDER, POKER_CARD_RADIUS } from "@/lib/pokerCardFrame";

export default function PokerCardFrame({ children, label, color = "black" }: { children: ReactNode; label?: string; color?: string }) {
  const clipId = `poker-clip-${useId().replace(/:/g, "")}`;
  const inset = POKER_CARD_BORDER / 2;
  return <svg viewBox="0 0 63 88" preserveAspectRatio="none" className="block h-full w-full overflow-hidden" role={label ? "img" : undefined} aria-label={localizeText(label)} aria-hidden={label ? undefined : true}>
    <defs><clipPath id={clipId}><rect width={63} height={88} rx={POKER_CARD_RADIUS} /></clipPath></defs>
    <g clipPath={`url(#${clipId})`}><rect width={63} height={88} fill="white" />{children}</g>
    <rect x={inset} y={inset} width={63 - POKER_CARD_BORDER} height={88 - POKER_CARD_BORDER} rx={POKER_CARD_RADIUS - inset} fill="none" stroke={color} strokeWidth={POKER_CARD_BORDER} data-card-border />
  </svg>;
}
