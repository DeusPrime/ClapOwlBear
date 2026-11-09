import { roomMessageSchema, type RoomMessage } from "./roomProtocol";

const MAX_SIZE = 6000000;
const CHUNK = 8000; // At most 32 KB UTF-8, below common SCTP message limits.

/** Ordered, bounded framing, including portraits larger than one WebRTC message. */
export class RoomTransport {
  private pending: string[] = [];
  private incoming = "";
  private priorityIncoming = "";
  private priorityExpected = 0;
  private expected = 0;
  private lastChunk = 0;
  constructor(readonly channel: RTCDataChannel, receive: (message: RoomMessage) => void, private generation?: () => string | undefined) {
    channel.bufferedAmountLowThreshold = 64000;
    channel.onbufferedamountlow = () => this.flush();
    channel.onmessage = ({ data }) => {
      if (typeof data !== "string" || data.length > CHUNK + 40) return;
      if (Date.now() - this.lastChunk > 30000) { this.incoming = ""; this.expected = 0; }
      this.lastChunk = Date.now();
      if ((data.startsWith('fast-size:') || data.startsWith('fast-data:')) && (channel as RTCDataChannel & {prioritySupported?:boolean}).prioritySupported) {
        if(data.startsWith('fast-size:')){const size=Number(data.slice(10));this.priorityExpected=Number.isInteger(size)&&size>0&&size<=64000?size:0;this.priorityIncoming='';return;}
        if(!this.priorityExpected)return;
        this.priorityIncoming+=data.slice(10);
        if(this.priorityIncoming.length>this.priorityExpected){this.priorityExpected=0;this.priorityIncoming='';return;}
        if(this.priorityIncoming.length===this.priorityExpected){try{const parsed=roomMessageSchema.safeParse(JSON.parse(this.priorityIncoming));if(parsed.success)receive(parsed.data);}catch{}this.priorityExpected=0;this.priorityIncoming='';}
        return;
      }
      if (data.startsWith('fast:') && (channel as RTCDataChannel & {prioritySupported?:boolean}).prioritySupported) {
        try { const parsed = roomMessageSchema.safeParse(JSON.parse(data.slice(5))); if (parsed.success) receive(parsed.data); } catch {}
        return;
      }
      if (data.startsWith("size:")) {
        const size = Number(data.slice(5));
        this.expected = Number.isInteger(size) && size > 0 && size <= MAX_SIZE ? size : 0;
        this.incoming = "";
        return;
      }
      if (!this.expected || !data.startsWith("data:")) return;
      this.incoming += data.slice(5);
      if (this.incoming.length > this.expected) { this.expected = 0; this.incoming = ""; return; }
      if (this.incoming.length === this.expected) {
        try {
          const parsed = roomMessageSchema.safeParse(JSON.parse(this.incoming));
          if (parsed.success) receive(parsed.data);
        } catch { /* Ignore malformed peer data. */ }
        this.expected = 0;
        this.incoming = "";
      }
    };
  }
  send(message: RoomMessage) {
    if (this.channel.readyState !== "open") return false;
    const json = JSON.stringify(this.generation ? { ...message, roomGeneration: this.generation() } : message);
    const priority = this.channel as RTCDataChannel & {prioritySupported?:boolean;sendPriority?:(value:string)=>void};
    if (priority.prioritySupported && priority.sendPriority && json.length <= 64000 && (message.kind!=='game-state'||json.length<=CHUNK-5) && !['sheet','sheet-resource','assign-sheet','game-handoff','hero-proposal','link-resource'].includes(message.kind)) {
      try {
        if(json.length<=CHUNK-5)priority.sendPriority('fast:'+json);
        else{priority.sendPriority('fast-size:'+json.length);for(let i=0;i<json.length;i+=CHUNK)priority.sendPriority('fast-data:'+json.slice(i,i+CHUNK));}
        return true;
      } catch { return false; }
    }
    if (json.length > MAX_SIZE || this.pending.length > 1500) return false;
    this.pending.push(`size:${json.length}`);
    for (let i = 0; i < json.length;) {
      let end = Math.min(i + CHUNK, json.length);
      // WebRTC UTF-8 encoding must never split an emoji's UTF-16 surrogate pair.
      const last = json.charCodeAt(end - 1);
      if (last >= 0xd800 && last <= 0xdbff && end < json.length) end--;
      this.pending.push(`data:${json.slice(i, end)}`);
      i = end;
    }
    return this.flush();
  }
  private flush() {
    try {
      while (this.channel.readyState === "open" && this.channel.bufferedAmount < 128000 && this.pending.length) {
        this.channel.send(this.pending.shift()!);
      }
      return this.channel.readyState === "open";
    } catch { this.pending = []; return false; }
  }
  close() { this.pending = []; this.incoming = ""; this.channel.close(); }
}
