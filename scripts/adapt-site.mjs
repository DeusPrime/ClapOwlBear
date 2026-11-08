import { readFileSync, writeFileSync } from "node:fs";
const read = (p) => readFileSync(p, "utf8").replace(/^\uFEFF/, "");
const save = (p, s) => writeFileSync(p, s.trimEnd() + "\n");
const root = "vendor/clap-site/src/";
let source = read(root + "lib/roomClient.ts");
const start = source.indexOf("  private async api<T>("),
  stop = source.indexOf("  list() {", start);
if (start < 0 || stop < 0) throw new Error("Upstream API boundary changed");
source =
  "import {callRoomApi,sharedRoomClient,createRoomPeer} from '@owlbear/runtime/client';\n" +
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
  async linkSiteRoom(link:string){
    this.integrationChanging=true;
    try{const config=await this.api<{room:string}>('/integration/validate',{link});const name=this.state.session?.name||'MJ Owlbear';
    if(this.state.session)await this.leave();await this.api('/integration/link',{link},null);await this.enter(name,config.room);}
    finally{this.integrationChanging=false;}
  }
  async unlinkSiteRoom(){this.integrationChanging=true;try{const name=this.state.session?.name||'MJ Owlbear';if(this.state.session)await this.leave();await this.api('/integration/unlink',{},null);await this.enter(name,undefined,undefined,{title:'Salle CLAP!'});}finally{this.integrationChanging=false;}}
  async sendChat(text: string, target?: string) {`,
);
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
heroAssignments = "import {copyConnectionDiagnostics} from '@owlbear/runtime/client';\n" + heroAssignments;
heroAssignments = heroAssignments.replace('{localizeText("En attente de connexion du joueur pour transmettre la fiche.")}</p>', '{localizeText("En attente de connexion du joueur pour transmettre la fiche.")} <button type="button" className="ml-2 underline" onClick={() => void copyConnectionDiagnostics()}>Copier le diagnostic connexion</button></p>');
save(root + 'components/RoomHeroAssignments.tsx',heroAssignments);
