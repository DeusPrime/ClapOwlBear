import { localizeText, localizeNode } from '@/i18n/localize';
import { Star } from "lucide-react";

export default function FilmRatingSummary({ average, count, lang }: { average: number | null; count: number; lang: "fr" | "en" }) {
  return <p className="typewriter flex items-center gap-2 text-sm" aria-label={localizeText(count ? (lang === "fr" ? "Note moyenne" : "Average rating") : undefined)}>
    <Star size={16} aria-hidden="true" className={count ? "text-accent fill-accent" : "text-muted-foreground"} />
    {count && average != null ? <><strong>{localizeNode(average.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 }))}/5</strong><span className="text-muted-foreground">· {localizeNode(count)} {lang === "fr" ? (count === 1 ? "note" : "notes") : (count === 1 ? "rating" : "ratings")}</span></> : <span className="text-muted-foreground">{localizeNode(lang === "fr" ? "Pas encore de note" : "Not rated yet")}</span>}
  </p>;
}
