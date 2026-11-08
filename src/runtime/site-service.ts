import type { RodeoPort } from "./rodeo-service";
import type { RoomSession } from "@/lib/roomProtocol";
export type SiteLink = { room: string; invite: string };
const API = "https://clapnrole.com/api";
const PRESENCE = "fr.clap.owlbear/v2/player";
async function request(
  path: string,
  body?: unknown,
  session?: RoomSession | null,
) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(API + path, {
      method: body === undefined ? "GET" : "POST",
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    let result: any;
    try {
      result = await response.json();
    } catch {
      throw new Error(
        "L’API du site ne répond pas au protocole de liaison Owlbear.",
      );
    }
    if (!response.ok)
      throw Object.assign(
        new Error(result.error || "Connexion au site impossible."),
        { status: response.status },
      );
    return result;
  } catch (error) {
    if (error instanceof TypeError)
      throw new Error(
        "Connexion à l’API du site impossible. Vérifie que la mise à jour Owlbear de l’API est installée.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
export function parseSiteLink(value: unknown): SiteLink {
  if (typeof value !== "string")
    throw new Error(
      "Copie le code depuis « Gérer la salle → Relier Owlbear Rodeo » sur le site.",
    );
  const match = /^([A-Fa-f0-9]{12})\.([a-zA-Z0-9_-]{20,100})$/.exec(
    value.trim(),
  );
  if (!match)
    throw new Error(
      "Code attendu : identifiant de salle suivi du code de liaison généré par son MJ.",
    );
  return { room: match[1].toUpperCase(), invite: match[2] };
}
export async function validateSiteLink(value: unknown): Promise<SiteLink> {
  const link = parseSiteLink(value),
    health = await request("/health");
  if (health.features?.owlbearRooms !== 1)
    throw new Error(
      "La mise à jour de l’API CLAP! doit être installée sur le site avant d’activer cette liaison.",
    );
  await request("/rooms/owlbear-check", {
    room: link.room,
    owlbearInvite: link.invite,
  });
  return link;
}
function identity(id: string) {
  const key = `clap-owlbear-site-identity:${id}`;
  let token = localStorage.getItem(key);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    localStorage.setItem(key, token);
  }
  return token;
}
export async function siteRoomApi(
  port: RodeoPort,
  link: SiteLink,
  path: string,
  body: any,
  session: RoomSession | null,
) {
  if (path === "/list") return { rooms: [] };
  if (path === "")
    throw new Error(
      "La salle du site est liée. Ferme la liaison pour créer une partie locale Owlbear.",
    );
  const self = await port.self();
  const memberKey = `clap-owlbear-site-member:${self.id}`;
  if (
    path !== "/join" &&
    session &&
    session.id !== localStorage.getItem(memberKey)
  )
    throw Object.assign(
      new Error("Identité de salle différente. Reconnexion requise."),
      { status: 401 },
    );
  const payload =
    path === "/join"
      ? {
          ...body,
          room: link.room,
          name: self.name.slice(0, 40),
          owlbearInvite: link.invite,
          identityToken: identity(self.id),
        }
      : body;
  const result = await request(
    "/rooms" + path,
    payload,
    path === "/join" ? null : session,
  );
  if (path === "/join") localStorage.setItem(memberKey, result.id);
  if (path === "/join" || path === "/poll") {
    const memberId = path === "/join" ? result.id : session?.id;
    const own = self.metadata[PRESENCE] as Record<string, unknown> | undefined;
    if (own?.siteMemberId !== memberId || !own?.active)
      await port.setPlayerMetadata({
        [PRESENCE]: { ...own, active: true, siteMemberId: memberId },
      });
  }
  if (path === "/poll" && Array.isArray(result.members)) {
    const players = [await port.self(), ...(await port.others())];
    result.members = result.members.map((member: any) => ({
      ...member,
      owlbearRole: players.find(
        (player) =>
          (player.metadata[PRESENCE] as any)?.siteMemberId === member.id,
      )?.role,
    }));
  }
  return result;
}
