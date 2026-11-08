import { normalizeCreditsPage, normalizeCreditsSection } from './filmCreditsLayout';
import { withFilmBackCover } from './filmBackCover';
import type { FilmBook, BookSection } from './filmBooks';

export const FILM_DISCORD_URL = 'https://discord.gg/rQUf6Xmnyt';
export const FILM_SITE_URL = 'https://clapnrole.com';
export const FILM_FRONT_MATTER_BACKGROUND = `${import.meta.env.BASE_URL}book-backgrounds/frontmatter-dark-left.png`;

/** Add the template's opening pages once, preserving all subsequent edits. */
export function withFilmFrontMatter(book: FilmBook): FilmBook {
  book = withFilmBackCover(book);
  if(!book.references?.toc||!book.references?.index)book={...book,references:{toc:true,index:true}};
  const insideCover = { id: `${book.id}-inside-cover`, titlePage: false, frontMatter: true, insideCover: 'front' as const, html: '' };
  const normalized=book.sections.map(section=>{const pages=section.pages.map(page=>page.id===insideCover.id?(page.insideCover==='front'&&page.html===''&&!page.objects?.length?page:{...page,insideCover:'front' as const,html:'',objects:[]}):normalizeCreditsPage(page));if(section.kind==='frontmatter'&&!pages.some(page=>page.id===insideCover.id))pages.unshift(insideCover);return pages.length!==section.pages.length||pages.some((page,index)=>page!==section.pages[index])?{...section,pages}:section;});
  for(let index=0;index<normalized.length;index++)normalized[index]=normalizeCreditsSection(normalized[index],book.name);
  if(normalized.some((section,index)=>section!==book.sections[index]))book={...book,sections:normalized};
  if (book.sections.some(section => section.kind === 'frontmatter')) {
    if (book.sections.some(section => section.kind === 'frontmatter' && (!section.background || /\/frontmatter-(left|right|gray)\.png$/.test(section.background)))) {
      return { ...book, sections: book.sections.map(section => section.kind === 'frontmatter' && (!section.background || /\/frontmatter-(left|right|gray)\.png$/.test(section.background)) ? { ...section, background: FILM_FRONT_MATTER_BACKGROUND } : section) };
    }
    return book;
  }
  const prefix = `${book.id}-frontmatter`;
  const section: BookSection = {
    id: prefix, kind: 'frontmatter', name: 'Crédits et remerciements', background: FILM_FRONT_MATTER_BACKGROUND, titleBackground: '',
    pages: [
      insideCover,
      {
        id: `${prefix}-credits`, titlePage: false, frontMatter: true,
        html: '<h2>Deuxième de couverture</h2><p>Écrit par</p><p><strong>Auteur</strong></p><p>© 2026 Auteur</p><p>Tous droits réservés.</p><h3>Rejoins la communauté Clap &amp; Role</h3><p>Si tu aimes ce scénario, retrouve les autres joueurs et partage tes aventures !</p><p>Discord : '+FILM_DISCORD_URL+'</p><p>Site : '+FILM_SITE_URL+'</p>',
        objects: [
          { id: `${prefix}-discord`, kind: 'image', locked: true, source: `${import.meta.env.BASE_URL}book-links/discord.png`, x: 40, y: 210, width: 40, height: 40, aspectRatio: 1, featherMm: 0 },
          { id: `${prefix}-site`, kind: 'image', locked: true, source: `${import.meta.env.BASE_URL}book-links/site.png`, x: 130, y: 210, width: 40, height: 40, aspectRatio: 1, featherMm: 0 },
        ],
      },
      {
        id: `${prefix}-thanks`, titlePage: false, frontMatter: true,
        html: '<h2>Remerciements</h2><p>Merci aux personnes qui ont aidé à écrire, relire ou tester ce scénario, ainsi qu’aux joueurs qui lui donnent vie autour de la table.</p><p>À compléter : auteurs, relecteurs, testeurs et autres contributeurs.</p><h2>À propos de l’IA</h2><p>Les illustrations de cet ouvrage ont été réalisées avec Midjourney, Dall-E et Stable Diffusion. Réalisant ce jeu de rôle sur mon temps libre, je n’ai pas les moyens de payer un graphiste pour le moment. Si Clap! marche et que c’est un souhait de la communauté, je serai ravi, à ce moment-là, de remplacer toutes les illustrations par celles issues du cerveau d’un être humain.</p><p>Adaptez cette mention aux outils et aux illustrations réellement utilisés dans votre scénario.</p>',
      },
    ],
  };
  const sections = [...book.sections];
  sections.splice(sections[0]?.kind === 'cover' || sections[0]?.pages.every(page => page.cover) ? 1 : 0, 0, section);
  return { ...book, sections: sections.map(section=>section.kind==='frontmatter'?normalizeCreditsSection({...section,pages:section.pages.map(normalizeCreditsPage)},book.name):section) };
}
