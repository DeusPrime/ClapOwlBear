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
    stop = serveRoomClient(engine, channel);
    configureRuntime({ background: false, channel });
    const make = () =>
      sharedRoomClient(() => {
        throw new Error("The visible UI must not create another engine");
      }) as typeof engine;
    const first = make();
    await vi.waitFor(() => expect(first.snapshot().session?.role).toBe("mj"));
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
