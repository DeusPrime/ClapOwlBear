import { localizeText, localizeNode } from '@/i18n/localize';
import { withExportProgress } from "@/lib/exportProgress";
import DirectoryMenu from "@/components/DirectoryMenu";
import { activeDirectory, selectDirectory } from "@/lib/directories";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Check, Download, Pencil, Plus, Trash2 } from "lucide-react";
import ProfileIcon from "@/components/ProfileIcon";
import RoleTabs from "@/components/RoleTabs";
import { Profile, blankProfile, deleteProfile, loadProfiles, upsertProfile } from "@/lib/profiles";
import { downloadBlob } from "@/lib/characterPng";
import { exportProfilePng } from "@/lib/profilePng";

const safeFileName = (name: string) =>
  (name || "profil")
    .trim()
    .split("")
    .map((char) => (char.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(char) ? "_" : char))
    .join("")
    .replace(/\s+/g, "_") || "profil";

const ProfilesList = () => {
  const [allItems, setProfiles] = useState<Profile[]>([]);
  const [directoryId, setDirectoryId] = useState(activeDirectory);
  const profiles = allItems.filter(item => item.directoryId === directoryId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const navigate = useNavigate();
  const selectionMode = selectedIds.size > 0;

  const refresh = async () => {
    const items = await loadProfiles();
    setProfiles(items.sort((a, b) => b.updatedAt - a.updatedAt));
  };

  useEffect(() => {
    document.title = "Profils — Clap & Role";
    void refresh();
  }, []);

  const createNew = async () => {
    const profile = blankProfile();
    await upsertProfile(profile);
    navigate(`/profils/${profile.id}/edit`);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (profile: Profile) => {
    if (!confirm(localizeText(`Supprimer ${profile.titre || "ce profil"} ?`))) return;
    await deleteProfile(profile.id);
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(profile.id);
      return next;
    });
    void refresh();
  };

  const handleExport = async (profile: Profile) => {
    return withExportProgress(async () => {
      await upsertProfile(profile);
      const blob = await exportProfilePng(profile);
      downloadBlob(blob, `${safeFileName(profile.titre)}.png`);
    });
  };

  return (
    <div className="min-h-screen bg-paper text-foreground">
      <header className="fixed inset-x-0 sm:sticky top-0 z-40 border-b border-ink bg-paper/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <DirectoryMenu value={directoryId} onChange={id => { selectDirectory(id); setDirectoryId(id); setSelectedIds(new Set()); }} />
          <h1 className="font-display text-2xl tracking-wider md:text-3xl">{localizeText("Mes Profils")}</h1>
          <span aria-hidden="true" className="w-10 shrink-0" />
        </div>
      </header>

      <main className="container pt-28 pb-12 sm:pt-12 pb-28 sm:pb-12">

        <RoleTabs />

        {localizeNode(selectionMode && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-2 border-ink bg-paper-dark/70 px-4 py-3 shadow-[4px_4px_0_hsl(var(--ink))]">
            <div className="flex items-center gap-2 typewriter text-sm font-bold uppercase tracking-widest">
              <Check size={16} />
              {localizeNode(selectedIds.size)}{localizeText(" selectionne")}{localizeNode(selectedIds.size > 1 ? "s" : "")}
            </div>
            <button type="button" onClick={() => setSelectedIds(new Set())} className="border-2 border-ink px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-ink hover:text-background">{localizeText(" Annuler ")}</button>
          </div>
        ))}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => {
            const selected = selectedIds.has(profile.id);
            return (
              <article key={profile.id} className={`paper-card relative flex flex-col overflow-hidden transition-transform ${selectionMode ? "tile-wiggle" : ""} ${selected ? "ring-4 ring-accent" : ""}`}>
                <button
                  type="button"
                  onClick={() => (selectionMode ? toggleSelected(profile.id) : navigate(`/profils/${profile.id}`))}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    toggleSelected(profile.id);
                  }}
                  className="relative block aspect-[3/4] w-full overflow-hidden bg-paper-dark text-left"
                  aria-pressed={selected}
                >
                  {profile.image ? (
                    <img src={profile.image} alt={localizeText(profile.titre)} className="absolute inset-0 h-full w-full origin-top -translate-y-[3%] scale-110 object-cover object-top" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ProfileIcon size={96} className="opacity-30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 pb-14 text-white">
                    <h3 className="font-display text-2xl leading-tight">{profile.titre || localizeText("Sans nom")}</h3>
                    {profile.description && <p className="mt-1 line-clamp-2 typewriter text-xs opacity-80">{profile.description}</p>}
                  </div>
                  {localizeNode(selectionMode && (
                    <span className={`absolute right-14 top-3 flex h-9 w-9 items-center justify-center border-2 border-ink bg-paper text-foreground shadow-[2px_2px_0_hsl(var(--ink))] ${selected ? "bg-accent text-background" : ""}`} aria-hidden="true">
                      {localizeNode(selected && <Check size={18} strokeWidth={3} />)}
                    </span>
                  ))}
                </button>
                <div className="absolute right-2 top-2 z-[3] sm:right-3 sm:top-3">
                  <button type="button" onClick={() => void handleDelete(profile)} aria-label={localizeText("Supprimer")} title={localizeText("Supprimer")} className="flex h-9 w-9 items-center justify-center rounded-md border border-white/20 bg-black/35 text-white/85 shadow-[2px_2px_0_rgba(0,0,0,0.3)] backdrop-blur transition-colors hover:border-destructive hover:bg-destructive hover:text-destructive-foreground">
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="absolute bottom-2 right-2 z-[2] flex items-center gap-1.5 sm:bottom-3 sm:right-3">
                  <button type="button" onClick={() => navigate(`/profils/${profile.id}/edit`)} aria-label={localizeText("Modifier")} title={localizeText("Modifier")} className="flex h-9 w-9 items-center justify-center rounded-md border border-white/25 bg-black/45 text-white shadow-[2px_2px_0_rgba(0,0,0,0.35)] backdrop-blur transition-colors hover:bg-paper hover:text-foreground">
                    <Pencil size={15} />
                  </button>
                  <button type="button" onClick={() => void handleExport(profile)} aria-label={localizeText("Exporter PNG")} title={localizeText("Exporter PNG")} className="flex h-9 w-9 items-center justify-center rounded-md border border-white/25 bg-black/45 text-white shadow-[2px_2px_0_rgba(0,0,0,0.35)] backdrop-blur transition-colors hover:bg-paper hover:text-foreground">
                    <Download size={15} />
                  </button>
                </div>
              </article>
            );
          })}

          <article className="paper-card flex flex-col overflow-hidden">
            <button type="button" onClick={createNew} className="relative flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 overflow-hidden border-2 border-dashed border-ink/40 bg-paper-dark/30 transition-colors hover:border-accent hover:bg-accent/5">
              <ProfileIcon size={54} className="opacity-60" />
              <div className="typewriter text-xs font-bold uppercase tracking-widest">{localizeText("Nouveau profil")}</div>
            </button>
            <div className="border-t border-ink/20 p-3">
              <button type="button" onClick={createNew} className="flex w-full items-center justify-center gap-2 bg-accent px-3 py-2 text-xs font-bold uppercase tracking-widest text-background hover:opacity-90">
                <Plus size={14} />{localizeText(" Nouveau profil ")}</button>
            </div>
          </article>
        </div>

        {localizeNode(profiles.length === 0 && (
          <div className="mt-8 flex items-center gap-3 border-2 border-dashed border-ink/30 p-4 typewriter text-sm text-foreground/65">
            <ProfileIcon size={18} />{localizeText(" Aucun profil pour l'instant. ")}</div>
        ))}
      </main>
    </div>
  );
};

export default ProfilesList;
