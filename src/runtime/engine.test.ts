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

  it("imports a full project into the room, restricts it to the MJ and restores its export", async () => {
    vi.stubGlobal("RTCPeerConnection", MemoryPeer);
    const world = new FakeRodeo(); world.add("host", "GM"); world.add("alice", "PLAYER");
    const hs = new OwlbearRoomService(world.port("host"), "ABCDABCD1234");
    const ps = new OwlbearRoomService(world.port("alice"), "ABCDABCD1234");
    services.push(hs, ps); await hs.start(); await ps.start();
    const host = await engine(hs, "host");
    const player = await engine(ps, "alice", "ABCDABCD1234");
    const { blankCharacter } = await import("@/lib/characters");
    const { blankPower } = await import("@/lib/powers");
    const power = { ...blankPower(), directoryId: "source", titre: "Project card" };
    const hero = { ...blankCharacter(), directoryId: "source", nom: "Project hero", linkedResources: [{ type: "power", id: power.id }] };
    const bytes = await new JSZip().file("studio.json", JSON.stringify({ format: "clap-studio", version: 1, project: { id: "source", name: "Imported film" }, heroes: [hero], resources: [{ type: "power", item: power }], tools: [] })).generateAsync({ type: "arraybuffer" });
    await expect(player.importProject(bytes)).rejects.toThrow("MJ");
    await expect(host.importProject(new ArrayBuffer(0))).rejects.toThrow();
    expect(host.snapshot().projectName).toBeUndefined();
    await host.importProject(bytes);
    expect(host.snapshot().projectName).toBe("Imported film");
    expect(host.snapshot().roomHeroes).toHaveLength(1);
    expect(host.snapshot().privateRefs).toHaveLength(2);
    const { loadDirectories } = await import("@/lib/directories");
    const project = loadDirectories().find(p => p.id === host.snapshot().roomHeroes[0].directoryId);
    expect(project?.roomKey).toBe(host.snapshot().session!.localRoomId!);
    const firstProject = host.snapshot().projectId!;
    const firstHero = host.snapshot().roomHeroes[0].id;
    await vi.waitFor(() => expect(host.snapshot().connected).toContain("alice"), { timeout: 12000 });
    await host.assignCharacter("alice", firstHero);
    await host.sendChat("Keep this chat");
    const secondBytes = await new JSZip().file("studio.json", JSON.stringify({ format: "clap-studio", version: 1, project: { id: "source", name: "Second film" }, heroes: [{ ...hero, nom: "Second hero" }], resources: [{ type: "power", item: power }], tools: [] })).generateAsync({ type: "arraybuffer" });
    await host.importProject(secondBytes);
    expect(host.snapshot().roomHeroes).toHaveLength(1);
    expect(host.snapshot().roomHeroes[0].nom).toBe("Second hero");
    expect(host.snapshot().sheets.alice.id).toBe(firstHero);
    expect(host.snapshot().messages.some(m => m.text === "Keep this chat")).toBe(true);
    await expect(player.useProject(firstProject)).rejects.toThrow("MJ");
    await host.useProject(firstProject);
    expect(host.snapshot().roomHeroes[0].id).toBe(firstHero);
    expect(host.snapshot().projects).toHaveLength(2);
    const { blob } = await host.exportArchive();
    const exported = JSON.parse(await (await JSZip.loadAsync(await readBlob(blob))).file("salle.json")!.async("string"));
    expect(exported.projectName).toBe("Imported film");
    expect(Object.keys(exported.projectLinks)).toHaveLength(2);
    expect(exported.heroes).toHaveLength(2);
    expect(exported.resources.some((resource: any) => resource.item.id === exported.heroes[0].linkedResources[0].id)).toBe(true);
    const localId = host.snapshot().session!.localRoomId!;
    await player.leave(); await host.leave();
    await host.resumeLocalRoom(localId);
    expect(host.snapshot().projectName).toBe("Imported film");
    expect(host.snapshot().roomHeroes).toHaveLength(1);
    const { createDirectory } = await import("@/lib/directories");
    const { upsertCharacter } = await import("@/lib/characters");
    const library = createDirectory("Library project");
    const original = { ...blankCharacter(), directoryId: library.id, nom: "Library hero" };
    await upsertCharacter(original);
    await host.useProject(library.id);
    expect(host.snapshot().projectName).toBe("Library project");
    expect(host.snapshot().roomHeroes[0].nom).toBe("Library hero");
    expect(host.snapshot().roomHeroes[0].id).not.toBe(original.id);
    const live = host.snapshot().roomHeroes[0];
    await host.updateRoomHero({ ...live, injuries: { ...live.injuries, Centrale: [true, false, false, false, false, false, false] } }, live.updatedAt);
    const { getCharacter } = await import("@/lib/characters");
    expect((await getCharacter(original.id))!.injuries.Centrale[0]).toBe(false);
    expect(host.snapshot().roomHeroes[0].injuries.Centrale[0]).toBe(true);
    const { blankKeyRole, upsertKeyRole, loadKeyRoles } = await import("@/lib/keyRoles");
    const originalCard = { ...blankKeyRole(), directoryId: library.id, titre: "Original actor", pv: "5" };
    await upsertKeyRole(originalCard);
    const roomCard = await host.addRoomResource({ type: "key-role", item: originalCard });
    expect(roomCard.item.id).not.toBe(originalCard.id);
    host.setPrivateRefs(host.snapshot().privateRefs.map(ref => ref.id === roomCard.item.id ? { ...ref, count: 0 } : ref));
    expect((await loadKeyRoles()).find(card => card.id === originalCard.id)!.pv).toBe("5");
    const isolated = JSON.parse(await (await JSZip.loadAsync(await readBlob((await host.exportArchive()).blob))).file("salle.json")!.async("string"));
    expect(isolated.privateRefs.find((ref: any) => ref.id === roomCard.item.id).count).toBe(0);
    await host.removeRoomHero(live.id);
    expect(await getCharacter(original.id)).toBeDefined();

    await host.useProject(firstProject);
    expect(host.snapshot().roomHeroes[0].id).toBe(firstHero);
  });
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
