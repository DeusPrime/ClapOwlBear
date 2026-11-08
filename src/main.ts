import OBR from "@owlbear-rodeo/sdk";
import { configureRuntime } from "./runtime/client";
import { OwlbearRoomService, roomCode, sdkPort } from "./runtime/rodeo-service";
const app = document.getElementById("app")!;
app.innerHTML =
  '<p style="padding:24px;font-family:monospace">Connexion à Owlbear Rodeo…</p>';
if (OBR.isAvailable)
  OBR.onReady(() => {
    void (async () => {
      const port = await sdkPort(),
        id = await OBR.player.getId(),
        code = await roomCode(port.roomId),
        service = new OwlbearRoomService(port, code);
      const channel = `clap-owlbear:${port.roomId}:${id}:${await OBR.player.getConnectionId()}`;
      const refresh = async () => {
        const linked = (await service.descriptor())?.site;
        configureRuntime({
          background: false,
          channel,
          code: linked?.room || code,
          mode: linked ? "site" : "owlbear",
          role: await OBR.player.getRole(),
          name: await OBR.player.getName(),
        });
      };
      await refresh();
      OBR.player.onChange(() => {
        void refresh();
      });
      OBR.party.onChange(() => {
        void refresh();
      });
      OBR.room.onMetadataChange(() => {
        void refresh();
      });
      const { initializeDirectoryAssets } = await import("@/lib/directoryAssets");
      await initializeDirectoryAssets();
      const { mount } = await import("./App");
      mount();
    })().catch((error) => {
      console.error("CLAP startup:", error);
      app.textContent =
        error instanceof Error ? error.message : "Connexion impossible.";
    });
  });
else
  app.innerHTML =
    '<main style="max-width:600px;margin:48px auto;padding:24px;font-family:monospace"><h1>CLAP! pour Owlbear Rodeo</h1><p>Ajoutez cette extension à votre salle Owlbear avec son manifest.json pour accéder aux fiches, au chat et aux outils du MJ.</p></main>';
