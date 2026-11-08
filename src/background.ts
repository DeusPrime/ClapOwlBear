import OBR from "@owlbear-rodeo/sdk";
import { configureRuntime, serveRoomClient } from "./runtime/client";
import { OwlbearRoomService, roomCode, sdkPort } from "./runtime/rodeo-service";

if (OBR.isAvailable)
  OBR.onReady(() => {
    void start().catch((error) => console.error("CLAP background:", error));
  });
async function start() {
  const port = await sdkPort(),
    self = await port.self();
  const code = await roomCode(port.roomId);
  const service = new OwlbearRoomService(port, code);
  await service.start();
  const channel = `clap-owlbear:${port.roomId}:${self.id}:${self.connectionId}`;
  configureRuntime({ background: true, channel }, service.api);
  const { roomClient } = await import("@/lib/roomClient");
  const archiveKey = `clap-owlbear-archive:${port.roomId}:${self.id}`;
  let connecting = false;
  const remember = async () => {
    const s = roomClient.snapshot().session;
    if (s?.role === "mj" && s.localRoomId)
      localStorage.setItem(archiveKey, s.localRoomId);
  };
  serveRoomClient(roomClient, channel, remember);
  // Saved edits originate in the visible UI and are forwarded by the local background bus.
  const session = JSON.parse(
    sessionStorage.getItem("clap-room-session-v1") || "null",
  );
  if (session?.room === code && session.id === self.id) {
    await roomClient.restore();
  }
  const connect = async () => {
    if (connecting || service.paused || roomClient.snapshot().session) return;
    connecting = true;
    try {
      if (await service.isHost()) {
        const localId = localStorage.getItem(archiveKey);
        if (localId) {
          try {
            await roomClient.resumeLocalRoom(localId);
            await remember();
            return;
          } catch (error) {
            if (
              (error as { status?: number }).status !== 401 &&
              (error as Error).message !== "Sauvegarde locale introuvable."
            )
              throw error;
          }
        }
        await roomClient.enter((await port.self()).name, undefined, undefined, {
          title: "Salle CLAP!",
        });
      } else {
        const descriptor = await service.descriptor();
        if (!descriptor || descriptor.closed) return;
        await roomClient.enter((await port.self()).name, code);
      }
      await remember();
      if (roomClient.snapshot().session?.role === "mj") {
        const { migrateLegacyProject } = await import("./project");
        await migrateLegacyProject(port.roomId, self.id);
      }
    } catch (error) {
      console.warn(
        "CLAP connection:",
        error instanceof Error ? error.message : error,
      );
    } finally {
      connecting = false;
    }
  };
  await connect();
  setInterval(() => {
    void connect();
  }, 2000);
  window.addEventListener(
    "pagehide",
    () => {
      roomClient.stop();
      service.stop();
    },
    { once: true },
  );
}
