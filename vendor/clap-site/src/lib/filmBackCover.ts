import { cleanBookHtml, type FilmBook, type BookSection, type BookPage } from './filmBooks';

export function backCoverWordFrame(text: string, pageNumber: number) {
  return `<w:p><w:r><w:pict><v:rect xmlns:v="urn:schemas-microsoft-com:vml" id="back-cover-summary-${pageNumber}" style="position:absolute;margin-left:20mm;margin-top:89mm;width:170mm;height:40mm;mso-position-horizontal-relative:page;mso-position-vertical-relative:page" fillcolor="#000000" stroked="t" strokecolor="#000000" strokeweight="1pt"><v:fill opacity="60%"/><v:textbox inset="8mm,8mm,8mm,8mm" style="mso-fit-shape-to-text:t"><w:txbxContent>${text}</w:txbxContent></v:textbox></v:rect></w:pict></w:r></w:p>`;
}

function summaryHtml(book: FilmBook) {
  for (const section of book.sections.filter(section => !section.kind)) for (const page of section.pages) {
    const doc = new DOMParser().parseFromString(cleanBookHtml(page.html), 'text/html');
    const heading = [...doc.querySelectorAll('h1,h2,h3,h4,h5')].find(element => /^résumé\s*:?$/i.test(element.textContent?.trim() ?? ''));
    if (!heading) continue;
    let html = '';
    for (let node = heading.nextElementSibling; node && !/^H[1-5]$/.test(node.tagName); node = node.nextElementSibling) html += node.outerHTML;
    if (html && doc.body.textContent?.trim()) return html;
  }
  return '<p>Présentez ici le résumé de votre scénario : le cadre, les héros et le point de départ de leur aventure. Donnez envie de jouer sans révéler les surprises de l’histoire.</p>';
}

export function withFilmBackCover(book: FilmBook): FilmBook {
  const existing = book.sections.find(section => section.kind === 'backcover');
  const inside: BookPage = { id: `${book.id}-inside-back-cover`, titlePage: false, frontMatter: true, insideCover: 'back', html: '' };
  if (existing && book.sections.at(-1) === existing && existing.pages[0]?.insideCover==='back') return book;
  const cover = book.sections.find(section => section.kind === 'cover');
  const section: BookSection = existing ?? {
    id: `${book.id}-backcover`, kind: 'backcover', name: 'Quatrième de couverture',
    background: '', titleBackground: cover?.titleBackground ?? '',
    pages: [{ id: `${book.id}-backcover-page`, titlePage: true, backCover: true, html: '<h2>Résumé</h2>' + summaryHtml(book) }],
  };
  const pages = [inside, ...section.pages.filter(page=>page.id!==inside.id)];
  return { ...book, sections: [...book.sections.filter(section => section.kind !== 'backcover'), {...section,pages}] };
}
