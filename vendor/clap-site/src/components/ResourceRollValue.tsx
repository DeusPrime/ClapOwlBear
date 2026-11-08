import { localizeText, localizeNode } from '@/i18n/localize';
export default function ResourceRollValue({ value, color, label, onClick, width = 97, fullHeight = false, tourTarget }: {
  value: string; color: string; label: string; onClick: () => void; width?: number; fullHeight?: boolean; tourTarget?: string;
}) {
  const path = fullHeight
    ? `M15.52 0H81.48L97 17.64V45.36L81.48 63H15.52L0 45.36V17.64Z`
    : `M19.7692 3H${width - 19.7692}L${width - 7} 17V38L${width - 19.7692} 52H19.7692L7 38V17Z`;
  return <button type="button" data-tour={tourTarget} onClick={onClick} aria-label={localizeText(label)} title={localizeText(label)}
    className="resource-card-roll-target relative h-[63px] shrink-0"
    style={{ width, color }}>
    <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${width} 63`} aria-hidden="true">
      <path d={path} fill="white" stroke="currentColor" strokeWidth={fullHeight ? 12 : 6} strokeLinejoin="round" />
    </svg>
    <span className={`resource-card-roll-value absolute inset-x-0 flex items-center justify-center font-bold leading-none ${fullHeight ? "top-0 h-full" : "top-[9px] h-[42px]"}`}
      style={{ fontSize: width > 97 ? 24 : 32 }}>{localizeNode(value || "-")}</span>
  </button>;
}
