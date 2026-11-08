import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import 'fake-indexeddb/auto';
const background = process.argv.includes('--background');
const origin = 'https://www.owlbear.rodeo';
const ref = Buffer.from(origin + ' production-test-room').toString('base64');
const dom = new JSDOM('<div id="app"></div>', { url: 'https://deusprime.github.io/ClapOwlBear/?obrref=' + ref, pretendToBeVisual: true });
for (const key of ['window', 'document', 'localStorage', 'sessionStorage', 'location', 'MutationObserver', 'HTMLElement', 'CustomEvent', 'Event']) globalThis[key] = dom.window[key];
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
const append = document.head.appendChild.bind(document.head);
document.head.appendChild = element => { const result = append(element); if (element.tagName === 'LINK') setTimeout(() => element.dispatchEvent(new Event('load')), 0); return result; };
// Separate page contexts use this transport; no WebRTC peer exists in this host-only smoke test.
globalThis.RTCPeerConnection = class {};
globalThis.BroadcastChannel = class {
  static channels = new Set();
  constructor(name) { this.name = name; this.constructor.channels.add(this); }
  postMessage(data) { for (const peer of this.constructor.channels) if (peer !== this && peer.name === this.name) queueMicrotask(() => peer.onmessage?.({ data: structuredClone(data) })); }
  close() { this.constructor.channels.delete(this); }
};
const notifications = [];
const rollToasts = [];
let metadata = {}, roomMetadata = {};
const receive = (id, data) => window.dispatchEvent(new window.MessageEvent('message', { origin, data: { id, data } }));
window.postMessage = message => {
  if (message.id === "OBR_MODAL_OPEN") rollToasts.push(message.data);
  if (message.id === "OBR_NOTIFICATION_SHOW") notifications.push(message.data.message);
  if (!message.nonce) return;
  const values = { OBR_PLAYER_GET_ID: { id: 'host' }, OBR_PLAYER_GET_NAME: { name: 'MJ' }, OBR_PLAYER_GET_ROLE: { role: 'GM' }, OBR_PLAYER_GET_CONNECTION_ID: { connectionId: 'connection-host' }, OBR_PLAYER_GET_METADATA: { metadata }, OBR_PLAYER_GET_COLOR: { color: '#123456' }, OBR_PLAYER_GET_SYNC_VIEW: { syncView: false }, OBR_PARTY_GET_PLAYERS: { players: [] }, OBR_ROOM_GET_METADATA: { metadata: roomMetadata } };
  if (message.id === 'OBR_PLAYER_SET_METADATA') metadata = { ...metadata, ...message.data.update };
  if (message.id === 'OBR_ROOM_SET_METADATA') roomMetadata = { ...roomMetadata, ...message.data.update };
  queueMicrotask(() => receive(message.id + '_RESPONSE' + message.nonce, values[message.id] || {}));
};
globalThis.fetch = async url => {
  assert.ok(String(url).startsWith('file:'), 'Startup must not call an external HTTP API');
  return new Response('');
};
const errors = [];
window.addEventListener('error', event => errors.push(event.error || event.message));
const originalError = console.error;
console.error = (...args) => { errors.push(args.join(' ')); originalError(...args); };
let snapshot;
const channel = new BroadcastChannel('clap-owlbear:production-test-room:host:connection-host');
const pending = new Map();
channel.onmessage = event => {
  const data = event.data;
  if (data.type === 'snapshot') snapshot = data.partial ? { ...snapshot, ...data.snapshot } : data.snapshot;
  if (data.type === 'result') { const resolve = pending.get(data.id); if (resolve) { pending.delete(data.id); resolve(data); } }
};
const command = (method, args) => new Promise((resolve, reject) => {
  const id = crypto.randomUUID();
  const timer = setTimeout(() => reject(new Error('Background command timed out')), 3000);
  pending.set(id, result => { clearTimeout(timer); result.error ? reject(new Error(result.error)) : resolve(result.value); });
  channel.postMessage({ type: 'command', id, method, args });
});
try {
  const html = readFileSync(background ? 'dist/background.html' : 'dist/index.html', 'utf8');
  const entry = html.match(/src="\/ClapOwlBear\/(assets\/[^\"]+\.js)"/)[1];
  await import('../dist/' + entry);
  receive('OBR_READY', { ref: 'test-ref', userId: 'host' });
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline && !errors.length) {
    if (background) { channel.postMessage({ type: 'hello' }); if (snapshot?.session?.role === 'mj') break; }
    else if (document.querySelector('.owlbear-header')) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.deepEqual(errors, [], 'Compiled startup must not throw');
  if (background) assert.equal(snapshot?.session?.role, 'mj', 'Compiled background must open a real MJ session');
  else assert.ok(document.querySelector('.owlbear-header'), 'Compiled foreground must mount the integrated header');
  if (background) {
    await command('broadcastRoll', ['Public roll', 'D6: 4', { public: true }]);
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(rollToasts.length, 1, 'Public rolls must open the graphic toast over the Owlbear table');
    assert.equal(rollToasts[0].disablePointerEvents, true);
    assert.equal(rollToasts[0].hideBackdrop, true);
    assert.ok(rollToasts[0].url.includes('roll-toast.html?'));
    assert.equal(notifications.length, 0, 'Do not duplicate graphic results with verbose text notifications');
    await command('setRollVisibility', [true]);
    await command('broadcastRoll', ['Secret roll', 'D6: 2', {}]);
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(rollToasts.length, 1, 'Hidden rolls must not open graphic toasts');
  }
  console.log('Production startup OK: ' + (background ? 'background engine and MJ session' : 'foreground interface'));
  process.exit(0);
} catch (error) { console.error(error); process.exit(1); }
