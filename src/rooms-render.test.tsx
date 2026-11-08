// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
const state = vi.hoisted(() => ({
  value: {
    session: { id: "host", role: "mj", name: "MJ" },
    roomInfo: { title: "Partie Owlbear" },
    roomHeroes: [],
    heroProposals: [],
    privateRefs: [],
    savedSheets: {},
    savedSheetResources: {},
    sheetResources: {},
    sheets: {},
    members: [
      { id: "host", name: "MJ", role: "mj", online: true, instance: "h" },
    ],
    connected: [],
    messages: [],
    requests: [],
    hideRolls: false,
    error: "",
    syncing: false,
  } as any,
}));
vi.mock("@/hooks/use-room", () => ({ useRoom: () => state.value }));
vi.mock("@/lib/roomClient", () => ({
  roomClient: new Proxy(
    { snapshot: () => state.value },
    {
      get: (target, key) =>
        key === "snapshot" ? target.snapshot : async () => {},
    },
  ),
}));
let root: Root | undefined;
beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  window.location.hash = "#/app/salle";
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    }),
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  vi.unstubAllGlobals();
});
it("monte les vrais composants MJ du site dans le panneau sans service de compte externe", async () => {
  const { mount } = await import("./App");
  await act(async () => {
    root = mount();
  });
  expect(document.body.textContent).toContain("Mes cartes de salle");
  expect(document.body.textContent).toContain("Discussion");
  expect(document.body.textContent).toContain("Partie Owlbear");
  expect(
    document.querySelector('nav[aria-label="Navigation MJ"]'),
  ).not.toBeNull();
});
it("monte la vraie vue joueur avec son choix de héros et sa discussion", async () => {
  state.value = {
    ...state.value,
    session: { id: "alice", role: "player", name: "Alice" },
  };
  const { mount } = await import("./App");
  await act(async () => {
    root = mount();
  });
  expect(document.body.textContent).toContain("Ton héros apparaîtra ici.");
  expect(document.body.textContent).toContain("Discussion");
  expect(document.querySelector('nav[aria-label="Navigation MJ"]')).toBeNull();
});
