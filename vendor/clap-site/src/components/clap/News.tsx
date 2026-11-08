import { localizeNode } from '@/i18n/localize';
import { useNews } from "@/data/content";
import ContentStatus from "@/components/clap/ContentStatus";
import AddPublication from "@/components/clap/AddPublication";
import { Link } from "react-router-dom";
import { useLang } from "@/i18n/LanguageContext";
import { Calendar, ArrowUpRight } from "lucide-react";
import { formatNewsDate } from "@/data/news";
import { useAppMode } from "@/hooks/use-app-mode";

const News = () => {
  const { t, lang } = useLang();
  const installedApp = useAppMode();
  const query = useNews();
  const newsItems = query.data ?? [];
  const items = newsItems.slice(0, 4);

  return (
    <section id="news" className="relative py-20 md:py-28 border-t border-ink">
      <div className="container">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14">
          <div className="max-w-2xl">
            <p className="typewriter text-sm uppercase tracking-[0.3em] text-accent mb-3">
              // {t("news_kicker")}
            </p>
            <h2 className="font-display text-4xl sm:text-5xl md:text-7xl break-words mb-4 text-balance">
              {t("news_title")}
            </h2>
            <p className="typewriter text-lg leading-relaxed text-foreground/80">
              {t("news_intro")}
            </p>
          </div>
          <div className="flex flex-col gap-5 shrink-0"><AddPublication kind="news" />{localizeNode(!installedApp && <Link
            to="/news"
            className="hidden md:inline-flex min-h-11 items-center justify-center gap-2 border-2 border-ink px-4 py-3 typewriter text-sm uppercase tracking-widest font-bold hover:bg-ink hover:text-background transition-colors self-end"
          >
            {localizeNode(lang === "fr" ? "Tout afficher" : "View all")} <ArrowUpRight size={16} />
          </Link>)}</div>
        </div>

        <ContentStatus query={query} lang={lang} />
        <div className="grid md:grid-cols-2 gap-6">
          {items.map((n) => (
            <Link
              key={n.slug}
              to={`/news/${n.slug}`}
              className="paper-card p-6 group hover:-translate-y-1 transition-transform block"
            >
              {localizeNode(n.cover && (
                <div className="relative -mx-6 -mt-6 mb-5 h-48 overflow-hidden border-b border-ink">
                  <img
                    src={n.cover}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              ))}
              <div className="flex items-center justify-between mb-4 typewriter text-[11px] uppercase tracking-widest text-foreground/60">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={12} /> {localizeNode(formatNewsDate(n.date, lang))}
                </span>
                <span className="px-2 py-0.5 bg-ink text-background">
                  {localizeNode(lang === "fr" ? n.category_fr : n.category_en)}
                </span>
              </div>
              <h3 className="font-display text-2xl md:text-3xl mb-3 leading-tight group-hover:text-accent transition-colors">
                {localizeNode(lang === "fr" ? n.title_fr : n.title_en)}
              </h3>
              <p className="typewriter text-sm leading-relaxed text-foreground/80 mb-4">
                {localizeNode(lang === "fr" ? n.excerpt_fr : n.excerpt_en)}
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest border-b-2 border-ink pb-0.5">
                {t("news_read")} <ArrowUpRight size={12} />
              </span>
            </Link>
          ))}
        </div>
        {localizeNode(!installedApp && <Link
          to="/news"
          className="mt-8 flex min-h-11 w-full items-center justify-center gap-2 border-2 border-ink px-4 py-3 typewriter text-sm uppercase tracking-widest font-bold hover:bg-ink hover:text-background transition-colors md:hidden"
        >
          {localizeNode(lang === "fr" ? "Tout afficher" : "View all")} <ArrowUpRight size={16} />
        </Link>)}
      </div>
    </section>
  );
};

export default News;
