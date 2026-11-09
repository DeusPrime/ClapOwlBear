/** Ordered, encrypted room transport carried by Owlbear rather than a direct WebRTC connection. */
const PREFIX = 'clap-native-v1:';
const errorText = (error: unknown) => error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : typeof error === 'string' ? error : 'Erreur sans message';
const encode = (bytes: Uint8Array) => { let value = ''; for (let i=0;i<bytes.length;i+=8192) value += String.fromCharCode(...bytes.subarray(i,i+8192)); return btoa(value); };
const decode = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));
async function transform(bytes: Uint8Array, unpack = false) {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(unpack ? new DecompressionStream('gzip') : new CompressionStream('gzip'));
  const reader = stream.getReader(); const chunks: Uint8Array[] = []; let size=0;
  while (true) { const {value,done}=await reader.read(); if(done)break; size+=value.length; if(size>262144){await reader.cancel();throw new Error('Room packet too large');} chunks.push(value); }
  const output=new Uint8Array(size); let offset=0; for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length;} return output;
}
export type NativeWire = { connectionId: string; send: (data: unknown) => Promise<void>; subscribe: (fn:(event:{connectionId:string;data:unknown})=>void)=>()=>void };
export function createNativePeerBridge(wire: NativeWire) {
  const peers = new Map<string, NativePeer>();
  // Share the budget across peers and control packets, not just each transfer.
  let lastSend=0;let stopped=false;let draining=false;let urgentStreak=0;
  type SendJob={packet:any;resolve:()=>void;reject:(error:unknown)=>void};
  const urgent:SendJob[]=[], bulk:SendJob[]=[];
  const wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
  const drain=async()=>{
    if(draining)return;draining=true;
    try{while(urgent.length||bulk.length){
      const job=urgent.length&&(urgentStreak<4||!bulk.length)?(urgentStreak++,urgent.shift()!):(urgentStreak=0,bulk.shift()!);
      try{for(let attempt=0;;attempt++){
        if(stopped)throw new Error('Transport stopped');
        const delay=100-(Date.now()-lastSend);if(delay>0)await wait(delay);
        if(stopped)throw new Error('Transport stopped');lastSend=Date.now();
        try{await wire.send(job.packet);job.resolve();break;}catch(error){if(attempt===3)throw error;stats.retries++;await wait(500*2**attempt);}
      }}catch(error){job.reject(error);}
    }}finally{draining=false;}
  };
  const scheduledSend=(packet:any)=>new Promise<void>((resolve,reject)=>{
    (packet.type!=='data'||packet.lane==='control'?urgent:bulk).push({packet,resolve,reject});void drain();
  });
  const stats={created:0,localDescriptions:0,remoteDescriptions:0,readySent:0,readyReceived:0,packets:0,unknownPeer:0,wrongConnection:0,lastError:'',lastClose:'',retries:0,sentTypes:{} as Record<string,number>,receivedTypes:{} as Record<string,number>};
  class Channel {
    readyState: RTCDataChannelState='connecting'; bufferedAmount=0; bufferedAmountLowThreshold=64000;
    onopen:any;onmessage:any;onclose:any;onbufferedamountlow:any;
    constructor(readonly peer:NativePeer){}
    send(value:string){if(this.readyState!=='open')throw new Error('Channel closed');this.bufferedAmount+=value.length*2;this.peer.queue.push(value);this.peer.scheduleFlush();}
    get prioritySupported(){return this.peer.prioritySupported;}
    sendPriority(value:string){if(this.readyState!=='open'||!this.prioritySupported||value.length>8040||this.peer.control.queue.length>=128)throw new Error('Priority channel unavailable');this.peer.control.queue.push(value);this.peer.scheduleFlush();}
    close(){this.peer.close();}
  }
  class NativePeer {
    id=crypto.randomUUID(); remoteId='';remoteConnection='';key?:CryptoKey;
    keys=crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey']);
    prioritySupported=false;
    bulk={queue:[] as string[],sending:false,sent:0,received:0,pending:undefined as {seq:number;resolve:()=>void;reject:(e:Error)=>void}|undefined,timer:undefined as ReturnType<typeof setTimeout>|undefined,chunks:undefined as {seq:number;count:number;iv:string;parts:Map<number,string>;created:number}|undefined};
    control={...this.bulk,queue:[] as string[]};
    get queue(){return this.bulk.queue;}
    flushQueued=false;receiving=Promise.resolve();
    channel?:Channel;localDescription:any;remoteDescription:any;readyTimer?:ReturnType<typeof setInterval>;readyTries=0;
    signalingState='stable';connectionState='new';iceGatheringState='complete';
    ondatachannel:any;onconnectionstatechange:any;
    constructor(){peers.set(this.id,this);stats.created++;}
    createDataChannel(){return this.channel = new Channel(this);}
    async setLocalDescription(){
      stats.localDescriptions++;const pair=await this.keys;const pub=await crypto.subtle.exportKey('jwk',pair.publicKey);const type=this.remoteDescription?'answer':'offer';
      const sdp=PREFIX+JSON.stringify({id:this.id,connection:wire.connectionId,pub,priority:true});
      this.localDescription={type,sdp,toJSON:()=>({type,sdp})};this.signalingState=type==='offer'?'have-local-offer':'stable';
    }
    async setRemoteDescription(description:any){
      stats.remoteDescriptions++;
      if(typeof description.sdp!=='string'||!description.sdp.startsWith(PREFIX))throw new Error('Rechargez l’extension CLAP! chez tous les participants.');
      const value=JSON.parse(description.sdp.slice(PREFIX.length));
      if(typeof value.id!=='string'||value.id.length>100||typeof value.connection!=='string'||value.connection.length>100)throw new Error('Invalid peer');
      const pub=await crypto.subtle.importKey('jwk',value.pub,{name:'ECDH',namedCurve:'P-256'},false,[]);
      this.key=await crypto.subtle.deriveKey({name:'ECDH',public:pub},(await this.keys).privateKey,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
      this.prioritySupported=value.priority===true;
      this.remoteId=value.id;this.remoteConnection=value.connection;this.remoteDescription=description;
      if(description.type==='offer'){this.channel=new Channel(this);this.ondatachannel?.({channel:this.channel});}
      else {
        this.signalingState='stable';
        this.readyTimer=setInterval(()=>{if(++this.readyTries>20){stats.lastError='Confirmation du MJ absente';this.close();}else void this.send({type:'ready'}).catch(error=>{stats.lastError=String(error);});},1000);
        await this.send({type:'ready'});
      }
    }
    open(){if(!this.channel||this.channel.readyState!=='connecting')return;this.channel.readyState='open';this.connectionState='connected';this.onconnectionstatechange?.();this.channel.onopen?.(new Event('open'));}
    send(packet:any){stats.sentTypes[packet.type]=(stats.sentTypes[packet.type]||0)+1;if(packet.type==='ready')stats.readySent++;return scheduledSend({...packet,target:this.remoteId,sender:this.id});}
    scheduleFlush(){if(this.flushQueued)return;this.flushQueued=true;queueMicrotask(()=>{this.flushQueued=false;void this.flush(this.bulk);void this.flush(this.control);});}
    async flush(lane:typeof this.bulk){
      if(lane.sending||this.channel?.readyState!=='open')return;lane.sending=true;let phase='prepare';
      try {while(lane.queue.length&&this.channel?.readyState==='open'){
        const frames:string[]=[];let size=0,bytes=0;const encoder=new TextEncoder();
        while(lane.queue.length&&frames.length<64){const frame=lane.queue[0];const length=encoder.encode(frame).length;if(frames.length&&bytes+length>128000)break;lane.queue.shift();frames.push(frame);size+=frame.length;bytes+=length;}
        const seq=++lane.sent;const iv=crypto.getRandomValues(new Uint8Array(12));
        const aad=new TextEncoder().encode(this.id+':'+this.remoteId+':'+seq+(lane===this.control?':control':''));
        phase='compress';const packed=await transform(new TextEncoder().encode(JSON.stringify(frames)));
        phase='encrypt';const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},this.key!,packed as BufferSource);
        const body=encode(new Uint8Array(cipher));const count=Math.ceil(body.length/12000);
        let accepted=false;
        for(let attempt=0;attempt<4&&!accepted;attempt++){
          const ack=new Promise<void>((resolve,reject)=>{lane.pending={seq,resolve,reject};});
          void ack.catch(()=>{});
          try {phase='broadcast';for(let index=0;index<count;index++)await this.send({type:'data',...(lane===this.control?{lane:'control'}:{}),seq,index,count,iv:encode(iv),text:body.slice(index*12000,(index+1)*12000)});phase='ack';lane.timer=setTimeout(()=>lane.pending?.reject(new Error('Owlbear packet timeout')),5000);await ack;accepted=true;}
          catch(error) {if(phase==='broadcast'||attempt===3)throw error;await wait(500*2**attempt);}finally{clearTimeout(lane.timer);lane.pending=undefined;}
        }
        if(lane===this.bulk)this.channel!.bufferedAmount=Math.max(0,this.channel!.bufferedAmount-size*2);
        if(this.channel!.bufferedAmount<=this.channel!.bufferedAmountLowThreshold)this.channel!.onbufferedamountlow?.(new Event('bufferedamountlow'));
      }}catch(error){stats.lastError='send/'+phase+': '+errorText(error).slice(0,250);this.close(true,stats.lastError);}finally{lane.sending=false;}
    }
    async receive(packet:any){
      if(this.connectionState==='closed')return;
      if(packet.type==='ready'){stats.readyReceived++;this.open();if(this.remoteDescription?.type==='offer')await this.send({type:'ready-ack'});return;}
      if(packet.type==='ready-ack'){stats.readyReceived++;clearInterval(this.readyTimer);this.open();return;}
      if(packet.type==='close'){if(typeof packet.reason==='string')stats.lastError='remote: '+packet.reason.slice(0,250);this.close(false);return;}
      if(packet.lane!==undefined&&packet.lane!=='control')return;
      if(packet.lane==='control'&&!this.prioritySupported)return;
      const lane=packet.lane==='control'?this.control:this.bulk;
      if(packet.type==='ack'){if(lane.pending && packet.seq===lane.pending.seq)lane.pending.resolve();return;}
      if(packet.type!=='data'||!Number.isSafeInteger(packet.seq)||packet.seq<1||!Number.isInteger(packet.count)||packet.count<1||packet.count>32||!Number.isInteger(packet.index)||packet.index<0||packet.index>=packet.count||typeof packet.text!=='string'||packet.text.length>12000||typeof packet.iv!=='string'||packet.iv.length!==16)return;
      if(packet.seq<=lane.received){await this.send({type:'ack',...(packet.lane==='control'?{lane:'control'}:{}),seq:packet.seq});return;}
      if(packet.seq!==lane.received+1)return;
      if(!lane.chunks||lane.chunks.seq!==packet.seq||Date.now()-lane.chunks.created>30000)lane.chunks={seq:packet.seq,count:packet.count,iv:packet.iv,parts:new Map(),created:Date.now()};
      const chunk=lane.chunks;if(chunk.count!==packet.count||chunk.iv!==packet.iv)return;chunk.parts.set(packet.index,packet.text);
      if(chunk.parts.size!==chunk.count)return;
      const body=Array.from({length:chunk.count},(_,i)=>chunk.parts.get(i)!).join('');
      const aad=new TextEncoder().encode(this.remoteId+':'+this.id+':'+packet.seq+(packet.lane==='control'?':control':''));
      const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(chunk.iv) as BufferSource,additionalData:aad},this.key!,decode(body) as BufferSource);
      const frames=JSON.parse(new TextDecoder().decode(await transform(new Uint8Array(plain),true)));
      if(!Array.isArray(frames)||frames.length>64||frames.some(frame=>typeof frame!=='string'||frame.length>8040))throw new Error('Invalid room frames');
      clearInterval(this.readyTimer);this.open();
      lane.received=packet.seq;lane.chunks=undefined;for(const frame of frames)this.channel?.onmessage?.({data:frame});await this.send({type:'ack',...(packet.lane==='control'?{lane:'control'}:{}),seq:packet.seq});
    }
    close(notify=true,reason?:string){clearInterval(this.readyTimer);if(this.connectionState==='closed')return;stats.lastClose=notify?'local':'remote';if(notify&&this.remoteId)void this.send({type:'close',...(reason?{reason}: {})}).catch(()=>{});this.connectionState='closed';for(const lane of [this.bulk,this.control]){clearTimeout(lane.timer);lane.pending?.reject(new Error('Closed'));lane.queue=[];}peers.delete(this.id);if(this.channel){this.channel.readyState='closed';this.channel.onclose?.(new Event('close'));}this.onconnectionstatechange?.();}
  }
  const unsubscribe=wire.subscribe(event=>{
    stats.packets++;const packet=event.data as any;if(typeof packet?.type==='string')stats.receivedTypes[packet.type]=(stats.receivedTypes[packet.type]||0)+1;const peer=packet&&peers.get(packet.target);
    if(!peer||packet.sender!==peer.remoteId){stats.unknownPeer++;return;}
    if(event.connectionId!==peer.remoteConnection){stats.wrongConnection++;return;}
    peer.receiving=peer.receiving.then(()=>peer.receive(packet)).catch((error: unknown)=>{stats.lastError='receive: '+errorText(error).slice(0,250);peer.close(true,stats.lastError);});
  });
  return { diagnostics:()=>({...stats,peers:[...peers.values()].map(peer=>({state:peer.connectionState,remote:Boolean(peer.remoteId),keys:Boolean(peer.key),channel:peer.channel?.readyState}))}), create:()=>new NativePeer() as unknown as RTCPeerConnection, stop:()=>{stopped=true;unsubscribe();for(const peer of peers.values())peer.close(false);} };
}
