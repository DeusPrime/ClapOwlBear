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
  try{await player.setLocalDescription();await host.setRemoteDescription(player.localDescription!);await host.setLocalDescription();await player.setRemoteDescription(host.localDescription!);await expect.poll(()=>channel?.readyState).toBe('open');channel!.send('room state');await expect.poll(()=>b.diagnostics().lastError,{timeout:7000}).toContain('SDK rejected packet QA');await expect.poll(()=>a.diagnostics().lastError,{timeout:3000}).toContain('SDK rejected packet QA');}finally{a.stop();b.stop();}
});

it('paces a large transfer instead of exhausting a burst-limited SDK', async () => {
  const listeners=new Map<string,(event:any)=>void>();const times=new Map<string,number[]>();let refused=0;
  const wire=(id:string)=>({connectionId:id,subscribe:(fn:any)=>{listeners.set(id,fn);return()=>{};},send:async(data:any)=>{
    expect(new TextEncoder().encode(JSON.stringify(data)).length).toBeLessThan(16*1024);const now=Date.now();const recent=(times.get(id)||[]).filter(t=>now-t<300);if(recent.length>=4){refused++;throw undefined;}recent.push(now);times.set(id,recent);
    for(const [other,fn]of listeners)if(other!==id)queueMicrotask(()=>fn({connectionId:id,data:structuredClone(data)}));
  }});
  const a=createNativePeerBridge(wire('p')),b=createNativePeerBridge(wire('h'));const player=a.create(),host=b.create();const channel=player.createDataChannel('room');let incoming:RTCDataChannel|undefined;host.ondatachannel=e=>{incoming=e.channel;};
  try {
    await player.setLocalDescription();await host.setRemoteDescription(player.localDescription!);await host.setLocalDescription();await player.setRemoteDescription(host.localDescription!);await expect.poll(()=>incoming?.readyState).toBe('open');
    const received:string[]=[];channel.onmessage=e=>received.push(e.data);const frames=Array.from({length:12},()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(5900)))));for(const frame of frames)incoming!.send(frame);
    await expect.poll(()=>received,{timeout:12000}).toEqual(frames);expect(channel.readyState).toBe('open');expect(refused).toBe(0);
  } finally {a.stop();b.stop();}
},15000);

it('recovers from a transient SDK refusal without discarding the connection', async()=>{
  const listeners=new Map<string,(event:any)=>void>();let refused=false;
  const wire=(id:string)=>({connectionId:id,subscribe:(fn:any)=>{listeners.set(id,fn);return()=>{};},send:async(data:any)=>{if(id==='h'&&data.type==='data'&&!refused){refused=true;throw undefined;}for(const [other,fn]of listeners)if(other!==id)queueMicrotask(()=>fn({connectionId:id,data:structuredClone(data)}));}});
  const a=createNativePeerBridge(wire('p')),b=createNativePeerBridge(wire('h'));const player=a.create(),host=b.create();const channel=player.createDataChannel('room');let incoming:RTCDataChannel|undefined;host.ondatachannel=e=>{incoming=e.channel;};
  try{await player.setLocalDescription();await host.setRemoteDescription(player.localDescription!);await host.setLocalDescription();await player.setRemoteDescription(host.localDescription!);await expect.poll(()=>incoming?.readyState).toBe('open');let result='';channel.onmessage=e=>{result=e.data;};incoming!.send('hero retained');await expect.poll(()=>result,{timeout:4000}).toBe('hero retained');expect(channel.readyState).toBe('open');expect(b.diagnostics().retries).toBe(1);expect(b.diagnostics().lastError).toBe('');}finally{a.stop();b.stop();}
});

it('batches synchronous resource frames without a header-only network round trip', async()=>{
  const listeners=new Map<string,(event:any)=>void>();const packets:any[]=[];
  const wire=(id:string)=>({connectionId:id,subscribe:(fn:any)=>{listeners.set(id,fn);return()=>{};},send:async(data:any)=>{packets.push({id,...data});for(const [other,fn]of listeners)if(other!==id)queueMicrotask(()=>fn({connectionId:id,data:structuredClone(data)}));}});
  const a=createNativePeerBridge(wire('p')),b=createNativePeerBridge(wire('h'));const player=a.create(),host=b.create();const channel=player.createDataChannel('room');let incoming:RTCDataChannel|undefined;host.ondatachannel=e=>{incoming=e.channel;};
  try {await player.setLocalDescription();await host.setRemoteDescription(player.localDescription!);await host.setLocalDescription();await player.setRemoteDescription(host.localDescription!);await expect.poll(()=>incoming?.readyState).toBe('open');const received:string[]=[];channel.onmessage=e=>received.push(e.data);
    const frames=['size:96000',...Array.from({length:12},(_,i)=>'data:'+String(i%10).repeat(7900))];for(const frame of frames)incoming!.send(frame);
    await expect.poll(()=>received.length,{timeout:5000}).toBe(frames.length);expect(received).toEqual(frames);expect(new Set(packets.filter(p=>p.id==='h'&&p.type==='data').map(p=>p.seq)).size).toBe(1);
  } finally {a.stop();b.stop();}
});
