import JSZip from "jszip";
import { importStudioArchive } from "@/lib/studioImport";
import { loadCharacters } from "@/lib/characters";
import { loadAllBundledResources } from "@/lib/resourceBundle";
import { roomClient } from "@/lib/roomClient";

/** Import once into the local library, then attach the project to the current MJ room. */
export async function importProject(
  bytes: ArrayBuffer,
  progress: (text: string) => void = () => {},
) {
  const result = await importStudioArchive(bytes, progress);
  if (roomClient.snapshot().roomInfo?.title === "Salle CLAP!")
    await roomClient.setRoomTitle(result.project.name);
  const heroes = (await loadCharacters()).filter(
    (hero) => hero.directoryId === result.project.id,
  );
  for (const hero of heroes) {
    progress(`Ajout de ${hero.nom || "héros"} à la salle…`);
    await roomClient.addRoomHero(hero);
  }
  const resources = (await loadAllBundledResources()).filter(
    (resource) => resource.item.directoryId === result.project.id,
  );
  const refs = [...roomClient.snapshot().privateRefs];
  for (const resource of resources)
    if (
      !refs.some(
        (ref) => ref.type === resource.type && ref.id === resource.item.id,
      )
    )
      refs.push({ type: resource.type, id: resource.item.id });
  await roomClient.setPrivateRefs(refs);
  window.dispatchEvent(new Event("focus"));
  return result;
}
/** Keep projects already imported with 0.1.x when moving to the shared site databases. */
export async function migrateLegacyProject(roomId: string, userId: string) {
  const marker = `clap-owlbear-migrated:${roomId}:${userId}`;
  if (localStorage.getItem(marker)) return;
  const legacy = await new Promise<unknown>((resolve) => {
    const request = indexedDB.open("clap-owlbear");
    request.onupgradeneeded = () => {
      request.transaction?.abort();
    };
    request.onerror = (event) => {
      event.preventDefault();
      resolve(undefined);
    };
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("data")) {
        db.close();
        resolve(undefined);
        return;
      }
      const tx = db.transaction("data", "readonly"),
        get = tx.objectStore("data").get(`${roomId}:project`);
      tx.oncomplete = () => {
        db.close();
        resolve(get.result);
      };
      tx.onerror = () => {
        db.close();
        resolve(undefined);
      };
    };
  });
  if (
    legacy &&
    typeof legacy === "object" &&
    (legacy as { format?: unknown }).format === "clap-studio"
  ) {
    const bytes = await new JSZip()
      .file("studio.json", JSON.stringify(legacy))
      .generateAsync({ type: "arraybuffer" });
    await importProject(bytes);
  }
  localStorage.setItem(marker, "1");
}
