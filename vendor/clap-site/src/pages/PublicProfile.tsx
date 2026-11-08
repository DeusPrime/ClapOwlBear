import { localizeNode } from '@/i18n/localize';
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LanguageProvider, useLang } from "@/i18n/LanguageContext";
import Header from "@/components/clap/Header";
import Footer from "@/components/clap/Footer";
import AccountAvatar from "@/components/AccountAvatar";
import { communityRequest } from "@/lib/community";

type Profile = { id: string; username: string; description: string; avatar: string | null; comments: { id: number; body: string; created: number; film: string; title_fr: string; title_en: string }[] };
function ProfileContent() {
  const { id } = useParams(); const { lang } = useLang(); const fr = lang === "fr";
  const profile = useQuery({ queryKey: ["public-profile", id], queryFn: ({ signal }) => communityRequest<Profile>(`/profiles/${encodeURIComponent(id!)}`, undefined, signal), retry: false });
  const person = profile.data;
  return <div className="min-h-screen"><Header /><main className="container max-w-3xl pt-28 md:pt-36 pb-20">
    <Link to="/#filmography" className="typewriter text-sm underline">{localizeNode(fr ? "Retour aux films" : "Back to films")}</Link>
    {profile.isPending ? <p role="status" className="mt-8">{localizeNode(fr ? "Chargement du profil…" : "Loading profile…")}</p> : profile.isError ? <p role="alert" className="mt-8">{profile.error.message}</p> : person && <>
      <section className="paper-card p-6 mt-8"><div className="flex items-center gap-5"><AccountAvatar username={person.username} avatar={person.avatar} className="h-20 w-20 shrink-0 text-3xl" /><h1 className="font-display text-4xl sm:text-5xl break-all">{person.username}</h1></div>
        <p className="typewriter whitespace-pre-wrap break-words mt-6 text-sm leading-relaxed">{person.description || (fr ? "Ce membre n’a pas encore renseigné de description." : "This member has not added a description yet.")}</p>
      </section>
      <section className="mt-10 space-y-4"><h2 className="font-display text-3xl">{localizeNode(fr ? "Derniers commentaires" : "Latest comments")}</h2>
        <p className="typewriter text-xs text-muted-foreground">{localizeNode(fr ? "Les 20 derniers commentaires sur les films publiés." : "The 20 latest comments on published films.")}</p>
        {localizeNode(!person.comments.length && <p className="typewriter text-sm">{localizeNode(fr ? "Aucun commentaire pour le moment." : "No comments yet.")}</p>)}
        {person.comments.map(comment => <article key={comment.id} className="paper-card p-5"><Link to={`/films/${encodeURIComponent(comment.film)}`} className="typewriter font-bold underline break-words hover:text-accent">{localizeNode(fr ? comment.title_fr : comment.title_en || comment.title_fr)}</Link><time dateTime={new Date(comment.created).toISOString()} className="block typewriter text-xs text-muted-foreground mt-2">{localizeNode(new Date(comment.created).toLocaleString(fr ? "fr-FR" : "en-GB"))}</time><p className="typewriter text-sm whitespace-pre-wrap break-words mt-4 leading-relaxed">{localizeNode(comment.body)}</p></article>)}
      </section>
    </>}
  </main><Footer /></div>;
}
export default function PublicProfile() { return <LanguageProvider><ProfileContent /></LanguageProvider>; }
