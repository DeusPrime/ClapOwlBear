import { readFileSync, writeFileSync } from "node:fs";
const read = (p) => readFileSync(p, "utf8").replace(/^\uFEFF/, "");
const save = (p, s) => writeFileSync(p, s.trimEnd() + "\n");
const root = "vendor/clap-site/src/";
let source = read(root + "lib/roomClient.ts");
const start = source.indexOf("  private async api<T>("),
  stop = source.indexOf("  list() {", start);
if (start < 0 || stop < 0) throw new Error("Upstream API boundary changed");
source =
  "import {sheetSignature} from '@owlbear/runtime/sheet-signature';\nimport {callRoomApi,sharedRoomClient,createRoomPeer} from '@owlbear/runtime/client';\n" +
  source.slice(0, start) +
  `  private async api<T>(path:string,body:unknown,session=this.state.session):Promise<T>{return callRoomApi<T>(path,body,session);}
` +
  source.slice(stop);
source = source.replace(
  "`clap-room-${this.state.session!.id}`",
  "`clap-room-${this.state.session!.room}:${this.state.session!.id}`",
);
source = source.replace(
  "  async sendChat(text: string, target?: string) {",
  `  async setRoomTitle(title:string){await this.api('/title',{title});await this.refreshRoom();this.persist();}
  private integrationChanging=false;
  isRoomTransitioning(){return this.integrationChanging||this.busy;}
  connectionState(){return {ticks:this.connectionTickCount,lastTickAt:this.connectionLastTick,offers:this.connectionOfferCount,signalError:this.connectionSignalError,lastPeerClose:this.connectionLastPeerClose,hostPresent:this.state.members.some(member=>member.role==='mj'&&member.online),stopped:this.stopped,busy:this.busy,role:this.state.session?.role,lockHeld:Boolean(this.releaseLock),error:this.state.error,memberRoles:this.state.members.map(member=>({role:member.role,online:member.online,self:member.id===this.state.session?.id})),peers:[...this.peers.values()].map(peer=>({implementation:peer.pc.constructor.name,state:peer.pc.connectionState,signaling:peer.pc.signalingState,channel:peer.transport?.channel.readyState}))};}
  async linkSiteRoom(link:string){
    this.integrationChanging=true;
    try{const config=await this.api<{room:string}>('/integration/validate',{link});const name=this.state.session?.name||'MJ Owlbear';
    if(this.state.session)await this.leave();await this.api('/integration/link',{link},null);await this.enter(name,config.room);}
    finally{this.integrationChanging=false;}
  }
  async unlinkSiteRoom(){this.integrationChanging=true;try{const name=this.state.session?.name||'MJ Owlbear';if(this.state.session)await this.leave();await this.api('/integration/unlink',{},null);await this.enter(name,undefined,undefined,{title:'Salle CLAP!'});}finally{this.integrationChanging=false;}}
  async sendChat(text: string, target?: string) {`,
);
source = source.replace('  private async tick(generation: number) {', '  private connectionTickCount=0; private connectionLastTick=0; private connectionOfferCount=0; private connectionSignalError="";\n  private async tick(generation: number) {this.connectionTickCount++;this.connectionLastTick=Date.now();');
source = source.replace('  private async offer(member: RoomMember, generation: number) {', '  private async offer(member: RoomMember, generation: number) {this.connectionOfferCount++;');
source = source.replace('catch { if (generation === this.generation) this.closePeer(signal.sender); }', 'catch(error) { this.connectionSignalError=error instanceof Error?error.message:String(error);if (generation === this.generation) this.closePeer(signal.sender); }');
source = source.replace('  private closePeer(id: string) {', '  private connectionLastPeerClose="";\n  private closePeer(id: string, reason="session cleanup") {if(this.peers.has(id))this.connectionLastPeerClose=reason;');
source = source.replace('    this.closePeer(member.id);\n    const pc', '    this.closePeer(member.id,"new negotiation");\n    const pc');
source = source.replace('this.closePeer(member.id); };', 'this.closePeer(member.id,"channel closed"); };');
source = source.replace('this.closePeer(member.id);\n    };', 'this.closePeer(member.id,"transport "+pc.connectionState);\n    };');
source = source.replace('if (!member?.online || member.instance !== peer.instance || (peer.transport?.channel.readyState !== "open" && Date.now() - peer.started > 30000)) this.closePeer(id);', 'if (!member?.online || member.instance !== peer.instance || (peer.transport?.channel.readyState !== "open" && Date.now() - peer.started > 30000)) this.closePeer(id,!member?.online?"participant offline":member.instance!==peer.instance?"participant instance changed":"negotiation timeout");');
// Without resource-ID remapping, the GM already owns the exact assigned sheet.
source = source.replace("this.peers.forEach(peer => { peer.sheet = ''; });", "const assignedCharacter=await getCharacter(character.id)||character;const assignedSignature=sheetSignature(roomCharacterSchema.parse({...assignedCharacter,portrait:assignedCharacter.portrait||undefined}));this.peers.forEach(peer => { peer.sheet = message.resources?.length ? '' : assignedSignature; });");
source = source.replace('const message: RoomMessage = { kind: "sheet", character: parsed?.success ? parsed.data : null };\n      const json = JSON.stringify(message);', 'const message: RoomMessage = { kind: "sheet", character: parsed?.success ? parsed.data : null };\n      const json = sheetSignature(message.character);');
source = source.replace('type Snapshot = {','type Snapshot = {\n  sheetTransfers?: string[];');
source = source.replace('  async assignCharacter(playerId: string, characterId: string) {', '  private preparingAssignments=new Set<string>();\n  pendingAssignmentIds(){return [...new Set([...this.preparingAssignments,...this.assignments.keys()])].filter(id=>this.state.connected.includes(id));}\n  async assignCharacter(playerId:string,characterId:string){this.preparingAssignments.add(playerId);this.update({});try{return await this.prepareCharacterAssignment(playerId,characterId);}finally{this.preparingAssignments.delete(playerId);this.update({});}}\n  private async prepareCharacterAssignment(playerId: string, characterId: string) {');
source = source.replace('this.assignments.delete(sender);', '{this.assignments.delete(sender);this.update({});}');
source = source.replace("new RTCPeerConnection({ iceServers: this.iceServers })", "createRoomPeer({ iceServers: this.iceServers })");
source = source.replace(
  "export const roomClient = new RoomClient();",
  "export const roomClient = sharedRoomClient(() => new RoomClient());",
);
const es = source.indexOf("    const url = URL.createObjectURL(blob);"),
  ee = source.indexOf("\n  private save(", es),
  expression = source.match(/link\.download = ([^\n]+);/);
if (es < 0 || ee < 0 || !expression)
  throw new Error("Upstream export boundary changed");
source =
  source.slice(0, es) +
  `    return {blob,name:${expression[1]}};
  }
` +
  source.slice(ee);
save(root + "lib/roomClient.ts", source);
save(
  root + "components/DirectoryMenu.tsx",
  "export {default} from '@owlbear/GameMenu';",
);
let manage =
  "import {isLinkedSite} from '@owlbear/runtime/client';\n" +
  read(root + "components/RoomManagement.tsx");
manage = manage.replace(
  /(<DropdownMenuItem className="min-h-11 gap-3" onSelect=\{\(\) => open\("invitation"\)\}>.*?<\/DropdownMenuItem>)/,
  "{isLinkedSite() && $1}",
);
manage = manage.replace(
  /(<DropdownMenuItem className="min-h-11 gap-3" onSelect=\{\(\) => open\("password"\)\}>.*?<\/DropdownMenuItem>)/,
  "{isLinkedSite() && $1}",
);
manage = manage.replace(
  "{isMJ && <DropdownMenuItem className=\"min-h-11 gap-3\" onSelect={() => open('owlbear')}",
  "{isMJ && isLinkedSite() && <DropdownMenuItem className=\"min-h-11 gap-3\" onSelect={() => open('owlbear')}",
);
manage = manage.replace(
  'member.role === "player" && room.connected.includes(member.id)',
  "member.role === \"player\" && (isLinkedSite() || member.owlbearRole === 'GM') && room.connected.includes(member.id)",
);
manage = manage.replace(
  "Le joueur choisi devient l’unique MJ. Tu redeviens joueur.",
  "Le joueur choisi devient le MJ de CLAP!. Pour une partie locale Owlbear, donne-lui d’abord le rôle MJ Owlbear.",
);
save(root + "components/RoomManagement.tsx", manage);
let protocol = read(root + "lib/roomProtocol.ts");
protocol = protocol.replace(
  "instance: string; online: boolean;",
  'instance: string; online: boolean; owlbearRole?: "GM" | "PLAYER";',
);
save(root + "lib/roomProtocol.ts", protocol);
let studio = read(root + "lib/studioImport.ts");
studio = studio.replace(
  '    if (entries.length > 4) throw new Error("Archive trop volumineuse.");',
  "",
);
save(root + "lib/studioImport.ts", studio);
await import("./strict-site.mjs");

let heroAssignments = read(root + 'components/RoomHeroAssignments.tsx');
heroAssignments = "import {copyConnectionDiagnostics,connectionError} from '@owlbear/runtime/client';\n" + heroAssignments;
heroAssignments = heroAssignments.replace('{localizeText("En attente de connexion du joueur pour transmettre la fiche.")}</p>', '{localizeText("En attente de connexion du joueur pour transmettre la fiche.")} <button type="button" className="ml-2 underline" onClick={() => void copyConnectionDiagnostics()}>Copier le diagnostic connexion</button><span className="mt-1 block text-destructive">{connectionError()}</span></p>');
save(root + 'components/RoomHeroAssignments.tsx',heroAssignments);

let rollDialog = read(root + 'components/RollDialog.tsx');
rollDialog = "import {afterRollPaint} from '@owlbear/runtime/after-roll-paint';\n" + rollDialog;
rollDialog = rollDialog.replace('    void logRoll(entry);','    afterRollPaint(() => { void logRoll(entry); });');
rollDialog = rollDialog.replace('    logging ? localizeText("Enregistrement du jet dans la salle en cours…") : "",\n', '');
save(root + 'components/RollDialog.tsx',rollDialog);

let playerBoard=read(root+'components/RoomPlayersBoard.tsx');
playerBoard="import SheetLoading from '@owlbear/SheetLoading';\n"+playerBoard;
playerBoard=playerBoard.replace('className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden bg-ink/5">','className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden bg-ink/5">{room.sheetTransfers?.includes(member.id) && <div className="absolute inset-0 z-10 flex items-center justify-center bg-paper/90"><SheetLoading /></div>}');
save(root+'components/RoomPlayersBoard.tsx',playerBoard);
