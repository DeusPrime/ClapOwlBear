import useScrollList from "@/hooks/use-scroll-list";
import { ListLoading } from "@/components/ListLoading";
import ApplicationTour from "@/components/ApplicationTour";
import { localizeText, localizeNode, getLanguage } from '@/i18n/localize';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Clapperboard, Film } from 'lucide-react';
import '@/styles/studio.css';
import defaultProjectPoster from '@/assets/project-poster-default.webp';
import DirectoryPicker from '@/components/DirectoryPicker';
import ProjectTileMenu from '@/components/ProjectTileMenu';
import ProjectImportButton from '@/components/ProjectImportButton';
import AppHeader from '@/components/AppHeader';
import RoleTabs from '@/components/RoleTabs';
import { activeDirectory, loadDirectories, selectDirectory, DIRECTORY_BACK_CHANGED, DIRECTORY_POSTER_CHANGED } from '@/lib/directories';
import { loadStudioOverview, type StudioItem } from '@/lib/studioSearch';
import { formatStudioBytes } from '@/lib/studioProjectSize';

export default function Dashboard() {
  const navigate = useNavigate();
  const [directory, setDirectory] = useState(activeDirectory);
  const [items, setItems] = useState<StudioItem[]>([]);
  const [projects, setProjects] = useState(loadDirectories);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const [revision, setRevision] = useState(0);
  const projectChanged = useCallback((id?: string) => {
    if (id) { selectDirectory(id); setDirectory(id); }
    setProjects(loadDirectories()); setRevision(value => value + 1);
  }, []);
  useEffect(() => {
    let active = true;
    let controller: AbortController | undefined;
    async function refresh() {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      setProjects(loadDirectories());
      try {
        const overview = await loadStudioOverview(true, request.signal);
        if (!active || request.signal.aborted) return;
        setItems(overview.items);
        setSizes(overview.sizes);
        setError('');
      } catch {
        if (!active || request.signal.aborted) return;
        setSizes({});
        setError('Les créations locales sont indisponibles. Réessaie en rechargeant la page.');
      }
      setLoading(false);
    }
    void refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener(DIRECTORY_BACK_CHANGED, refresh);
    window.addEventListener(DIRECTORY_POSTER_CHANGED, refresh);
    return () => {
      active = false;
      controller?.abort();
      window.removeEventListener('focus', refresh);
      window.removeEventListener(DIRECTORY_BACK_CHANGED, refresh);
      window.removeEventListener(DIRECTORY_POSTER_CHANGED, refresh);
    };
  }, [revision]);
  const list = useScrollList(projects, "projects");
  return <div className="studio-page min-h-screen bg-paper text-foreground">
    <AppHeader title={localizeText("Mon studio")} directoryId={directory} onDirectoryChange={setDirectory} />
    <main className="container space-y-5 pt-24 pb-32 sm:pt-8">
      <RoleTabs />
      <ApplicationTour view="projects" />
      {localizeNode(error && <p role="alert" className="rounded-lg border border-destructive p-4 text-destructive">{localizeNode(error)}</p>)}
      <section aria-labelledby="studio-projects" className="space-y-4">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-5"><div><p className="typewriter text-xs uppercase tracking-widest text-accent">{localizeText("Toutes tes histoires commencent ici")}</p><h1 id="studio-projects" className="mt-2 hidden items-center gap-3 font-display text-4xl uppercase sm:flex sm:text-5xl"><Clapperboard size={32} />{localizeText("Mes projets")}</h1><p className="mt-3 max-w-2xl text-muted-foreground">{localizeText("Retrouve tes créations ou crée un nouveau projet pour préparer ta prochaine partie.")}</p></div><DirectoryPicker createOnly value={directory} onChange={id => { selectDirectory(id); setDirectory(id); setProjects(loadDirectories()); setRevision(value => value + 1); }} /></header>
        <ProjectImportButton onImported={() => { setDirectory(activeDirectory()); setRevision(value => value + 1); }}>
        <ListLoading loading={loading} />
        <div style={{ scrollMarginTop: 80 }} ref={list.gridRef} aria-busy={loading || list.pending} className="studio-project-grid">{list.items.map((project, index) => {
          const creations = items.filter(item => item.directoryId === project.id).sort((a, b) => b.updatedAt - a.updatedAt);
          const poster = project.posterImage || defaultProjectPoster;
          const selected = project.id === directory;
          const kinds = [...new Set(creations.map(item => item.kind))];
          return <div key={project.id} className="studio-project-tile"><button type="button" onClick={() => { selectDirectory(project.id); setDirectory(project.id); navigate("/characters"); }} className="studio-poster" aria-label={localizeText(`Ouvrir le projet ${project.name}`)}>
            <span className={`studio-poster-art studio-poster-tone-${index % 3}`}>
              {localizeNode(poster && <img src={poster} alt="" loading="lazy" />)}
              <span className="studio-poster-shade" />
              <span className="studio-poster-top"><span>{localizeText("Une production Clap & Role")}</span><Film size={18} aria-hidden="true" /></span>
              {localizeNode(!poster && <Clapperboard className="studio-poster-symbol" size={88} strokeWidth={.8} aria-hidden="true" />)}
              <span className="studio-poster-title"><span className="studio-eyebrow">{localizeText("Projet ")}{localizeNode(String(index + 1).padStart(2, '0'))}</span><strong>{localizeNode(project.backFilmTitle || project.name)}</strong><span>{localizeNode(kinds.length ? kinds.join(' · ') : 'L’histoire reste à écrire')}</span></span>
            </span>
            <span className="studio-poster-info"><span className="flex items-center justify-between gap-2"><strong className="truncate">{localizeNode(project.name)}</strong>{localizeNode(selected && <span className="studio-selected"><Check size={13} aria-hidden="true" />{localizeText(" Actif")}</span>)}</span><span>{localizeNode(loading ? 'Chargement…' : creations.length + (getLanguage() === 'en' ? ' creation' : ' création') + (creations.length === 1 ? '' : 's'))}</span><span className="studio-poster-date">{localizeNode(creations.length ? (getLanguage() === 'en' ? 'Updated ' : 'Modifié le ') + new Date(creations[0].updatedAt).toLocaleDateString(getLanguage() === 'en' ? 'en-GB' : 'fr-FR') : 'Prêt pour le premier clap')}</span></span>
            <span className="block px-5 pb-4 text-xs text-muted-foreground" title={getLanguage() === 'en' ? 'Project data before compression, including images. The download may be smaller.' : 'Données du projet avant compression, images comprises. Le fichier téléchargé peut être plus petit.'}>
              {getLanguage() === 'en' ? 'Size on disk: ' : 'Poids sur le disque : '}{sizes[project.id] === undefined ? '…' : formatStudioBytes(sizes[project.id], getLanguage())}
            </span>
          </button><ProjectTileMenu project={project} onChange={projectChanged} /></div>;
        })}</div>
        </ProjectImportButton>
        <div ref={list.endRef} className="min-h-1"><ListLoading loading={list.pending} /></div>
      </section>
    </main>
  </div>;
}
