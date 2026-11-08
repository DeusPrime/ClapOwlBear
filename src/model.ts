import JSZip from 'jszip';
import { z } from 'zod';
const short = z.string().max(500);
const record = z.object({ id: short.min(1), directoryId: short.min(1) }).passthrough();
const hero = record.extend({ nom: short, concept: z.string().max(10000).optional(), portrait: z.string().max(20_000_000).optional(), facets: z.record(z.string(), z.object({ core: z.number(), skills: z.record(z.string(), z.number()), supernatural: z.record(z.string(), z.number()).optional() })).optional() });
export const projectSchema = z.object({ format:z.literal('clap-studio'), version:z.literal(1), project:z.object({id:short.min(1),name:short.min(1)}).passthrough(), heroes:z.array(hero).max(2000), resources:z.array(z.object({type:z.enum(['key-role','figurant','profile','power','vehicle']),item:record})).max(10000), tools:z.array(record).max(1000) }).superRefine((p, ctx) => {
  const ids = new Set<string>();
  for (const [kind, item] of [...p.heroes.map(h => ['hero',h] as const), ...p.resources.map(r => [r.type,r.item] as const), ...p.tools.map(t => ['tool',t] as const)]) {
    const key = `${kind}:${item.id}`;
    if (item.directoryId !== p.project.id || ids.has(key)) ctx.addIssue({code:z.ZodIssueCode.custom,message:'Identifiant dupliqué ou ressource appartenant à un autre projet.'});
    ids.add(key);
  }
});
export type Project = z.infer<typeof projectSchema>;
export const MAX_PROJECT = 32 * 1024 * 1024;
export async function readArchive(file: File): Promise<Project> {
  if (file.size > MAX_PROJECT) throw new Error('Archive limitée à 32 Mo pour cette version.');
  const zip = await JSZip.loadAsync(file);
  const entry = zip.file('studio.json');
  if (!entry || Object.keys(zip.files).length > 4) throw new Error('Archive .clapStudio invalide : studio.json attendu.');
  // JSZip does not offer streaming decompression limits; reject oversized entries before inflation.
  const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
  if (size === undefined || size > MAX_PROJECT) throw new Error('Projet décompressé limité à 32 Mo.');
  const json = await entry.async('string');
  if (new TextEncoder().encode(json).length > MAX_PROJECT) throw new Error('Projet trop volumineux.');
  return projectSchema.parse(JSON.parse(json));
}
export function rollDice(notation: string, random = () => crypto.getRandomValues(new Uint32Array(1))[0]): {notation:string;dice:number[];total:number} {
  const m = /^(\d{1,3})d(\d{1,4})([+-]\d{1,4})?$/i.exec(notation.replace(/\s/g,''));
  if (!m) throw new Error('Notation attendue : 2d6 ou 1d20+3.');
  const count=Number(m[1]), sides=Number(m[2]), modifier=Number(m[3]||0);
  if(count<1 || count>100 || sides<2 || sides>1000) throw new Error('Utilise 1 à 100 dés, de 2 à 1000 faces.');
  const ceiling=Math.floor(2**32/sides)*sides;
  const dice=Array.from({length:count},()=>{ let value=random(); while(value>=ceiling) value=random(); return value%sides+1; });
  return {notation:notation.replace(/\s/g,''),dice,total:dice.reduce((a,b)=>a+b,modifier)};
}
export async function stored(key:string, value?: unknown): Promise<unknown> {
  const db = await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('clap-owlbear',1);r.onupgradeneeded=()=>r.result.createObjectStore('data');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  try { return await new Promise((resolve,reject)=>{const tx=db.transaction('data',value===undefined?'readonly':'readwrite');const store=tx.objectStore('data');const r=value===undefined?store.get(key):store.put(value,key);tx.oncomplete=()=>resolve(r.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);}); } finally {db.close();}
}

