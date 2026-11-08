// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act } from "react";
import type { Root } from "react-dom/client";
const state = vi.hoisted(() => ({
  room: {
    session: {
      id: "alice",
      role: "player",
      name: "Alice",
      characterId: undefined,
    },
    roomInfo: { title: "La partie" },
    roomHeroes: [],
    savedSheets: {},
    privateRefs: [],
    members: [],
    connected: [],
    error: "",
    messages: [],
    requests: [],
  } as any,
}));
vi.mock("@/hooks/use-room", () => ({ useRoom: () => state.room }));
vi.mock("@/lib/roomClient", () => ({
  roomClient: { snapshot: () => state.room },
}));
vi.mock("@/lib/characters", () => ({ loadCharacters: async () => [] }));
vi.mock("./OwlbearWorkspace", () => ({ OwlbearMJWorkspace: () => <div>Outils du MJ</div>, OwlbearPlayerWorkspace: () => <div>Fiche et discussion du joueur</div> }));
vi.mock("@/components/RoomHeroReserve", () => ({
  default: () => <div>Réserve des héros</div>,
}));
vi.mock("@/components/RoomManagement", () => ({
  default: () => <div>Gestion de la salle</div>,
}));
vi.mock("@/components/RoomRewardNotification", () => ({ default: () => null }));
vi.mock("@/components/GlobalExportLoader", () => ({ default: () => null }));
vi.mock("@/pages/Dashboard", () => ({
  default: () => <div>Bibliothèque privée du MJ</div>,
}));
vi.mock("./GameMenu", () => ({ default: () => <div>Menu</div> }));
let root: Root | undefined;
beforeEach(() => {
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
  document.body.innerHTML = '<div id="app"></div>';
  window.location.hash = "#/app/salle";
  state.room.session.role = "player";
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
});
describe("Interface intégrée et permissions", () => {
  (it("ouvre le panneau joueur et masque la navigation des projets", async () => {
    const { mount } = await import("./App");
    await act(async () => {
      root = mount();
    });
    expect(document.body.textContent).toContain(
      "Fiche et discussion du joueur",
    );
    expect(
      document.querySelector('nav[aria-label="Navigation MJ"]'),
    ).toBeNull();
  }),
    it("redirige un joueur qui tente d’ouvrir directement la bibliothèque du MJ", async () => {
      window.location.hash = "#/app/studio";
      const { mount } = await import("./App");
      await act(async () => {
        root = mount();
      });
      expect(document.body.textContent).not.toContain(
        "Bibliothèque privée du MJ",
      );
      expect(document.body.textContent).toContain(
        "Fiche et discussion du joueur",
      );
    }),
    it("affiche les outils complets et les projets au MJ", async () => {
      state.room.session.role = "mj";
      const { mount } = await import("./App");
      await act(async () => {
        root = mount();
      });
      expect(document.body.textContent).toContain("Outils du MJ");
      expect(document.querySelector('.owlbear-header')?.textContent).not.toContain('Projet');
      expect(document.querySelector('button[aria-label="Ouvrir le menu CLAP!"]')).toBeNull();
      expect(document.querySelector('.owlbear-header')?.querySelectorAll('button')).toHaveLength(2);
    }));
});
