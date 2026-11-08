// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { OwlbearRoomService, ROOM_KEY, HOST_KEY } from "./rodeo-service";
import { parseSiteLink, validateSiteLink } from "./site-service";
import { FakeRodeo } from "../test/fakes";
const active: OwlbearRoomService[] = [];
afterEach(() => {
  for (const service of active) service.stop();
  active.length = 0;
  vi.restoreAllMocks();
  localStorage.clear();
});
const answer = (data: unknown, status = 200) =>
  Promise.resolve({
    ok: status < 400,
    status,
    json: async () => data,
  } as Response);
async function setup() {
  const world = new FakeRodeo();
  world.add("host", "GM", "MJ");
  world.add("alice", "PLAYER", "Alice");
  world.add("bob", "PLAYER", "Bob");
  const services = Object.fromEntries(
    await Promise.all(
      world.players.map(async (p) => {
        const s = new OwlbearRoomService(world.port(p.id), "ABCDEF123456");
        active.push(s);
        await s.start();
        return [p.id, s];
      }),
    ),
  );
  await services.host.api("", { title: "Partie locale" }, null);
  return { world, services };
}
describe("Liaison avec une salle réelle du site", () => {
  it("ne traite jamais un simple ID de salle comme une autorisation du MJ", () => {
    expect(() => parseSiteLink("ABCDEF123456")).toThrow();
    expect(parseSiteLink("ABCDEF123456." + "A".repeat(43))).toEqual({
      room: "ABCDEF123456",
      invite: "A".repeat(43),
    });
  });
  it("refuse une API ancienne et laisse la partie native intacte", async () => {
    const { services } = await setup();
    const before = await services.host.descriptor();
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      answer({ features: {} }),
    );
    await expect(
      services.host.api(
        "/integration/validate",
        { link: "ABCDEF123456." + "A".repeat(43) },
        null,
      ),
    ).rejects.toThrow("mise à jour");
    expect(await services.host.descriptor()).toEqual(before);
  });
  it("ignore un détournement de configuration dans les métadonnées partagées ou celles d’un joueur", async () => {
    const { world, services } = await setup();
    const expected = await services.host.descriptor();
    world.metadata[ROOM_KEY] = {
      ...expected,
      site: { room: "FFFFFFFFFFFF", invite: "attacker" },
    };
    world.players.find((p) => p.id === "alice")!.metadata[HOST_KEY] = {
      ...expected,
      revision: Date.now() + 100000,
      site: { room: "FFFFFFFFFFFF", invite: "attacker" },
    };
    expect(await services.bob.descriptor()).toEqual(expected);
  });
  it("raccorde chaque joueur à un membre distinct du site, sans cookies et sans délégation MJ implicite", async () => {
    const { services } = await setup();
    const requests: { url: string; init: RequestInit; body: any }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((url, init) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ url: String(url), init: init || {}, body });
      if (String(url).endsWith("/health"))
        return answer({ features: { owlbearRooms: 1 } });
      if (String(url).endsWith("/owlbear-check"))
        return answer({
          room: { id: "123456ABCDEF", title: "Partie du site" },
        });
      if (String(url).endsWith("/join"))
        return answer({
          room: "123456ABCDEF",
          id: body.name.toLowerCase(),
          name: body.name,
          role: "player",
          token: "private-" + body.name,
        });
      throw new Error("Unexpected request");
    });
    await services.host.api(
      "/integration/link",
      { link: "123456ABCDEF." + "A".repeat(43) },
      null,
    );
    const alice = await services.alice.api("/join", {}, null),
      bob = await services.bob.api("/join", {}, null);
    expect(alice.role).toBe("player");
    expect(alice.id).not.toBe(bob.id);
    const joins = requests.filter((r) => r.url.endsWith("/join"));
    expect(joins[0].body.identityToken).toMatch(/^[a-f0-9]{64}$/);
    expect(joins[0].body.identityToken).not.toBe(joins[1].body.identityToken);
    expect(joins.every((r) => r.init.credentials === "omit")).toBe(true);
    expect(joins.every((r) => r.body.owlbearInvite === "A".repeat(43))).toBe(
      true,
    );
    await expect(
      services.alice.api("/integration/unlink", {}, null),
    ).rejects.toMatchObject({ status: 403 });
  });
});
