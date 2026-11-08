import type { RoomSession } from './roomProtocol';

// Device-only access settings are deliberately kept outside portable room archives.
const sessionKey = (code: string) => `clap-owned-room-v1:${code}`;
const settingsKey = (id: string) => `clap-local-room-settings-v1:${id}`;
export function rememberOwnedRoom(session: RoomSession) {
  try {
    if (session.role === 'mj') localStorage.setItem(sessionKey(session.room), JSON.stringify(session));
    else localStorage.removeItem(sessionKey(session.room));
  } catch { /* A live session remains usable without persistent storage. */ }
}
export function ownedRoom(code: string): RoomSession | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(sessionKey(code)) || 'null');
    if (value?.role === 'mj' && value.room === code && typeof value.token === 'string' && typeof value.id === 'string' && typeof value.name === 'string') return value;
  } catch { /* Missing or invalid saved access must never establish ownership. */ }
}
export function forgetOwnedRoom(code: string) {
  try { localStorage.removeItem(sessionKey(code)); } catch { /* Storage may be unavailable. */ }
}
export function ownedLocalRoom(id: string): RoomSession | undefined {
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith('clap-owned-room-v1:')) continue;
      const session = ownedRoom(key.slice('clap-owned-room-v1:'.length));
      if (session?.localRoomId === id) return session;
    }
  } catch { /* Local access may be unavailable. */ }
}
export function rememberRoomSettings(id: string, password?: string) {
  try { localStorage.setItem(settingsKey(id), JSON.stringify({ password: password || '' })); }
  catch { /* Reopening remains available with the saved host name. */ }
}
export function roomSettings(id: string): { password?: string } {
  try {
    const value = JSON.parse(localStorage.getItem(settingsKey(id)) || 'null');
    if (typeof value?.password === 'string' && value.password.length <= 128) return { password: value.password };
  } catch { /* Old archives have no device settings. */ }
  return {};
}
