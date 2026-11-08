import { bookTemplateUrl } from './bookBackground';
import type { BookPage, BookSection } from './filmBooks';

export function filmPageHasDarkBackground(section: BookSection, page: BookPage) {
  if(page.imagePage)return false;
  if(page.titlePage||page.frontMatter||page.generated)return true;
  if(!section.background)return false;
  const defaultDark=/\/(?:left|right)-dark\.png$/.test(section.background);
  return page.backgroundTone ? page.backgroundTone==='dark' : defaultDark;
}

// Page numbers are continuous across sections: odd pages face right.
export function filmPageBackground(section: BookSection, page: BookPage, pageNumber: number) {
  if(page.imagePage)return page.imagePage.source??'';
  if(page.generated==='index')return `${import.meta.env.BASE_URL}book-backgrounds/index-${pageNumber%2?'right':'left'}.png`;
  if(page.insideCover)return import.meta.env.BASE_URL+'book-backgrounds/'+(page.insideCover==='front'?'inside-cover.jpg':'inside-back-cover.png');
  if(page.generated==='toc')return `${import.meta.env.BASE_URL}book-backgrounds/toc-${pageNumber%2?'right':'left'}.png`;
  if (page.titlePage) return section.titleBackground;
  if (!section.background) return '';
  const side = pageNumber % 2 ? 'right' : 'left';
  if (/\/frontmatter-dark-(left|right)\.png$/.test(section.background)) return `${import.meta.env.BASE_URL}book-backgrounds/frontmatter-dark-${side}.png`;
  if (/\/frontmatter-(left|right)\.png$/.test(section.background)) return `${import.meta.env.BASE_URL}book-backgrounds/frontmatter-${side}.png`;
  const template = section.background.match(/\/(?:left|right)-(light|dark)\.png$/);
  const tone = page.backgroundTone ?? (template?.[1] === 'dark' ? 'dark' : 'light');
  if (section.backgroundVariants) return section.backgroundVariants[`${side}-${tone}`];
  return template ? bookTemplateUrl(side, tone) : section.background;
}

// Bands remain in front of the watermark; coordinates match the book template.
export const FILM_BAND_HEIGHT_MM = 18.245;
export const filmBandFadeStops: [number,number][] = [[0,0],[24,0],...Array.from({length:17},(_,i):[number,number]=>{const t=i/16;return [24+10*t,t*t*(3-2*t)];}),...Array.from({length:17},(_,i):[number,number]=>{const t=i/16;return [264+10*t,1-t*t*(3-2*t)];}),[274,0],[297,0]];
const bandFadeMask = 'linear-gradient(to bottom,'+filmBandFadeStops.map(([mm,alpha])=>'rgba(0,0,0,'+alpha+') '+mm+'mm').join(',')+')';
export function fadeFilmBandCut(ctx:CanvasRenderingContext2D,width:number,height:number){
  ctx.save();ctx.globalCompositeOperation='destination-in';
  const gradient=ctx.createLinearGradient(0,0,0,height);
  for(const [mm,alpha] of filmBandFadeStops)gradient.addColorStop(mm/297,'rgba(0,0,0,'+alpha+')');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);ctx.restore();
}
export const filmBandCss = `.book-page .book-watermark[data-protect-bands]{clip-path:inset(24mm 0 23mm 0);mask-image:${bandFadeMask};-webkit-mask-image:${bandFadeMask}}.book-page .book-bands{position:absolute;inset:0;pointer-events:none;z-index:1;background-size:100% 100%;mask-image:linear-gradient(to bottom,#000 0,#000 ${FILM_BAND_HEIGHT_MM}mm,transparent ${FILM_BAND_HEIGHT_MM}mm,transparent calc(100% - ${FILM_BAND_HEIGHT_MM}mm),#000 calc(100% - ${FILM_BAND_HEIGHT_MM}mm));-webkit-mask-image:linear-gradient(to bottom,#000 0,#000 ${FILM_BAND_HEIGHT_MM}mm,transparent ${FILM_BAND_HEIGHT_MM}mm,transparent calc(100% - ${FILM_BAND_HEIGHT_MM}mm),#000 calc(100% - ${FILM_BAND_HEIGHT_MM}mm))}.book-page .book-content,.book-page .book-number{z-index:2}`;
