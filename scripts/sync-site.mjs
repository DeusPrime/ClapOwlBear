import {
  cpSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { resolve, join, extname } from "node:path";
import { createHash } from "node:crypto";
const site = resolve(process.argv[2] || "../../clap-cinematic-quest");
if (!existsSync(join(site, "src/lib/roomClient.ts")))
  throw new Error("Pass the CLAP site checkout as the first argument.");
const target = "vendor/clap-site";
mkdirSync(target, { recursive: true });
cpSync(join(site, "src"), join(target, "src"), {
  recursive: true,
  filter: (source) =>
    !source.endsWith(".test.ts") &&
    !source.endsWith(".test.tsx") &&
    !/[\\/]test(?:[\\/]|$)/.test(source),
});
for (const entry of readdirSync(join(site, "public"), {
  withFileTypes: true,
})) {
  if (
    [
      "sw.js",
      "manifest.webmanifest",
      "robots.txt",
      ".htaccess",
      "audio",
      "icons",
    ].includes(entry.name)
  )
    continue;
  cpSync(join(site, "public", entry.name), join("public", entry.name), {
    recursive: true,
  });
}
const publicNames = readdirSync(join(site, "public")).filter(
  (n) => !n.startsWith("."),
);
const records = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(file);
      continue;
    }
    if (![".ts", ".tsx", ".css", ".json"].includes(extname(file))) continue;
    let content = readFileSync(file, "utf8");
    records.push([
      file.replaceAll("\\", "/"),
      createHash("sha256").update(content).digest("hex"),
    ]);
    if (extname(file) !== ".json") {
      content = content.replace(/from (["'])zod\1/g, "from 'zod/v3'");
      if (extname(file) !== ".css")
        for (const name of publicNames) {
          const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          content = content.replace(
            new RegExp("(['\"`])/" + escaped + "(?=[/'\"`?])", "g"),
            `$1/ClapOwlBear/${name}`,
          );
        }
    }
    writeFileSync(file, content.replace(/^[ \t]+(?=\r?$)/gm, ""));
  }
}
walk(join(target, "src"));
writeFileSync(
  join(target, "SOURCE.json"),
  JSON.stringify(
    {
      source: "DeusPrime/clap-cinematic-quest",
      syncedAt: new Date().toISOString(),
      adaptations: [
        "zod/v3 compatibility",
        "GitHub Pages asset paths",
        "Owlbear signaling and background proxy",
        "native permissions and invitations",
        "strict TypeScript compatibility",
      ],
      files: records,
    },
    null,
    2,
  ) + "\n",
);
await import("./adapt-site.mjs");
console.log(
  `Synced and adapted ${records.length} source files from CLAP!. No server or credentials copied.`,
);
