import OBR from "@owlbear-rodeo/sdk";
import { configureRuntime } from "./runtime/client";
import { roomCode } from "./runtime/rodeo-service";
const app = document.getElementById("app")!;
app.innerHTML =
  '<p style="padding:24px;font-family:monospace">Connexion à Owlbear Rodeo…</p>';
if (OBR.isAvailable)
  OBR.onReady(() => {
    void (async () => {
      const id = await OBR.player.getId(),
        code = await roomCode(OBR.room.id);
      const channel = `clap-owlbear:${OBR.room.id}:${id}:${await OBR.player.getConnectionId()}`;
      configureRuntime({
        background: false,
        channel,
        code,
        role: await OBR.player.getRole(),
        name: await OBR.player.getName(),
      });
      OBR.player.onChange((player) =>
        configureRuntime({
          background: false,
          channel,
          code,
          role: player.role,
          name: player.name,
        }),
      );
      const { mount } = await import("./App");
      mount();
    })().catch((error) => {
      app.textContent =
        error instanceof Error ? error.message : "Connexion impossible.";
    });
  });
else
  app.innerHTML =
    '<main style="max-width:600px;margin:48px auto;padding:24px;font-family:monospace"><h1>CLAP! pour Owlbear Rodeo</h1><p>Ajoutez cette extension à votre salle Owlbear avec son manifest.json pour accéder aux fiches, au chat et aux outils du MJ.</p><p>Cette interface est intégrée à la salle ; elle ne crée pas de salle sur le site.</p></main>';
