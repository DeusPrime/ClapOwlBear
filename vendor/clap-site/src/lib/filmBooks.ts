import { openListDatabase } from './listDatabase';

export type BookObject = { id: string; locked?: boolean; kind: 'image' | 'example'; x: number; y: number; width: number; height: number; featherMm?: number; aspectRatio?: number; html?: string; source?: string };
export type BackgroundVariants = Record<'left-light'|'right-light'|'left-dark'|'right-dark',string>;
export type BookPage = { id: string; html: string; image?: string; imagePage?: { source?: string; numberColor: 'white' | 'black' }; watermark?: { source: string; opacity: number; size: number; featherMm?: number; x?: number; y?: number }; titlePage: boolean; frontMatter?: boolean; insideCover?: 'front' | 'back'; backCover?: boolean; objects?: BookObject[]; cover?: boolean; coverBottomHtml?:string; backgroundTone?: 'light'|'dark'; generated?:'toc'|'index'; continuationOf?:string; continuationJoined?:boolean };
export type BookSection = { id: string; name: string; kind?: 'cover' | 'toc' | 'frontmatter' | 'backcover' | 'index'; savedTitlePage?: BookPage; labelColor?: string; background: string; backgroundVariants?: BackgroundVariants; titleBackground: string; pages: BookPage[] };
export type FilmBook = { id: string; directoryId: string; name: string; sections: BookSection[]; updatedAt: number; references?:{toc:boolean;index:boolean} };
export const newBookPage = (titlePage = false): BookPage => ({ id: crypto.randomUUID(), titlePage, html: titlePage ? '<h1 data-film-style="section">Titre de section</h1><p>Sous-titre</p>' : '<h2>Nouvelle page</h2><p>Écrivez votre film ici…</p>' });
export const newBookSection = (poster = ''): BookSection => ({ id: crypto.randomUUID(), name: 'Nouvelle section', background: '', titleBackground: poster, pages: [newBookPage(true), newBookPage()] });
async function request<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openListDatabase('clap-film-books', 'books');
  return new Promise((resolve, reject) => {
    const tx = db.transaction('books', mode), req = action(tx.objectStore('books'));
    tx.oncomplete = () => { db.close(); resolve(req.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Sauvegarde du film impossible.')); };
  });
}
export const loadFilmBooks = () => request<FilmBook[]>('readonly', store => store.getAll());
export const projectFilm = (films: FilmBook[], directoryId: string) => films.filter(film => film.directoryId === directoryId).sort((a,b) => b.updatedAt-a.updatedAt || a.id.localeCompare(b.id))[0] ?? null;
export async function saveFilmBook(book: FilmBook): Promise<void> {
  let duplicate = false;
  try {
    // Check and write in one transaction so simultaneous creation in two tabs
    // cannot create two films in the same project. Earlier drafts stay untouched.
    await request('readwrite', store => {
      const existing = store.index('directoryId').getAll(IDBKeyRange.only(book.directoryId));
      existing.onsuccess = () => {
        const current = projectFilm(existing.result as FilmBook[], book.directoryId);
        if (current && current.id !== book.id) { duplicate = true; store.transaction.abort(); }
        else store.put(book);
      };
      return existing;
    });
  } catch (error) {
    if (duplicate) throw new Error('Ce projet possède déjà un film. Ouvrez son film pour continuer la rédaction.');
    throw error;
  }
}
export const deleteFilmBook = (id: string) => request('readwrite', store => store.delete(id));

// Only formatting produced by the editor is retained, including when pasting HTML.
export function cleanBookHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.body.querySelectorAll('[data-film-wrap]').forEach(el=>el.remove());
  const allowed = new Set(['P','DIV','BR','SPAN','H1','H2','H3','H4','H5','STRONG','B','EM','I','U','UL','OL','LI','BLOCKQUOTE','TABLE','TBODY','THEAD','TR','TD','TH']);
  for (const el of Array.from(doc.body.querySelectorAll('*')).reverse()) {
    if (['SCRIPT','STYLE','IFRAME','OBJECT'].includes(el.tagName)) { el.remove(); continue; }
    if (!allowed.has(el.tagName)) { el.replaceWith(...el.childNodes); continue; }
    const align = (el as HTMLElement).style.textAlign || el.getAttribute('align');
    const creditBlock=el.getAttribute('data-film-credit-block');
    const keywords=el.getAttribute('data-index-keywords');
    const special=el.getAttribute('data-film-style');
    const tocLevel=el.getAttribute('data-toc-level'),tocLabel=el.hasAttribute('data-toc-label'),tocNumber=el.hasAttribute('data-toc-number');
    for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name);
    if(el.tagName==='DIV'&&['title','author','copyright','community'].includes(creditBlock??''))el.setAttribute('data-film-credit-block',creditBlock!);
    if(/^H[1-5]$/.test(el.tagName)&&(special==='cover'||special==='section'))el.setAttribute('data-film-style',special);
    if(el.tagName==='P'&&/^[1-5]$/.test(tocLevel??''))el.setAttribute('data-toc-level',tocLevel!);
    if(el.tagName==='SPAN'&&tocLabel)el.setAttribute('data-toc-label','');
    if(el.tagName==='SPAN'&&tocNumber)el.setAttribute('data-toc-number','');
    if(['P','DIV','H1','H2','H3','H4','H5','LI','TD','TH'].includes(el.tagName) && ['left','center','right','justify'].includes(align ?? '')) (el as HTMLElement).style.textAlign=align!;
    if(/^H[1-5]$/.test(el.tagName)&&keywords){try{const values:unknown=JSON.parse(keywords);if(Array.isArray(values))el.setAttribute('data-index-keywords',JSON.stringify(values.filter((v):v is string=>typeof v==='string').map(v=>v.trim().slice(0,100)).filter(Boolean).slice(0,30)));}catch{/* Discard invalid metadata. */}}
  }
  return doc.body.innerHTML;
}
