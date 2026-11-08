import FilmSectionList from '@/components/FilmSectionList';
import { reorderFilmSections } from '@/lib/reorderFilmSections';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ArrowLeft } from 'lucide-react';
import { useBackNavigation } from '@/hooks/use-back-navigation';
import FilmBookActions from '@/components/FilmBookActions';
import { withFilmFrontMatter } from '@/lib/filmFrontMatter';
import { mergeFilmPageBackward } from '@/lib/filmPageBackspace';
import FilmLazyPage from '@/components/FilmLazyPage';
import {hasFilmSectionLabel,sectionLabelFontSize,sectionLabelStyle} from '@/lib/filmSectionLabel';
import FilmImage from '@/components/FilmImage';
import FilmWatermark from '@/components/FilmWatermark';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import AppHeader from '@/components/AppHeader';
import RoleTabs from '@/components/RoleTabs';
import { activeDirectory, loadDirectories, selectDirectory } from '@/lib/directories';
import { cleanBookHtml, deleteFilmBook, loadFilmBooks, projectFilm, newBookPage, newBookSection, saveFilmBook, type FilmBook, type BookPage, type BookObject } from '@/lib/filmBooks';
import BookResourcePicker from '@/components/BookResourcePicker';
import BookPageObject from '@/components/BookPageObject';
import { bookPageCss, exportFilmWord, printFilmBook } from '@/lib/filmBookExport';
import { constrainFilmObject, filmNumberStyle } from '@/lib/filmPageLayout';
import { blobDataUrl } from '@/lib/imageEditing';
import defaultProjectPoster from '@/assets/project-poster-default.webp';
import { filmPageBackground, filmPageHasDarkBackground } from '@/lib/filmPageBackground';
import FilmEditorToolbar from '@/components/FilmEditorToolbar';
import { applyFilmTextWrap } from '@/lib/filmTextWrap';
import FilmSectionMenu from '@/components/FilmSectionMenu';
import FilmPageHeader from '@/components/FilmPageHeader';
import { withFilmReferences } from '@/lib/filmReferences';
import { applyFilmTextStyle } from '@/lib/filmTextStyle';
import { filmCoverLogoUrl } from '@/lib/filmCover';
import { splitFilmPage, filmCaretOffset, placeFilmCaret, joinFilmContinuation } from '@/lib/filmPagination';
import FilmPageSheet from '@/components/FilmPageSheet';

const button = 'min-h-11 border border-ink/40 bg-paper px-3 py-2 text-sm font-semibold hover:bg-ink/10 disabled:opacity-40';

function PageText({ page, change, activate, objects, paginate, backspace, bottom=false }: { page: BookPage; change: (html: string) => void; activate: (element: HTMLDivElement) => void; objects:BookObject[]; paginate:(editor:HTMLDivElement,manual:boolean)=>void; backspace?:(editor:HTMLDivElement)=>boolean; bottom?:boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const lastGood=useRef(page.html),composing=useRef(false),pasting=useRef(false);
  const standard=!page.cover&&!page.titlePage&&!page.generated&&!page.frontMatter;
  function commit(){if(pasting.current)return;const root=ref.current!;if(standard&&!composing.current){paginate(root,false);return;}if(!page.frontMatter&&root.scrollHeight>root.clientHeight+1&&!composing.current){root.innerHTML=lastGood.current;placeFilmCaret(root,Number.MAX_SAFE_INTEGER);return;}lastGood.current=cleanBookHtml(root.innerHTML);change(lastGood.current);}
  useEffect(()=>{const article=ref.current?.closest('.book-page');if(!article)return;const observer=new ResizeObserver(()=>{article.toggleAttribute('data-overflow',!page.frontMatter&&(ref.current?.scrollHeight??0)>(ref.current?.clientHeight??0)+2);});observer.observe(article);return()=>observer.disconnect();},[]);
  useLayoutEffect(() => { if (ref.current && cleanBookHtml(ref.current.innerHTML) !== cleanBookHtml(page.html) && document.activeElement !== ref.current) ref.current.innerHTML = cleanBookHtml(page.html); }, [page.html]);
  useLayoutEffect(()=>{if(ref.current){applyFilmTextWrap(ref.current,page.frontMatter?[]:objects,page.titlePage);if(standard&&ref.current.scrollHeight>ref.current.clientHeight+1&&!composing.current)paginate(ref.current,false);}},[objects,page.titlePage,page.html,standard,paginate]);
  useEffect(()=>{let alive=true;void document.fonts.ready.then(()=>{if(alive&&standard&&ref.current&&ref.current.scrollHeight>ref.current.clientHeight+1)paginate(ref.current,false);});return()=>{alive=false;};},[standard,page.id,paginate]);
  return <div ref={ref} data-page-editor={!bottom?page.id:undefined} className={`book-content outline-none ${bottom?'book-cover-bottom':''}`} contentEditable={!page.generated&&!page.insideCover} suppressContentEditableWarning role="textbox" aria-label={bottom?'Titre bas de la couverture':'Texte de la page'} aria-multiline onFocus={() => activate(ref.current!)} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;commit();}} onInput={commit} onKeyDown={event=>{if(event.key==='Backspace'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.shiftKey&&!event.nativeEvent.isComposing&&!composing.current&&standard&&getSelection()?.isCollapsed&&filmCaretOffset(ref.current!)===0&&backspace?.(ref.current!)){event.preventDefault();event.stopPropagation();return;}if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();event.stopPropagation();paginate(ref.current!,true);}}} onPaste={event=>{event.preventDefault();const root=ref.current!,html=event.clipboardData.getData('text/html');const content=html?cleanBookHtml(html):cleanBookHtml(event.clipboardData.getData('text/plain').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>'));pasting.current=true;try{document.execCommand('insertHTML',false,content+'<span data-film-paste-end="">&#8288;</span>');const marker=root.querySelector('[data-film-paste-end]');if(marker){const range=document.createRange();range.setStartBefore(marker);range.collapse(true);marker.remove();getSelection()?.removeAllRanges();getSelection()?.addRange(range);}}finally{pasting.current=false;commit();}}} />;
}

export default function FilmBookEditor() {
  const goBack=useBackNavigation('/app/studio');
  const [sectionsOpen,setSectionsOpen]=useState(false);
  const [directory, setDirectory] = useState(activeDirectory);
  const [book, setBook] = useState<FilmBook | null>(null);
  const [sectionId, setSectionId] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pick, setPick] = useState<{target:'background'|'title'|'image'|'watermark';sectionId?:string;pageId?:string} | null>(null);
  const [focusedPage, setFocusedPage] = useState('');
  const [objectPreview,setObjectPreview]=useState<BookObject|null>(null);
  const poster = loadDirectories().find(d => d.id === directory)?.posterImage || defaultProjectPoster;
  const editable = useRef<HTMLDivElement | null>(null);
  const pendingCaret=useRef<{id:string;offset:number}|null>(null);
  const savedSelection = useRef<Range | null>(null);
  const styleUndo = useRef<{editor:HTMLDivElement;before:string;after:string}[]>([]);
  const styleRedo = useRef<{editor:HTMLDivElement;before:string;after:string}[]>([]);
  function captureSelection(){const selection=getSelection();if(selection?.rangeCount && editable.current?.contains(selection.anchorNode) && editable.current.contains(selection.focusNode))savedSelection.current=selection.getRangeAt(0).cloneRange();}
  useEffect(()=>{const remember=()=>{if(editable.current?.contains(document.activeElement))captureSelection();};document.addEventListener('selectionchange',remember);return()=>document.removeEventListener('selectionchange',remember);},[]);
  const queue = useRef(Promise.resolve());
  const revision = useRef(0);
  const creating = useRef(false);
  const currentDirectory = useRef(directory);
  currentDirectory.current = directory;
  const section = book?.sections.find(s => s.id === sectionId) ?? book?.sections[0];
  useEffect(() => {
    let disposed = false;
    revision.current += 1;
    setLoaded(false); setBook(null); setSectionId(''); setPick(null); setFocusedPage(''); setError(''); setStatus(''); editable.current = null;
    void queue.current.catch(() => {}).then(loadFilmBooks).then(items => {
      if (disposed) return;
      const saved = projectFilm(items, directory);const film=saved?withFilmReferences(withFilmFrontMatter(saved)):null;
      setBook(film); setSectionId(film?.sections[0]?.id ?? ''); setLoaded(true);
    }).catch(e => { if (!disposed) setError(String(e)); });
    return () => { disposed = true; };
  }, [directory]);
  useEffect(() => {
    if (!book) return;
    const currentRevision = ++revision.current;
    setStatus('Enregistrement…');
    // Serialize saves, including when switching books, so an older edit cannot overwrite a newer one.
    queue.current = queue.current.catch(() => {}).then(async () => {
      try { await saveFilmBook(book); if(currentRevision===revision.current)setStatus('Enregistré dans ce navigateur'); }
      catch (e) { setError(String(e)); setStatus('Échec de la sauvegarde'); }
    });
  }, [book]);
  function update(transform: (b: FilmBook) => FilmBook) { setBook(b => b ? withFilmReferences(withFilmFrontMatter({ ...transform(b), updatedAt: Date.now() })) : b); }
  function updateSection(patch: Partial<NonNullable<typeof section>>, targetId=section?.id) { if (targetId) update(b => ({ ...b, sections: b.sections.map(s => s.id === targetId ? { ...s, ...patch } : s) })); }
  function updatePage(id: string, patch: Partial<BookPage>) { update(b=>({...b,sections:b.sections.map(s=>({...s,pages:s.pages.map(p=>p.id===id?{...p,...patch}:p)}))})); }
  useLayoutEffect(()=>{const request=pendingCaret.current;if(!request)return;const root=document.querySelector<HTMLDivElement>(`[data-page-editor="${request.id}"]`);if(!root)return;placeFilmCaret(root,request.offset);editable.current=root;setFocusedPage(request.id);pendingCaret.current=null;captureSelection();const article=root.closest<HTMLElement>('.book-page');if(article){article.style.scrollMarginTop=`${64+(document.querySelector('[data-film-toolbar]')?.getBoundingClientRect().height??90)+12}px`;article.scrollIntoView({block:'start',behavior:'instant'});}},[book]);
  function flowPage(pageId:string,root:HTMLDivElement,manual:boolean){
    const source=book?.sections.flatMap(s=>s.pages).find(p=>p.id===pageId);if(!source||source.cover||source.frontMatter||source.generated||source.backCover||source.imagePage)return;
    const standard=!source.titlePage&&!source.cover&&!source.generated&&!source.frontMatter;
    if(!manual&&!standard)return;
    if(manual&&standard){const selection=getSelection();if(selection?.rangeCount&&root.contains(selection.getRangeAt(0).commonAncestorContainer))selection.deleteFromDocument();}
    const result=standard?splitFilmPage(root,source.objects??[],manual):null;
    if(!manual&&!result){const html=cleanBookHtml(root.innerHTML);if(html!==source.html)updatePage(pageId,{html});return;}
    const caret=pendingCaret.current?.id===pageId?pendingCaret.current.offset:(result?.caret??filmCaretOffset(root));
    if(result){root.innerHTML=result.head||'<p><br></p>';applyFilmTextWrap(root,source.objects??[]);if(caret!==null&&caret<=result.offset&&!manual)placeFilmCaret(root,caret);}
    update(b=>{const sections=b.sections.map(s=>{const index=s.pages.findIndex(p=>p.id===pageId);if(index<0)return s;const pages=[...s.pages],next=pages[index+1];const reuse=!manual&&next?.continuationOf===pageId&&!next.titlePage&&!next.generated&&!next.imagePage;
      const destination=reuse?{...next,html:joinFilmContinuation(result?.tail??'',next.html,!!next.continuationJoined),continuationJoined:result?.continued}:{...newBookPage(),html:result?.tail||'<p><br></p>',continuationOf:manual?undefined:pageId,continuationJoined:result?.continued,backgroundTone:source.backgroundTone,watermark:source.watermark};
      if(result)pages[index]={...pages[index],html:result.head||'<p><br></p>'};if(reuse)pages[index+1]=destination;else pages.splice(index+1,0,destination);
      if(manual||(caret!==null&&caret>(result?.offset??0)))pendingCaret.current={id:destination.id,offset:manual?0:Math.max(0,caret!-(result?.offset??0))};return {...s,pages};});return {...b,sections};});
  }
  function backspacePage(pageId:string,root:HTMLDivElement){
    const owner=book?.sections.find(s=>s.pages.some(p=>p.id===pageId));if(!owner)return false;
    const result=mergeFilmPageBackward(owner.pages,pageId,root.innerHTML);if(!result)return false;
    pendingCaret.current={id:result.target.id,offset:result.offset};
    updateSection({pages:result.pages},owner.id);return true;
  }
  function addObject(pageId: string, kind: BookObject['kind'], source?: string) {
    const page = book?.sections.flatMap(s=>s.pages).find(p=>p.id===pageId); if (!page) return;
    const object: BookObject = { id:crypto.randomUUID(), kind, x:25, y:160, width:160, height:kind==='image'?65:40, ...(source ? {source} : {html:'<p><strong>Exemple</strong></p><p>Votre exemple…</p>'}) };
    updatePage(pageId,{objects:[...(page.objects??[]),constrainFilmObject(object)]});
  }
  function command(cmd: string, value?: string) {
    const root=editable.current;if(!root?.isConnected)return;
    const range=savedSelection.current;root.focus({preventScroll:true});
    if(range&&root.contains(range.commonAncestorContainer)){const selection=getSelection();selection?.removeAllRanges();selection?.addRange(range);}
    const before=cleanBookHtml(root.innerHTML),undo=styleUndo.current[styleUndo.current.length-1],redo=styleRedo.current[styleRedo.current.length-1];
    if(cmd==='formatBlock'){
      applyFilmTextStyle(root,value??'p');const after=cleanBookHtml(root.innerHTML);
      if(after!==before){styleUndo.current.push({editor:root,before,after});styleRedo.current=[];}
    }else if((cmd==='undo'&&undo?.editor===root&&undo.after===before)||(cmd==='redo'&&redo?.editor===root&&redo.before===before)){
      const entry=cmd==='undo'?styleUndo.current.pop()!:styleRedo.current.pop()!;
      root.innerHTML=cmd==='undo'?entry.before:entry.after;
      (cmd==='undo'?styleRedo:styleUndo).current.push(entry);
      const restored=document.createRange();restored.selectNodeContents(root);restored.collapse(false);getSelection()?.removeAllRanges();getSelection()?.addRange(restored);
    }else document.execCommand(cmd,false,value);
    const selection=getSelection();if(selection?.rangeCount)savedSelection.current=selection.getRangeAt(0).cloneRange();
    root.dispatchEvent(new Event('input',{bubbles:true}));
  }
  async function image(file: File | undefined, accept: (url: string) => void) {
    if (!file) return;
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) { setError('Choisissez une image PNG, JPEG ou WebP de moins de 15 Mo.'); return; }
    try { accept(await blobDataUrl(file)); setError(''); } catch (e) { setError(String(e)); }
  }
  async function exportBook(word: boolean) { if (!book) return; setBusy(true); setError(''); try { await queue.current; const output={...book,sections:book.sections.map(s=>({...s,titleBackground:s.titleBackground || poster}))}; if (word) await exportFilmWord(output); else await printFilmBook(output); } catch(e) { setError(String(e)); } finally { setBusy(false); } }
  const removeFilm = async () => { if(!book||busy)return; if (!confirm('Supprimer le film de ce projet ?')) return; setBusy(true); try { await queue.current; await deleteFilmBook(book.id); const remaining=projectFilm(await loadFilmBooks(),directory);setBook(remaining);setSectionId(remaining?.sections[0]?.id??''); } catch(e) { setError(String(e)); } finally { setBusy(false); } };
  function open(value: FilmBook) { value=withFilmFrontMatter(value);setBook(value); setSectionId(value.sections[0]?.id ?? ''); editable.current = null; }
  async function createFilm() {
    if (creating.current || book || !loaded) return;
    creating.current = true; setBusy(true); setError('');
    try {
      await queue.current;
      const existing = projectFilm(await loadFilmBooks(), directory);
      if (existing) { if(currentDirectory.current===directory) open(existing); return; }
      const first = newBookSection(poster);
      const cover={...newBookSection(poster),name:'Couverture',kind:'cover' as const,pages:[{ ...newBookPage(true), cover: true, html: '<h1 data-film-style="cover">Mon film</h1>' }]};
      const film: FilmBook = { id: crypto.randomUUID(), directoryId: directory, name: 'Mon film', sections: [cover,first], updatedAt: Date.now() };
      const prepared=withFilmFrontMatter(film);await saveFilmBook(prepared); if(currentDirectory.current===directory) open(film);
    } catch(e) { setError(String(e)); }
    finally { creating.current = false; setBusy(false); }
  }
  function sectionMenu(pageNumber?:number,target=section) {if(!target||!book||target.kind)return null;const patch=(value:Partial<typeof target>)=>updateSection(value,target.id);return <FilmSectionMenu section={target} pageNumber={pageNumber} update={patch} poster={poster} background={()=>{setSectionsOpen(false);setPick({target:'background',sectionId:target.id});}} titleImage={()=>{setSectionsOpen(false);setPick({target:'title',sectionId:target.id});}} importTitle={file=>void image(file,url=>patch({titleBackground:url}))} canRemove={!target.kind&&book.sections.filter(s=>!s.kind).length>1} remove={()=>{if(confirm('Supprimer cette section et ses pages ?')){update(b=>({...b,sections:b.sections.filter(s=>s.id!==target.id)}));setSectionId('');}}}/>;}
  function jumpSection(id:string){setSectionId(id);requestAnimationFrame(()=>document.getElementById('film-section-'+id)?.scrollIntoView({block:'start',behavior:'instant'}));}
  return <div className="min-h-screen bg-paper text-foreground" onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&((e.target as HTMLElement).closest('[contenteditable="true"]'))){if(e.key.toLowerCase()==='z'){e.preventDefault();command(e.shiftKey?'redo':'undo');}else if(e.key.toLowerCase()==='y'){e.preventDefault();command('redo');}}}}>
    <style>{bookPageCss}</style>
    {book ? <header className="fixed inset-x-0 top-0 z-40 border-b border-ink bg-paper/95 backdrop-blur sm:sticky"><div className="container flex h-16 items-center justify-between gap-4"><button type="button" aria-label="Retour" onClick={goBack} className="flex h-9 w-9 items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest hover:text-accent md:w-auto"><ArrowLeft size={16} /><span className="hidden md:inline">Retour</span></button><h1 className="truncate font-display text-xl tracking-wider md:text-2xl">{book.name || "Sans nom"}</h1><div className="flex shrink-0 items-center gap-2"><span data-mobile-help className="empty:hidden shrink-0 sm:hidden" /><span aria-hidden="true" className="hidden w-10 shrink-0 sm:block" /><FilmBookActions busy={busy} status={status} exportWord={()=>void exportBook(true)} exportPdf={()=>void exportBook(false)} remove={()=>void removeFilm()} /></div></div></header> : <AppHeader title="Film" directoryId={directory} onDirectoryChange={id=>{selectDirectory(id);setDirectory(id);setBook(null);}} />}
    <main className="container pb-40 pt-24 sm:pt-8">
      <RoleTabs />
      <header className="mb-5 flex flex-wrap items-center gap-3"><h1 className="font-display text-4xl">Mon film</h1>{loaded && !book && <button className={button} disabled={busy} onClick={() => void createFilm()}>Créer le film</button>}</header>
      {error && <p role="alert" className="mb-4 text-destructive">{error}</p>}
      {!book ? <p>{loaded ? 'Un seul film par projet. Créez le film de ce projet pour écrire directement sur ses pages.' : 'Chargement du film…'}</p> : <>
        <div className="mb-4 flex flex-wrap items-center gap-3"><label>Titre du film <input className="border bg-paper p-2" value={book.name} onChange={e => update(b => ({ ...b, name: e.target.value }))} /></label></div>
        <button type="button" className={button+" mb-4"} onClick={()=>setSectionsOpen(true)}>Sections</button>
        <Dialog open={sectionsOpen} onOpenChange={setSectionsOpen}><DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto bg-paper"><DialogTitle>Sections</DialogTitle><DialogDescription>Accédez aux pages du livre et gérez les sections du scénario. Les pages techniques sont permanentes.</DialogDescription><button type="button" className={button} onClick={()=>{const added=newBookSection(poster);update(b=>({...b,sections:[...b.sections,added]}));setSectionsOpen(false);jumpSection(added.id);}}>+ Ajouter une section</button><FilmSectionList sections={book.sections} select={id=>{setSectionsOpen(false);jumpSection(id);editable.current=null;}} move={(source,target)=>update(b=>({...b,sections:reorderFilmSections(b.sections,source,target)}))} remove={id=>{const target=book.sections.find(s=>s.id===id);if(!target||target.kind)return;if(confirm("Supprimer cette section et ses pages ?")){update(b=>({...b,sections:b.sections.filter(s=>s.id!==id)}));setSectionId("");}}} /></DialogContent></Dialog>
        {section && <>
          <FilmEditorToolbar sectionSettings={sectionMenu()} editor={editable} command={command} captureSelection={captureSelection} context={section.name+' · Page '+(book.sections.flatMap(s=>s.pages).findIndex(p=>p.id===focusedPage)+1)} example={()=>{const pageId=section.pages.find(p=>p.id===focusedPage)?.id || section.pages.find(p=>!p.titlePage)?.id || section.pages[0].id;addObject(pageId,'example');}} image={()=>{const pageId=section.pages.find(p=>p.id===focusedPage)?.id || section.pages.find(p=>!p.titlePage)?.id || section.pages[0].id;setPick({target:'image',pageId});}} />
          <p className="mb-3 text-sm text-muted-foreground">Cliquez dans une page pour écrire. Le texte passe automatiquement à la page suivante. Ctrl+Entrée crée une nouvelle page à partir du curseur. Pour le PDF, choisissez « Enregistrer au format PDF » et activez les arrière-plans.</p>
          {book.sections.map(section=>{const patchSection=(patch:Partial<typeof section>)=>updateSection(patch,section.id);return <section key={section.id} id={'film-section-'+section.id} data-film-section={section.id} className="mb-8 scroll-mt-48"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-display text-2xl">{section.name}</h2></div><div className="bg-ink/10 p-3 sm:p-6"><div className="mx-auto w-full max-w-[210mm] space-y-6">{section.pages.map((page,index) => {const pageNumber=book.sections.slice(0,book.sections.indexOf(section)).reduce((n,s)=>n+s.pages.length,0)+index+1;const bg=filmPageBackground({...section,titleBackground:section.titleBackground||poster},page,pageNumber);return <FilmLazyPage key={page.id} pageId={page.id} eager={page.id===focusedPage||page.id===pendingCaret.current?.id}>
            <FilmPageHeader page={page} number={pageNumber} sectionMenu={sectionMenu(pageNumber,section)} toneEnabled={!!section.backgroundVariants || /\/(left|right)-(light|dark)\.png$/.test(section.background)} update={patch=>updatePage(page.id,patch)} illustration={()=>setPick({target:'image',pageId:page.id})} watermark={()=>setPick({target:'watermark',pageId:page.id})} importWatermark={file=>void image(file,source=>updatePage(page.id,{watermark:{source,opacity:0.1,size:80}}))} importImage={file=>void image(file,url=>addObject(page.id,'image',url))} canUp={!section.kind&&!page.generated && index>0} canDown={!section.kind&&!page.generated && index<section.pages.length-1} canRemove={!section.kind&&!page.generated && section.pages.length>1} up={()=>{const pages=[...section.pages];[pages[index-1],pages[index]]=[pages[index],pages[index-1]];patchSection({pages});}} down={()=>{const pages=[...section.pages];[pages[index+1],pages[index]]=[pages[index],pages[index+1]];patchSection({pages});}} remove={()=>{if(confirm('Supprimer cette page ?'))patchSection({pages:section.pages.filter(p=>p.id!==page.id)});}} insert={()=>{const pages=[...section.pages];pages.splice(index+1,0,newBookPage());patchSection({pages});}} />
            <FilmPageSheet><article data-dark-background={filmPageHasDarkBackground(section,page)||undefined} data-backcover={page.backCover || undefined} data-frontmatter={page.frontMatter ? (page.id.endsWith('-credits') ? 'credits' : page.id.endsWith('-community') ? 'community' : 'thanks') : undefined} data-cover={page.cover || undefined} data-generated={page.generated} className={`book-page shadow-lg ${page.titlePage ? 'title-page' : ''}`} style={{backgroundImage:bg ? `url("${bg}")` : undefined}}>
              {!page.imagePage&&<>{!page.titlePage&&page.watermark && <FilmWatermark mark={page.watermark} protectBands={!!bg}/> }{page.watermark && bg && !page.titlePage && <div aria-hidden="true" className="book-bands" style={{backgroundImage:`url("${bg}")`}}/>}
              {page.cover && <img className="book-cover-logo" src={filmCoverLogoUrl} alt="Logo Clap & Role" />}
              <PageText page={page} backspace={root=>backspacePage(page.id,root)} paginate={(editor,manual)=>flowPage(page.id,editor,manual)} objects={(page.objects??[]).map(o=>objectPreview?.id===o.id?objectPreview:o)} change={html=>updatePage(page.id,{html})} activate={el=>{editable.current=el;setFocusedPage(page.id);setSectionId(section.id);}} />
              {page.cover&&<PageText page={{...page,html:page.coverBottomHtml??'<h2>Titre bas</h2>',titlePage:false}} bottom paginate={(editor,manual)=>flowPage(page.id,editor,manual)} objects={[]} change={html=>updatePage(page.id,{coverBottomHtml:html})} activate={el=>{editable.current=el;setFocusedPage(page.id);setSectionId(section.id);}}/>}
              {page.image && <FilmImage className="book-page-illustration" source={page.image} widthMm={170} heightMm={65} alt="Illustration de la page" />}
              {(page.objects??[]).map(object=><BookPageObject key={object.id} object={constrainFilmObject(object)} preview={setObjectPreview} activate={el=>{editable.current=el;setFocusedPage(page.id);setSectionId(section.id);}} change={patch=>{setObjectPreview(null);updatePage(page.id,{objects:(page.objects??[]).map(o=>o.id===object.id?constrainFilmObject({...o,...patch}):o)});}} remove={()=>updatePage(page.id,{objects:(page.objects??[]).filter(o=>o.id!==object.id)})} />)}
              {hasFilmSectionLabel(page)&&<div className="book-section-label" style={sectionLabelStyle(section.name,pageNumber,section.labelColor)} data-side={pageNumber%2?'right':'left'}><span style={{fontSize:sectionLabelFontSize(section.name)+'pt'}}>{section.name}</span></div>}
              </>}
              {!page.cover && !page.titlePage && !page.frontMatter && page.generated!=='toc' && page.generated!=='index' && <span className="book-number" style={filmNumberStyle(pageNumber,!!bg,page.imagePage?.numberColor)}>{book.sections.slice(0,book.sections.indexOf(section)).reduce((n,s)=>n+s.pages.length,0)+index+1}</span>}
            </article></FilmPageSheet>
          </FilmLazyPage>;})}</div></div>
          {!section.kind&&<div className="mt-4 flex gap-2"><button className={button} onClick={() => patchSection({pages:[...section.pages,newBookPage()]})}>+ Page</button><button className={button} onClick={() => patchSection({pages:[...section.pages,newBookPage(true)]})}>+ Page de titre</button></div>}</section>;})}
        </>}
      </>}
      {pick && <BookResourcePicker directoryId={directory} background={pick.target==='background'} close={()=>setPick(null)} choose={(source,variants)=>{if(pick.target==='background')updateSection({background:source,backgroundVariants:variants},pick.sectionId);else if(pick.target==='title')updateSection({titleBackground:source},pick.sectionId);else if(pick.target==='watermark'&&pick.pageId)updatePage(pick.pageId,{watermark:{source,opacity:0.1,size:80}});else if(pick.pageId)addObject(pick.pageId,'image',source);}} />}
    </main>
  </div>;
}
