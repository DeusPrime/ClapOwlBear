import { cleanBookHtml, type BookPage } from './filmBooks';
import { joinFilmContinuation } from './filmPagination';

export function mergeFilmPageBackward(pages: BookPage[], id: string, html: string) {
  const index = pages.findIndex(page => page.id === id);
  const current = pages[index], previous = pages[index - 1];
  if (!current || !previous || [current, previous].some(page => page.cover || page.titlePage || page.generated || page.frontMatter || page.imagePage)) return null;
  const left = document.createElement('div'), right = document.createElement('div');
  left.innerHTML = cleanBookHtml(previous.html); right.innerHTML = cleanBookHtml(html);
  const empty = (element: HTMLElement) => !element.textContent?.trim() && !element.querySelector('table');
  const offset = empty(left) ? 0 : (left.textContent?.length ?? 0) + left.querySelectorAll('br').length;
  const merged = { ...previous, html: empty(left) ? right.innerHTML : empty(right) ? left.innerHTML : joinFilmContinuation(left.innerHTML, right.innerHTML, true), objects: [...(previous.objects ?? []), ...(current.objects ?? [])] };
  const result = pages.filter(page => page.id !== id).map(page => page.id === previous.id ? merged : page.continuationOf === id ? { ...page, continuationOf: previous.id } : page);
  return { pages: result, target: merged, offset };
}
