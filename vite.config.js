import { defineConfig } from "vite";
import { resolve } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
const base = "/ClapOwlBear/";
const publicUrl = "https://deusprime.github.io/ClapOwlBear/";
export default defineConfig(({ command }) => ({
  base,
  define: { __APP_VERSION__: JSON.stringify("0.2.18") },
  resolve: {
    alias: { "@owlbear": resolve("src"), "@": resolve("vendor/clap-site/src") },
    dedupe: ["react", "react-dom"],
  },
  build: {
    rollupOptions: {
      // Keep validation dependencies, bootstrap and engine in dependency order.
      // Automatic shared chunks introduced a cycle that called uninitialized Zod factories.
      output: {
        manualChunks(id) {
          const file = id.replaceAll("\\", "/");
          if (file.includes("vite/preload-helper")) return "preload";
          if (file.endsWith("/src/runtime/client.ts")) return "runtime";
          if (file.includes("/node_modules/")) return "dependencies";
          if (/\/components\/(DiceModel|RollingDie|RollOutcomeEffect)\.tsx$/.test(file) || file.includes("/assets/dice/")) return "dice-visuals";
          if (file.includes("/vendor/clap-site/")) return "site";
        },
      },
      input: {
        main: resolve("index.html"),
        background: resolve("background.html"),
        rollToast: resolve("roll-toast.html"),
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
        manifest.icon = new URL("icon.svg?v=0.2.18", publicUrl).href;
        manifest.background_url = new URL("background.html?v=0.2.18", publicUrl).href;
        manifest.action.icon = manifest.icon;
        manifest.action.popover = new URL("index.html?v=0.2.18", publicUrl).href;
        writeFileSync(
          "dist/manifest.json",
          JSON.stringify(manifest, null, 2) + "\n",
        );
      },
    },
  ],
}));
