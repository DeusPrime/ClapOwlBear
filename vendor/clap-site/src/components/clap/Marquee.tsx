import { localizeNode } from '@/i18n/localize';
import { useMemo } from "react";
import { useLang } from "@/i18n/LanguageContext";

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const Marquee = () => {
  const { t } = useLang();
  const raw = t("marquee_words");

  // Génère une longue séquence aléatoire (sans deux fois le même mot d'affilée)
  const sequence = useMemo(() => {
    const words = raw.split("|").map((w) => w.trim()).filter(Boolean);
    if (words.length === 0) return [];
    const out: string[] = [];
    const target = 60;
    let last = "";
    while (out.length < target) {
      const batch = shuffle(words);
      for (const w of batch) {
        if (w === last && words.length > 1) continue;
        out.push(w);
        last = w;
      }
    }
    return out;
  }, [raw]);

  const Group = ({ ariaHidden = false }: { ariaHidden?: boolean }) => (
    <div
      className="flex shrink-0 items-center whitespace-nowrap gap-10"
      aria-hidden={ariaHidden}
    >
      {sequence.map((word, i) => (
        <span key={i} className="flex items-center gap-10">
          <span>{localizeNode(word)}</span>
          <span className="text-accent" aria-hidden>●</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="overflow-hidden bg-ink text-background py-3 border-y border-ink">
      <div className="flex marquee-track w-max font-display text-2xl tracking-[0.2em]">
        <Group />
        <Group ariaHidden />
      </div>
    </div>
  );
};

export default Marquee;
