import { useRef, useState } from 'react';
import { GripVertical, LockKeyhole, Trash2 } from 'lucide-react';
import type { BookSection } from '@/lib/filmBooks';

export default function FilmSectionList({ sections, select, remove, move }: { sections: BookSection[]; select: (id: string) => void; remove: (id: string) => void; move: (source: string, target: string) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: string; target: string; y: number; active: boolean } | null>(null);
  const [dragged, setDragged] = useState(''), [over, setOver] = useState('');
  const movable = sections.filter(section => !section.kind);
  function finish() {
    const current = gesture.current;
    if (current?.active && current.target) move(current.id, current.target);
    gesture.current = null; setDragged(''); setOver('');
  }
  return <div ref={root} className="space-y-3">
    <p className="text-sm text-muted-foreground">Glissez la poignée pour réordonner les sections. Les sections techniques restent fixes.</p>
    {sections.map(section => <div key={section.id} data-section-id={section.id} className={`flex items-center gap-2 rounded border p-3 ${over === section.id && dragged !== section.id ? 'border-accent ring-2 ring-accent/30' : 'border-ink/20'} ${dragged === section.id ? 'opacity-50' : ''}`}>
      {section.kind ? <LockKeyhole size={18} aria-label="Section technique fixe" className="shrink-0 text-muted-foreground" /> : <button type="button" aria-label={`Déplacer la section ${section.name}`} title="Glisser pour déplacer ; flèches pour réordonner" className="flex h-11 w-11 shrink-0 touch-none cursor-grab items-center justify-center rounded hover:bg-ink/10 active:cursor-grabbing"
        onPointerDown={event => { if(event.button !== 0)return;event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); gesture.current = { id: section.id, target: '', y: event.clientY, active: false }; }}
        onPointerMove={event => {
          const current = gesture.current; if (!current || current.id !== section.id) return;
          if (!current.active && Math.abs(event.clientY - current.y) < 5) return;
          current.active = true; setDragged(current.id);
          const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-section-id]');
          const target = row && root.current?.contains(row) ? sections.find(item => item.id === row.dataset.sectionId && !item.kind) : undefined;
          current.target = target?.id ?? ''; setOver(current.target);
          const panel = root.current?.closest<HTMLElement>('[role="dialog"]');
          if(panel){const bounds=panel.getBoundingClientRect();if(event.clientY>bounds.bottom-45)panel.scrollBy(0,15);else if(event.clientY<bounds.top+45)panel.scrollBy(0,-15);}
        }}
        onPointerUp={finish} onPointerCancel={() => { gesture.current = null; setDragged(''); setOver(''); }}
        onKeyDown={event => { if(event.key!=='ArrowUp'&&event.key!=='ArrowDown')return;event.preventDefault();const index=movable.findIndex(item=>item.id===section.id);const target=movable[index+(event.key==='ArrowUp'?-1:1)];if(target)move(section.id,target.id); }}><GripVertical size={20} /></button>}
      <button type="button" className="min-h-11 min-w-0 flex-1 text-left font-semibold" onClick={() => select(section.id)}>{section.name}<span className="block text-xs font-normal text-muted-foreground">{section.pages.length} page(s){section.kind ? ' · Pages permanentes' : ''}</span></button>
      {!section.kind && movable.length > 1 && <button type="button" aria-label={`Supprimer la section ${section.name}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded text-destructive hover:bg-destructive/10" onClick={() => remove(section.id)}><Trash2 size={18} /></button>}
    </div>)}
  </div>;
}
