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
it('shows a newly received linked card in the already open hero tab after its notification', async () => {
  const { blankCharacter, upsertCharacter } = await import('@/lib/characters');
  const { blankPower, upsertPower } = await import('@/lib/powers');
  const hero = { ...blankCharacter(), nom: 'Receiving hero' };
  await upsertCharacter(hero);
  state.value = { ...state.value, session: { id: 'alice', role: 'player', name: 'Alice', characterId: hero.id } };
  const { mount } = await import('./App');
  await act(async () => { root = mount(); });
  await vi.waitFor(async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); }); expect(document.body.textContent).toContain('Receiving hero'); });
  const resourcesTab = [...document.querySelectorAll('nav[data-tour="hero-tabs"] button')].find(button => button.textContent?.includes('Cartes')) as HTMLButtonElement;
  expect(resourcesTab).toBeDefined();
  await act(async () => resourcesTab.click());
  expect(document.querySelector('[data-tour="hero-linked-resource"]')).toBeNull();
  const power = { ...blankPower(), directoryId: hero.directoryId, titre: 'Received power' };
  await upsertPower(power);
  const updated = { ...hero, linkedResources: [{ type: 'power' as const, id: power.id }] };
  await upsertCharacter(updated);
  await act(async () => { window.dispatchEvent(new CustomEvent('clap-room-character-assigned', { detail: { character: updated } })); window.dispatchEvent(new CustomEvent('clap-room-reward', { detail: { title: power.titre, resource: { type: 'power', item: power }, removed: false } })); });
  await vi.waitFor(async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); }); expect(document.querySelector('[data-tour="hero-linked-resource"]')).not.toBeNull(); });
});
it('keeps the player sheet live while editing and merges a remote attribute without losing a local edit', async () => {
  const {blankCharacter,upsertCharacter,getCharacter}=await import('@/lib/characters');
  const hero={...blankCharacter(),nom:'Editable hero'};await upsertCharacter(hero);
  state.value={...state.value,session:{id:'alice',role:'player',name:'Alice',characterId:hero.id}};
  const {mount}=await import('./App');await act(async()=>{root=mount();});
  await vi.waitFor(async()=>{await act(async()=>{await new Promise(resolve=>setTimeout(resolve,5));});expect(document.body.textContent).toContain('Editable hero');});
  const menu=document.querySelector<HTMLButtonElement>('[aria-label="Actions de ma fiche"]')!;
  await act(async()=>menu.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,button:0})));
  const edit=[...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(node=>node.textContent?.includes('Modifier'))!;
  expect(edit).toBeDefined();await act(async()=>edit.click());
  const name=[...document.querySelectorAll<HTMLInputElement>('input')].find(input=>input.value==='Editable hero')!;
  expect(name).toBeDefined();
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(name,'Live renamed hero');name.dispatchEvent(new Event('input',{bubbles:true}));});
  await vi.waitFor(async()=>expect((await getCharacter(hero.id))?.nom).toBe('Live renamed hero'));
  const current=(await getCharacter(hero.id))!;
  const remote={...current,facets:{...current.facets,corps:{...current.facets.corps,skills:{...current.facets.corps.skills,Force:5}}}};
  await act(async()=>{await upsertCharacter(remote,{roomRemote:true});window.dispatchEvent(new CustomEvent('clap-room-character-assigned',{detail:{character:remote,changes:[{path:['facets','corps','skills','Force'],value:5}]}}));});
  await act(async()=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Attributs')!.click());
  expect([...document.querySelectorAll<HTMLInputElement>('input')].some(input=>input.value==='5')).toBe(true);
  await act(async()=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Identité')!.click());
  expect([...document.querySelectorAll<HTMLInputElement>('input')].some(input=>input.value==='Live renamed hero')).toBe(true);
  await vi.waitFor(async()=>{const saved=await getCharacter(hero.id);expect(saved?.facets.corps.skills.Force).toBe(5);expect(saved?.nom).toBe('Live renamed hero');});
});
