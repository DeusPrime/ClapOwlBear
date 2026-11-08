import { defineConfig } from "vite";
import { resolve } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
const base = "/ClapOwlBear/";
const publicUrl = "https://deusprime.github.io/ClapOwlBear/";
export default defineConfig(({ command }) => ({
  base,
  define: { __APP_VERSION__: JSON.stringify("0.2.1") },
  resolve: {
    alias: { "@owlbear": resolve("src"), "@": resolve("vendor/clap-site/src") },
    dedupe: ["react", "react-dom"],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve("index.html"),
        background: resolve("background.html"),
      },
    },
  },
  plugins: [
    {
      name: "owlbear-pages-manifest",
      apply: "build",
      closeBundle() {
        const manifest = JSON.parse(
          readFileSync("public/manifest.json", "utf8").replace(/^\uFEFF/, ""),
        );
        manifest.icon = new URL("icon.svg?v=0.2.1", publicUrl).href;
        manifest.background_url = new URL("background.html", publicUrl).href;
        manifest.action.icon = manifest.icon;
        manifest.action.popover = new URL("index.html", publicUrl).href;
        writeFileSync(
          "dist/manifest.json",
          JSON.stringify(manifest, null, 2) + "\n",
        );
      },
    },
  ],
}));
