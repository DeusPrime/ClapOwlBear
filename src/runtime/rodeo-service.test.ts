// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { OwlbearRoomService, ROOM_KEY, PLAYER_KEY, HOST_KEY } from "./rodeo-service";
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

it('keeps an existing player session retryable when the MJ presence is temporarily absent', async () => {
  const { world, services } = await fixture();
  await services.host.api('', {}, null);
  const session = await services.alice.api('/join', {}, null);
  const host = world.players.find(player => player.id === 'host')!;
  world.players = world.players.filter(player => player.id !== 'host');
  await expect(services.alice.api('/poll', { instance: 'returning', since: 0 }, session)).rejects.toMatchObject({ status: 409 });
  world.players.push(host);
  await expect(services.alice.api('/poll', { instance: 'returning', since: 0 }, session)).resolves.toMatchObject({ self: { role: 'player' } });
});

it('allows the returning GM to recreate a missing native descriptor from the local room save', async () => {
  const { world, services } = await fixture();
  const session = await services.host.api('', {}, null);
  delete world.players.find(player => player.id === 'host')!.metadata[HOST_KEY];
  await expect(services.host.api('/poll', { instance: 'returning-host', since: 0 }, session)).rejects.toMatchObject({ status: 401 });
  await expect(services.host.api('', {}, null)).resolves.toMatchObject({ role: 'mj' });
});
it.each(['lost-offer','delayed-presence'])('retries negotiation when Owlbear has %s', async scenario => {
  const {world,services}=await fixture();
  const host=await services.host.api('',{},null),alice=await services.alice.api('/join',{},null);
  await services.host.api('/poll',{instance:'host-instance',since:0},host);
  await services.alice.api('/poll',{instance:'alice-instance',since:0},alice);
  const send=services.alice.port.send;let dropped=false;
  if(scenario==='lost-offer')services.alice.port.send=async(channel:string,data:any)=>{if(!dropped&&data.index===0){dropped=true;return;}await send(channel,data);};
  else (world.players.find(p=>p.id==='alice')!.metadata[PLAYER_KEY] as any).instance='stale-instance';
  await services.alice.api('/signal',{target:'host',instance:'host-instance',connection:'connection-test',description:{type:'offer',sdp:'test-offer'}},alice);
  await new Promise(resolve=>setTimeout(resolve,30));
  expect((await services.host.api('/poll',{instance:'host-instance',since:0},host)).signals).toEqual([]);
  if(scenario==='delayed-presence')(world.players.find(p=>p.id==='alice')!.metadata[PLAYER_KEY] as any).instance='alice-instance';
  await vi.waitFor(async()=>{const poll=await services.host.api('/poll',{instance:'host-instance',since:0},host);expect(poll.signals).toHaveLength(1);},{timeout:4000});
});
it('authenticates a guest using its own SDK connection metadata when the party snapshot omits connectionId', async () => {
  const {world,services}=await fixture();const host=await services.host.api('',{},null),alice=await services.alice.api('/join',{},null);
  await services.host.api('/poll',{instance:'h',since:0},host);await services.alice.api('/poll',{instance:'a',since:0},alice);
  const others=services.host.port.others;services.host.port.others=async()=> (await others()).map((player:any)=>({...player,connectionId:undefined} as any));
  await services.alice.api('/signal',{target:'host',instance:'h',connection:'guest-connection',description:{type:'offer',sdp:'guest-offer'}},alice);
  await vi.waitFor(async()=>expect((await services.host.api('/poll',{instance:'h',since:0},host)).signals).toHaveLength(1));
  const bob=world.players.find(p=>p.id==='bob')!;(bob.metadata[PLAYER_KEY] as any).sdkConnectionId='connection-alice';
  await services.alice.api('/signal',{target:'host',instance:'h',connection:'ambiguous-connection',description:{type:'offer',sdp:'ambiguous-offer'}},alice);
  await new Promise(resolve=>setTimeout(resolve,30));
  expect((await services.host.api('/poll',{instance:'h',since:0},host)).signals).toHaveLength(1);
});
