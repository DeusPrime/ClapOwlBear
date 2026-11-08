import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { CircleHelp, X } from 'lucide-react';
import { getLanguage } from '@/i18n/localize';

type Page = 'resources' | 'heroes' | 'tools' | 'resource-detail' | 'hero-detail' | 'tool-detail' | 'resource-edit' | 'hero-edit' | 'hero-resources' | 'projects' | 'rooms' | 'room-mj' | 'room-player';
export type TourStep = { target: string; title: string; body: string; tryAction?: boolean; heroTab?: 'attributes' | 'state'; placement?: 'bottom'; highlight?: string; highlightShape?: 'circle' };

export function tourPlacement(viewportHeight: number, panelHeight: number, target: Pick<DOMRect, 'top' | 'bottom'> | null) {
  const margin = 16;
  const height = Math.min(panelHeight, viewportHeight - margin * 2);
  const centeredTop = Math.max(margin, (viewportHeight - height) / 2);
  if (!target || centeredTop + height < target.top - margin || centeredTop > target.bottom + margin) {
    return { top: centeredTop, maxHeight: viewportHeight - margin * 2 };
  }
  const above = Math.max(0, target.top - margin * 2);
  const below = Math.max(0, viewportHeight - target.bottom - margin * 2);
  if (below >= height) return { top: target.bottom + margin, maxHeight: below };
  if (above >= height) return { top: target.top - margin - height, maxHeight: above };
  // Keep the whole explanation readable before trying to avoid the spotlight.
  // Overlap is preferable to scrolling when the panel fits in the viewport.
  return { top: centeredTop, maxHeight: viewportHeight - margin * 2 };
}

export function mobileTourPlacement(viewportHeight: number, panelHeight: number, side: 'top' | 'bottom', target: Pick<DOMRect, 'top' | 'bottom'> | null) {
  const margin = 16;
  const available = target && target.bottom > 0 && target.top < viewportHeight
    ? (side === 'top' ? target.top - margin * 2 : viewportHeight - target.bottom - margin * 2)
    : viewportHeight / 2;
  // A large section may fill the viewport: keep the navigation usable while
  // showing the part of the section outside the explanation.
  const maxHeight = Math.min(viewportHeight / 2, Math.max(Math.min(200, viewportHeight / 2), available));
  const height = Math.min(panelHeight, maxHeight);
  return { top: side === 'top' ? margin : viewportHeight - margin - height, maxHeight };
}

export default function PageTour({ page, customSteps, tutorialId, onStart, onHeroTabChange, introTitle, introBody }: { page: Page; customSteps?: TourStep[]; tutorialId?: string; onStart?: () => void; onHeroTabChange?: (tab: 'attributes' | 'state') => void; introTitle?: string; introBody?: string }) {
  const en = getLanguage() === 'en';
  const tr = (fr: string, english: string) => en ? english : fr;
  const key = `clap-tour-v1:${tutorialId ?? page}`;
  const [open, setOpen] = useState(false);
  const [disabled, setDisabled] = useState(() => {
    try { return localStorage.getItem('clap-tours-disabled') === 'true'; } catch { return false; }
  });
  const [index, setIndex] = useState(-1);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [highlights, setHighlights] = useState<DOMRect[]>([]);
  const maskId = `tour-mask-${key.replace(/[^a-z0-9-]/gi, "-")}`;
  const help = useRef<HTMLButtonElement>(null);
  const mobileHelp = useRef<HTMLButtonElement>(null);
  const [helpSlot, setHelpSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const update = () => setHelpSlot(document.querySelector<HTMLElement>('[data-mobile-help]'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const footer = useRef<HTMLDivElement>(null);
  const [mobileSide, setMobileSide] = useState<'top' | 'bottom'>('bottom');
  const [mobile, setMobile] = useState(() => window.innerWidth < 640);
  const [panelHeight, setPanelHeight] = useState(280);
  const [viewport, setViewport] = useState(() => ({ height: window.innerHeight, offset: 0 }));
  const steps: TourStep[] = customSteps ?? (page === 'hero-resources' ? [
    { target: 'hero-link-resource', title: tr('Lier une carte', 'Link a card'), body: tr('Le sélecteur permet d’ajouter une carte existante à ce héros. Choisis les cartes dont il dispose : pouvoirs, véhicules, profils, figurants ou rôles clés.', 'Use the picker to add an existing card to this hero. Choose the powers, vehicles, profiles, extras or key roles available to them.') },
    { target: 'hero-unlink-resource', title: tr('Délier une carte', 'Unlink a card'), body: tr('Le bouton Délier sous une carte retire son lien avec ce héros. La carte reste disponible dans le projet. Si aucune carte n’est liée, commence par en ajouter une avec le sélecteur.', 'The Unlink button below a card removes its link to this hero. The card remains in the project. If there are no linked cards, add one using the picker first.') },
    { target: 'hero-linked-resource', title: tr('Ouvrir et utiliser', 'Open and use'), body: tr('Clique sur une carte liée pour ouvrir son détail. Les pouvoirs actifs et les véhicules proposent aussi un bouton Utiliser pour préparer un jet avec ce héros.', 'Click a linked card to open its detail. Active powers and vehicles also offer a Use button to prepare a roll with this hero.') },
  ] : page === 'hero-edit' ? [
    { target: 'hero-tabs', title: tr('Les rubriques du héros', 'Hero sections'), body: tr('Choisis une rubrique pour modifier l’identité, les attributs, les traits ou les notes. Sur mobile, la navigation est en bas de l’écran.', 'Choose a section to edit identity, attributes, traits or notes. On mobile, navigation is at the bottom of the screen.') },
    { target: '.character-editor-edit-main .room-player-sheet', title: tr('Renseigner la fiche', 'Fill in the sheet'), body: tr('Modifie les champs de la rubrique choisie. Les listes permettent d’ajouter les équipements et les textes enrichis de mettre en forme tes descriptions. La rubrique Cartes sert à gérer les cartes liées au héros.', 'Edit fields in the selected section. Lists let you add equipment and rich text lets you format descriptions. The Cards section manages cards linked to the hero.') },
    { target: 'hero-actions', title: tr('Sauvegarder les changements', 'Save changes'), body: tr('Utilise Sauvegarder en haut de la page pour conserver tes modifications et revenir au mode jeu.', 'Use Save at the top of the page to keep your changes and return to play mode.') },
  ] : page === 'resource-detail' ? [
    { target: 'detail-actions', title: tr('Modifier et exporter', 'Edit and export'), body: tr('Le menu ⋮ regroupe la modification de la carte et les exports PNG et PDF.', 'The ⋮ menu contains editing and PNG/PDF exports.') },
    { target: 'detail-card', title: tr('Retourner la carte', 'Flip the card'), body: tr('Glisse à gauche ou à droite sur la carte pour afficher son verso. Les valeurs utilisables pour un jet sont cliquables.', 'Swipe left or right on the card to see its back. Values available for a roll are clickable.') },
  ] : page === 'hero-detail' ? [
    { target: 'hero-actions', title: tr('Modifier et exporter le héros', 'Edit and export your hero'), body: tr('Le menu ⋮ permet de passer en édition et d’exporter la fiche en PNG ou PDF A6. En édition, utilise Sauvegarder pour conserver tes changements.', 'Use the ⋮ menu to edit or export the sheet as PNG or A6 PDF. In edit mode, use Save to keep your changes.') },
    { target: 'hero-tabs', title: tr('Explorer la fiche', 'Explore the sheet'), body: tr('Les onglets donnent accès aux différentes parties de la fiche. Sur mobile, utilise la navigation en bas de l’écran.', 'Tabs open the different parts of the sheet. On mobile, use the navigation at the bottom of the screen.') },
    { target: '.hero-attributes-card .hero-card-mini-reels', heroTab: 'attributes', placement: 'bottom', highlight: '.hero-attributes-card .hero-mini-reel-value:not(.is-disabled)', highlightShape: 'circle', title: tr('Jouer avec le héros', 'Play your hero'), body: tr('En mode jeu, clique sur les valeurs de la fiche pour préparer un jet. Retrouve aussi les cartes liées au héros dans ses onglets.', 'In play mode, click sheet values to prepare a roll. Linked cards are available in the hero’s tabs.') },
    { target: '.hero-state-card .hero-card-injury-grid', heroTab: 'state', placement: 'bottom', highlight: '.hero-state-card .hero-card-checkbox, .hero-state-card .hero-card-critical-summary-box', title: tr('Gérer les blessures', 'Manage injuries'), body: tr('Dans l’onglet Constantes, clique sur les cases de blessure de chaque localisation pour ajuster leur niveau. Tu peux aussi y suivre le stress et les chagrins. Les pénalités correspondantes sont prises en compte dans les jets du héros.', 'In the Vitals tab, click the injury boxes for each body location to adjust their level. You can also track stress and grief there. The corresponding penalties are included in the hero’s rolls.') },
  ] : page === 'tool-detail' ? [
    { target: '#tool-editor-header', title: tr('Enregistrer ta ressource', 'Save your resource'), body: tr('La barre du haut permet de nommer et sauvegarder ta création dans ce projet, puis de revenir à tes ressources.', 'The top bar lets you name and save your creation in this project, then return to your resources.') },
    { target: 'tool-import', title: tr('Ajouter des images', 'Add images'), body: tr('Importe tes images ici pour commencer. Les réglages de cette page permettent ensuite d’adapter leur présentation.', 'Import images here to get started. Use this page’s settings to adjust their presentation.') },
    { target: 'tool-export', title: tr('Exporter le résultat', 'Export the result'), body: tr('Une fois les images et les réglages prêts, utilise les boutons d’export. Les formats proposés dépendent de la ressource.', 'When your images and settings are ready, use the export buttons. Available formats depend on the resource.') },
  ] : [
    { target: 'create', title: tr('Créer ou importer', 'Create or import'), body: page === 'tools'
      ? tr('Choisis une ressource : planche A4, couverture ou conversion d’image. Sur mobile, ouvre le bouton +.', 'Choose a resource: A4 sheet, cover or image conversion. On mobile, open the + button.')
      : page === 'heroes'
        ? tr('Le bouton Ajouter (ou + sur mobile) permet de créer un héros ou d’importer une fiche.', 'Use Add (+ on mobile) to create a hero or import a sheet.')
        : tr('Le bouton Ajouter (ou + sur mobile) permet de choisir un type de carte ou d’importer un fichier.', 'Use Add (+ on mobile) to choose a card type or import a file.') },
    { target: 'search', title: tr('Retrouver une création', 'Find your creations'), body: tr('Saisis quelques mots ici pour réduire la liste affichée.', 'Type a few words here to narrow down the list.') },
    ...(page === 'resources' ? [
      { target: 'filter', title: tr('Filtrer les types', 'Filter by type'), body: tr('Choisis un ou plusieurs types. « Tous les types » réinitialise le filtre.', 'Choose one or more types. “All types” resets the filter.') },
      { target: 'card', title: tr('Manipuler les cartes', 'Use your cards'), body: tr('Clique pour ouvrir une fiche. Glisse à gauche ou à droite pour retourner une carte. Un appui long active la sélection pour les actions groupées.', 'Click to open a sheet. Swipe left or right to flip a card. Long press to select cards for bulk actions.') },
    ] : [{ target: '', title: tr('Retrouver et utiliser', 'Open and use'), body: page === 'heroes'
      ? tr('Ouvre un héros pour modifier sa fiche et l’exporter. Un appui long sur une carte permet de sélectionner plusieurs héros.', 'Open a hero to edit and export the sheet. Long press a card to select several heroes.')
      : tr('Tes créations restent dans la liste de ce projet. Ouvre une vignette pour reprendre une ressource et exporter le résultat.', 'Your creations stay in this project’s list. Open a thumbnail to continue editing and export the result.') }]),
  ]);
  const step = steps[index];
  useLayoutEffect(() => {
    if (open && step?.heroTab) onHeroTabChange?.(step.heroTab);
  }, [open, index, step?.heroTab, onHeroTabChange]);

  useLayoutEffect(() => {
    if (!open || !panel.current) return;
    const element = panel.current;
    const measure = () => setPanelHeight((body.current?.scrollHeight ?? 0) + (footer.current?.offsetHeight ?? 0) + 4);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (body.current) observer.observe(body.current);
    if (footer.current) observer.observe(footer.current);
    return () => observer.disconnect();
  }, [open, index]);

  useEffect(() => {
    const update = () => { setMobile(window.innerWidth < 640); setViewport({ height: window.visualViewport?.height ?? window.innerHeight, offset: window.visualViewport?.offsetTop ?? 0 }); };
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, []);

  useEffect(() => {
    try { setOpen(localStorage.getItem('clap-tours-disabled') !== 'true' && localStorage.getItem(key) !== 'seen'); } catch { setOpen(true); }
    setIndex(-1);
  }, [key]);

  useEffect(() => { if (open) onStart?.(); }, [open]);

  const close = () => {
    try { localStorage.setItem(key, 'seen'); } catch { /* Storage may be unavailable. */ }
    setOpen(false);
    setRect(null);
  };

  useEffect(() => {
    setRect(null);
    setHighlights([]);
    if (!open || !step?.target) return;
    let dispose: (() => void) | undefined;
    const frame = requestAnimationFrame(() => {
    const target = Array.from(document.querySelectorAll<HTMLElement>(/^[#.]/.test(step.target) ? step.target : `[data-tour="${step.target}"]`))
      .map(element => {
        const bounds = element.getBoundingClientRect();
        if (bounds.width > 0 && bounds.height > 0) return element;
        // Some mobile wrappers only contain a fixed floating action button.
        return Array.from(element.querySelectorAll<HTMLElement>('button, a, input')).find(child => {
          const childBounds = child.getBoundingClientRect();
          return childBounds.width > 0 && childBounds.height > 0;
        });
      }).find((element): element is HTMLElement => !!element);
    if (!target) return;
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
    if (mobile || step.placement === 'bottom') {
      const bounds = target.getBoundingClientRect();
      const height = window.visualViewport?.height ?? window.innerHeight;
      const offset = window.visualViewport?.offsetTop ?? 0;
      const side = step.placement ?? ((bounds.top + bounds.bottom) / 2 - offset > height / 2 ? 'top' : 'bottom');
      setMobileSide(side);
      // Fixed and sticky controls stay in place; put the explanation opposite them.
      let ancestor: HTMLElement | null = target;
      let pinned = false;
      while (ancestor) {
        if (['fixed', 'sticky'].includes(getComputedStyle(ancestor).position)) { pinned = true; break; }
        ancestor = ancestor.parentElement;
      }
      if (!pinned) {
        const explanationHeight = Math.min(panelHeight, height / 2);
        const freeTop = side === 'top' ? explanationHeight + 32 : 80;
        const freeBottom = side === 'top' ? height - 80 : height - explanationHeight - 32;
        const targetTop = bounds.top - offset;
        const targetBottom = bounds.bottom - offset;
        if (targetTop < freeTop || targetBottom > freeBottom) {
          const delta = bounds.height <= freeBottom - freeTop
            ? (targetTop + targetBottom - freeTop - freeBottom) / 2
            : targetTop - freeTop;
          let scroller = target.parentElement;
          while (scroller && !(scroller.scrollHeight > scroller.clientHeight && /auto|scroll/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
          (scroller ?? window).scrollBy({ top: delta, behavior });
        }
      }
    } else target.scrollIntoView({ block: step.placement === 'bottom' ? 'start' : 'center', behavior });
    const update = () => {
      setRect(target.getBoundingClientRect());
      setHighlights(step.highlight ? Array.from(document.querySelectorAll(step.highlight)).map(element => element.getBoundingClientRect()).filter(bounds => bounds.width > 0 && bounds.height > 0) : []);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    dispose = () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
    });
    return () => { cancelAnimationFrame(frame); dispose?.(); };
  }, [open, index, step?.target, mobile]);

  useEffect(() => {
    body.current?.scrollTo?.({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [index]);
  const targetBounds = rect ? { top: rect.top - viewport.offset, bottom: rect.bottom - viewport.offset } : null;
  const placement = step?.placement === 'bottom'
    ? mobileTourPlacement(viewport.height, panelHeight, 'bottom', null)
    : mobile && targetBounds
    ? mobileTourPlacement(viewport.height, panelHeight, mobileSide, targetBounds)
    : tourPlacement(viewport.height, panelHeight, targetBounds);
  const highlightShape = (bounds: DOMRect, i: number, outline = false) => {
    const paint = outline
      ? { fill: 'hsl(var(--accent) / 0.15)', stroke: 'hsl(var(--accent))', strokeWidth: 2 }
      : { fill: 'black' };
    return step?.highlightShape === 'circle'
      ? <circle key={i} cx={bounds.left + bounds.width / 2} cy={bounds.top + bounds.height / 2} r={Math.max(bounds.width, bounds.height) / 2 + 5} {...paint} />
      : <rect key={i} x={bounds.left - 3} y={bounds.top - 3} width={bounds.width + 6} height={bounds.height + 6} rx="4" {...paint} />;
  };
  const button = 'min-h-11 border-2 border-ink px-4 py-2 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';
  return <>
    <div className={helpSlot ? "mb-3 hidden justify-end sm:flex" : "mb-3 flex justify-end"}>
      <button ref={help} type="button" onClick={() => { setIndex(-1); setOpen(true); }} className="flex min-h-11 items-center gap-2 px-2 text-sm hover:text-accent" aria-label={tr('Relancer le tutoriel de cette page', 'Restart this page’s tutorial')}>
        <CircleHelp size={20} /><span>{tr('Aide', 'Help')}</span>
      </button>
    </div>
    {helpSlot && createPortal(<button ref={mobileHelp} type="button" aria-label={tr('Relancer le tutoriel de cette page', 'Restart this page?s tutorial')} title={tr('Aide', 'Help')} onClick={() => { setIndex(-1); setOpen(true); }} className="flex h-11 w-10 shrink-0 items-center justify-center rounded-md hover:bg-ink/5"><CircleHelp size={22} /></button>, helpSlot)}
    <Dialog.Root open={open} onOpenChange={value => { if (!value) close(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className={`tour-backdrop fixed inset-0 z-[70] ${rect ? '' : 'bg-black/60'}`} />
        {highlights.length > 0 && <svg aria-hidden="true" className="pointer-events-none fixed inset-0 z-[71] h-full w-full"><defs><mask id={maskId}><rect width="100%" height="100%" fill="white" />{highlights.map((bounds, i) => highlightShape(bounds, i))}</mask></defs><rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask={`url(#${maskId})`} />{highlights.map((bounds, i) => highlightShape(bounds, i, true))}</svg>}
        {rect && !highlights.length && <div aria-hidden="true" className="tour-spotlight pointer-events-none fixed z-[71] rounded-md border-2 border-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]" style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }}><div className="tour-halo absolute -inset-1 rounded-lg border-2 border-accent" /></div>}
        <Dialog.Content ref={panel} style={{ top: placement.top + viewport.offset, maxHeight: placement.maxHeight }} onCloseAutoFocus={event => { event.preventDefault(); (helpSlot && window.matchMedia("(max-width: 639px)").matches ? mobileHelp : help).current?.focus({ preventScroll: true }); }} className="tour-panel fixed inset-x-3 z-[72] mx-auto max-w-lg flex flex-col overflow-hidden border-2 border-ink bg-paper text-foreground shadow-xl">
          <Dialog.Close aria-label={tr('Fermer le tutoriel', 'Close tutorial')} className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center"><X size={20} /></Dialog.Close>
          <div ref={body} className="min-h-0 overflow-y-auto overscroll-contain p-5">
          <p className="mb-2 pr-10 text-xs text-muted-foreground">{index < 0 ? tr('Bienvenue', 'Welcome') : `${index + 1} / ${steps.length}`}</p>
          <Dialog.Title className="pr-10 font-display text-2xl">{step?.title ?? introTitle ?? tr('Découvrir cette page', 'Discover this page')}</Dialog.Title>
          <Dialog.Description className="mt-3 text-sm leading-relaxed">{step?.target === 'card' && !rect ? tr('Aucune carte à montrer pour le moment. Commence par créer ou importer une carte avec le bouton +, puis relance cette visite avec ? Aide pour découvrir les gestes sur tes cartes.', 'There are no cards to show yet. Create or import a card with +, then restart with ? Help to discover card gestures.') : step?.body ?? introBody ?? tr('Un petit tour pour découvrir les principales actions. Tu peux passer à tout moment et relancer la visite avec le bouton ? Aide.', 'Take a quick tour of the main actions. Skip at any time and restart with the ? Help button.')}</Dialog.Description>
          <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5 shrink-0 accent-[hsl(var(--accent))]" checked={disabled} onChange={event => {
              const checked = event.target.checked;
              setDisabled(checked);
              try { localStorage.setItem('clap-tours-disabled', String(checked)); } catch { /* Keep the current choice when storage is unavailable. */ }
            }} />
            {tr('Ne plus afficher de tutoriel', 'Don’t show tutorials automatically')}
          </label>
          </div>
          <div ref={footer} className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-ink/15 bg-paper p-3">
            <button type="button" className={button} onClick={close}>{tr('Passer', 'Skip')}</button>
            <div className="flex flex-wrap gap-2">
              {step?.tryAction && rect && <button type="button" className={button} onClick={() => {
                const target = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
                close();
                requestAnimationFrame(() => target?.click());
              }}>{tr('Essayer ce clic', 'Try this click')}</button>}
              {index >= 0 && <button type="button" className={button} onClick={() => setIndex(index - 1)}>{tr('Retour', 'Back')}</button>}
              <button type="button" className={`${button} bg-accent text-background`} onClick={() => index === steps.length - 1 ? close() : setIndex(index + 1)}>{index < 0 ? tr('Découvrir', 'Start tour') : index === steps.length - 1 ? tr('Terminer', 'Finish') : tr('Suivant', 'Next')}</button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}
