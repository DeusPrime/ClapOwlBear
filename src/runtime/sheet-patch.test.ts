import {expect,it} from 'vitest';
import {applySheetChanges,applySheetValues,createSheetChanges,sheetValues} from './sheet-patch';
it('sends only changed attributes and constants without the portrait or other fields',async()=>{
  const before={id:'hero',portrait:'large-image',facets:{corps:{core:3,skills:{Force:2}}},stress:[false,false,false],notes:'Keep notes'};
  const after={...before,facets:{corps:{core:4,skills:{Force:2}}},stress:[false,true,false]};
  const patch=await createSheetChanges(before,after);
  expect(patch.map(change=>change.path)).toEqual([['facets','corps','core'],['stress','1']]);
  expect(JSON.stringify(patch)).not.toContain('large-image');expect(JSON.stringify(patch)).not.toContain('Keep notes');
  expect(await applySheetChanges(before,patch)).toEqual(after);
});
it('keeps unrelated concurrent edits and resolves a conflicting field in favour of the host',async()=>{
  const original={facets:{corps:{core:3}},notes:'Before',stress:[false,false]};
  const player=await createSheetChanges(original,{...original,notes:'Player note'});
  const host={...original,stress:[true,false]};
  expect(await applySheetChanges(host,player)).toEqual({...host,notes:'Player note'});
  const otherPlayer=await createSheetChanges(original,{...original,facets:{corps:{core:4}}});
  const hostEdit={...original,facets:{corps:{core:5}}};
  expect(await applySheetChanges(hostEdit,otherPlayer)).toEqual(hostEdit);
  const hostPatch=await createSheetChanges(original,hostEdit);
  expect(await applySheetChanges({...original,facets:{corps:{core:4}}},hostPatch,true)).toEqual(hostEdit);
});
it('supports inventory changes and rejects identity or prototype changes',async()=>{
  const before={id:'hero',autresAccessoires:[] as {nom:string;proprietes:string}[]};
  const after={...before,autresAccessoires:[{nom:'Key',proprietes:'Brass'}]};
  const patch=await createSheetChanges(before,after);expect(patch).toHaveLength(1);expect(patch[0].path).toEqual(['autresAccessoires']);
  expect(await applySheetChanges(before,patch)).toEqual(after);
  expect(()=>applySheetValues(before,[{path:['id'],value:'other'}])).toThrow();
  expect(()=>applySheetValues(before,[{path:['facets','__proto__','polluted'],value:true}])).toThrow();
  expect(sheetValues(before,{...before,id:'other'})).toEqual([]);
});
