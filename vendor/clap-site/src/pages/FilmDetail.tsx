import { localizeText, localizeNode } from '@/i18n/localize';
import AppHeader from "@/components/AppHeader";

import Header from "@/components/clap/Header";
import Footer from "@/components/clap/Footer";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Star, Trash2 } from "lucide-react";
import FilmRatingSummary from "@/components/FilmRatingSummary";
import { LanguageProvider, useLang } from "@/i18n/LanguageContext";
import AccountAvatar from "@/components/AccountAvatar";
import ContentStatus from "@/components/clap/ContentStatus";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFilms } from "@/data/content";
import { communityRequest, useAccount, type FilmActivity } from "@/lib/community";

function FilmDetailInner({ appMode }: { appMode: boolean }) {
  const { code } = useParams();
  const { t, lang } = useLang();
  const fr = lang === "fr";
  const { user, loading: accountLoading } = useAccount();
  const client = useQueryClient();
  const films = useFilms();
  const film = films.data?.find(f => f.code === code);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const activity = useInfiniteQuery({
    queryKey: ["film-activity", code, user?.id || null, user?.admin || false], enabled: Boolean(film) && !accountLoading,
    initialPageParam: null as number | null,
    queryFn: ({ pageParam, signal }) => communityRequest<FilmActivity>(`/films/${encodeURIComponent(code!)}${pageParam ? `?before=${pageParam}` : ""}`, undefined, signal),
    getNextPageParam: page => page.next ?? undefined,
  });
  const data = activity.data?.pages[0];
  const comments = activity.data?.pages.flatMap(page => page.comments) || [];
  const title = film && (fr ? film.title_fr : film.title_en);
  useEffect(() => { if (title) document.title = `${title} — Clap & Role`; }, [title]);
  useEffect(() => { setComment(""); setError(""); setNotice(""); }, [code, user?.id]);
  const mutate = async (path: string, body: unknown, message: string) => {
    setBusy(true); setError(""); setNotice("");
    try {
      await communityRequest(`/films/${encodeURIComponent(code!)}/${path}`, body);
      if (path === "comments") setComment("");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["film-activity", code] }),
        ...(path === "rating" ? [client.invalidateQueries({ queryKey: ["content", "films"] })] : []),
      ]);
      setNotice(message);
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur du service."); }
    finally { setBusy(false); }
  };
  const submit = (e: FormEvent) => { e.preventDefault(); void mutate("comments", { body: comment }, fr ? "Commentaire publié." : "Comment posted."); };
  return <div className="min-h-screen">{appMode ? <AppHeader title={localizeText(t("films_title"))} /> : <Header />}<main className={`container ${appMode ? "pt-24 sm:pt-6 md:pt-10" : "pt-28 md:pt-36"} pb-20`}>
    <Link to={appMode ? "/app/films" : "/films"} className="typewriter text-sm hover:text-accent">← {localizeNode(fr ? "Tous les films" : "All films")}</Link>
    {films.isPending || films.isError ? <div className="mt-8"><ContentStatus query={films} lang={lang} /></div> : !film ?
      <h1 className="font-display text-5xl mt-10">{localizeNode(fr ? "Film introuvable" : "Film not found")}</h1> : <>
      <section className="grid md:grid-cols-[minmax(220px,360px)_1fr] gap-8 lg:gap-14 mt-8 items-start">
        <div className="paper-card overflow-hidden">{localizeNode(film.poster ? <img src={film.poster} alt={localizeText(title)} className="w-full aspect-[2/3] object-cover" /> : <div className={`aspect-[2/3] bg-gradient-to-br ${film.palette}`} />)}</div>
        <div className="py-2"><p className="typewriter text-xs uppercase tracking-widest text-accent mb-4">{localizeNode(film.code)} · {localizeNode(film.year)}</p>
          <h1 className="font-display text-5xl md:text-7xl break-words mb-5">{localizeNode(title)}</h1>
          <p className="typewriter text-sm text-accent mb-4">{localizeNode(film.released ? (fr ? "Sorti" : "Released") : (fr ? "Prochainement" : "Coming soon"))}</p>
          {localizeNode(!appMode && user?.admin && <Button variant="outline" className="mb-5" asChild><Link to={`/admin/films/${encodeURIComponent(film.code)}/edit`}>{localizeNode(fr ? "Modifier le film" : "Edit film")}</Link></Button>)}
          <p className="typewriter text-sm text-muted-foreground mb-6">{localizeNode(fr ? film.genre_fr : film.genre_en)} · {localizeNode(film.duration)} · {localizeNode(film.rating)}</p>
          {localizeNode(film.intro && <span className="inline-block border-2 border-accent text-accent typewriter text-xs uppercase px-3 py-2 mb-6">{localizeNode(fr ? "Scénario d’introduction" : "Intro scenario")}</span>)}
          <h2 className="font-display text-3xl mb-3">{localizeText("Synopsis")}</h2>
          <p className="typewriter leading-relaxed whitespace-pre-wrap">{localizeNode(fr ? film.pitch_fr : film.pitch_en)}</p>
          <div className="border-t border-ink/20 mt-8 pt-6"><h2 className="font-display text-3xl mb-4">{localizeNode(fr ? "Ton avis" : "Your opinion")}</h2>
            <FilmRatingSummary average={data?.ratingAverage ?? film.ratingAverage} count={data?.ratingCount ?? film.ratingCount ?? 0} lang={lang} />
            <div className="flex flex-wrap gap-2 mt-4" role="group" aria-label={localizeText(fr ? "Ta note" : "Your rating")}>
              {[1, 2, 3, 4, 5].map(value => <Button key={value} variant={(data?.userRating ?? 0) >= value ? "default" : "outline"} size="icon"
                disabled={!film.released || !user || !data || busy} aria-pressed={data?.userRating === value}
                aria-label={localizeText(fr ? `Noter ${value} sur 5` : `Rate ${value} out of 5`)}
                onClick={() => void mutate("rating", { value }, fr ? "Note enregistrée." : "Rating saved.")}>
                <Star size={20} className={(data?.userRating ?? 0) >= value ? "fill-current" : ""} />
              </Button>)}
            </div>
            {localizeNode(data && data.userRating > 0 && <div className="flex flex-wrap items-center gap-3 mt-3"><p className="typewriter text-sm">{localizeNode(fr ? "Ta note" : "Your rating")} : {localizeNode(data.userRating)}/5</p><Button variant="ghost" size="sm" disabled={busy || !film.released} onClick={() => void mutate("rating", { value: 0 }, fr ? "Note retirée." : "Rating removed.")}>{localizeNode(fr ? "Retirer ma note" : "Remove my rating")}</Button></div>)}
            <p className="typewriter text-sm mt-3 text-muted-foreground">{!film.released ? (fr ? "Les notes et commentaires seront disponibles à la sortie du film." : "Ratings and comments will be available when the film is released.") : user ? (fr ? "Une note de 1 à 5 étoiles par film, modifiable à tout moment." : "One rating from 1 to 5 stars per film. You can change it at any time.") : appMode ? <span>{localizeNode(fr ? "Connecte-toi depuis le menu pour noter et commenter." : "Sign in from the menu to rate and comment.")}</span> : <Link className="underline" to="/compte">{localizeNode(fr ? "Connecte-toi pour noter et commenter." : "Sign in to rate and comment.")}</Link>}</p>
          </div>
        </div>
      </section>
      <section className="max-w-3xl mx-auto mt-16 space-y-6"><h2 className="font-display text-4xl">{localizeNode(fr ? "Commentaires" : "Comments")}{localizeNode(data ? ` (${data.totalComments})` : "")}</h2>
        {localizeNode(!film.released && <p className="typewriter text-muted-foreground">{localizeNode(fr ? "Ce film est en mode Prochainement : les commentaires ne sont pas encore ouverts." : "This film is coming soon: comments are not open yet.")}</p>)}
        {user && film.released && <form className="paper-card p-5 space-y-3" onSubmit={submit}><label className="typewriter text-sm block" htmlFor="comment">{localizeNode(fr ? "Partage ton avis" : "Share your thoughts")}</label>
          <Textarea id="comment" value={comment} onChange={e => setComment(e.target.value)} maxLength={3000} rows={4} required disabled={busy} />
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="typewriter text-xs text-muted-foreground">{localizeNode(comment.length)}/3000 · {user.username}</span><Button disabled={busy || !comment.trim()} type="submit">{localizeNode(fr ? "Publier" : "Post")}</Button></div>
        </form>}
        {localizeNode(error && <p className="typewriter text-destructive" role="alert">{localizeNode(error)}</p>)}
        {localizeNode(notice && <p className="typewriter" role="status">{localizeNode(notice)}</p>)}
        {localizeNode(activity.isPending && <p className="typewriter" role="status">{localizeNode(fr ? "Chargement des avis…" : "Loading opinions…")}</p>)}
        {localizeNode(activity.isError && <p role="alert" className="typewriter">{localizeNode(fr ? "Impossible de charger les avis." : "Unable to load opinions.")} <button className="underline" onClick={() => void activity.refetch()}>{localizeNode(fr ? "Réessayer" : "Retry")}</button></p>)}
        {localizeNode(data && !comments.length && film.released && <p className="typewriter text-muted-foreground">{localizeNode(fr ? "Aucun commentaire pour le moment. Ouvre la discussion !" : "No comments yet. Start the conversation!")}</p>)}
        {comments.map(item => <article key={item.id} className="paper-card p-5"><div className="flex justify-between gap-4 items-start"><div className="flex gap-3 items-center min-w-0">{appMode ? <AccountAvatar username={item.username} avatar={item.avatar} /> : <Link to={`/membres/${encodeURIComponent(item.authorId)}`} aria-label={localizeText(fr ? `Voir le profil de ${item.username}` : `View ${item.username}'s profile`)} className="shrink-0"><AccountAvatar username={item.username} avatar={item.avatar} /></Link>}<div className="min-w-0">
          {appMode ? <span className="typewriter text-sm font-bold break-all">{item.username}</span> : <Link to={`/membres/${encodeURIComponent(item.authorId)}`} className="typewriter text-sm font-bold break-all underline hover:text-accent">{item.username}</Link>}<time className="block text-xs typewriter text-muted-foreground mt-1" dateTime={new Date(item.created).toISOString()}>{localizeNode(new Date(item.created).toLocaleString(fr ? "fr-FR" : "en-GB"))}</time>
        </div></div>{localizeNode(item.canDelete && <Button size="sm" variant="ghost" disabled={busy} aria-label={localizeText(fr ? "Supprimer le commentaire" : "Delete comment")} onClick={() => void mutate(`comments/${item.id}/delete`, {}, fr ? "Commentaire supprimé." : "Comment deleted.")}><Trash2 size={16} /></Button>)}</div>
          <p className="typewriter whitespace-pre-wrap break-words mt-4 text-sm leading-relaxed">{localizeNode(item.body)}</p>
        </article>)}
        {localizeNode(activity.hasNextPage && <Button variant="outline" disabled={activity.isFetchingNextPage} onClick={() => void activity.fetchNextPage()}>{localizeNode(fr ? "Voir les commentaires précédents" : "Load older comments")}</Button>)}
      </section>
    </>}
  </main>{localizeNode(!appMode && <Footer />)}</div>;
}
export default function FilmDetail({ appView = false }: { appView?: boolean }) { return <LanguageProvider><FilmDetailInner appMode={appView} /></LanguageProvider>; }
