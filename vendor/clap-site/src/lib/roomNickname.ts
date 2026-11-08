import { roomCode } from "./roomProtocol";
const key = (room: string) => `clap-room-nickname-v1:${roomCode(room)}`;
export function previousRoomNickname(room: string): string {
  try { return localStorage.getItem(key(room)) || ""; } catch { return ""; }
}
export function rememberRoomNickname(room: string, name: string) {
  try { localStorage.setItem(key(room), name.trim()); } catch { /* Joining remains available without local storage. */ }
}
