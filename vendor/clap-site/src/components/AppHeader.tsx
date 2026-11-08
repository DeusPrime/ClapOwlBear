import { localizeText } from '@/i18n/localize';
import { useEffect, useState, type ReactNode } from "react";
import GlobalSearch from './GlobalSearch';
import DirectoryMenu from "@/components/DirectoryMenu";
import { activeDirectory, selectDirectory, DIRECTORY_SELECTED } from "@/lib/directories";

export default function AppHeader({ title, directoryId: selectedDirectory, onDirectoryChange, actions }: { title: string; directoryId?: string; onDirectoryChange?: (id: string) => void; actions?: ReactNode }) {
  const [localDirectory, setDirectoryId] = useState(activeDirectory);
  const directoryId = selectedDirectory ?? localDirectory;
  useEffect(() => {
    const refresh = () => setDirectoryId(activeDirectory());
    window.addEventListener(DIRECTORY_SELECTED, refresh);
    return () => window.removeEventListener(DIRECTORY_SELECTED, refresh);
  }, []);

  return (
    <header aria-label={localizeText(title)} className="fixed inset-x-0 sm:sticky top-0 z-40 border-b border-ink bg-paper/95 backdrop-blur">
      <div className={`container relative grid h-16 ${actions ? 'grid-cols-[2.5rem_minmax(0,1fr)_auto]' : 'grid-cols-[2.5rem_minmax(0,1fr)]'} items-center gap-3`}>
        <DirectoryMenu value={directoryId} onChange={id => { selectDirectory(id); setDirectoryId(id); onDirectoryChange?.(id); }} />
        <GlobalSearch title={localizeText(title)} />
        {actions}
      </div>
    </header>
  );
}
