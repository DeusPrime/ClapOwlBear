// @vitest-environment jsdom
import "fake-indexeddb/auto";
import JSZip from "jszip";
import { afterEach, describe, it, expect, vi } from "vitest";
import { FakeRodeo, MemoryPeer } from "../test/fakes";
import { OwlbearRoomService } from "./rodeo-service";
const clients: any[] = [],
  services: OwlbearRoomService[] = [];
afterEach(() => {
  for (const c of clients) c.stop();
  for (const s of services) s.stop();
  clients.length = 0;
  services.length = 0;
  vi.unstubAllGlobals();
});
const readBlob = (blob: Blob) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = reject;
    r.readAsArrayBuffer(blob);
  });
async function engine(
  service: OwlbearRoomService,
  name: string,
  code?: string,
) {
  vi.resetModules();
  const runtime = await import("./client");
  runtime.configureRuntime({ background: true, channel: name }, service.api);
  const { RoomClient } = await import("@/lib/roomClient");
  const client = new RoomClient();
  clients.push(client);
  await client.enter(name, code);
  return client;
}
describe("Moteur CLAP! partagé — MJ et joueurs", () => {
  it.each(["closed-tab", "logout-login", "new-browser"])("restores the player hero after %s and a new Owlbear connection", async scenario => {
    vi.stubGlobal("RTCPeerConnection", MemoryPeer);
    const world = new FakeRodeo(); world.add("host", "GM"); world.add("alice", "PLAYER");
    const hs = new OwlbearRoomService(world.port("host"), "ABCD1234ABCD");
    const ps = new OwlbearRoomService(world.port("alice"), "ABCD1234ABCD");
    services.push(hs, ps); await hs.start(); await ps.start();
    const host = await engine(hs, "host");
    const player = await engine(ps, "alice", "ABCD1234ABCD");
    await vi.waitFor(() => expect(host.snapshot().connected).toContain("alice"), { timeout: 12000 });
    const { blankCharacter } = await import("@/lib/characters");
    const hero = await host.addRoomHero({ ...blankCharacter(), nom: "Returning hero", notes: "Keep this progress" }, []);
    await host.setOwlbearRoomUrl("https://www.owlbear.rodeo/room/room-id/adventure");
    await host.assignCharacter("alice", hero.id);
    await vi.waitFor(() => expect(player.snapshot().session?.characterId).toBe(hero.id));
    await host.heroAction("alice", { type: "add-item", category: "autresAccessoires", item: { nom: "Returning key", proprietes: "Keep", degats: "", poids: "", protection: "" } });
    await vi.waitFor(() => expect(host.snapshot().sheets.alice.autresAccessoires).toHaveLength(1));
    player.stop(); ps.stop(); world.players = world.players.filter(p => p.id !== "alice");
    await vi.waitFor(() => expect(host.snapshot().members.some(p => p.id === "alice")).toBe(false), { timeout: 12000 });
    sessionStorage.clear();
    if (scenario === "new-browser") await (await import("@/lib/characters")).deleteCharacter(hero.id);
    const returning = world.add("alice", "PLAYER"); returning.connectionId = "new-connection-alice";
    const nextService = new OwlbearRoomService(world.port("alice"), "ABCD1234ABCD"); services.push(nextService); await nextService.start();
    const next = await engine(nextService, "alice", "ABCD1234ABCD");
    await vi.waitFor(() => expect(next.snapshot().session?.characterId).toBe(hero.id), { timeout: 12000 });
    await vi.waitFor(() => expect(host.snapshot().sheets.alice.autresAccessoires).toHaveLength(1));
    expect(host.snapshot().sheets.alice.notes).toBe("Keep this progress");
    await vi.waitFor(() => expect(next.snapshot().owlbearUrl).toBe("https://www.owlbear.rodeo/room/room-id/adventure"));
    const recovered = await (await import("@/lib/characters")).getCharacter(hero.id);
    expect(recovered?.autresAccessoires[0].nom).toBe("Returning key");
  }, 25000);

  it("resets all game progress after confirmed project change and never resurrects old sheets", async () => {
    vi.stubGlobal("RTCPeerConnection", MemoryPeer);
    const world = new FakeRodeo(); world.add("host", "GM"); world.add("alice", "PLAYER");
    const hs = new OwlbearRoomService(world.port("host"), "ABCDABCD1234"), ps = new OwlbearRoomService(world.port("alice"), "ABCDABCD1234");
    services.push(hs, ps); await hs.start(); await ps.start();
    const host = await engine(hs, "host"), player = await engine(ps, "alice", "ABCDABCD1234");
    const { blankCharacter, getCharacter } = await import("@/lib/characters");
    const { blankPower } = await import("@/lib/powers");
    const power = { ...blankPower(), directoryId: "source", titre: "Project card" };
    const hero = { ...blankCharacter(), directoryId: "source", nom: "Project hero", linkedResources: [{ type: "power", id: power.id }] };
    const archive = (name: string) => new JSZip().file("studio.json", JSON.stringify({ format: "clap-studio", version: 1, project: { id: "source", name }, heroes: [hero], resources: [{ type: "power", item: power }], tools: [] })).generateAsync({ type: "arraybuffer" });
    await host.importProject(await archive("First film"));
    const oldId = host.snapshot().session!.localRoomId!, oldGeneration = host.snapshot().session!.gameGeneration!;
    const oldHero = host.snapshot().roomHeroes[0];
    await vi.waitFor(() => expect(host.snapshot().connected).toContain("alice"), { timeout: 12000 });
    await host.assignCharacter("alice", oldHero.id);
    await vi.waitFor(() => expect(player.snapshot().session?.characterId).toBe(oldHero.id));
    await host.heroAction("alice", { type: "add-item", category: "autresAccessoires", item: { nom: "Old inventory", proprietes: "", degats: "", poids: "", protection: "" } });
    await host.sendChat("Old discussion");
    await expect(host.importProject(await archive("Second film"))).rejects.toThrow("progression");
    expect(host.snapshot().projectName).toBe("First film");
    await expect(host.importProject(new ArrayBuffer(0), undefined, true)).rejects.toThrow();
    expect(host.snapshot().sheets.alice).toBeDefined();
    await host.importProject(await archive("Second film"), undefined, true);
    expect(host.snapshot().projectName).toBe("Second film");
    expect(host.snapshot().messages).toEqual([]); expect(host.snapshot().requests).toEqual([]);
    expect(host.snapshot().sheets).toEqual({}); expect(host.snapshot().savedSheets).toEqual({});
    expect(host.snapshot().roomHeroes).toHaveLength(1); expect(host.snapshot().roomHeroes[0].id).not.toBe(oldHero.id);
    expect(host.snapshot().roomHeroes[0].autresAccessoires).toEqual([]);
    expect(host.snapshot().session!.gameGeneration).not.toBe(oldGeneration);
    await vi.waitFor(() => expect(player.snapshot().session?.characterId).toBeUndefined());
    expect(player.snapshot().messages).toEqual([]);
    const { loadLocalRoom } = await import("@/lib/roomArchive");
    expect(await loadLocalRoom(oldId)).toBeUndefined();
    expect(await getCharacter(oldHero.id)).toBeUndefined();
    (host as any).receive("alice", { kind: "sheet", character: oldHero, roomGeneration: oldGeneration });
    expect(host.snapshot().sheets).toEqual({});
    const { createDirectory } = await import("@/lib/directories"), { upsertCharacter } = await import("@/lib/characters");
    const sourceProject = createDirectory("Untouched source");
    const original = { ...blankCharacter(), directoryId: sourceProject.id, nom: "Source hero" }; await upsertCharacter(original);
    await expect(host.useProject(sourceProject.id)).rejects.toThrow("Confirme");
    await host.useProject(sourceProject.id, true);
    expect((await getCharacter(original.id))?.nom).toBe("Source hero");
    expect(host.snapshot().roomHeroes[0].id).not.toBe(original.id);
    player.stop(); ps.stop(); world.players = world.players.filter(p => p.id !== "alice");
    await vi.waitFor(() => expect(host.snapshot().members.some(p => p.id === "alice")).toBe(false), { timeout: 12000 });
    sessionStorage.clear(); world.add("alice", "PLAYER");
    const nextService = new OwlbearRoomService(world.port("alice"), "ABCDABCD1234"); services.push(nextService); await nextService.start();
    const next = await engine(nextService, "alice", "ABCDABCD1234");
    await vi.waitFor(() => expect(host.snapshot().connected).toContain("alice"), { timeout: 12000 });
    expect(next.snapshot().session?.characterId).toBeUndefined();
    const { blob } = await host.exportArchive();
    const saved = JSON.parse(await (await JSZip.loadAsync(await readBlob(blob))).file("salle.json")!.async("string"));
    expect(saved.messages).toBeUndefined(); expect(saved.game.messages).toEqual([]); expect(saved.sheets).toEqual({});
  }, 25000);
  it("synchronise fiches, chat, murmures et jets, puis exporte une véritable archive du site", async () => {
    vi.stubGlobal("RTCPeerConnection", MemoryPeer);
    const world = new FakeRodeo();
    world.add("host", "GM");
    world.add("alice", "PLAYER");
    world.add("bob", "PLAYER");
    const [hs, as, bs] = ["host", "alice", "bob"].map(
      (id) => new OwlbearRoomService(world.port(id), "ABCDEF123456"),
    );
    services.push(hs, as, bs);
    await Promise.all(services.map((s) => s.start()));
    const host = await engine(hs, "host");
    const alice = await engine(as, "alice", "ABCDEF123456");
    const bob = await engine(bs, "bob", "ABCDEF123456");
    await vi.waitFor(
      () =>
        expect(host.snapshot().connected).toEqual(
          expect.arrayContaining(["alice", "bob"]),
        ),
      { timeout: 12000, interval: 50 },
    );
    const fetchGuard = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        json: async () => ({ features: {} }),
      } as Response);
    await expect(
      host.linkSiteRoom("ABCDEF123456." + "A".repeat(43)),
    ).rejects.toThrow("mise à jour");
    expect(host.snapshot().session?.role).toBe("mj");
    expect(host.isRoomTransitioning()).toBe(false);
    fetchGuard.mockRestore();
    const { blankCharacter } = await import("@/lib/characters");
    const source = blankCharacter();
    source.nom = "Camille";
    source.notes = "Notes privées du héros";
    const hero = await host.addRoomHero(source, []);
    await host.assignCharacter("alice", hero.id);
    await vi.waitFor(() =>
      expect(alice.snapshot().session!.characterId).toBe(hero.id),
    );
    await host.heroAction("alice", {
      type: "add-item",
      category: "autresAccessoires",
      item: {
        nom: "Clé",
        proprietes: "Porte du studio",
        degats: "",
        poids: "",
        protection: "",
      },
    });
    const { getCharacter } = await import("@/lib/characters");
    await vi.waitFor(async () =>
      expect((await getCharacter(hero.id))?.autresAccessoires[0].nom).toBe(
        "Clé",
      ),
    );
    const currentSheet = host.snapshot().sheets.alice;
    await host.updateRoomHero({ ...currentSheet, stress: [true, false, false, false, false, false, false] }, currentSheet.updatedAt);
    await vi.waitFor(() => expect(host.snapshot().sheets.alice.stress[0]).toBe(true));
    expect(source.stress[0]).toBe(false);
    expect(bob.snapshot().session!.characterId).toBeUndefined();
    expect(JSON.stringify(bob.snapshot().sheets)).not.toContain(
      "Notes privées du héros",
    );
    await alice.sendChat("Bonjour la table");
    await alice.sendChat("Message pour le MJ", "host");
    await vi.waitFor(() =>
      expect(
        bob.snapshot().messages.some((m: any) => m.text === "Bonjour la table"),
      ).toBe(true),
    );
    expect(
      bob.snapshot().messages.some((m: any) => m.text === "Message pour le MJ"),
    ).toBe(false);
    expect(
      host
        .snapshot()
        .messages.some((m: any) => m.text === "Message pour le MJ"),
    ).toBe(true);
    await host.requestRoll(
      "alice",
      "Action",
      [{ facet: "corps", name: "Force" }],
      6,
    );
    await vi.waitFor(() => expect(alice.snapshot().requests).toHaveLength(1));
    expect(bob.snapshot().requests).toHaveLength(0);
    const request = alice.snapshot().requests[0];
    await alice.broadcastRoll("Force", "Résultat : 5", {
      requestId: request.id,
      public: true,
    });
    await vi.waitFor(() =>
      expect(
        bob
          .snapshot()
          .messages.some(
            (m: any) => m.kind === "roll" && m.text.includes("Résultat : 5"),
          ),
      ).toBe(true),
    );
    const archive = await host.exportArchive();
    expect(archive.name).toMatch(/\.clapSalle$/);
    const bytes = await readBlob(archive.blob);
    const { parseRoomArchive, importRoomArchive } =
      await import("@/lib/roomArchive");
    const restored = await parseRoomArchive({
      size: bytes.byteLength,
      arrayBuffer: async () => bytes,
    } as File);
    expect(restored.format).toBe("clapSalle");
    expect(restored.sheets.alice.nom).toBe("Camille");
    expect(
      restored.game.messages.some((m) => m.text === "Message pour le MJ"),
    ).toBe(true);
    const copy = await importRoomArchive({
      size: bytes.byteLength,
      arrayBuffer: async () => bytes,
    } as File);
    expect(copy.id).not.toBe(restored.id);
    expect(copy.sheets.alice.nom).toBe("Camille");
    expect(copy.sheets.alice.id).not.toBe(restored.sheets.alice.id);
    const json = JSON.stringify(restored);
    expect(json).not.toContain(host.snapshot().session!.token);
    expect(json).not.toContain(alice.snapshot().session!.token);
  }, 20000);
});
it('keeps an approved player proposal in the room library and the native room in local browser saves', async () => {
  vi.stubGlobal('RTCPeerConnection', MemoryPeer);
  const world = new FakeRodeo(); world.add('host', 'GM'); world.add('alice', 'PLAYER');
  const hs = new OwlbearRoomService(world.port('host'), 'AABBCC112233'), ps = new OwlbearRoomService(world.port('alice'), 'AABBCC112233');
  services.push(hs, ps); await hs.start(); await ps.start();
  const host = await engine(hs, 'host'), player = await engine(ps, 'alice', 'AABBCC112233');
  await vi.waitFor(() => expect(host.snapshot().connected).toContain('alice'), { timeout: 12000 });
  const { blankCharacter, upsertCharacter } = await import('@/lib/characters');
  const source = { ...blankCharacter(), nom: 'Proposed hero', notes: 'Full proposed notes' };
  await upsertCharacter(source);
  await player.selectCharacter(source.id);
  await vi.waitFor(() => expect(host.snapshot().heroProposals).toHaveLength(1));
  const proposal = host.snapshot().heroProposals[0];
  expect(proposal.character.notes).toBe(source.notes);
  await host.resolveHeroProposal(proposal.id, true);
  await vi.waitFor(() => expect(player.snapshot().session?.characterId).toBe(host.snapshot().roomHeroes[0]?.id));
  expect(host.snapshot().roomHeroes).toHaveLength(1);
  expect(host.snapshot().roomHeroes[0].nom).toBe(source.nom);
  const { listLocalRooms } = await import('@/lib/roomArchive');
  await vi.waitFor(async () => {
    const saved = (await listLocalRooms()).find(room => room.id === host.snapshot().session?.localRoomId);
    expect(saved?.heroes.some(hero => hero.nom === source.nom)).toBe(true);
    expect(saved?.sheets.alice.nom).toBe(source.nom);
  });
}, 20000);
