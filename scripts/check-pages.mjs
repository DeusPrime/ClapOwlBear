import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
const origin = "https://deusprime.github.io";
const prefix = "/ClapOwlBear/";
const manifest = JSON.parse(readFileSync("dist/manifest.json", "utf8"));
assert.ok(manifest.background_url, "Missing persistent background entry");
for (const url of [
  manifest.icon,
  manifest.action.icon,
  manifest.action.popover,
  manifest.background_url,
]) {
  const target = new URL(url);
  assert.equal(target.origin, origin);
  assert.ok(
    target.pathname.startsWith(prefix),
    `URL outside extension: ${url}`,
  );
  assert.ok(
    existsSync(`dist/${target.pathname.slice(prefix.length)}`),
    `Missing resource: ${url}`,
  );
}
for (const entry of ["index.html", "background.html"]) {
  const html = readFileSync(`dist/${entry}`, "utf8");
  const assets = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(
    (m) => m[1],
  );
  assert.ok(
    assets.some((path) => path.endsWith(".js")),
    `Missing entry script: ${entry}`,
  );
  for (const path of assets) {
    assert.ok(path.startsWith(prefix), `Invalid Pages asset path: ${path}`);
    assert.ok(
      existsSync(`dist/${path.slice(prefix.length)}`),
      `Missing build asset: ${path}`,
    );
  }
}
for (const file of readdirSync("dist/assets").filter((file) =>
  file.endsWith(".css"),
)) {
  const css = readFileSync(`dist/assets/${file}`, "utf8");
  for (const match of css.matchAll(
    /url\(["']?(\/ClapOwlBear\/[^)"']+)["']?\)/g,
  ))
    assert.ok(
      existsSync(`dist/${match[1].slice(prefix.length).split("?")[0]}`),
      `Missing CSS resource: ${match[1]}`,
    );
}
for (const file of [
  "templates/cartes-heros-vierges-A6.pdf",
  "templates/blank-hero-cards-A6-en.pdf",
  "fonts/CourierPrime-Regular.ttf",
])
  assert.ok(existsSync("dist/" + file), `Missing export resource: ${file}`);
console.log(
  "Pages OK: manifest, persistent background, UI, compiled assets and export resources.",
);
