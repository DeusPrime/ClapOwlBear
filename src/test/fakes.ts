import type { Player } from "@owlbear-rodeo/sdk";
import type { RodeoPort } from "../runtime/rodeo-service";
export class FakeRodeo {
  metadata: Record<string, unknown> = {};
  players: Player[] = [];
  listeners = new Map<
    string,
    (event: { connectionId: string; data: unknown }) => void
  >();
  sent: { sender: string; channel: string; data: any }[] = [];
  add(id: string, role: "GM" | "PLAYER", name = id) {
    const p = {
      id,
      role,
      name,
      connectionId: "connection-" + id,
      color: "#000000",
      syncView: false,
      metadata: {},
    };
    this.players.push(p);
    return p;
  }
  port(id: string): RodeoPort {
    const self = () => this.players.find((p) => p.id === id)!;
    return {
      roomId: "owlbear-fixture",
      self: async () => self(),
      others: async () => this.players.filter((p) => p.id !== id),
      roomMetadata: async () => this.metadata,
      setRoomMetadata: async (v) => {
        Object.assign(this.metadata, v);
      },
      setPlayerMetadata: async (v) => {
        Object.assign(self().metadata, v);
      },
      send: async (channel, data) => {
        this.sent.push({ sender: id, channel, data });
        for (const [other, cb] of this.listeners)
          if (other !== id) cb({ connectionId: self().connectionId, data });
      },
      onSignal: (cb) => {
        this.listeners.set(id, cb);
        return () => {
          this.listeners.delete(id);
        };
      },
    };
  }
}
export class MemoryChannel {
  readyState: RTCDataChannelState = "connecting";
  bufferedAmount = 0;
  bufferedAmountLowThreshold = 0;
  onopen: any;
  onclose: any;
  onmessage: any;
  onbufferedamountlow: any;
  peer?: MemoryChannel;
  send(data: string) {
    if (this.readyState !== "open") throw new Error("Channel closed");
    queueMicrotask(() => {
      if (this.peer?.readyState === "open") this.peer.onmessage?.({ data });
    });
  }
  close() {
    if (this.readyState === "closed") return;
    this.readyState = "closed";
    this.onclose?.();
    this.peer?.close();
  }
}
export class MemoryPeer {
  static all = new Map<string, MemoryPeer>();
  id = crypto.randomUUID();
  remote?: MemoryPeer;
  channel?: MemoryChannel;
  ondatachannel: any;
  onconnectionstatechange: any;
  localDescription: any;
  remoteDescription: any;
  signalingState = "stable";
  connectionState = "new";
  iceGatheringState = "complete";
  constructor() {
    MemoryPeer.all.set(this.id, this);
  }
  createDataChannel() {
    return (this.channel = new MemoryChannel() as any);
  }
  async setLocalDescription() {
    const type = this.remoteDescription ? "answer" : "offer";
    this.localDescription = {
      type,
      sdp: this.id,
      toJSON: () => ({ type, sdp: this.id }),
    };
    if (type === "offer") this.signalingState = "have-local-offer";
  }
  async setRemoteDescription(desc: any) {
    this.remoteDescription = desc;
    this.remote = MemoryPeer.all.get(desc.sdp);
    if (desc.type === "answer") {
      this.signalingState = "stable";
      const outgoing = this.channel!,
        incoming = new MemoryChannel();
      this.remote!.channel = incoming;
      outgoing.peer = incoming;
      incoming.peer = outgoing;
      this.remote!.ondatachannel?.({ channel: incoming });
      queueMicrotask(() => {
        outgoing.readyState = "open";
        incoming.readyState = "open";
        this.connectionState = "connected";
        this.remote!.connectionState = "connected";
        outgoing.onopen?.call(outgoing, new Event("open"));
        incoming.onopen?.call(incoming, new Event("open"));
      });
    }
  }
  addEventListener() {}
  removeEventListener() {}
  close() {
    this.connectionState = "closed";
    this.channel?.close();
    MemoryPeer.all.delete(this.id);
  }
}
