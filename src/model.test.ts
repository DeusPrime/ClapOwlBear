import { describe,it,expect } from 'vitest';
import JSZip from 'jszip';
import { projectSchema,readArchive,rollDice } from './model';
const fixture=()=>({format:'clap-studio',version:1,project:{id:'p',name:'Mon film'},heroes:[{id:'h',directoryId:'p',nom:'Camille'}],resources:[],tools:[]});
describe('Import Studio',()=>{
  it('accepte le format exporté par le site et conserve les données des fiches',()=>{const p=fixture();Object.assign(p.heroes[0],{notes:'Exemple'});expect(projectSchema.parse(p).heroes[0].notes).toBe('Exemple');});
  it('rejette les versions inconnues, appartenances invalides et doublons',()=>{expect(()=>projectSchema.parse({...fixture(),version:2})).toThrow();const p=fixture();p.heroes[0].directoryId='autre';expect(()=>projectSchema.parse(p)).toThrow();const q=fixture();q.heroes.push(q.heroes[0]);expect(()=>projectSchema.parse(q)).toThrow();});
  it('lit une véritable archive et rejette studio.json absent',async()=>{
    const zip=new JSZip();zip.file('studio.json',JSON.stringify(fixture()));const bytes=await zip.generateAsync({type:'uint8array'});const file=Object.assign(bytes,{size:bytes.length}) as unknown as File;
    expect((await readArchive(file)).heroes[0].nom).toBe('Camille');
    const empty=await new JSZip().generateAsync({type:'uint8array'});await expect(readArchive(Object.assign(empty,{size:empty.length}) as unknown as File)).rejects.toThrow('studio.json');
  });
  it('importe une archive et un projet de plus de 32 Mo, avec des entrées annexes',async()=>{
    const data={...fixture(),tools:[{id:'t',directoryId:'p',name:'Grand document',data:'x'.repeat(33*1024*1024)}]};
    const zip=new JSZip();zip.file('studio.json',JSON.stringify(data));
    for(let i=0;i<5;i++)zip.file('extra/'+i+'.txt','Fichier annexe');
    const bytes=await zip.generateAsync({type:'uint8array',compression:'STORE'});
    expect(bytes.byteLength).toBeGreaterThan(32*1024*1024);
    const result=await readArchive(bytes as unknown as File);
    expect(result.tools[0].data).toHaveLength(33*1024*1024);
  });

});
describe('Jets publics',()=>{
  it('calcule plusieurs dés avec un modificateur signé',()=>{let i=0;const values=[0,5];expect(rollDice('2d6-2',()=>values[i++])).toEqual({notation:'2d6-2',dice:[1,6],total:5});});
  it('rejette les tirages créant un biais de modulo',()=>{let i=0;const values=[4294967295,5];expect(rollDice('1d6',()=>values[i++]).dice).toEqual([6]);expect(i).toBe(2);});
  it('borne les entrées',()=>{for(const v of ['0d6','101d6','1d1','1d1001','hello','1d6<script>'])expect(()=>rollDice(v)).toThrow();});
});
