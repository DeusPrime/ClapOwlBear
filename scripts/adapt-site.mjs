import { readFileSync, writeFileSync } from "node:fs";
const read = (p) => readFileSync(p, "utf8").replace(/^\uFEFF/, "");
const save = (p, s) => writeFileSync(p, s.trimEnd() + "\n");
const root = "vendor/clap-site/src/";
let source = read(root + "lib/roomClient.ts");
const start = source.indexOf("  private async api<T>("),
  stop = source.indexOf("  list() {", start);
if (start < 0 || stop < 0) throw new Error("Upstream API boundary changed");
source =
  "import { callRoomApi, sharedRoomClient } from '@owlbear/runtime/client';\n" +
  source.slice(0, start) +
  `  private async api<T>(path: string, body: unknown, session = this.state.session): Promise<T> {
    return callRoomApi<T>(path, body, session);
  }
` +
  source.slice(stop);
source = source.replace(
  "`clap-room-${this.state.session!.id}`",
  "`clap-room-${this.state.session!.room}:${this.state.session!.id}`",
);
source = source.replace(
  "  async sendChat(text: string, target?: string) {",
  `  async setRoomTitle(title: string) { await this.api('/title', {title}); await this.refreshRoom(); this.persist(); }
  async sendChat(text: string, target?: string) {`,
);
source = source.replace(
  "export const roomClient = new RoomClient();",
  "export const roomClient = sharedRoomClient(() => new RoomClient());",
);
const exportStart = source.indexOf(
    "    const url = URL.createObjectURL(blob);",
  ),
  exportEnd = source.indexOf("\n  private save(", exportStart);
const expression = source.match(/link\.download = ([^\n]+);/);
if (exportStart < 0 || exportEnd < 0 || !expression)
  throw new Error("Upstream export boundary changed");
source =
  source.slice(0, exportStart) +
  `    return {blob, name: ${expression[1]}};
  }
` +
  source.slice(exportEnd);
save(root + "lib/roomClient.ts", source);
save(
  root + "components/DirectoryMenu.tsx",
  "export { default } from '@owlbear/GameMenu';",
);
let manage = read(root + "components/RoomManagement.tsx");
manage = manage.replace(
  /      <DropdownMenuItem className="min-h-11 gap-3" onSelect=\{\(\) => open\("invitation"\)\}>.*?<\/DropdownMenuItem>\r?\n/,
  "",
);
manage = manage.replace(
  /<DropdownMenuItem className="min-h-11 gap-3" onSelect=\{\(\) => open\("password"\)\}>.*?<\/DropdownMenuItem>/,
  "",
);
manage = manage.replace(
  'member.role === "player" && room.connected.includes(member.id)',
  "member.role === \"player\" && member.owlbearRole === 'GM' && room.connected.includes(member.id)",
);
manage = manage.replace(
  "Le joueur choisi devient l’unique MJ. Tu redeviens joueur.",
  "Le successeur doit avoir le rôle MJ dans Owlbear. Le transfert lui transmet ensuite les données de la partie CLAP!.",
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
