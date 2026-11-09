// @vitest-environment jsdom
import "fake-indexeddb/auto";
import JSZip from "jszip";
import { afterEach, describe, it, expect, vi } from "vitest";
import { FakeRodeo, MemoryPeer, MemoryChannel } from "../test/fakes";
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
it.each(['identical','missing-card','missing-player-card','different-sheet'] as const)('resumes with content hashes instead of reassigning identical cached data (%s)', async scenario => {
  const prototype=MemoryChannel.prototype as any;
  Object.defineProperty(prototype,'prioritySupported',{configurable:true,value:true});
  prototype.sendPriority=prototype.send;
  const frames:string[]=[];
  const original=prototype.send;
  const spy=vi.spyOn(prototype,'send').mockImplementation(function(this:any,value:unknown){frames.push(String(value));return original.call(this,value);});
  prototype.sendPriority=prototype.send;
  try {
    vi.stubGlobal('RTCPeerConnection',MemoryPeer);
    const world=new FakeRodeo();world.add('host','GM');world.add('alice','PLAYER');
    const hs=new OwlbearRoomService(world.port('host'),'F1F2F3F4F5F6'),ps=new OwlbearRoomService(world.port('alice'),'F1F2F3F4F5F6');
    services.push(hs,ps);await hs.start();await ps.start();
    const host=await engine(hs,'host'),player=await engine(ps,'alice','F1F2F3F4F5F6');
    await vi.waitFor(()=>expect(host.snapshot().connected).toContain('alice'),{timeout:12000});
    const {blankCharacter,getCharacter,upsertCharacter}=await import('@/lib/characters');
    const {blankPower}=await import('@/lib/powers');
    const powers=[{...blankPower(),titre:'Cached card one'},{...blankPower(),titre:'Cached card two'}];
    const hero=await host.addRoomHero({...blankCharacter(),nom:'Cached hero',notes:'Stored notes',linkedResources:powers.map(power=>({type:'power',id:power.id}))},powers.map(item=>({type:'power',item})));
    await host.assignCharacter('alice',hero.id);
    await vi.waitFor(()=>expect(host.snapshot().sheetResources.alice).toHaveLength(2),{timeout:12000});
    await vi.waitFor(()=>expect(host.pendingAssignmentIds()).toEqual([]));
    (host as any).closePeer('alice');(player as any).closePeer('host');
    if(scenario==='missing-card')(host as any).archive.sheetResources.alice=(host as any).archive.sheetResources.alice.slice(0,1);
    if(scenario==='missing-player-card'){const local=await getCharacter(hero.id);await (await import('@/lib/powers')).deletePower(local!.linkedResources[0].id);}
    if(scenario==='different-sheet'){window.removeEventListener('clap-character-saved',(host as any).characterSaved);const local=await getCharacter(hero.id);await upsertCharacter({...local!,notes:'Unconfirmed offline edit'});}
    frames.length=0;
    const assign=vi.spyOn(host,'assignCharacter');
    await vi.waitFor(()=>expect(host.snapshot().connected).toContain('alice'),{timeout:12000});
    if(scenario==='different-sheet') {
      await vi.waitFor(()=>expect(assign).toHaveBeenCalled(),{timeout:6000});
      await vi.waitFor(async()=>expect((await getCharacter(hero.id))?.notes).toBe('Stored notes'));
    } else {
      await vi.waitFor(()=>expect(host.snapshot().sheets.alice?.id).toBe(hero.id),{timeout:6000});
      await vi.waitFor(()=>expect(host.snapshot().sheetResources.alice).toHaveLength(2),{timeout:6000});
      if(scenario==='missing-player-card')await vi.waitFor(async()=>expect(await (await import('@/lib/resourceBundle')).loadLinkedBundledResources((await getCharacter(hero.id))!)).toHaveLength(2),{timeout:6000});
      expect(assign).not.toHaveBeenCalled();
      expect(frames.some(frame=>frame.includes('"kind":"assign-sheet"'))).toBe(false);
      expect(frames.some(frame=>frame.includes('"kind":"sheet"'))).toBe(false);
      const sentCards=frames.filter(frame=>frame.includes('"kind":"sheet-resource"'));
      expect(sentCards).toHaveLength(scenario==='missing-card'||scenario==='missing-player-card'?1:0);
    }
  } finally {spy.mockRestore();delete prototype.prioritySupported;delete prototype.sendPriority;}
},25000);
it('delivers a live roll ahead of blocked history and retains it when an older history arrives', async () => {
  const prototype=MemoryChannel.prototype as any;
  Object.defineProperty(prototype,'prioritySupported',{configurable:true,value:true});prototype.sendPriority=prototype.send;
  let spy:ReturnType<typeof vi.spyOn>|undefined;
  try {
    vi.stubGlobal('RTCPeerConnection',MemoryPeer);
    const world=new FakeRodeo();world.add('host','GM');world.add('alice','PLAYER');
    const hs=new OwlbearRoomService(world.port('host'),'A0B0C0D0E0F0'),ps=new OwlbearRoomService(world.port('alice'),'A0B0C0D0E0F0');
    services.push(hs,ps);await hs.start();await ps.start();
    const host=await engine(hs,'host'),player=await engine(ps,'alice','A0B0C0D0E0F0');
    await vi.waitFor(()=>expect(host.snapshot().connected).toContain('alice'),{timeout:12000});
    await vi.waitFor(()=>expect((player as any).peers.get('host')?.resumeChecked).toBe(true));
    const original=prototype.send;
    const blocked:string[]=[];
    spy=vi.spyOn(prototype,'send').mockImplementation(function(this:any,value:unknown){const frame=String(value);if(frame.startsWith('size:')||frame.startsWith('data:')){blocked.push(frame);return;}return original.call(this,value);});prototype.sendPriority=prototype.send;
    const history=Array.from({length:30},(_,id)=>({id:id+1,sender:'host',name:'MJ',role:'mj',kind:'chat',text:'history '.repeat(100),created:1}));
    (host as any).game={...(host as any).game,messages:history,sequence:30};
    (host as any).publishGame();
    await host.broadcastRoll('Priority roll','Result: 4',{public:true});
    await vi.waitFor(()=>expect(player.snapshot().messages.some(message=>message.kind==='roll'&&message.text.includes('Priority roll'))).toBe(true),{timeout:2000});
    expect(blocked.length).toBeGreaterThan(0);
    (player as any).receive('host',{kind:'game-state',messages:history,requests:[],roomGeneration:player.snapshot().session?.gameGeneration});
    expect(player.snapshot().messages.some(message=>message.kind==='roll'&&message.text.includes('Priority roll'))).toBe(true);
    expect(player.snapshot().messages.filter(message=>message.kind==='roll')).toHaveLength(1);
  } finally {spy?.mockRestore();delete prototype.prioritySupported;delete prototype.sendPriority;}
},15000);
it('synchronizes live constants, attributes and inventory in both directions using only deltas', async () => {
  const prototype=MemoryChannel.prototype as any;
  Object.defineProperty(prototype,'prioritySupported',{configurable:true,value:true});Object.defineProperty(prototype,'deltaSupported',{configurable:true,value:true});prototype.sendPriority=prototype.send;
  const spies:ReturnType<typeof vi.spyOn>[]=[];
  try {
    vi.stubGlobal('RTCPeerConnection',MemoryPeer);
    const world=new FakeRodeo();world.add('host','GM');world.add('alice','PLAYER');
    const hs=new OwlbearRoomService(world.port('host'),'D1D2D3D4D5D6'),ps=new OwlbearRoomService(world.port('alice'),'D1D2D3D4D5D6');services.push(hs,ps);await hs.start();await ps.start();
    const host=await engine(hs,'host'),player=await engine(ps,'alice','D1D2D3D4D5D6');
    await vi.waitFor(()=>expect(host.snapshot().connected).toContain('alice'),{timeout:12000});
    const {blankCharacter,getCharacter,mutateCharacter}=await import('@/lib/characters');
    const portrait='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=';
    const {blankPower}=await import('@/lib/powers');const power={...blankPower(),titre:'Existing linked card'};
    const hero=await host.addRoomHero({...blankCharacter(),nom:'Live hero',portrait,linkedResources:[{type:'power',id:power.id}]},[{type:'power',item:power}]);await host.assignCharacter('alice',hero.id);
    await vi.waitFor(()=>expect(player.snapshot().session?.characterId).toBe(hero.id));
    await vi.waitFor(()=>expect((player as any).peers.get('host')?.baseCharacter?.id).toBe(hero.id));
    await vi.waitFor(()=>expect(host.snapshot().sheetResources.alice).toHaveLength(1),{timeout:12000});
    const messages:any[]=[];const held:(()=>void)[]=[];let holdPatches=false;
    for(const [client,id] of [[player,'host'],[host,'alice']] as const){const transport=(client as any).peers.get(id).transport;const original=transport.send.bind(transport);spies.push(vi.spyOn(transport,'send').mockImplementation((message:any)=>{messages.push(message);if(holdPatches&&message.kind==='sheet-patch'){held.push(()=>original(message));return true;}return original(message);}));}
    const playerChange=async(change:(current:any)=>any)=>{window.removeEventListener('clap-character-saved',(host as any).characterSaved);try{await mutateCharacter(hero.id,change);}finally{window.addEventListener('clap-character-saved',(host as any).characterSaved);}};
    await playerChange(current=>({...current,stress:current.stress.map((value:boolean,index:number)=>index===1?true:value)}));
    await vi.waitFor(()=>expect(host.snapshot().sheets.alice.stress[1]).toBe(true),{timeout:2000});
    await playerChange(current=>({...current,facets:{...current.facets,corps:{...current.facets.corps,core:6,skills:{...current.facets.corps.skills,Force:5}}}}));
    await vi.waitFor(()=>expect(host.snapshot().sheets.alice.facets.corps.skills.Force).toBe(5),{timeout:2000});
    await playerChange(current=>({...current,autresAccessoires:[{nom:'Player key',proprietes:'Gold'}]}));
    await vi.waitFor(()=>expect(host.snapshot().sheets.alice.autresAccessoires[0]?.nom).toBe('Player key'),{timeout:2000});
    const {roomHeroEditSignature}=await import('@/lib/roomInventoryChanges');
    const current=host.snapshot().sheets.alice;
    await host.updateRoomHero({...current,griefs:current.griefs.map((value:boolean,index:number)=>index===2?true:value),facets:{...current.facets,esprit:{...current.facets.esprit,core:7}},autresAccessoires:[...current.autresAccessoires,{nom:'GM item',proprietes:'Silver'}]},current.updatedAt,roomHeroEditSignature(current));
    await vi.waitFor(async()=>{const received=await getCharacter(hero.id);expect(received?.griefs[2]).toBe(true);expect(received?.facets.esprit.core).toBe(7);expect(received?.autresAccessoires).toHaveLength(2);},{timeout:2000});
    await vi.waitFor(()=>expect((host as any).peers.get('alice').pendingPatch).toBeUndefined());
    await vi.waitFor(()=>expect((player as any).peers.get('host').pendingPatch).toBeUndefined());
    holdPatches=true;
    await playerChange(current=>({...current,notes:'Player simultaneous note'}));
    await vi.waitFor(()=>expect((player as any).peers.get('host').pendingPatch?.target.notes).toBe('Player simultaneous note'));
    const simultaneous=host.snapshot().sheets.alice;
    await host.updateRoomHero({...simultaneous,notes:'GM simultaneous note'},simultaneous.updatedAt,roomHeroEditSignature(simultaneous));
    await vi.waitFor(()=>expect(held).toHaveLength(2));holdPatches=false;held.splice(0).forEach(deliver=>deliver());
    await vi.waitFor(async()=>{expect(host.snapshot().sheets.alice.notes).toBe('GM simultaneous note');expect((await getCharacter(hero.id))?.notes).toBe('GM simultaneous note');expect((host as any).peers.get('alice').pendingPatch).toBeUndefined();expect((player as any).peers.get('host').pendingPatch).toBeUndefined();});
    const patches=messages.filter(message=>message.kind==='sheet-patch');
    expect(patches.length).toBeGreaterThanOrEqual(3);
    expect(patches.some(message=>message.changes.some((change:any)=>change.path.join('.')==='facets.corps.core'))).toBe(true);
    expect(messages.some(message=>message.kind==='sheet'||message.kind==='assign-sheet')).toBe(false);
    expect(JSON.stringify(patches)).not.toContain(portrait);
    expect(messages.some(message=>message.kind==='sheet-resource')).toBe(false);
  } finally {for(const spy of spies)spy.mockRestore();delete prototype.prioritySupported;delete prototype.deltaSupported;delete prototype.sendPriority;}
},20000);
it.each(['identical','missing-player-card'] as const)('retains the player cache across a GM restart and a new authentication epoch (%s)',async scenario=>{
  const prototype=MemoryChannel.prototype as any;
  Object.defineProperty(prototype,'prioritySupported',{configurable:true,value:true});Object.defineProperty(prototype,'deltaSupported',{configurable:true,value:true});prototype.sendPriority=prototype.send;
  let wireSpy:ReturnType<typeof vi.spyOn>|undefined;
  try{
    vi.stubGlobal('RTCPeerConnection',MemoryPeer);
    const world=new FakeRodeo();world.add('host','GM');world.add('alice','PLAYER');
    const code='DAD1DAD2DAD3';
    const hs=new OwlbearRoomService(world.port('host'),code),ps=new OwlbearRoomService(world.port('alice'),code);services.push(hs,ps);await hs.start();await ps.start();
    const host=await engine(hs,'host'),player=await engine(ps,'alice',code);
    await vi.waitFor(()=>expect(host.snapshot().connected).toContain('alice'),{timeout:12000});
    const {blankCharacter,getCharacter}=await import('@/lib/characters');const {blankPower,deletePower}=await import('@/lib/powers');
    const power={...blankPower(),directoryId:'source',titre:'Cache retained card'};
    const hero={...blankCharacter(),directoryId:'source',nom:'GM reconnect hero',linkedResources:[{type:'power',id:power.id}]};
    const studio=await new JSZip().file('studio.json',JSON.stringify({format:'clap-studio',version:1,project:{id:'source',name:'Reconnect project'},heroes:[hero],resources:[{type:'power',item:power}],tools:[]})).generateAsync({type:'arraybuffer'});
    await host.importProject(studio);
    await vi.waitFor(()=>expect(player.snapshot().session?.gameGeneration).toBe(host.snapshot().session?.gameGeneration));
    const assigned=host.snapshot().roomHeroes[0];await host.assignCharacter('alice',assigned.id);
    await vi.waitFor(()=>expect(host.snapshot().sheetResources.alice).toHaveLength(1),{timeout:12000});
    await vi.waitFor(()=>expect(host.pendingAssignmentIds()).toEqual([]));
    const {rememberPlayerSession,cachedPlayerSheet,rememberedPlayerSession}=await import('./player-session');
    const oldSession=player.snapshot().session!;const localId=host.snapshot().session!.localRoomId!;
    rememberPlayerSession(world.port('alice').roomId,'alice',oldSession);
    host.stop();hs.stop();await (host as any).persistence;
    world.players=world.players.filter(member=>member.id!=='host');
    const returning=world.add('host','GM');returning.connectionId='reconnected-gm';
    const nextService=new OwlbearRoomService(world.port('host'),code);services.push(nextService);await nextService.start();
    vi.resetModules();const runtime=await import('./client');runtime.configureRuntime({background:true,channel:'reconnected-host'},nextService.api);
    const {RoomClient}=await import('@/lib/roomClient');const nextHost=new RoomClient();clients.push(nextHost);await nextHost.resumeLocalRoom(localId);
    await vi.waitFor(()=>expect(player.snapshot().session).toBeNull(),{timeout:10000});
    const descriptor=await nextService.descriptor();
    expect(oldSession.token.startsWith(descriptor!.epoch+':')).toBe(false);
    expect(rememberedPlayerSession(world.port('alice').roomId,'alice',code,'alice',descriptor!.epoch)).toBeUndefined();
    const cached=cachedPlayerSheet(world.port('alice').roomId,'alice',code,'alice')!;expect(cached.characterId).toBe(assigned.id);
    if(scenario==='missing-player-card')await deletePower((await getCharacter(assigned.id))!.linkedResources[0].id);
    const frames:string[]=[];const original=prototype.send;wireSpy=vi.spyOn(prototype,'send').mockImplementation(function(this:any,data:unknown){frames.push(String(data));return original.call(this,data);});prototype.sendPriority=prototype.send;
    const assignSpy=vi.spyOn(nextHost,'assignCharacter');
    await player.enter('alice',code,cached.characterId,{cachedSheet:cached});
    await vi.waitFor(()=>expect(nextHost.snapshot().sheets.alice?.id).toBe(assigned.id),{timeout:12000});
    expect(player.snapshot().session?.characterId).toBe(assigned.id);
    expect(player.snapshot().session?.gameGeneration).toBe(nextHost.snapshot().session?.gameGeneration);
    expect(player.snapshot().session?.token).not.toBe(oldSession.token);
    await vi.waitFor(async()=>expect(await (await import('@/lib/resourceBundle')).loadLinkedBundledResources((await getCharacter(assigned.id))!)).toHaveLength(1));
    expect(assignSpy).not.toHaveBeenCalled();
    expect(frames.some(frame=>frame.includes('"kind":"assign-sheet"')||frame.includes('"kind":"sheet"'))).toBe(false);
    expect(frames.filter(frame=>frame.includes('"kind":"sheet-resource"'))).toHaveLength(scenario==='missing-player-card'?1:0);
  }finally{wireSpy?.mockRestore();delete prototype.prioritySupported;delete prototype.deltaSupported;delete prototype.sendPriority;}
},30000);
