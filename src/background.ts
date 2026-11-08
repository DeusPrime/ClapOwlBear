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
  let connecting = false,
    joinError = "",
    failures = 0,
    nextAttempt = 0;
  const remember = async () => {
    const s = roomClient.snapshot().session;
    if (s?.role === "mj" && s.localRoomId)
      localStorage.setItem(archiveKey, s.localRoomId);
  };
  serveRoomClient(roomClient, channel, remember, () => ({
    error: roomClient.snapshot().error || joinError,
  }));
  roomClient.subscribe(() => {
    void remember();
  });
  // Saved edits originate in the visible UI and are forwarded by the local background bus.
  const session = JSON.parse(
    sessionStorage.getItem("clap-room-session-v1") || "null",
  );
  if (
    session?.room === ((await service.descriptor())?.site?.room || code) &&
    (session.id === self.id ||
      session.id ===
        localStorage.getItem(`clap-owlbear-site-member:${self.id}`))
  ) {
    await roomClient.restore();
  }
  const connect = async () => {
    if (
      connecting ||
      roomClient.isRoomTransitioning() ||
      service.paused ||
      roomClient.snapshot().session ||
      Date.now() < nextAttempt
    )
      return;
    connecting = true;
    try {
      const link = (await service.descriptor())?.site;
      if (link) {
        await roomClient.enter((await port.self()).name, link.room);
      } else if (await service.isHost()) {
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
      joinError = "";
      failures = 0;
      nextAttempt = 0;
      window.dispatchEvent(new Event("clap-integration-state"));
      if (roomClient.snapshot().session?.role === "mj") {
        const { migrateLegacyProject } = await import("./project");
        await migrateLegacyProject(port.roomId, self.id);
      }
    } catch (error) {
      joinError =
        error instanceof Error ? error.message : "Connexion impossible.";
      nextAttempt =
        Date.now() + Math.min(30000, 2000 * 2 ** Math.min(failures++, 4));
      window.dispatchEvent(new Event("clap-integration-state"));
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
