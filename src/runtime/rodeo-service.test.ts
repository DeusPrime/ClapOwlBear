// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { OwlbearRoomService, ROOM_KEY, PLAYER_KEY } from "./rodeo-service";
import { FakeRodeo } from "../test/fakes";
const instances: OwlbearRoomService[] = [];
afterEach(() => {
  for (const s of instances) s.stop();
  instances.length = 0;
});
async function fixture() {
  const world = new FakeRodeo();
  world.add("host", "GM");
  world.add("alice", "PLAYER");
  world.add("bob", "PLAYER");
  const services = Object.fromEntries(
    await Promise.all(
      world.players.map(async (p) => {
        const service = new OwlbearRoomService(
          world.port(p.id),
          "ABCDEF123456",
        );
        instances.push(service);
        await service.start();
        return [p.id, service];
      }),
    ),
  );
  return { world, services };
}
describe("Salle Owlbear et identités individuelles", () => {
  (it("crée automatiquement une salle MJ, fournit des identités distinctes et ne publie rien sur le site", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const { services } = await fixture();
    const host = await services.host.api("", { title: "Le film" }, null),
      alice = await services.alice.api("/join", {}, null),
      bob = await services.bob.api("/join", {}, null);
    expect(host.role).toBe("mj");
    expect(alice.id).not.toBe(bob.id);
    expect(alice.token).not.toBe(bob.token);
    expect(alice.role).toBe("player");
    expect(await services.host.api("/list", {}, null)).toEqual({ rooms: [] });
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
    await expect(services.alice.api("", {}, null)).rejects.toMatchObject({
      status: 403,
    });
  }),
    it("vérifie identité et rôle à chaque opération", async () => {
      const { services } = await fixture();
      const host = await services.host.api("", {}, null),
        alice = await services.alice.api("/join", {}, null);
      await expect(
        services.alice.api("/poll", { instance: "x", since: 0 }, host),
      ).rejects.toMatchObject({ status: 401 });
      await expect(
        services.alice.api("/kick", { target: "bob" }, alice),
      ).rejects.toMatchObject({ status: 403 });
      await services.host.api("/kick", { target: "alice" }, host);
      await expect(
        services.alice.api("/poll", { instance: "x", since: 0 }, alice),
      ).rejects.toThrow("expulsé");
    }),
    it("route la signalisation uniquement vers son destinataire et depuis son véritable émetteur", async () => {
      const { world, services } = await fixture();
      const host = await services.host.api("", {}, null),
        alice = await services.alice.api("/join", {}, null),
        bob = await services.bob.api("/join", {}, null);
      await services.host.api("/poll", { instance: "h", since: 0 }, host);
      await services.alice.api("/poll", { instance: "a", since: 0 }, alice);
      await services.bob.api("/poll", { instance: "b", since: 0 }, bob);
      const sdp = "description".repeat(800);
      await services.alice.api(
        "/signal",
        {
          target: "host",
          instance: "h",
          connection: "peer",
          description: { type: "offer", sdp },
        },
        alice,
      );
      await vi.waitFor(async () =>
        expect(
          (await services.host.api("/poll", { instance: "h", since: 0 }, host))
            .signals,
        ).toHaveLength(1),
      );
      const signals = (
        await services.host.api("/poll", { instance: "h", since: 0 }, host)
      ).signals;
      expect(signals[0]).toMatchObject({
        sender: "alice",
        senderInstance: "a",
        description: { sdp },
      });
      expect(
        (await services.bob.api("/poll", { instance: "b", since: 0 }, bob))
          .signals,
      ).toEqual([]);
      expect(
        world.sent.every(
          (p) =>
            new TextEncoder().encode(JSON.stringify(p.data)).length < 16 * 1024,
        ),
      ).toBe(true);
    }),
    it("refuse un transfert MJ vers un simple joueur et ferme la partie explicitement", async () => {
      const { services } = await fixture();
      const host = await services.host.api("", {}, null),
        alice = await services.alice.api("/join", {}, null);
      await expect(
        services.host.api("/transfer", { target: "alice" }, host),
      ).rejects.toMatchObject({ status: 400 });
      await services.host.api("/leave", {}, host);
      expect(services.host.paused).toBe(true);
      await expect(
        services.alice.api("/poll", { instance: "a", since: 0 }, alice),
      ).rejects.toMatchObject({ status: 401 });
    }));
});
