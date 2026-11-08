import { Pencil } from 'lucide-react';
import PlayingCardsIcon from './PlayingCardsIcon';
import { localizeText } from '@/i18n/localize';

export default function CardEditorTabs({ value, onChange }: { value: 'edit' | 'card'; onChange: (value: 'edit' | 'card') => void }) {
  return <nav data-tour="editor-view-tabs" aria-label={localizeText('Vues de la carte')} className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 gap-2 border-t-2 border-ink bg-paper/95 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-[0_-4px_18px_hsl(0_0%_0%_/_0.18)] backdrop-blur lg:hidden">
    {([{ id: 'edit', label: 'Édition', Icon: Pencil }, { id: 'card', label: 'Carte', Icon: PlayingCardsIcon }] as const).map(({ id, label, Icon }) => <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 border-2 px-1 py-2 text-center typewriter text-xs font-bold uppercase leading-none tracking-widest transition-colors sm:min-h-11 sm:flex-row sm:gap-2 sm:px-4 ${value === id ? 'border-accent bg-accent text-background shadow-[3px_3px_0_hsl(var(--ink))]' : 'border-ink/30 hover:border-ink hover:bg-ink hover:text-background'}`}>
      <Icon size={18} className="sm:h-4 sm:w-4" aria-hidden="true" />
      <span className="block text-center text-[10px] tracking-normal sm:text-xs sm:tracking-widest">{localizeText(label)}</span>
    </button>)}
  </nav>;
}
