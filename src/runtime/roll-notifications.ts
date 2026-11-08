import type { RoomChatMessage } from '@/lib/roomProtocol';
type Snapshot = { session: { room: string } | null; messages: RoomChatMessage[] };
export function watchPublicRolls(client: { snapshot: () => Snapshot; subscribe: (listener: () => void) => () => void }, show: (message: string) => Promise<unknown>, startedAt = Date.now()) {
  let previous: RoomChatMessage[] | undefined, room: string | undefined;
  const seen = new Set<number>();
  const update = () => {
    const snapshot = client.snapshot();
    if (room !== snapshot.session?.room) { room = snapshot.session?.room; previous = undefined; seen.clear(); }
    if (!room || snapshot.messages === previous) return;
    previous = snapshot.messages;
    for (const message of snapshot.messages) {
      if (seen.has(message.id)) continue;
      seen.add(message.id);
      if (message.kind !== 'roll' || message.hidden || message.privateTo || message.created < startedAt) continue;
      void show(('CLAP! ' + message.name + ' : ' + message.text).slice(0, 600)).catch(() => {});
    }
    if (seen.size > 4000) { seen.clear(); for (const message of snapshot.messages) seen.add(message.id); }
  };
  update();
  return client.subscribe(update);
}
