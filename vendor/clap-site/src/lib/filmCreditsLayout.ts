import { cleanBookHtml, type BookPage, type BookObject, type BookSection } from './filmBooks';

export function creditsHtml(html: string) {
  const doc = new DOMParser().parseFromString(cleanBookHtml(html), 'text/html');
  if (doc.querySelector('[data-film-credit-block]')) {
    return cleanBookHtml(doc.body.innerHTML);
  }
  const elements = [...doc.body.children];
  const paragraphs = elements.filter(element => element.tagName === 'P');
  const author = paragraphs.slice(0, 2).map(element => element.outerHTML).join('') || '<p>Écrit par</p><p><strong>Auteur</strong></p>';
  const copyright = '<p>© 2026 Clap &amp; Role</p><p>Tous droits réservés.</p>';
  const invitation = elements.find(element => element.tagName === 'H3');
  const community = (invitation?.outerHTML || '<h3>Si tu aimes ce scénario :<br>Rejoins la communauté Clap &amp; Role !</h3>') + '<p>Discord : https://discord.gg/rQUf6Xmnyt<br>Site : https://clapnrole.com</p>';
  return `<div data-film-credit-block="author">${author}</div><div data-film-credit-block="copyright">${copyright}</div><div data-film-credit-block="community">${community}</div>`;
}

export function creditsQrLabel(source?: string) {
  return /\/book-links\/discord\.png$/.test(source ?? '') ? 'Discord' : /\/book-links\/site\.png$/.test(source ?? '') ? 'Site' : '';
}

export function fixedCreditsQr(pageId: string): BookObject[] {
  return (['discord', 'site'] as const).map((name, index) => ({ id: `${pageId}-${name}`, kind: 'image', locked: true, source: `${import.meta.env.BASE_URL}book-links/${name}.png`, x: index ? 122 : 44, y: 125, width: 44, height: 44, aspectRatio: 1, featherMm: 0 }));
}

export function normalizeCreditsPage(page: BookPage): BookPage {
  if (!page.frontMatter || (!page.id.endsWith('-credits') && !page.id.endsWith('-community'))) return page;
  const community = page.id.endsWith('-community');
  const html = community ? page.html : creditsHtml(page.html);
  const extra = (page.objects ?? []).filter(object => !/\/book-links\/(discord|site)\.png$/.test(object.source ?? '') && !/-((discord)|(site))$/.test(object.id));
  const objects = community ? [...extra, ...fixedCreditsQr(page.id)] : extra;
  if (html === page.html && JSON.stringify(objects) === JSON.stringify(page.objects)) return page;
  return { ...page, html, objects };
}

export function normalizeCreditsSection(section: BookSection, title: string): BookSection {
  if(section.kind!=='frontmatter')return section;
  let pages=section.pages.map(normalizeCreditsPage);
  const credits=pages.find(page=>page.id.endsWith('-credits'));
  if(credits){
    const doc=new DOMParser().parseFromString(credits.html,'text/html');
    let footer=doc.querySelector('[data-film-credit-block="copyright"]');
    if(!footer){footer=doc.createElement('div');footer.setAttribute('data-film-credit-block','copyright');doc.body.append(footer);}
    footer.innerHTML='<p><strong>© 2026 Clap &amp; Role</strong></p><p><strong>Tous droits réservés.</strong></p>';
    // Older sanitizer versions stripped the title marker, causing a fresh
    // template to be inserted on every update. Repair only those templates.
    const titleBlocks=[...doc.body.children].filter(element=>element.getAttribute('data-film-credit-block')==='title'||(!element.hasAttribute('data-film-credit-block')&&element.tagName==='DIV'&&!!element.querySelector('h2')&&/Nombre de joueurs\s*:/.test(element.textContent??'')));
    if(titleBlocks.length){
      const keep=titleBlocks.find(element=>element.getAttribute('data-film-credit-block')==='title')??titleBlocks[0];
      keep.setAttribute('data-film-credit-block','title');
      for(const block of titleBlocks)if(block!==keep)block.remove();
    }
    const invitation=doc.querySelector('[data-film-credit-block="community"]');
    if(!pages.some(page=>page.id.endsWith('-community'))){
      const community:BookPage={id:credits.id.replace(/-credits$/,'-community'),titlePage:false,frontMatter:true,html:invitation?.outerHTML??'<div data-film-credit-block="community"><h3>Si tu aimes ce scénario :<br>Rejoins la communauté Clap &amp; Role !</h3></div>'};
      pages.splice(pages.indexOf(credits)+1,0,normalizeCreditsPage(community));
    }
    invitation?.remove();
    if(!doc.querySelector('[data-film-credit-block="title"]')){
      const block=doc.createElement('div');block.setAttribute('data-film-credit-block','title');
      const heading=doc.createElement('h2');heading.textContent=title;block.append(heading);
      block.insertAdjacentHTML('beforeend','<p>Nombre de joueurs : 3 à 5<br>Âge minimum : à compléter<br>Temps de jeu : à compléter</p>');doc.body.prepend(block);
    }
    const html=cleanBookHtml(doc.body.innerHTML);
    if(html!==credits.html)pages=pages.map(page=>page.id===credits.id?{...page,html}:page);
  }
  return pages.length===section.pages.length&&pages.every((page,index)=>page===section.pages[index])?section:{...section,pages};
}
