import { LoaderCircle } from "lucide-react";
import { localizeText } from "@/i18n/localize";

export default function ImageStyleLoader({ compact = false }: { compact?: boolean }) {
  return <div role="status" aria-label={localizeText("Stylisation en cours…")} className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 bg-black/45 text-white">
    <LoaderCircle aria-hidden="true" className={`${compact ? "h-5 w-5" : "h-8 w-8"} animate-spin`} />
    <span className={compact ? "sr-only" : "px-2 text-center text-xs font-bold"}>{localizeText("Stylisation en cours…")}</span>
  </div>;
}
