const KEY = 'clap-player-identity-v1';
let memoryIdentity: string | undefined;

/** A private random credential, never the public member ID shown to other players. */
export function playerIdentityToken() {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const value = storage.getItem(KEY);
      if (value && /^[a-f0-9]{64}$/.test(value)) return memoryIdentity = value;
    } catch { /* Continue with the other storage or this tab's identity. */ }
  }
  memoryIdentity ??= Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
  for (const storage of [localStorage, sessionStorage]) {
    try { storage.setItem(KEY, memoryIdentity); } catch { /* This tab can still reconnect. */ }
  }
  return memoryIdentity;
}
