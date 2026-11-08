/** Ordered, encrypted room transport carried by Owlbear rather than a direct WebRTC connection. */
const PREFIX = 'clap-native-v1:';
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
  const stats={created:0,localDescriptions:0,remoteDescriptions:0,readySent:0,readyReceived:0,packets:0,unknownPeer:0,wrongConnection:0,lastError:''};
  class Channel {
    readyState: RTCDataChannelState='connecting'; bufferedAmount=0; bufferedAmountLowThreshold=64000;
    onopen:any;onmessage:any;onclose:any;onbufferedamountlow:any;
    constructor(readonly peer:NativePeer){}
    send(value:string){if(this.readyState!=='open')throw new Error('Channel closed');this.bufferedAmount+=value.length*2;this.peer.queue.push(value);void this.peer.flush();}
    close(){this.peer.close();}
  }
  class NativePeer {
    id=crypto.randomUUID(); remoteId='';remoteConnection='';key?:CryptoKey;
    keys=crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey']);
    queue:string[]=[];sending=false;sent=0;received=0;pending?:{seq:number;resolve:()=>void;reject:(e:Error)=>void};timer?:ReturnType<typeof setTimeout>;
    chunks?:{seq:number;count:number;iv:string;parts:Map<number,string>;created:number};receiving=Promise.resolve();
    channel?:Channel;localDescription:any;remoteDescription:any;readyTimer?:ReturnType<typeof setInterval>;readyTries=0;
    signalingState='stable';connectionState='new';iceGatheringState='complete';
    ondatachannel:any;onconnectionstatechange:any;
    constructor(){peers.set(this.id,this);stats.created++;}
    createDataChannel(){return this.channel = new Channel(this);}
    async setLocalDescription(){
      stats.localDescriptions++;const pair=await this.keys;const pub=await crypto.subtle.exportKey('jwk',pair.publicKey);const type=this.remoteDescription?'answer':'offer';
      const sdp=PREFIX+JSON.stringify({id:this.id,connection:wire.connectionId,pub});
      this.localDescription={type,sdp,toJSON:()=>({type,sdp})};this.signalingState=type==='offer'?'have-local-offer':'stable';
    }
    async setRemoteDescription(description:any){
      stats.remoteDescriptions++;
      if(typeof description.sdp!=='string'||!description.sdp.startsWith(PREFIX))throw new Error('Rechargez l’extension CLAP! chez tous les participants.');
      const value=JSON.parse(description.sdp.slice(PREFIX.length));
      if(typeof value.id!=='string'||value.id.length>100||typeof value.connection!=='string'||value.connection.length>100)throw new Error('Invalid peer');
      const pub=await crypto.subtle.importKey('jwk',value.pub,{name:'ECDH',namedCurve:'P-256'},false,[]);
      this.key=await crypto.subtle.deriveKey({name:'ECDH',public:pub},(await this.keys).privateKey,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
      this.remoteId=value.id;this.remoteConnection=value.connection;this.remoteDescription=description;
      if(description.type==='offer'){this.channel=new Channel(this);this.ondatachannel?.({channel:this.channel});}
      else {
        this.signalingState='stable';
        this.readyTimer=setInterval(()=>{if(++this.readyTries>20){stats.lastError='Confirmation du MJ absente';this.close();}else void this.send({type:'ready'}).catch(error=>{stats.lastError=String(error);});},1000);
        await this.send({type:'ready'});
      }
    }
    open(){if(!this.channel||this.channel.readyState!=='connecting')return;this.channel.readyState='open';this.connectionState='connected';this.onconnectionstatechange?.();this.channel.onopen?.(new Event('open'));}
    send(packet:any){if(packet.type==='ready')stats.readySent++;return wire.send({...packet,target:this.remoteId,sender:this.id});}
    async flush(){
      if(this.sending||this.channel?.readyState!=='open')return;this.sending=true;
      try {while(this.queue.length&&this.channel?.readyState==='open'){
        const frames:string[]=[];let size=0;while(this.queue.length&&size<32000){const frame=this.queue.shift()!;frames.push(frame);size+=frame.length;}
        const seq=++this.sent;const iv=crypto.getRandomValues(new Uint8Array(12));
        const aad=new TextEncoder().encode(this.id+':'+this.remoteId+':'+seq);
        const packed=await transform(new TextEncoder().encode(JSON.stringify(frames)));
        const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},this.key!,packed as BufferSource);
        const body=encode(new Uint8Array(cipher));const count=Math.ceil(body.length/6000);
        let accepted=false;
        for(let attempt=0;attempt<4&&!accepted;attempt++){
          const ack=new Promise<void>((resolve,reject)=>{this.pending={seq,resolve,reject};this.timer=setTimeout(()=>reject(new Error('Owlbear packet timeout')),5000);});
          void ack.catch(()=>{});
          try {for(let index=0;index<count;index++)await this.send({type:'data',seq,index,count,iv:encode(iv),text:body.slice(index*6000,(index+1)*6000)});await ack;accepted=true;}
          catch {if(attempt===3)throw new Error('Connexion Owlbear interrompue.');}finally{clearTimeout(this.timer);this.pending=undefined;}
        }
        this.channel!.bufferedAmount=Math.max(0,this.channel!.bufferedAmount-size*2);
        if(this.channel!.bufferedAmount<=this.channel!.bufferedAmountLowThreshold)this.channel!.onbufferedamountlow?.(new Event('bufferedamountlow'));
      }}catch{this.connectionState='failed';this.onconnectionstatechange?.();this.close();}finally{this.sending=false;}
    }
    async receive(packet:any){
      if(this.connectionState==='closed')return;
      if(packet.type==='ready'){stats.readyReceived++;this.open();if(this.remoteDescription?.type==='offer')await this.send({type:'ready-ack'});return;}
      if(packet.type==='ready-ack'){stats.readyReceived++;clearInterval(this.readyTimer);this.open();return;}
      if(packet.type==='close'){this.close(false);return;}
      if(packet.type==='ack'){if(this.pending && packet.seq===this.pending.seq)this.pending.resolve();return;}
      if(packet.type!=='data'||!Number.isSafeInteger(packet.seq)||packet.seq<1||!Number.isInteger(packet.count)||packet.count<1||packet.count>32||!Number.isInteger(packet.index)||packet.index<0||packet.index>=packet.count||typeof packet.text!=='string'||packet.text.length>6000||typeof packet.iv!=='string'||packet.iv.length!==16)return;
      if(packet.seq<=this.received){await this.send({type:'ack',seq:packet.seq});return;}
      if(packet.seq!==this.received+1)return;
      if(!this.chunks||this.chunks.seq!==packet.seq||Date.now()-this.chunks.created>30000)this.chunks={seq:packet.seq,count:packet.count,iv:packet.iv,parts:new Map(),created:Date.now()};
      const chunk=this.chunks;if(chunk.count!==packet.count||chunk.iv!==packet.iv)return;chunk.parts.set(packet.index,packet.text);
      if(chunk.parts.size!==chunk.count)return;
      const body=Array.from({length:chunk.count},(_,i)=>chunk.parts.get(i)!).join('');
      const aad=new TextEncoder().encode(this.remoteId+':'+this.id+':'+packet.seq);
      const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(chunk.iv) as BufferSource,additionalData:aad},this.key!,decode(body) as BufferSource);
      const frames=JSON.parse(new TextDecoder().decode(await transform(new Uint8Array(plain),true)));
      if(!Array.isArray(frames)||frames.length>64||frames.some(frame=>typeof frame!=='string'||frame.length>8040))throw new Error('Invalid room frames');
      clearInterval(this.readyTimer);this.open();
      this.received=packet.seq;this.chunks=undefined;for(const frame of frames)this.channel?.onmessage?.({data:frame});await this.send({type:'ack',seq:packet.seq});
    }
    close(notify=true){clearInterval(this.readyTimer);if(this.connectionState==='closed')return;if(notify&&this.remoteId)void this.send({type:'close'}).catch(()=>{});this.connectionState='closed';clearTimeout(this.timer);this.pending?.reject(new Error('Closed'));this.queue=[];peers.delete(this.id);if(this.channel){this.channel.readyState='closed';this.channel.onclose?.(new Event('close'));}this.onconnectionstatechange?.();}
  }
  const unsubscribe=wire.subscribe(event=>{
    stats.packets++;const packet=event.data as any;const peer=packet&&peers.get(packet.target);
    if(!peer||packet.sender!==peer.remoteId){stats.unknownPeer++;return;}
    if(event.connectionId!==peer.remoteConnection){stats.wrongConnection++;return;}
    peer.receiving=peer.receiving.then(()=>peer.receive(packet)).catch((error: unknown)=>{stats.lastError=error instanceof Error?error.message:String(error);peer.close();});
  });
  return { diagnostics:()=>({...stats,peers:[...peers.values()].map(peer=>({state:peer.connectionState,remote:Boolean(peer.remoteId),keys:Boolean(peer.key),channel:peer.channel?.readyState}))}), create:()=>new NativePeer() as unknown as RTCPeerConnection, stop:()=>{unsubscribe();for(const peer of peers.values())peer.close();} };
}
