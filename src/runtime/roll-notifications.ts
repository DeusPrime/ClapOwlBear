import type { RoomChatMessage } from '@/lib/roomProtocol';
type Snapshot = { session: { room: string; gameGeneration?: string } | null; messages: RoomChatMessage[] };
export function watchPublicRolls(client: { snapshot: () => Snapshot; subscribe: (listener: () => void) => () => void }, show: (message: RoomChatMessage) => Promise<unknown>, startedAt = Date.now()) {
  let previous: RoomChatMessage[] | undefined, room: string | undefined;
  const seen = new Set<number>();
  const update = () => {
    const snapshot = client.snapshot();
    // Keep the array identity across a generation change to ignore the transitional old history, then accept reused sequence IDs in the fresh game.
    const scope = snapshot.session ? snapshot.session.room + ':' + (snapshot.session.gameGeneration || '') : undefined;
    if (room !== scope) { room = scope; seen.clear(); }
    if (!room || snapshot.messages === previous) return;
    previous = snapshot.messages;
    for (const message of snapshot.messages) {
      if (seen.has(message.id)) continue;
      seen.add(message.id);
      if (message.kind !== 'roll' || message.hidden || message.privateTo || message.created < startedAt) continue;
      void show(message).catch(() => {});
    }
    if (seen.size > 4000) { seen.clear(); for (const message of snapshot.messages) seen.add(message.id); }
  };
  update();
  return client.subscribe(update);
}
