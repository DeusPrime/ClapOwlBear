// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { expect, it, vi } from 'vitest';
import { configureRuntime } from './client';
import { emptyGame } from '@/lib/localRoomGame';
import { saveLocalRoom } from '@/lib/roomArchive';
vi.mock('@/lib/roomArchive', async original => ({ ...await original<typeof import('@/lib/roomArchive')>(), saveLocalRoom: vi.fn() }));
it('coalesces queued room saves and acknowledges a roll without waiting for later transfers', async () => {
  const releases: (()=>void)[]=[];
  vi.mocked(saveLocalRoom).mockImplementation(async()=>new Promise<void>(resolve=>releases.push(resolve)));
  configureRuntime({background:true,channel:'persistence-test'});
  const {RoomClient}=await import('@/lib/roomClient');
  const client:any=new RoomClient();
  client.state={...client.snapshot(),session:{id:'host',name:'MJ',role:'mj'},roomInfo:{title:'Room'}};
  client.archive={id:crypto.randomUUID(),format:'clapSalle',version:1,title:'Room',hostId:'host',hostName:'MJ',updatedAt:1,game:emptyGame(),heroes:[],resources:[],sheets:{},sheetResources:{},privateRefs:[]};
  client.game=emptyGame();
  client.persist();
  await vi.waitFor(()=>expect(releases).toHaveLength(1));
  for(let sequence=1;sequence<=20;sequence++){client.game={...client.game,sequence};client.persist();}
  const rollSaved=client.persistence;
  expect(saveLocalRoom).toHaveBeenCalledTimes(1);
  releases[0]();
  await vi.waitFor(()=>expect(releases).toHaveLength(2));
  expect(vi.mocked(saveLocalRoom).mock.calls[1][0].game.sequence).toBe(20);
  client.game={...client.game,sequence:21};client.persist();
  let acknowledged=false;void rollSaved.then(()=>{acknowledged=true;});
  releases[1]();
  await vi.waitFor(()=>expect(acknowledged).toBe(true));
  await vi.waitFor(()=>expect(releases).toHaveLength(3));
  expect(vi.mocked(saveLocalRoom).mock.calls[2][0].game.sequence).toBe(21);
  releases[2]();await client.persistence;
});
