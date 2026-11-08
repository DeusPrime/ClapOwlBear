import { localizeNode } from '@/i18n/localize';
import { useLang } from "@/i18n/LanguageContext";
import { Download, FileText } from "lucide-react";

const Resources = () => {
  const { t, lang } = useLang();
  const items = [
    { icon: FileText, title: t("res_sheet_title"), desc: t("res_sheet_desc"), href: `${import.meta.env.BASE_URL}templates/${lang === "en" ? "blank-hero-cards-A6-en.pdf?v=1" : "cartes-heros-vierges-A6.pdf?v=6"}` },
  ];

  return (
    <section id="resources" className="relative py-20 md:py-28 border-t border-ink">
      <div className="container">
        <div className="max-w-3xl mb-14">
          <p className="typewriter text-sm uppercase tracking-[0.3em] text-accent mb-3">
            // {t("res_kicker")}
          </p>
          <h2 className="font-display text-4xl sm:text-5xl md:text-7xl break-words mb-6">{t("res_title")}</h2>
          <p className="typewriter text-lg leading-relaxed text-foreground/80">{t("res_intro")}</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {items.map((it, i) => (
            <article
              key={i}
              className="paper-card p-6 flex gap-5 items-start hover:-translate-y-1 transition-transform"
            >
              <div className="shrink-0 w-14 h-14 bg-ink text-background flex items-center justify-center">
                <it.icon size={24} />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2 mb-1">
                  <h3 className="font-display text-2xl">{localizeNode(it.title)}</h3>
                  <span className="text-xs typewriter px-1.5 py-0.5 bg-accent text-accent-foreground">
                    {t("res_pdf")}
                  </span>
                </div>
                <p className="typewriter text-sm text-foreground/75 mb-4">{localizeNode(it.desc)}</p>
                <a href={it.href} download={lang === "en" ? "blank-hero-cards-A6-en.pdf" : "cartes-heros-vierges-A6.pdf"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest hover:text-accent transition-colors">
                  <Download size={14} /> {t("res_download")}
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Resources;
