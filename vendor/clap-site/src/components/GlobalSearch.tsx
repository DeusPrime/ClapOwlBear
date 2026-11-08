import { localizeText, localizeNode } from '@/i18n/localize';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { flushSync } from 'react-dom';
import { loadStudioItems, searchStudio, type StudioItem } from '@/lib/studioSearch';
import { directoryName, selectDirectory } from '@/lib/directories';

export default function GlobalSearch({ title }: { title: string }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [query, setQuery] = useState<string>(location.state?.globalSearch || '');
  const [items, setItems] = useState<StudioItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => { setQuery(location.state?.globalSearch || ''); setOpen(false); setMobileExpanded(false); }, [location.key, location.state]);
  const closeMobile = () => {
    flushSync(() => { setMobileExpanded(false); setOpen(false); });
    trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true); setError('');
    void loadStudioItems().then(value => { if (active) setItems(value); }).catch(() => {
      if (active) setError('Recherche indisponible. Ferme puis rouvre le champ pour réessayer.');
    }).finally(() => { if (active) setLoading(false); });
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => { active = false; document.removeEventListener('pointerdown', outside); };
  }, [open]);
  const ready = query.trim().length >= 3;
  const results = ready ? searchStudio(items, query) : [];
  const returnState = { ...location.state, globalSearch: query };
  return <div ref={root} className={`${mobileExpanded ? "absolute inset-x-0 top-0 z-10 bg-paper px-4 py-2 sm:relative sm:inset-auto sm:bg-transparent sm:p-0" : "relative"} min-w-0 w-full ${mobileExpanded ? "sm:max-w-2xl" : "max-w-2xl"} justify-self-center`} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (mobileExpanded) closeMobile(); else { input.current?.focus(); setOpen(false); } }
    if (event.key === 'ArrowDown' && event.target === input.current && ready) { event.preventDefault(); root.current?.querySelector<HTMLAnchorElement>('li a')?.focus(); }
  }}>
    <div className={`${mobileExpanded ? 'hidden' : 'flex'} min-w-0 items-center gap-3 sm:hidden`}>
      <span className="min-w-0 flex-1 truncate text-center font-display text-2xl tracking-wider">{localizeNode(title)}</span>
      <span data-mobile-help className="empty:hidden shrink-0 sm:hidden" />
      <button data-tour="application-search" ref={trigger} type="button" aria-label={localizeText("Ouvrir la recherche")} aria-expanded={mobileExpanded} className="flex h-11 w-10 shrink-0 items-center justify-center rounded-md hover:bg-ink/5" onClick={() => { flushSync(() => setMobileExpanded(true)); input.current?.focus(); setOpen(true); }}><Search size={22} /></button>
    </div>
    <div className={`${mobileExpanded ? 'flex' : 'hidden'} min-w-0 items-center gap-2 sm:flex`}>
    <label data-tour="application-search" className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-ink/20 bg-background/60 px-3">
      <Search size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      <input ref={input} type="search" aria-label={localizeText("Rechercher dans mes projets")} placeholder={localizeText("Rechercher dans mes projets…")} value={query} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setOpen(true); }} aria-expanded={open} aria-controls={open ? id : undefined} className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" />
      {localizeNode(query && <button type="button" aria-label={localizeText("Effacer la recherche")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-ink/5" onClick={() => { setQuery(''); input.current?.focus(); }}><X size={16} /></button>)}
    </label>
      <button type="button" aria-label={localizeText("Fermer la recherche")} className="flex h-11 w-10 shrink-0 items-center justify-center rounded-md hover:bg-ink/5 sm:hidden" onClick={closeMobile}><X size={20} /></button>
    </div>
    {open && <div id={id} role="region" aria-label={localizeText("Résultats de recherche")} className="absolute inset-x-0 top-full z-50 mt-2 rounded-lg border border-ink/20 bg-paper p-3 shadow-xl">
      <p role="status" className="px-2 py-2 text-sm text-muted-foreground">{localizeNode(!ready ? 'Saisis au moins 3 caractères.' : error || (loading ? 'Recherche…' : results.length ? `${results.length} résultat(s)${results.length > 8 ? ' · les 8 premiers sont affichés' : ''}` : 'Aucun résultat.'))}</p>
      {ready && !loading && !error && <ul className="max-h-[min(50dvh,24rem)] space-y-1 overflow-y-auto">{results.slice(0, 8).map(item => <li key={`${item.kind}:${item.id}`}><Link to={item.url} state={{ returnTo: location.pathname + location.search + location.hash, returnState }} onClick={() => { selectDirectory(item.directoryId); setOpen(false); }} className="block rounded-md px-3 py-3 hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"><span className="block break-words font-bold">{localizeNode(item.title)}</span><span className="mt-1 block text-xs text-muted-foreground">{localizeNode(item.kind)} · {localizeNode(directoryName(item.directoryId))}</span></Link></li>)}</ul>}
    </div>}
  </div>;
}
