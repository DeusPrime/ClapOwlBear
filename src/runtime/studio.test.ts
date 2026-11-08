// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { readStudioArchive } from "@/lib/studioImport";
describe("Import .clapStudio du moteur du site", () => {
  it("accepte une archive et un projet de plus de 32 Mo sans plafond global ni limite d’entrées annexes", async () => {
    const source = "data:image/png;base64," + "A".repeat(17 * 1024 * 1024);
    const studio = {
      format: "clap-studio",
      version: 1,
      project: { id: "p", name: "Grand film" },
      heroes: [],
      resources: [],
      tools: [
        {
          id: "t",
          directoryId: "p",
          name: "Planches",
          kind: "image-conversion",
          updatedAt: 1,
          data: {
            tool: "image-conversion",
            settings: { style: 0, rotation: 0 },
            images: [0, 1].map((i) => ({
              id: String(i),
              name: "Image " + i,
              source,
              width: 100,
              height: 100,
            })),
          },
        },
      ],
    };
    const zip = new JSZip().file("studio.json", JSON.stringify(studio));
    for (let i = 0; i < 5; i++) zip.file("extra/" + i + ".txt", "annexe");
    const bytes = await zip.generateAsync({
      type: "arraybuffer",
      compression: "STORE",
    });
    expect(bytes.byteLength).toBeGreaterThan(32 * 1024 * 1024);
    const restored = await readStudioArchive(bytes);
    expect(restored.tools[0].data?.images).toHaveLength(2);
  });
  it("rejette une archive invalide ou sans studio.json", async () => {
    const empty = await new JSZip().generateAsync({ type: "arraybuffer" });
    await expect(readStudioArchive(empty)).rejects.toThrow();
    const wrong = await new JSZip()
      .file("studio.json", JSON.stringify({ format: "inconnu", version: 2 }))
      .generateAsync({ type: "arraybuffer" });
    await expect(readStudioArchive(wrong)).rejects.toThrow();
  });
});
