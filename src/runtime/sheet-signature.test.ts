import {expect,it} from 'vitest';
import {sheetSignature} from './sheet-signature';
it('ignores storage-only timestamps but retains actual sheet changes',()=>{const hero={updatedAt:1,notes:'notes',portrait:'portrait',injuries:{head:[false]}};expect(sheetSignature(hero)).toBe(sheetSignature({...hero,updatedAt:2}));expect(sheetSignature(hero)).not.toBe(sheetSignature({...hero,notes:'changed'}));expect(sheetSignature(hero)).not.toBe(sheetSignature({...hero,portrait:'changed'}));expect(sheetSignature(hero)).not.toBe(sheetSignature({...hero,injuries:{head:[true]}}));expect(sheetSignature(null)).not.toBe(sheetSignature(hero));});
it('hashes content consistently across local storage metadata and property order', async () => {
  const {contentDigest}=await import('./sheet-signature');
  const hero={id:'hero',updatedAt:1,directoryId:'local-a',portrait:'image',notes:'notes',linkedResources:[{type:'power',id:'card'}]};
  const digest=await contentDigest(hero);
  expect(digest).toMatch(/^[a-f0-9]{64}$/);
  expect(await contentDigest({notes:hero.notes,portrait:hero.portrait,linkedResources:hero.linkedResources,directoryId:'local-b',updatedAt:99,id:'hero'})).toBe(digest);
  for(const changed of [{...hero,notes:'changed'},{...hero,portrait:'new image'},{...hero,linkedResources:[{type:'power',id:'other'}]}])expect(await contentDigest(changed)).not.toBe(digest);
});
it('includes core attributes, skills and supernatural attributes in the hash', async () => {
  const {contentDigest}=await import('./sheet-signature');
  const facets={corps:{core:3,skills:{Force:2},supernatural:{Vol:1}},esprit:{core:4,skills:{Savoir:1},supernatural:{}},ame:{core:2,skills:{Courage:1},supernatural:{}}};
  const before=await contentDigest({facets});
  for(const patch of [{core:4},{skills:{Force:3}},{supernatural:{Vol:2}}]) expect(await contentDigest({facets:{...facets,corps:{...facets.corps,...patch}}})).not.toBe(before);
});
