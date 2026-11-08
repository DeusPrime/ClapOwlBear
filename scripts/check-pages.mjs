import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const origin = 'https://deusprime.github.io';
const prefix = '/ClapOwlBear/';
const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
for (const url of [manifest.icon, manifest.action.icon, manifest.action.popover]) {
  const target = new URL(url);
  assert.equal(target.origin, origin);
  assert.ok(target.pathname.startsWith(prefix), `URL outside extension: ${url}`);
  assert.ok(existsSync(`dist/${target.pathname.slice(prefix.length)}`), `Missing resource: ${url}`);
}
const html = readFileSync('dist/index.html', 'utf8');
const assets = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m => m[1]);
assert.ok(assets.some(path => path.endsWith('.js')), 'Missing entry script');
for (const path of assets) {
  assert.ok(path.startsWith(prefix), `Invalid Pages asset path: ${path}`);
  assert.ok(existsSync(`dist/${path.slice(prefix.length)}`), `Missing build asset: ${path}`);
}
console.log('Pages OK: manifest, panel, icon and compiled assets.');
