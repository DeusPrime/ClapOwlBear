// @vitest-environment jsdom
import {beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({
  role:'PLAYER',ready:undefined as undefined|(()=>void),
  changed:undefined as undefined|((player:{role:string;name:string})=>void),
  received:undefined as undefined|((event:{connectionId:string;data:unknown})=>void),
  saved:vi.fn(async(_key:string,_value?:unknown)=>undefined as unknown),
}));
vi.mock('@owlbear-rodeo/sdk',()=>({default:{
  isAvailable:true,onReady:(cb:()=>void)=>{state.ready=cb;},room:{id:'room-test'},
  player:{getRole:async()=>state.role,getId:async()=>'player',getName:async()=>'Camille',getMetadata:async()=>({}),onChange:(cb:typeof state.changed)=>{state.changed=cb;}},
  party:{getPlayers:async()=>[{id:'gm',name:'Le MJ',role:'GM',connectionId:'gm-connection'}],onChange:vi.fn()},
  broadcast:{sendMessage:vi.fn(async()=>{}),onMessage:(_channel:string,cb:typeof state.received)=>{state.received=cb;}},
}}));
vi.mock('./model',async importOriginal=>({...await importOriginal<typeof import('./model')>(),stored:state.saved}));
function projectTab(){return document.querySelector<HTMLButtonElement>('[data-tab="project"]')!;}
async function ready(){state.ready!();await vi.waitFor(()=>expect(state.received).toBeDefined());}
beforeEach(()=>{vi.resetModules();state.role='PLAYER';state.ready=undefined;state.changed=undefined;state.received=undefined;state.saved.mockReset().mockResolvedValue(undefined);document.body.innerHTML='<div id="app"></div>';});
describe('Accès Projet dans le panneau Owlbear',()=>{
  it('reste fermé avant de connaître le rôle puis pour un joueur, même par clic direct',async()=>{
    await import('./main');expect(projectTab().hidden).toBe(true);projectTab().click();expect(document.querySelector('input[type=file]')).toBeNull();
    await ready();expect(projectTab().hidden).toBe(true);projectTab().click();expect(document.querySelector('#content h2')?.textContent).toBe('Ma fiche');
  });
  it('autorise le MJ puis ferme immédiatement Projet lorsque le rôle devient joueur',async()=>{
    state.role='GM';await import('./main');await ready();expect(projectTab().hidden).toBe(false);projectTab().click();expect(document.querySelector('input[type=file]')).not.toBeNull();
    state.changed!({role:'PLAYER',name:'Camille'});expect(projectTab().hidden).toBe(true);expect(document.querySelector('input[type=file]')).toBeNull();expect(document.querySelector('#content h2')?.textContent).toBe('Ma fiche');
  });
  it('reçoit un projet partagé de plus de 32 Mo sans ouvrir la vue Projet du joueur',async()=>{
    await import('./main');await ready();
    const json=JSON.stringify({format:'clap-studio',version:1,project:{id:'p',name:'Grand film'},heroes:[],resources:[],tools:[{id:'t',directoryId:'p',data:'x'.repeat(33*1024*1024)}]});
    const count=Math.ceil(json.length/1500), id='large-transfer';
    const send=(data:unknown)=>state.received!({connectionId:'gm-connection',data});
    send({type:'start',id,count});
    for(let index=0;index<count;index++)send({type:'part',id,index,text:json.slice(index*1500,(index+1)*1500)});
    send({type:'end',id});
    await vi.waitFor(()=>expect(document.querySelector('#status')?.textContent).toContain('Grand film'));
    expect(state.saved).toHaveBeenCalledWith('room-test:project',expect.objectContaining({project:{id:'p',name:'Grand film'}}));
    expect(projectTab().hidden).toBe(true);
  });
});
