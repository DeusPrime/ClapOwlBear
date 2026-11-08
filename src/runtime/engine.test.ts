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
    const { blob } = await host.exportArchive();
    const exported = JSON.parse(await (await JSZip.loadAsync(await readBlob(blob))).file("salle.json")!.async("string"));
    expect(exported.projectName).toBe("Imported film");
    expect(exported.heroes[0].linkedResources[0].id).toBe(exported.resources[0].item.id);
    const localId = host.snapshot().session.localRoomId;
    await player.leave(); await host.leave();
    await host.resumeLocalRoom(localId);
    expect(host.snapshot().projectName).toBe("Imported film");
    expect(host.snapshot().roomHeroes).toHaveLength(1);
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
