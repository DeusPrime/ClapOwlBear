import type {FilmBook,BookSection} from './filmBooks';
// Split older mixed sections without changing any page content or page IDs.
export function separateFilmCover(book:FilmBook):FilmBook {
 const source=book.sections.find(s=>s.pages.some(p=>p.cover));if(!source)return book;
 const covers=book.sections.flatMap(s=>s.pages.filter(p=>p.cover));
 const dedicated=source.kind==='cover'||source.pages.every(p=>p.cover);
 const cover:BookSection={...source,id:dedicated?source.id:book.id+'-cover',name:source.kind==='cover'?source.name:'Couverture',kind:'cover',pages:covers};
 const sections=book.sections.flatMap(s=>{const pages=s.pages.filter(p=>!p.cover);if(!pages.length)return [];return [{...s,id:s.id===cover.id?s.id+'-content':s.id,kind:s.kind==='cover'?undefined:s.kind,pages}];});
 return {...book,sections:[cover,...sections]};
}
