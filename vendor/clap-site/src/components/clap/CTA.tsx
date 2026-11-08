import { localizeNode } from '@/i18n/localize';
import { useLang } from "@/i18n/LanguageContext";
import { ShoppingBag, MessageCircle } from "lucide-react";

const CTA = () => {
  const { t } = useLang();
  return (
    <section className="relative py-24 md:py-32 bg-paper-dark/40 border-y border-ink overflow-hidden">
      <div className="absolute inset-0 bg-grain opacity-40 pointer-events-none" aria-hidden />
      <div className="splat" style={{ top: '15%', left: '8%', width: 30, height: 30, background: 'hsl(var(--accent))' }} />
      <div className="splat" style={{ bottom: '20%', right: '10%', width: 18, height: 18, background: 'hsl(var(--accent))' }} />
      <div className="splat" style={{ top: '60%', left: '20%', width: 8, height: 8, background: 'hsl(var(--accent))' }} />

      <div className="container relative text-center max-w-3xl">
        <h2 className="font-display text-5xl sm:text-6xl md:text-8xl mb-6 text-balance break-words">
          {t("cta_title").split(" ").map((w, i) =>
            /(film|movie|tourner|shoot)/i.test(w) ? (
              <span key={i} className="text-accent">{localizeNode(w)} </span>
            ) : (
              <span key={i}>{localizeNode(w)} </span>
            )
          )}
        </h2>
        <p className="typewriter text-lg md:text-xl text-foreground/80 mb-10">{t("cta_body")}</p>
        <div className="flex flex-wrap gap-4 justify-center">
          <a href="#" className="btn-clap">
            <ShoppingBag size={16} /> {t("cta_buy")}
          </a>
          <a href="#" className="btn-ghost-clap">
            <MessageCircle size={16} /> {t("cta_discord")}
          </a>
        </div>
      </div>
    </section>
  );
};

export default CTA;
