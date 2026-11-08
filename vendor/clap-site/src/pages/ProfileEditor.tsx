import CardEditorTabs from "@/components/CardEditorTabs";
import ResourceEditorTour from "@/components/ResourceEditorTour";
import { localizeText, localizeNode } from '@/i18n/localize';
import { reportSaveError } from "@/lib/saveError";
import ImageEditorField from "@/components/ImageEditorField";
import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import ProfileCard from "@/components/ProfileCard";
import { Profile, blankProfile, getProfile, upsertProfile } from "@/lib/profiles";

const TextField = ({
  label,
  value,
  onChange,
  helper,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helper?: string;
  inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
}) => (
  <label className="block">
    <span className="typewriter text-[11px] uppercase tracking-[0.18em] text-foreground/65">{localizeNode(label)}</span>
    <input maxLength={100000}
      value={value}
      inputMode={inputMode}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 min-h-11 w-full border border-ink/35 bg-background/35 px-3 py-2 typewriter text-base outline-none transition-colors placeholder:text-foreground/35 focus:border-accent focus:bg-background/60 focus:ring-2 focus:ring-accent/20"
    />
    {localizeNode(helper && <span className="mt-1 block text-xs leading-snug text-foreground/55">{localizeNode(helper)}</span>)}
  </label>
);

const TextAreaField = ({ label, value, onChange, rows = 4, helper }: { label: string; value: string; onChange: (value: string) => void; rows?: number; helper?: string }) => (
  <label className="block">
    <span className="typewriter text-[11px] uppercase tracking-[0.18em] text-foreground/65">{localizeNode(label)}</span>
    <textarea maxLength={100000}
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 w-full resize-y border border-ink/35 bg-background/35 px-3 py-2 typewriter text-base leading-relaxed outline-none transition-colors placeholder:text-foreground/35 focus:border-accent focus:bg-background/60 focus:ring-2 focus:ring-accent/20"
    />
    {localizeNode(helper && <span className="mt-1 block text-xs leading-snug text-foreground/55">{localizeNode(helper)}</span>)}
  </label>
);

const FormSection = ({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) => (
  <section className="paper-card p-4 sm:p-5">
    <div className="mb-5 flex flex-col gap-1 border-b border-ink/20 pb-3 sm:flex-row sm:items-end sm:justify-between">
      <h2 className="font-display text-2xl leading-none">{localizeNode(title)}</h2>
      <p className="typewriter text-[11px] uppercase tracking-[0.18em] text-foreground/55">{localizeNode(eyebrow)}</p>
    </div>
    {children}
  </section>
);



const ProfileEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const detailState = { ...location.state, returnTo: "/ressources", returnState: null };
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mobileTab, setMobileTab] = useState<"edit" | "card">("edit");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!id || id === "new") {
        const item = blankProfile();
        await upsertProfile(item);
        if (!cancelled) navigate(`/profils/${item.id}/edit`, { replace: true });
        return;
      }
      const item = await getProfile(id);
      if (cancelled) return;
      if (!item) {
        navigate("/ressources");
        return;
      }
      setProfile(item);
      document.title = `${item.titre || "Profil"} — Clap & Role`;
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  useEffect(() => {
    if (!profile) return;
    const timeout = window.setTimeout(() => void upsertProfile(profile).catch(reportSaveError), 250);
    return () => window.clearTimeout(timeout);
  }, [profile]);

  const update = (patch: Partial<Profile>) => setProfile((current) => (current ? { ...current, ...patch } : current));

  const save = async () => {
    if (!profile) return;
    await upsertProfile(profile);
    navigate(`/profils/${profile.id}`, { replace: true, state: detailState });
  };




  if (!profile) return null;

  return (
    <div className="min-h-screen bg-paper pb-12 text-foreground">
      <header className="sticky top-0 z-10 border-b border-ink bg-paper/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link to={`/profils/${profile.id}`} state={detailState} replace className="flex h-9 w-9 items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest hover:text-accent md:w-auto">
            <ArrowLeft size={16} />
            <span className="hidden md:inline">{localizeText("Carte")}</span>
          </Link>
          <h1 className="truncate font-display text-xl tracking-wider md:text-2xl">{profile.titre || localizeText("Sans nom")}</h1>
          <div className="flex items-center gap-2">
            <span data-mobile-help className="empty:hidden shrink-0 sm:hidden" /><span aria-hidden="true" className="hidden w-10 shrink-0 sm:block" />

            <button type="button" onClick={save} data-tour="editor-save" aria-label={localizeText("Sauver")} className="flex h-9 w-9 items-center justify-center gap-2 bg-accent text-xs font-bold uppercase tracking-widest text-background hover:opacity-90 md:w-auto md:px-3 md:py-2">
              <Save size={14} />
              <span className="hidden md:inline">{localizeText("Sauver")}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container grid gap-8 pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <CardEditorTabs value={mobileTab} onChange={setMobileTab} />

        <section className={`resource-edit-form ${mobileTab === "edit" ? "block" : "hidden"} space-y-6 lg:block`}>
          <ResourceEditorTour onStart={() => setMobileTab("edit")} />

          <FormSection title={localizeText("Haut de carte")} eyebrow={localizeText("Fond, titre")}>
            <div className="grid gap-5">
              <ImageEditorField aspectRatio={710 / 1005} value={profile.image} editing={profile.imageEditing} onChange={(image, imageEditing) => update({ image, imageEditing })} />
              <TextField label={localizeText("Titre du profil")} value={profile.titre} onChange={(value) => update({ titre: value })} />
              <TextAreaField label={localizeText("Description")} value={profile.description} onChange={(value) => update({ description: value })} rows={3} />
            </div>
          </FormSection>

          <FormSection title={localizeText("Facettes")} eyebrow={localizeText("Forte, neutre, faible")}>
            <div className="grid gap-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <TextField label={localizeText("Nom premiere facette")} value={profile.facetteForteLabel} onChange={(value) => update({ facetteForteLabel: value })} />
                <TextField label={localizeText("Nom deuxieme facette")} value={profile.facetteNeutreLabel} onChange={(value) => update({ facetteNeutreLabel: value })} />
                <TextField label={localizeText("Nom troisieme facette")} value={profile.facetteFaibleLabel} onChange={(value) => update({ facetteFaibleLabel: value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <TextField label={localizeText("Valeur premiere facette")} value={profile.facetteForte} onChange={(value) => update({ facetteForte: value })} inputMode="numeric" />
                <TextField label={localizeText("Valeur deuxieme facette")} value={profile.facetteNeutre} onChange={(value) => update({ facetteNeutre: value })} inputMode="numeric" />
                <TextField label={localizeText("Valeur troisieme facette")} value={profile.facetteFaible} onChange={(value) => update({ facetteFaible: value })} inputMode="numeric" />
              </div>
            </div>
          </FormSection>

          <FormSection title={localizeText("Traits")} eyebrow={localizeText("Bonus et malus")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label={localizeText("Trait +")} value={profile.traitPlus} onChange={(value) => update({ traitPlus: value })} inputMode="numeric" />
              <TextField label={localizeText("Trait -")} value={profile.traitMoins} onChange={(value) => update({ traitMoins: value })} inputMode="numeric" />
            </div>
          </FormSection>

          <FormSection title={localizeText("Bas de carte")} eyebrow={localizeText("Capacites et citation")}>
            <div className="grid gap-5">
              <TextAreaField label={localizeText("Capacites speciales")} value={profile.special} onChange={(value) => update({ special: value })} rows={6} />
              <TextField label={localizeText("Citation")} value={profile.citation} onChange={(value) => update({ citation: value })} />
            </div>
          </FormSection>

          <FormSection title={localizeText("Notes")} eyebrow={localizeText("Privees")}>
            <TextAreaField label={localizeText("Notes privees")} value={profile.notes} onChange={(value) => update({ notes: value })} rows={8} />
          </FormSection>
        </section>

        <aside data-tour="editor-view-tabs" className={`${mobileTab === "card" ? "block" : "hidden"} lg:block lg:self-start`}>
          <div className="lg:fixed lg:right-8 lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:w-[420px] lg:overflow-y-auto 2xl:right-[calc((100vw-1400px)/2+2rem)]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-2xl">{localizeText("Carte")}</h2>

            </div>
            <div className="max-w-full overflow-auto">
              <div className="w-fit overflow-hidden rounded-[18px]">
                <ProfileCard profile={profile} scale={0.52} />
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default ProfileEditor;
