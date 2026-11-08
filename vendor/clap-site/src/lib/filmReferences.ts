import { withFilmBackCover } from './filmBackCover';
import {separateFilmCover} from './filmCoverSection';
import { cleanBookHtml, type FilmBook, type BookPage } from './filmBooks';
export type FilmHeading={text:string;level:number;page:number;keywords:string[]};
export function filmHeadings(book:FilmBook):FilmHeading[]{
  const result:FilmHeading[]=[];let number=0;
  for(const section of book.sections)for(const page of section.pages){number++;if(page.generated||page.cover||page.frontMatter||page.backCover||page.imagePage)continue;
    const sources=[page.html,...(page.objects??[]).filter(o=>o.kind==='example').map(o=>o.html??'')];
    for(const html of sources){const doc=new DOMParser().parseFromString(cleanBookHtml(html),'text/html');for(const el of doc.querySelectorAll('h1,h2,h3,h4,h5')){const text=el.textContent?.trim();if(!text)continue;const keywords=JSON.parse(el.getAttribute('data-index-keywords')||'[]') as string[];result.push({text,level:Number(el.tagName[1]),page:number,keywords});}}
  }return result;
}
const escape=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
export function withFilmReferences(book:FilmBook):FilmBook {
  book=separateFilmCover(book);if(book.sections.some(s=>s.kind==='backcover'))book=withFilmBackCover(book);
  if(!book.references)return book;
  const oldToc=book.sections.find(s=>s.kind==='toc'),oldIndex=book.sections.find(s=>s.kind==='index');
  const sections=book.sections.filter(s=>s.kind!=='toc'&&s.kind!=='index').map(s=>({...s,pages:s.pages.filter(p=>!p.generated)}));
  if(!sections.length)return book;
  const base={...book,sections},headings=filmHeadings(base),words=new Set(headings.flatMap(h=>h.keywords).map(w=>w.toLocaleLowerCase('fr')));
  const create=(kind:'toc'|'index',count:number):BookPage[]=>Array.from({length:Math.max(1,Math.ceil(count/18))},(_,i)=>({id:`${book.id}-${kind}-${i}`,html:'',titlePage:false,generated:kind}));
  const content=sections.find(s=>!s.kind);
  if(book.references.toc){const toc={id:book.id+'-toc-section',name:'Sommaire',background:'',titleBackground:'',...oldToc,kind:'toc' as const,pages:create('toc',headings.length)};const opening=sections.findIndex(s=>s.kind!=='cover'&&s.kind!=='frontmatter');sections.splice(opening<0?sections.length:opening,0,toc);}
  if(book.references.index&&content){const indexSection={id:book.id+'-index-section',name:'Index',background:'',titleBackground:'',...oldIndex,kind:'index' as const,pages:create('index',words.size)};const beforeBack=sections.findIndex(s=>s.kind==='backcover');sections.splice(beforeBack<0?sections.length:beforeBack,0,indexSection);}
  const entries=filmHeadings(base),index=new Map<string,{word:string;pages:Set<number>}>();
  for(const h of entries)for(const word of h.keywords){const key=word.toLocaleLowerCase('fr');const row=index.get(key)??{word,pages:new Set<number>()};row.pages.add(h.page);index.set(key,row);}
  const toc=entries.map(h=>`<p data-toc-level="${h.level}"><span data-toc-label="">${escape(h.text)}</span><span data-toc-number="">${h.page}</span></p>`);
  const rows=[...index.values()].sort((a,b)=>a.word.localeCompare(b.word,'fr',{sensitivity:'base'})).map(row=>`<p><strong>${escape(row.word)}</strong> · ${[...row.pages].sort((a,b)=>a-b).join(', ')}</p>`);
  const offsets={toc:0,index:0};
  for(const section of sections)for(const page of section.pages)if(page.generated){const kind=page.generated,start=offsets[kind];offsets[kind]+=18;page.html=`<h2>${kind==='toc'?'Sommaire':'Index'}${start?' (suite)':''}</h2>`+(kind==='toc'?toc:rows).slice(start,start+18).join('')+(!(kind==='toc'?toc:rows).length?'<p>Aucun titre ou mot-clé pour le moment.</p>':'');}
  return base;
}
