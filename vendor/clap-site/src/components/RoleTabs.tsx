import PlayingCardsIcon from "@/components/PlayingCardsIcon";
import { localizeText, localizeNode } from '@/i18n/localize';
import { useEffect, useState } from "react";
import { activeDirectory, directoryName, DIRECTORY_SELECTED } from "@/lib/directories";
import { Link, useLocation, NavLink } from "react-router-dom";
import { ArrowLeft, UserCircle, Wrench, LayoutDashboard, Users, Clapperboard } from "lucide-react";

const mainTabs = [
  { to: "/app/studio", label: "Studio", icon: LayoutDashboard },
  { to: "/app/salle", label: "Salles", icon: Users },
];
const projectTabs = [
  { to: "/characters", label: "Héros", icon: UserCircle },
  { to: "/ressources", label: "Cartes", icon: PlayingCardsIcon },
  { to: "/outils", label: "Ressources", icon: Wrench },
  { to: "/film", label: "Film", icon: Clapperboard },
];

const RoleTabs = () => {
  const { pathname } = useLocation();
  const [directory, setDirectory] = useState(activeDirectory);
  useEffect(() => {
    const refresh = () => setDirectory(activeDirectory());
    window.addEventListener(DIRECTORY_SELECTED, refresh);
    return () => window.removeEventListener(DIRECTORY_SELECTED, refresh);
  }, []);
  const projectView = projectTabs.some(tab => pathname === tab.to || pathname.startsWith(`${tab.to}/`)) || /^\/(key-roles|figurants|profils|pouvoirs|vehicules)(\/|$)/.test(pathname);
  const tabs = projectView ? projectTabs : mainTabs;
  return <>
    {localizeNode(projectView && <div className="mb-5 hidden min-w-0 flex-wrap items-center gap-x-5 gap-y-2 sm:flex"><Link to="/app/studio" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold hover:text-accent"><ArrowLeft size={18} />{localizeText("Studio")}</Link><span className="break-words font-display text-2xl">{localizeNode(directoryName(directory))}</span></div>)}
  <nav data-tour="app-navigation" aria-label={localizeText(projectView ? "Navigation du projet" : "Navigation de l'application")} className={`fixed inset-x-0 bottom-0 z-40 grid ${projectView ? "grid-cols-4" : "grid-cols-2"} gap-2 border-t-2 border-ink bg-paper/95 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-[0_-4px_18px_hsl(0_0%_0%_/_0.18)] backdrop-blur sm:static sm:mb-8 sm:flex sm:w-fit sm:gap-2 sm:border-t-0 sm:border-b-2 sm:bg-transparent sm:p-0 sm:pb-2 sm:shadow-none sm:backdrop-blur-none`}>
    {tabs.map((tab) => {
      const Icon = tab.icon;
      return (
        <NavLink
          key={tab.to}
          to={tab.to}
          aria-label={localizeText(tab.label)}
          title={localizeText(tab.label)}
          className={({ isActive }) =>
            `flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 sm:flex-row sm:gap-2 border-2 px-1 sm:px-3 py-2 text-center typewriter text-xs font-bold uppercase leading-none tracking-widest transition-colors sm:min-h-11 sm:px-4 ${
              isActive
                ? "border-accent bg-accent text-background shadow-[3px_3px_0_hsl(var(--ink))]"
                : "border-ink/30 hover:border-ink hover:bg-ink hover:text-background"
            }`
          }
        >
          <>
              <Icon size={18} className="sm:h-4 sm:w-4" />
              <span className="block text-center text-[10px] tracking-normal sm:text-xs sm:tracking-widest">{localizeNode(tab.label)}</span>
          </>
        </NavLink>
      );
    })}
  </nav>
</>;
};

export default RoleTabs;
