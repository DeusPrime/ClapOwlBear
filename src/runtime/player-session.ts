import type { RoomSession } from '@/lib/roomProtocol';
const key = (room: string, player: string) => 'clap-owlbear-player-session:v1:' + room + ':' + player;
export function rememberPlayerSession(room: string, player: string, session: RoomSession | null) {
  if (session?.role !== 'player' || !session.characterId) return;
  try {
    const value = JSON.stringify(session), storageKey = key(room, player);
    if (localStorage.getItem(storageKey) !== value) localStorage.setItem(storageKey, value);
  } catch { /* The MJ retains the authoritative assignment if local storage is unavailable. */ }
}
export function rememberedPlayerSession(room: string, player: string, game: string, memberId: string, epoch?: string): RoomSession | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(key(room, player)) || 'null');
    if (!value || value.role !== 'player' || value.room !== game || value.id !== memberId || typeof value.token !== 'string' || typeof value.characterId !== 'string' || !value.characterId || (epoch && !value.token.startsWith(epoch + ':'))) return;
    return value as RoomSession;
  } catch { return; }
}
