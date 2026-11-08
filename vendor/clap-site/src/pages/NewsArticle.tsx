import { localizeText, localizeNode } from '@/i18n/localize';
import AppHeader from "@/components/AppHeader";

import Header from "@/components/clap/Header";
import Footer from "@/components/clap/Footer";
import { useNews } from "@/data/content";
import ContentStatus from "@/components/clap/ContentStatus";
import { Link, useParams, Navigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import { LanguageProvider, useLang } from "@/i18n/LanguageContext";
import { formatNewsDate } from "@/data/news";
import { ArrowLeft, Calendar } from "lucide-react";
import { useAccount } from "@/lib/community";
import { Button } from "@/components/ui/button";

const NewsArticleInner = ({ appMode }: { appMode: boolean }) => {
  const { slug } = useParams();
  const { t, lang } = useLang();
  const { user } = useAccount();
  const query = useNews();
  const newsItems = query.data ?? [];
  const item = newsItems.find((n) => n.slug === slug);
  const stackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (item) {
      document.title = `${lang === "fr" ? item.title_fr : item.title_en} — Clap & Role`;
    }
  }, [item, lang]);

  // Parallax / stacked pages reveal on scroll
  useEffect(() => {
    if (!item?.pages?.length) return;
    const el = stackRef.current;
    if (!el) return;

    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // progress: 0 when stack enters from below, 1 when fully scrolled past
      const total = rect.height + vh;
      const scrolled = vh - rect.top;
      const p = Math.max(0, Math.min(1, scrolled / total));
      el.style.setProperty("--scroll-p", String(p));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [item]);

  if (query.isPending || query.isError) return <div className="min-h-screen">{appMode ? <AppHeader title={localizeText(t("nav_news"))} /> : <Header />}<main className={`container ${appMode ? "pt-24 sm:pt-6 md:pt-10" : "pt-28 md:pt-36"}`}><ContentStatus query={query} lang={lang} /></main>{localizeNode(!appMode && <Footer />)}</div>;

  if (!item) return <Navigate to={appMode ? "/app/news" : "/news"} replace />;

  const hasCover = !!item.cover;
  const pages = item.pages ?? [];

  return (
    <div className="relative min-h-screen">
      {appMode ? <AppHeader title={localizeText(t("nav_news"))} /> : <Header />}
      <main className={hasCover ? "pb-20" : appMode ? "pt-24 sm:pt-6 md:pt-10 pb-20" : "pt-28 md:pt-36 pb-20"}>
        {localizeNode(!appMode && user?.admin && <div className={`container ${hasCover ? (appMode ? "pt-24 sm:pt-6 md:pt-10 mb-6" : "pt-28 mb-6") : "mb-6"}`}><Button variant="outline" asChild><Link to={`/admin/news/${encodeURIComponent(item.slug)}/edit`}>{localizeNode(lang === "fr" ? "Modifier l’actualité" : "Edit news")}</Link></Button></div>)}
        {/* Cover hero */}
        {hasCover && (
          <section className={`relative h-[80vh] min-h-[520px] overflow-hidden flex items-end ${appMode ? "pt-24 sm:pt-10" : "pt-28"}`}>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${item.cover})`,
                filter: "contrast(1.05) saturate(0.9)",
              }}
              aria-hidden
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" aria-hidden />
            <div className="absolute inset-0 bg-grain opacity-40 mix-blend-multiply" aria-hidden />
            <div className="container relative z-10 pb-12">
              <Link
                to={appMode ? "/app/news" : "/news"}
                className="inline-flex items-center gap-2 typewriter text-xs uppercase tracking-widest mb-6 hover:text-accent transition-colors"
              >
                <ArrowLeft size={14} /> {t("news_back_list")}
              </Link>
              <div className="flex items-center gap-3 mb-4 typewriter text-[11px] uppercase tracking-widest text-foreground/70">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={12} /> {localizeNode(formatNewsDate(item.date, lang))}
                </span>
                <span className="px-2 py-0.5 bg-ink text-background">
                  {localizeNode(lang === "fr" ? item.category_fr : item.category_en)}
                </span>
              </div>
              <h1 className="font-display text-4xl sm:text-5xl md:text-7xl lg:text-8xl break-words leading-[0.9] text-balance max-w-4xl">
                {localizeNode(lang === "fr" ? item.title_fr : item.title_en)}
              </h1>
            </div>
          </section>
        )}

        <div className={`container max-w-3xl ${hasCover || !appMode ? "pt-16" : "pt-2"}`}>
          {!hasCover && (
            <Link
              to={appMode ? "/app/news" : "/news"}
              className="inline-flex items-center gap-2 typewriter text-xs uppercase tracking-widest mb-8 hover:text-accent transition-colors"
            >
              <ArrowLeft size={14} /> {t("news_back_list")}
            </Link>
          )}

          <article className="paper-card p-8 md:p-12">
            {localizeNode(!hasCover && (
              <>
                <div className="flex items-center justify-between mb-6 typewriter text-[11px] uppercase tracking-widest text-foreground/60">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar size={12} /> {localizeNode(formatNewsDate(item.date, lang))}
                  </span>
                  <span className="px-2 py-0.5 bg-ink text-background">
                    {localizeNode(lang === "fr" ? item.category_fr : item.category_en)}
                  </span>
                </div>
                <h1 className="font-display text-4xl md:text-6xl mb-6 leading-tight text-balance">
                  {localizeNode(lang === "fr" ? item.title_fr : item.title_en)}
                </h1>
              </>
            ))}

            <p className="typewriter text-lg md:text-xl leading-relaxed text-foreground/85 mb-6 italic">
              {localizeNode(lang === "fr" ? item.excerpt_fr : item.excerpt_en)}
            </p>

            <div className="w-16 border-t-2 border-ink my-8" />

            <p className="typewriter text-base leading-relaxed text-foreground/80 whitespace-pre-line">
              {localizeNode(lang === "fr" ? item.body_fr : item.body_en)}
            </p>
          </article>
        </div>

        {/* Stacked pages parallax */}
        {pages.length > 0 && (
          <section className="container max-w-5xl mt-24">
            <p className="typewriter text-xs uppercase tracking-[0.3em] text-accent text-center mb-3">
              // {localizeNode(lang === "fr" ? "Aperçu" : "Preview")}
            </p>
            <h2 className="font-display text-3xl md:text-5xl text-center mb-16">
              {localizeNode(lang === "fr" ? "Feuillette l'ouvrage" : "Browse the book")}
            </h2>

            <div
              ref={stackRef}
              className="relative mx-auto"
              style={{
                height: `${pages.length * 70}vh`,
                ["--scroll-p" as never]: 0,
              }}
            >
              {pages.map((src, i) => {
                const start = i / pages.length;
                const end = (i + 1) / pages.length;
                return (
                  <div
                    key={i}
                    className="sticky top-24 mx-auto w-full max-w-4xl"
                    style={{
                      height: "70vh",
                      marginTop: i === 0 ? 0 : "-70vh",
                      zIndex: i + 1,
                      transform: `translateY(calc(var(--scroll-p) * -${i * 30}px)) rotate(${(i - 1) * 0.8}deg)`,
                      transition: "transform 0.1s linear",
                    }}
                  >
                    <div
                      className="relative w-full h-full paper-card overflow-hidden"
                      style={{
                        boxShadow: `${4 + i * 2}px ${4 + i * 2}px 0 hsl(var(--ink)), 0 ${10 + i * 6}px 40px -10px hsl(0 0% 0% / 0.4)`,
                      }}
                    >
                      <img
                        src={src}
                        alt={localizeText(`Page ${i + 1}`)}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-3 right-4 typewriter text-xs uppercase tracking-widest bg-ink text-background px-2 py-0.5">
                        p. {localizeNode(String((i + 1) * 47).padStart(3, "0"))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
      {localizeNode(!appMode && <Footer />)}
    </div>
  );
};

const NewsArticle = ({ appView = false }: { appView?: boolean }) => (
  <LanguageProvider>
    <NewsArticleInner appMode={appView} />
  </LanguageProvider>
);

export default NewsArticle;
