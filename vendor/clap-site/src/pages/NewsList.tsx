import { localizeText, localizeNode } from '@/i18n/localize';
import AppHeader from "@/components/AppHeader";

import Header from "@/components/clap/Header";
import Footer from "@/components/clap/Footer";
import { useNews } from "@/data/content";
import ContentStatus from "@/components/clap/ContentStatus";
import AddPublication from "@/components/clap/AddPublication";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import { LanguageProvider, useLang } from "@/i18n/LanguageContext";
import { formatNewsDate } from "@/data/news";
import { ArrowLeft, Calendar, ArrowUpRight } from "lucide-react";

const NewsListInner = ({ appMode }: { appMode: boolean }) => {
  const { t, lang } = useLang();
  const query = useNews();
  const newsItems = query.data ?? [];

  useEffect(() => {
    document.title =
      lang === "fr"
        ? "Actualités — Clap & Role"
        : "News — Clap & Role";
  }, [lang]);

  const sorted = [...newsItems].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="relative min-h-screen">
      {appMode ? <AppHeader title={localizeText(t("nav_news"))} /> : <Header />}
      <main className={appMode ? "pt-24 sm:pt-6 md:pt-10 pb-20" : "pt-28 md:pt-36 pb-20"}>
        <div className="container">
          {!appMode && <Link
            to="/"
            className="inline-flex items-center gap-2 typewriter text-xs uppercase tracking-widest mb-8 hover:text-accent transition-colors"
          >
            <ArrowLeft size={14} /> {t("back_home")}
          </Link>}

          <div className="max-w-3xl mb-14">
            <p className="typewriter text-sm uppercase tracking-[0.3em] text-accent mb-3">
              // {t("news_kicker")}
            </p>
            <h1 className="font-display text-4xl sm:text-5xl md:text-7xl break-words mb-4 text-balance">
              {t("news_title")}
            </h1>
            <p className="typewriter text-lg leading-relaxed text-foreground/80">
              {t("news_intro")}
            </p>
          </div>

          <ContentStatus query={query} lang={lang} />
          {localizeNode(!appMode && <div className="mb-8"><AddPublication kind="news" /></div>)}
        <div className="grid md:grid-cols-2 gap-6">
            {sorted.map((n) => (
              <Link
                key={n.slug}
                to={`${appMode ? "/app/news" : "/news"}/${encodeURIComponent(n.slug)}`}
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
                <h2 className="font-display text-2xl md:text-3xl mb-3 leading-tight group-hover:text-accent transition-colors">
                  {localizeNode(lang === "fr" ? n.title_fr : n.title_en)}
                </h2>
                <p className="typewriter text-sm leading-relaxed text-foreground/80 mb-4">
                  {localizeNode(lang === "fr" ? n.excerpt_fr : n.excerpt_en)}
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest border-b-2 border-ink pb-0.5">
                  {t("news_read")} <ArrowUpRight size={12} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>
      {localizeNode(!appMode && <Footer />)}
    </div>
  );
};

const NewsList = ({ appView = false }: { appView?: boolean }) => (
  <LanguageProvider>
    <NewsListInner appMode={appView} />
  </LanguageProvider>
);

export default NewsList;
