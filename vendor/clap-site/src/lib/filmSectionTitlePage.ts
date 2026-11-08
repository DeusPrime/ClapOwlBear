import { newBookPage, type BookSection } from './filmBooks';

export function sectionTitlePagePatch(section: BookSection, enabled: boolean): Partial<BookSection> {
  if(section.kind)return {};
  const first=section.pages[0];
  if(enabled){
    if(first?.titlePage)return {};
    const title=section.savedTitlePage??newBookPage(true);
    return { pages:[title,...section.pages], savedTitlePage:undefined };
  }
  if(!first?.titlePage)return {};
  return {pages:section.pages.length>1?section.pages.slice(1):[{...newBookPage(),html:'<p><br></p>'}],savedTitlePage:first};
}
