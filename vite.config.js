import { defineConfig } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
const base = '/ClapOwlBear/';
const publicUrl = 'https://deusprime.github.io/ClapOwlBear/';
export default defineConfig(({ command }) => ({
  base: command === 'build' ? base : '/',
  plugins: [{
    name: 'owlbear-pages-manifest',
    apply: 'build',
    closeBundle() {
      const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8').replace(/^\uFEFF/, ''));
      manifest.icon = new URL('icon.svg', publicUrl).href;
      manifest.action.icon = manifest.icon;
      manifest.action.popover = new URL('index.html', publicUrl).href;
      writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
    },
  }],
}));
