// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { BroadcastChannel } from "node:worker_threads";
import {
  configureRuntime,
  sharedRoomClient,
  serveRoomClient,
  notifyViewReady,
} from "./client";
let stop: (() => void) | undefined;
afterEach(() => {
  window.dispatchEvent(new Event("pagehide"));
  stop?.();
  vi.unstubAllGlobals();
});
describe("Connexion maintenue en arrière-plan", () => {
  it("continue à recevoir les événements après fermeture puis réouverture du panneau", async () => {
    vi.stubGlobal("BroadcastChannel", BroadcastChannel);
    const channel = "test-background-" + crypto.randomUUID();
    let state = { messages: [] as string[], session: { role: "mj" } };
    const listeners = new Set<() => void>();
    const engine = {
      snapshot: () => state,
      subscribe: (fn: () => void) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      stop: vi.fn(),
      sendChat: async (text: string) => {
        state = { ...state, messages: [...state.messages, text] };
        listeners.forEach((fn) => fn());
      },
    };
    stop = serveRoomClient(engine, channel, undefined, () => ({
      error: "Etat de connexion",
    }));
    configureRuntime({ background: false, channel });
    const make = () =>
      sharedRoomClient(() => {
        throw new Error("The visible UI must not create another engine");
      }) as typeof engine;
    const first = make();
    await vi.waitFor(() => expect(first.snapshot().session?.role).toBe("mj"));
    expect((first.snapshot() as { error?: string }).error).toBe(
      "Etat de connexion",
    );
    await first.sendChat("Avant fermeture");
    first.stop();
    expect(engine.stop).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("pagehide"));
    await engine.sendChat("Pendant la fermeture");
    window.dispatchEvent(
      new CustomEvent("clap-room-reward", {
        detail: { title: "Nouvel objet" },
      }),
    );
    const notification = vi.fn((event: Event) => {
      if (
        (event as Event & { clapIpcEvent?: string }).clapIpcEvent !==
        "background"
      )
        return;
      expect((event as CustomEvent).detail.title).toBe("Nouvel objet");
    });
    window.addEventListener("clap-room-reward", notification);
    const reopened = make();
    notifyViewReady();
    await vi.waitFor(() =>
      expect(reopened.snapshot().messages).toEqual([
        "Avant fermeture",
        "Pendant la fermeture",
      ]),
    );
    await vi.waitFor(() => expect(notification).toHaveBeenCalled());
    window.removeEventListener("clap-room-reward", notification);
    await reopened.sendChat("Après réouverture");
    expect(engine.snapshot().messages).toHaveLength(3);
    expect(engine.stop).not.toHaveBeenCalled();
  });
});

it('keeps card image data and library refreshes out of chat-only updates', async () => {
  vi.stubGlobal('BroadcastChannel', BroadcastChannel);
  const channel = 'delta-' + crypto.randomUUID();
  let state = { roomResources: [{ item: { id: 'card', image: 'large-image-payload' } }], messages: [] as string[] };
  let update = () => {};
  const engine = { snapshot: () => state, subscribe: (listener: () => void) => { update = listener; return () => {}; } };
  const packets: any[] = [];
  const monitor = new BroadcastChannel(channel);
  monitor.onmessage = event => { if (event.data.type === 'snapshot') packets.push(event.data); };
  stop = serveRoomClient(engine, channel);
  configureRuntime({ background: false, channel });
  const ui = sharedRoomClient(() => engine);
  await vi.waitFor(() => expect(ui.snapshot().roomResources).toHaveLength(1));
  const cards = ui.snapshot().roomResources;
  await new Promise(resolve => setTimeout(resolve, 150));
  const focus = vi.fn(); window.addEventListener('focus', focus);
  packets.length = 0;
  state = { ...state, messages: ['Public chat'] }; update();
  await vi.waitFor(() => expect(ui.snapshot().messages).toEqual(['Public chat']));
  expect(ui.snapshot().roomResources).toBe(cards);
  expect(packets.at(-1).partial).toBe(true);
  expect(packets.at(-1).snapshot).not.toHaveProperty('roomResources');
  expect(focus).not.toHaveBeenCalled();
  window.removeEventListener('focus', focus); monitor.close();
});
class LocalBus {
  static peers = new Set<LocalBus>();
  onmessage?: (event: { data: any }) => void;
  constructor(public name: string) { LocalBus.peers.add(this); }
  postMessage(data: unknown) { for (const peer of LocalBus.peers) if (peer !== this && peer.name === this.name) peer.onmessage?.({ data: structuredClone(data) }); }
  close() { LocalBus.peers.delete(this); }
}
it('keeps an acknowledged import alive beyond two minutes, forwards progress and returns its real result', async () => {
  vi.useFakeTimers(); vi.stubGlobal('BroadcastChannel', LocalBus);
  let complete!: (value: unknown) => void;
  const engine = { snapshot: () => ({ session: { role: 'mj' } }), subscribe: () => () => {}, importProject: () => new Promise(resolve => { complete = resolve; }) };
  const channel = 'long-import'; stop = serveRoomClient(engine, channel);
  configureRuntime({ background: false, channel });
  const ui = sharedRoomClient(() => engine);
  const progress = vi.fn((event: Event) => (event as any).clapIpcEvent === 'background' && (event as CustomEvent).detail.message);
  window.addEventListener('clap-room-import-progress', progress);
  try {
    const operation = ui.importProject(); let finished = false; operation.then(() => { finished = true; });
    window.dispatchEvent(new CustomEvent('clap-room-import-progress', { detail: { message: 'Carte 45/100' } }));
    await vi.advanceTimersByTimeAsync(155000);
    expect(finished).toBe(false);
    expect(progress.mock.results.some(result => result.value === 'Carte 45/100')).toBe(true);
    complete({ name: 'Silverlake' });
    await expect(operation).resolves.toEqual({ name: 'Silverlake' });
    await vi.advanceTimersByTimeAsync(130000);
  } finally { window.removeEventListener('clap-room-import-progress', progress); window.dispatchEvent(new Event('pagehide')); stop?.(); stop = undefined; vi.useRealTimers(); }
});
it('reports a missing engine promptly instead of waiting two minutes for an unacknowledged command', async () => {
  vi.useFakeTimers(); vi.stubGlobal('BroadcastChannel', LocalBus);
  configureRuntime({ background: false, channel: 'absent-engine' });
  const ui = sharedRoomClient(() => ({ importProject: async () => {} }));
  try {
    const failure = expect(ui.importProject()).rejects.toThrow('ne répond plus');
    await vi.advanceTimersByTimeAsync(20001); await failure;
  } finally { window.dispatchEvent(new Event('pagehide')); vi.useRealTimers(); }
});
it('forwards an import failure immediately after acknowledgement', async () => {
  vi.stubGlobal('BroadcastChannel', LocalBus);
  const engine = { snapshot: () => ({}), subscribe: () => () => {}, importProject: async () => { throw new Error('Archive invalide QA'); } };
  stop = serveRoomClient(engine, 'failed-import');
  configureRuntime({ background: false, channel: 'failed-import' });
  const ui = sharedRoomClient(() => engine);
  await expect(ui.importProject()).rejects.toThrow('Archive invalide QA');
});
