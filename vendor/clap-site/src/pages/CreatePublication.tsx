import { localizeText, localizeNode } from '@/i18n/localize';
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LanguageProvider, useLang } from "@/i18n/LanguageContext";
import ImageEditorField from "@/components/ImageEditorField";
import type { ImageEditing } from "@/lib/imageEditing";
import Header from "@/components/clap/Header";
import Footer from "@/components/clap/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { communityRequest, useAccount } from "@/lib/community";

function PublicationForm({ kind, editing }: { kind: "films" | "news"; editing: boolean }) {
  const { lang } = useLang(); const fr = lang === "fr"; const film = kind === "films";
  const { user, loading } = useAccount(); const client = useQueryClient(); const navigate = useNavigate();
  const { identifier } = useParams();
  const [fields, setFields] = useState<Record<string, string>>({ date: new Date().toISOString().slice(0, 10), category_fr: "Actualité" });
  const [intro, setIntro] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [released, setReleased] = useState(false);
  const [imageEditing, setImageEditing] = useState<ImageEditing>();
  const imageKey = film ? "poster" : "cover";
  const imageField = <ImageEditorField label={localizeText(film ? "Affiche" : "Image de couverture")} aspectRatio={film ? 2 / 3 : 16 / 9} disabled={busy} value={fields[imageKey] || undefined} editing={imageEditing} onChange={(value, draft) => { setFields(previous => ({ ...previous, [imageKey]: value ?? "" })); setImageEditing(draft); }} />;
  const existing = useQuery({ queryKey: ["admin-publication", kind, identifier, user?.id], enabled: editing && Boolean(user?.admin), staleTime: Infinity, refetchOnWindowFocus: false,
    queryFn: () => communityRequest<{ item: Record<string, string | number | null> }>(`/admin/${kind}/${encodeURIComponent(identifier!)}`) });
  useEffect(() => {
    if (editing && existing.data) {
      setFields(Object.fromEntries(Object.entries(existing.data.item).filter(([, value]) => typeof value === "string" || value === null).map(([key, value]) => [key, value === null ? "" : String(value)])));
      setIntro(Boolean(existing.data.item.intro)); setReleased(Boolean(existing.data.item.released));
    }
  }, [editing, existing.data]);
  const back = editing ? (film ? `/films/${encodeURIComponent(identifier!)}` : `/news/${encodeURIComponent(identifier!)}`) : film ? "/#filmography" : "/#news";
  const title = editing ? (film ? (fr ? "Modifier le film" : "Edit film") : (fr ? "Modifier l’actualité" : "Edit news")) : film ? (fr ? "Ajouter un film" : "Add a film") : (fr ? "Ajouter une actualité" : "Add news");
  const field = (key: string, label: string, maxLength: number, required = false, multiline = false, placeholder = "", type = "text") => {
    const attributes = { id: key, value: fields[key] ?? "", onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFields(previous => ({ ...previous, [key]: event.target.value })), maxLength, required, disabled: busy || (editing && (key === "code" || key === "slug")), placeholder };
    return <div className="space-y-2"><label className="block typewriter text-sm" htmlFor={key}>{localizeNode(label)}{localizeNode(required ? " *" : "")}</label>{localizeNode(multiline ? <Textarea {...attributes} rows={key.startsWith("body") ? 10 : 4} /> : <Input {...attributes} type={type} />)}</div>;
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await communityRequest<{ code?: string; slug?: string }>(`/admin/${kind}${editing ? `/${encodeURIComponent(identifier!)}` : ""}`, { ...fields, ...(film ? { intro, released } : {}) });
      await client.invalidateQueries({ queryKey: ["content", kind], refetchType: "all" });
      await client.invalidateQueries({ queryKey: ["admin-publication", kind, identifier] });
      if (film) await client.invalidateQueries({ queryKey: ["film-activity"] });
      navigate(film ? `/films/${encodeURIComponent(result.code!)}` : `/news/${encodeURIComponent(result.slug!)}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erreur du service."); }
    finally { setBusy(false); }
  };
  return <div className="min-h-screen"><Header /><main className="container max-w-3xl pt-28 md:pt-36 pb-20">
    <Link to={back} className="typewriter text-sm underline">{localizeNode(fr ? "← Retour à la liste" : "← Back to the list")}</Link>
    <h1 className="font-display text-5xl mt-8 mb-8">{localizeNode(title)}</h1>
    {loading ? <p role="status">{localizeNode(fr ? "Chargement…" : "Loading…")}</p> : !user?.admin ? <p>{localizeNode(fr ? "Cette page est réservée aux administrateurs." : "This page is restricted to administrators.")} <Link to="/compte" className="underline">{localizeNode(fr ? "Connexion" : "Sign in")}</Link></p> : editing && existing.isPending ? <p role="status">{localizeNode(fr ? "Chargement de la publication…" : "Loading publication…")}</p> : editing && existing.isError ? <p role="alert">{existing.error.message}</p> : <form onSubmit={submit} className="paper-card p-6 sm:p-8 space-y-6">
      <p className="typewriter text-sm text-muted-foreground">{localizeNode(editing ? (fr ? "Les champs marqués * sont obligatoires. Les modifications seront visibles immédiatement sur le site." : "Fields marked * are required. Changes will appear on the site immediately.") : (fr ? "Les champs marqués * sont obligatoires. La publication apparaîtra immédiatement sur le site." : "Fields marked * are required. The publication will appear on the site immediately."))}</p>
      {localizeNode(field("title_fr", fr ? "Titre" : "French title", 200, true))}
      {film ? <>
        {localizeNode(field("code", fr ? "Code du film (facultatif)" : "Film code (optional)", 64, false, false, fr ? "Généré automatiquement, par exemple FILM_07" : "Generated automatically, e.g. FILM_07"))}
        <div className="grid sm:grid-cols-2 gap-5">{localizeNode(field("year", fr ? "Année de l’histoire" : "Story year", 40))}{localizeNode(field("genre_fr", fr ? "Genre" : "French genre", 120))}{localizeNode(field("duration", fr ? "Durée" : "Duration", 60, false, false, "4h"))}{localizeNode(field("rating", fr ? "Classification" : "Classification", 40, false, false, "PG-13"))}</div>
        {localizeNode(field("pitch_fr", fr ? "Synopsis" : "French synopsis", 5000, true, true))}
        {localizeNode(imageField)}
        <label className="block space-y-2"><span className="typewriter text-sm">{localizeNode(fr ? "Statut de sortie" : "Release status")}</span><select aria-label={localizeText(fr ? "Statut de sortie" : "Release status")} className="w-full border-2 border-ink bg-background p-3" disabled={busy} value={released ? "released" : "upcoming"} onChange={event => setReleased(event.target.value === "released")}><option value="upcoming">{localizeNode(fr ? "Prochainement" : "Coming soon")}</option><option value="released">{localizeNode(fr ? "Sorti" : "Released")}</option></select></label>
        <p className="typewriter text-xs text-muted-foreground">{fr ? "Les notes et les commentaires sont ouverts uniquement quand le film est sorti." : "Ratings and comments are available only once the film is released."}</p>
        <label className="flex items-center gap-3 typewriter text-sm"><input type="checkbox" checked={intro} disabled={busy} onChange={event => setIntro(event.target.checked)} />{localizeNode(fr ? "Scénario d’introduction" : "Introductory scenario")}</label>
      </> : <>
        {field("slug", fr ? "Adresse courte (facultatif)" : "Short URL (optional)", 120, false, false, fr ? "Générée à partir du titre" : "Generated from the title")}
        <div className="grid sm:grid-cols-2 gap-5">{localizeNode(field("date", fr ? "Date de publication" : "Publication date", 10, true, false, "", "date"))}{localizeNode(field("category_fr", fr ? "Catégorie" : "French category", 100))}</div>
        {localizeNode(field("excerpt_fr", fr ? "Résumé" : "French summary", 2000, false, true))}
        {localizeNode(field("body_fr", fr ? "Contenu de l’actualité" : "French article body", 15000, true, true))}
        {localizeNode(imageField)}
      </>}
      <p className="typewriter text-xs text-muted-foreground">{localizeText("PNG, JPEG, WebP ou GIF · 8 Mo maximum. Rotation, style et cadrage disponibles en ouvrant l’image.")}</p>
      <details className="border-t border-ink/20 pt-5"><summary className="typewriter text-sm cursor-pointer">{localizeNode(fr ? "Version anglaise (facultative)" : "English version (optional)")}</summary><div className="space-y-5 mt-5">
        <p className="typewriter text-xs text-muted-foreground">{localizeNode(fr ? "Le français sera utilisé pour les champs laissés vides." : "Empty fields will use the French text.")}</p>
        {localizeNode(field("title_en", fr ? "Titre anglais" : "English title", 200))}
        {localizeNode(film ? <>{localizeNode(field("genre_en", fr ? "Genre anglais" : "English genre", 120))}{localizeNode(field("pitch_en", fr ? "Synopsis anglais" : "English synopsis", 5000, false, true))}</> : <>{localizeNode(field("category_en", fr ? "Catégorie anglaise" : "English category", 100))}{localizeNode(field("excerpt_en", fr ? "Résumé anglais" : "English summary", 2000, false, true))}{localizeNode(field("body_en", fr ? "Contenu anglais" : "English article body", 15000, false, true))}</>)}
      </div></details>
      {localizeNode(error && <p role="alert" className="typewriter text-sm text-destructive">{localizeNode(error)}</p>)}
      <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy}>{localizeNode(busy ? (fr ? "Enregistrement…" : "Saving…") : editing ? (fr ? "Enregistrer les modifications" : "Save changes") : film ? (fr ? "Publier le film" : "Publish film") : (fr ? "Publier l’actualité" : "Publish news"))}</Button><Button variant="outline" disabled={busy} type="button" onClick={() => navigate(back)}>{localizeNode(fr ? "Annuler" : "Cancel")}</Button></div>
    </form>}
  </main><Footer /></div>;
}
export default function CreatePublication({ kind, editing = false }: { kind: "films" | "news"; editing?: boolean }) { return <LanguageProvider><PublicationForm kind={kind} editing={editing} /></LanguageProvider>; }
