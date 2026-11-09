import { contentDigest } from './sheet-signature';
export type SheetValue = { path: string[]; value?: unknown; remove?: boolean };
export type SheetChange = SheetValue & { beforeHash: string };
const fields = new Set(['nom','age','taille','poids','concept','replique','portrait','facets','traits','specialite','lore','notes','armes','armures','autresAccessoires','injuries','stress','griefs','cardInk','cardCheckColors','criticalStates','pointsRecits','destinDiceCount','supernaturalEnabled','mandatoryComplication','climaxUsed','linkedResources']);
export const validSheetPath = (path: string[]) => path.length > 0 && path.length <= 8 && fields.has(path[0]) && path.every(key => key.length <= 100 && !['__proto__','prototype','constructor'].includes(key));
export function sheetValue(source: unknown, path: string[]): unknown {
  let value: any = source;
  for (const key of path) { if (!value || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value,key)) return undefined; value=value[key]; }
  return value;
}
const same = (a: unknown,b: unknown) => Object.is(a,b)||JSON.stringify(a)===JSON.stringify(b);
export function sheetValues(before: unknown, after: unknown): SheetValue[] {
  const changes: SheetValue[]=[];
  const walk=(a:any,b:any,path:string[])=>{
    if(same(a,b))return;
    const records=a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b);
    const checks=Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every(item=>typeof item==='boolean')&&b.every(item=>typeof item==='boolean');
    if(records||checks){for(const key of new Set([...Object.keys(a),...Object.keys(b)]))walk(a[key],b[key],[...path,key]);return;}
    changes.push(b===undefined?{path,remove:true}:{path,value:structuredClone(b)});
  };
  for(const key of fields)walk((before as any)?.[key],(after as any)?.[key],[key]);
  return changes;
}
export async function createSheetChanges(before: unknown, after: unknown): Promise<SheetChange[]> {
  return Promise.all(sheetValues(before,after).map(async change=>({...change,beforeHash:await contentDigest(sheetValue(before,change.path))})));
}
export function applySheetValues<T>(source:T, changes:SheetValue[]):T {
  const result=structuredClone(source) as any;
  for(const change of changes){
    if(!validSheetPath(change.path))throw new Error('Invalid sheet field');
    let parent=result;
    for(const key of change.path.slice(0,-1)){if(!parent[key]||typeof parent[key]!=='object')parent[key]={};parent=parent[key];}
    const key=change.path.at(-1)!;
    if(Array.isArray(parent)&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=parent.length||change.remove))throw new Error('Invalid sheet index');
    if(change.remove)delete parent[key];else parent[key]=structuredClone(change.value);
  }
  return result;
}
export async function applySheetChanges<T>(source:T, changes:SheetChange[], force=false) {
  const accepted:SheetValue[]=[];
  for(const change of changes){if(!validSheetPath(change.path))throw new Error('Invalid sheet field');if(force||await contentDigest(sheetValue(source,change.path))===change.beforeHash||same(sheetValue(source,change.path),change.value))accepted.push(change);}
  return applySheetValues(source,accepted);
}
export function valuesAt(source:unknown, changes:SheetValue[]):SheetValue[]{return changes.map(({path})=>{const value=sheetValue(source,path);return value===undefined?{path,remove:true}:{path,value:structuredClone(value)};});}
