import { expect, it } from 'vitest';
import { createNativePeerBridge } from './native-peer';
it('connects isolated participants without WebRTC and delivers ordered encrypted frames', async () => {
  const listeners = new Map<string,(event:any)=>void>(); const packets:any[]=[];
  const wire=(id:string)=>({connectionId:id,subscribe:(callback:any)=>{listeners.set(id,callback);return()=>{listeners.delete(id);};},send:async(data:any)=>{packets.push(structuredClone(data));for(const [other,fn]of listeners)if(other!==id)queueMicrotask(()=>fn({connectionId:id,data:structuredClone(data)}));}});
  const first=createNativePeerBridge(wire('guest-private')),second=createNativePeerBridge(wire('mj'));
  const player=first.create(),host=second.create();const outgoing=player.createDataChannel('room');let incoming:RTCDataChannel|undefined;
  host.ondatachannel=event=>{incoming=event.channel;};
  try {
    await player.setLocalDescription(); await host.setRemoteDescription(player.localDescription!);
    await host.setLocalDescription(); await player.setRemoteDescription(host.localDescription!);
    await expect.poll(()=>outgoing.readyState).toBe('open');await expect.poll(()=>incoming?.readyState).toBe('open');
    const received:string[]=[];incoming!.onmessage=event=>received.push(event.data);
    const secret='Notes privées du héros 🐻';outgoing.send(secret);outgoing.send('second');
    await expect.poll(()=>received).toEqual([secret,'second']);
    expect(JSON.stringify(packets)).not.toContain(secret);expect(JSON.stringify(packets)).not.toContain('second');
    const before=received.length;const duplicate=packets.find(p=>p.type==='data');listeners.get('mj')!({connectionId:'intruder',data:duplicate});
    await new Promise(resolve=>setTimeout(resolve,30));expect(received).toHaveLength(before);
    const replies:string[]=[];outgoing.onmessage=event=>replies.push(event.data);incoming!.send('public roll');
    await expect.poll(()=>replies).toEqual(['public roll']);
  }finally{first.stop();second.stop();}
});
it('retries a lost ready message without falsely marking the player connected', async () => {
  const listeners=new Map<string,(event:any)=>void>();let dropped=false;
  const wire=(id:string)=>({connectionId:id,subscribe:(fn:any)=>{listeners.set(id,fn);return()=>{};},send:async(data:any)=>{if(id==='p'&&data.type==='ready'&&!dropped){dropped=true;return;}for(const [other,fn]of listeners)if(other!==id)queueMicrotask(()=>fn({connectionId:id,data:structuredClone(data)}));}});
  const a=createNativePeerBridge(wire('p')),b=createNativePeerBridge(wire('h'));const player=a.create(),host=b.create();const channel=player.createDataChannel('room');host.ondatachannel=()=>{};
  try{await player.setLocalDescription();await host.setRemoteDescription(player.localDescription!);await host.setLocalDescription();await player.setRemoteDescription(host.localDescription!);expect(channel.readyState).toBe('connecting');await expect.poll(()=>channel.readyState,{timeout:3000}).toBe('open');expect(a.diagnostics().readySent).toBeGreaterThanOrEqual(2);}finally{a.stop();b.stop();}
});
it('retains and propagates the SDK send failure instead of closing with an empty error', async () => {
  const listeners=new Map<string,(event:any)=>void>();
  const wire=(id:string)=>({connectionId:id,subscribe:(fn:any)=>{listeners.set(id,fn);return()=>{};},send:async(data:any)=>{if(id==='h'&&data.type==='data')throw new Error('SDK rejected packet QA');for(const [other,fn]of listeners)if(other!==id)queueMicrotask(()=>fn({connectionId:id,data:structuredClone(data)}));}});
  const a=createNativePeerBridge(wire('p')),b=createNativePeerBridge(wire('h'));const player=a.create(),host=b.create();player.createDataChannel('room');let channel:RTCDataChannel|undefined;host.ondatachannel=event=>{channel=event.channel;};
  try{await player.setLocalDescription();await host.setRemoteDescription(player.localDescription!);await host.setLocalDescription();await player.setRemoteDescription(host.localDescription!);await expect.poll(()=>channel?.readyState).toBe('open');channel!.send('room state');await expect.poll(()=>b.diagnostics().lastError).toContain('SDK rejected packet QA');await expect.poll(()=>a.diagnostics().lastError).toContain('SDK rejected packet QA');}finally{a.stop();b.stop();}
});
