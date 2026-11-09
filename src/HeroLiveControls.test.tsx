// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {blankCharacter} from '@/lib/characters';
import {PlayerSheet} from '@/components/RoomPlayersBoard';
import RoomHeroStateEditor from '@/components/RoomHeroStateEditor';
const state=vi.hoisted(()=>({room:{} as any,update:vi.fn(async(_hero:any,_timestamp:number,_state?:string)=>{})}));
vi.mock('@/hooks/use-room',()=>({useRoom:()=>state.room}));
vi.mock('@/lib/roomClient',()=>({roomClient:{updateRoomHero:state.update,snapshot:()=>state.room}}));
vi.mock('@/pages/CharacterEditor',()=>({default:()=>null,CharacterCards:({onStressChange}:any)=><button type="button" onClick={()=>onStressChange(2)}>Stress click</button>}));
vi.mock('@/components/RoomHeroActions',()=>({default:()=>null}));
vi.mock('@/components/RollDialog',()=>({default:()=>null}));
let root:Root;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);root=createRoot(host);state.room={session:{id:'host',role:'mj'},sheetResources:{},sheets:{},members:[],connected:[]};vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});});
afterEach(async()=>{await act(async()=>root.unmount());document.body.innerHTML='';vi.clearAllMocks();vi.unstubAllGlobals();});
it('sends a GM constant click immediately from the displayed hero card',async()=>{
  const hero={...blankCharacter(),nom:'GM controlled hero'};
  const member={id:'alice',name:'Alice',role:'player' as const,online:true,instance:'a'};state.room.sheets.alice=hero;
  await act(async()=>root.render(<PlayerSheet hero={hero} member={member} onClose={()=>{}}/>));
  const click=[...document.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Stress click')!;
  await act(async()=>click.click());
  expect(state.update).toHaveBeenCalledOnce();expect(state.update.mock.calls[0][0].stress).toEqual([true,true,true,false,false,false,false]);
});
it('synchronizes a GM attribute edit without requiring the save button',async()=>{
  const hero={...blankCharacter(),nom:'Attributes hero'};
  await act(async()=>root.render(<RoomHeroStateEditor hero={hero}/>));
  await act(async()=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Attributs, constantes et inventaire')!.click());
  const input=document.querySelector<HTMLInputElement>('input[aria-label="Force skills"]')!;expect(input).not.toBeNull();
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'5');input.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,250));});
  await vi.waitFor(()=>expect(state.update).toHaveBeenCalled());
  expect(state.update.mock.calls.at(-1)![0].facets.corps.skills.Force).toBe(5);
});
