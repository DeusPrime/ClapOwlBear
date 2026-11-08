import { localizeText, localizeNode } from '@/i18n/localize';
import { useFilms } from "@/data/content";
import ContentStatus from "@/components/clap/ContentStatus";
import AddPublication from "@/components/clap/AddPublication";
import { useLang } from "@/i18n/LanguageContext";
import { ArrowUpRight, Clapperboard } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import FilmRatingSummary from "@/components/FilmRatingSummary";
import { Input } from "@/components/ui/input";
import { useAppMode } from "@/hooks/use-app-mode";

const Filmography = ({ showAllLink = true, appView = false }: { showAllLink?: boolean; appView?: boolean }) => {
  const { t, lang } = useLang();
  const installedApp = useAppMode();
  const query = useFilms();
  const [sort, setSort] = useState("default");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const films = (query.data ?? []).filter(f => {
    if (!normalize([f.title_fr, f.title_en, f.code, f.genre_fr, f.genre_en, f.pitch_fr, f.pitch_en].join(" ")).includes(normalize(search.trim()))) return false;
    if (filter === "all") return true;
    if (filter === "unrated") return !f.ratingCount;
    if (filter === "rated") return f.ratingCount > 0;
    return f.ratingCount > 0 && f.ratingAverage != null && f.ratingAverage >= Number(filter);
  });
  if (sort !== "default") films.sort((a, b) => {
    if (!a.ratingCount || !b.ratingCount) return Number(!a.ratingCount) - Number(!b.ratingCount);
    const diff = (a.ratingAverage ?? 0) - (b.ratingAverage ?? 0);
    return (sort === "highest" ? -diff : diff) || b.ratingCount - a.ratingCount;
  });
  return (
    <section id="filmography" className="relative py-20 md:py-28 bg-paper-dark/30 border-t border-ink">
      <div className="container">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14"><div className="max-w-3xl">
          <p className="typewriter text-sm uppercase tracking-[0.3em] text-accent mb-3">
            // {t("films_kicker")}
          </p>
          <h2 className="font-display text-4xl sm:text-5xl md:text-7xl break-words mb-6 text-balance">
            {t("films_title")}
          </h2>
          <p className="typewriter text-lg leading-relaxed text-foreground/80">
            {t("films_intro")}
          </p>
        </div><div className="flex flex-col gap-5 shrink-0">
          {localizeNode(!appView && <AddPublication kind="films" />)}
          {localizeNode(showAllLink && !appView && !installedApp && <Link
            to="/films"
            className="hidden md:inline-flex min-h-11 items-center justify-center gap-2 border-2 border-ink px-4 py-3 typewriter text-sm uppercase tracking-widest font-bold hover:bg-ink hover:text-background transition-colors self-end"
          >
            {localizeNode(lang === "fr" ? "Tout afficher" : "View all")} <ArrowUpRight size={16} />
          </Link>)}
        </div></div>

        <ContentStatus query={query} lang={lang} />
        {query.data && <div className="flex flex-wrap gap-4 items-end mb-8 typewriter text-sm">
          <label className="w-full sm:w-auto sm:flex-1 sm:min-w-56">
            <span className="sr-only">{localizeNode(lang === "fr" ? "Rechercher un film" : "Search films")}</span>
            <Input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={localizeText(lang === "fr" ? "Titre, genre, mot-clé…" : "Title, genre, keyword…")} />
          </label>
          <label className="flex flex-col gap-2">{localizeNode(lang === "fr" ? "Classer les films" : "Sort films")}
            <select aria-label={localizeText(lang === "fr" ? "Classer les films" : "Sort films")} className="border-2 border-ink bg-background px-3 py-2 max-w-full" value={sort} onChange={e => setSort(e.target.value)}>
              <option value="default">{localizeNode(lang === "fr" ? "Ordre de l’affiche" : "Default order")}</option>
              <option value="highest">{lang === "fr" ? "Meilleures notes d’abord" : "Highest rated first"}</option>
              <option value="lowest">{localizeNode(lang === "fr" ? "Notes les plus basses d’abord" : "Lowest rated first")}</option>
            </select>
          </label>
          <label className="flex flex-col gap-2">{localizeNode(lang === "fr" ? "Filtrer par note" : "Filter by rating")}
            <select aria-label={localizeText(lang === "fr" ? "Filtrer par note" : "Filter by rating")} className="border-2 border-ink bg-background px-3 py-2 max-w-full" value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">{localizeNode(lang === "fr" ? "Tous les films" : "All films")}</option>
              <option value="rated">{localizeNode(lang === "fr" ? "Films notés" : "Rated films")}</option>
              <option value="unrated">{localizeNode(lang === "fr" ? "Sans note" : "Unrated films")}</option>
              {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{localizeNode(value)}/5 {localizeNode(lang === "fr" ? "minimum" : "or higher")}</option>)}
            </select>
          </label>
          <p role="status" className="text-muted-foreground py-2">{localizeNode(films.length)} {localizeNode(films.length === 1 ? "film" : "films")}</p>
        </div>}
        {localizeNode(query.data && !films.length && <p className="typewriter mb-8">{localizeNode(lang === "fr" ? "Aucun film ne correspond à ce filtre." : "No films match this filter.")}</p>)}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {films.map((f, i) => (
            <Link
              to={`${appView ? "/app/films" : "/films"}/${encodeURIComponent(f.code)}`}
              key={f.code}
              className={`paper-card group overflow-hidden hover:-translate-y-1 transition-transform ${showAllLink && i >= 3 ? "hidden md:block" : ""}`}
              style={{ transform: `rotate(${i % 2 === 0 ? "-0.6deg" : "0.6deg"})` }}
            >
              {/* Poster */}
              <div className="relative aspect-[2/3] overflow-hidden">
                {localizeNode(f.poster ? (
                  <img
                    src={f.poster}
                    alt={localizeText(lang === "fr" ? f.title_fr : f.title_en)}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className={`absolute inset-0 bg-gradient-to-br ${f.palette} grayscale-[0.7] opacity-80`} />
                ))}
                <div className="absolute inset-0 bg-grain opacity-40 mix-blend-overlay" />
                {localizeNode(f.poster ? (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/40" />
                ) : (
                  <div className="absolute inset-0 bg-black/30" />
                ))}
                <div className="absolute inset-0 flex flex-col justify-between p-5 text-white">
                  <div className="flex items-center justify-between">
                  <span className="typewriter text-[10px] tracking-[0.3em] opacity-80">
                    {localizeNode(f.code)}
                  </span>
                    <span className="typewriter text-[10px] border border-white/60 px-1.5 py-0.5">
                      {localizeNode(f.rating)}
                    </span>
                  </div>

                  {localizeNode(!f.poster && (
                    <div className="flex justify-center opacity-30 group-hover:opacity-60 group-hover:scale-110 transition-all duration-700">
                      <Clapperboard size={88} strokeWidth={1} />
                    </div>
                  ))}

                  <div>
                    <p className="typewriter text-[10px] uppercase tracking-[0.25em] opacity-70 mb-2">
                      {localizeNode(lang === "fr" ? f.genre_fr : f.genre_en)}
                    </p>
                    <h3 className="font-display text-3xl md:text-4xl leading-none">
                      {localizeNode(lang === "fr" ? f.title_fr : f.title_en)}
                    </h3>
                  </div>
                </div>

                {/* Sprocket strip top */}
                <div className="absolute top-0 left-0 right-0 h-3 flex gap-2 px-2 items-center">
                  {Array.from({ length: 12 }).map((_, k) => (
                    <span key={k} className="w-2 h-1.5 bg-black/60 rounded-sm" />
                  ))}
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-3 flex gap-2 px-2 items-center">
                  {Array.from({ length: 12 }).map((_, k) => (
                    <span key={k} className="w-2 h-1.5 bg-black/60 rounded-sm" />
                  ))}
                </div>

                {/* Coming soon banner */}
                {localizeNode(!f.released && <div className="absolute top-12 -right-14 w-56 rotate-45 z-10 pointer-events-none">
                  <div className="relative bg-accent text-background py-1.5 text-center shadow-lg">
                    {/* Ribbon tail left */}
                    <div className="absolute -left-2 top-0 h-full w-2 bg-accent" style={{ clipPath: 'polygon(100% 0, 0 50%, 100% 100%)' }} />
                    {/* Ribbon tail right */}
                    <div className="absolute -right-2 top-0 h-full w-2 bg-accent" style={{ clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
                    {/* Fold shadow */}
                    <div className="absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-black/20 to-transparent" />
                    <div className="absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-black/20 to-transparent" />
                    <span className="typewriter relative text-[11px] font-bold uppercase tracking-[0.25em]">
                      {localizeNode(lang === "fr" ? "Prochainement" : "Coming soon")}
                    </span>
                  </div>
                </div>)}

                {/* Intro scenario stamp */}
                {localizeNode(f.intro && (
                  <div className="absolute top-12 left-4 z-10 pointer-events-none -rotate-12">
                    <span className="inline-block typewriter text-[9px] font-bold uppercase tracking-[0.25em] text-accent border-2 border-accent/90 px-2 py-1 bg-background/85 shadow-md">
                      {localizeNode(lang === "fr" ? "Scénario d'intro" : "Intro scenario")}
                    </span>
                  </div>
                ))}
              </div>

              {/* Pitch */}
              <div className="p-5">
                <div className="mb-4"><FilmRatingSummary average={f.ratingAverage} count={f.ratingCount ?? 0} lang={lang} /></div>
                <div className="flex items-center justify-between mb-2 typewriter text-[11px] uppercase tracking-widest text-foreground/60">
                  <span>{t("films_runtime")} · {localizeNode(f.duration)}</span>
                  <span className="text-accent">{localizeText("●REC")}</span>
                </div>
                <p className="typewriter text-sm leading-relaxed text-foreground/85">
                  {localizeNode(lang === "fr" ? f.pitch_fr : f.pitch_en)}
                </p>
                <p className="typewriter text-xs uppercase tracking-widest text-accent mt-4">{localizeNode(lang === "fr" ? "Voir la fiche et les avis →" : "Details and opinions →")}</p>
              </div>
            </Link>
          ))}
        </div>
        {localizeNode(showAllLink && !appView && !installedApp && <Link
          to="/films"
          className="mt-8 flex min-h-11 w-full items-center justify-center gap-2 border-2 border-ink px-4 py-3 typewriter text-sm uppercase tracking-widest font-bold hover:bg-ink hover:text-background transition-colors md:hidden"
        >
          {localizeNode(lang === "fr" ? "Tout afficher" : "View all")} <ArrowUpRight size={16} />
        </Link>)}
      </div>
    </section>
  );
};

export default Filmography;
