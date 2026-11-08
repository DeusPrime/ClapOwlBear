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
  expect(document.body.textContent).toContain("Projet de la salle");
  expect([...document.querySelectorAll('[role="tablist"] [role="tab"]')].map(t => t.textContent)).toEqual(['Héros', 'Cartes', 'Ressources', 'Discussion']);
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
it("garde uniquement les onglets de la fiche et la discussion après attribution du héros", async () => {
  const { blankCharacter, upsertCharacter } = await import("@/lib/characters");
  const hero = { ...blankCharacter(), nom: "Héroïne Owlbear" };
  await upsertCharacter(hero);
  state.value = { ...state.value, session: { id: "alice", role: "player", name: "Alice", characterId: hero.id } };
  const { mount } = await import("./App");
  await act(async () => { root = mount(); });
  await vi.waitFor(async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); }); expect(document.body.textContent).toContain("Héroïne Owlbear"); });
  const tabs = document.querySelector('nav[data-tour="hero-tabs"]');
  expect(tabs?.textContent).toContain("Discussion");
  expect(tabs?.textContent).toContain("Identité");
  expect(document.querySelector('[data-tour="room-management"]')).toBeNull();
  expect(document.querySelector('[aria-label="Actions du héros"]')).toBeNull();
  expect(document.querySelector('nav[aria-label="Navigation MJ"]')).toBeNull();
});
