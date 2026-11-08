import type { RoomSession } from "@/lib/roomProtocol";

type Api = (
  path: string,
  body: any,
  session: RoomSession | null,
) => Promise<any>;
let api: Api | undefined;
export type RuntimeContext = {
  background: boolean;
  channel: string;
  role?: string;
  name?: string;
  code?: string;
  mode?: "owlbear" | "site";
};
let context: RuntimeContext | undefined;
const runtimeListeners = new Set<() => void>();
export const runtimeInfo = () => context;
export const isLinkedSite = () => context?.mode === "site";
export const siteInvitation = () =>
  isLinkedSite()
    ? `https://clapnrole.com/app/salle?room=${context?.code}`
    : "Invitez les participants depuis Owlbear Rodeo.";
export const runtimeSubscribe = (listener: () => void) => {
  runtimeListeners.add(listener);
  return () => runtimeListeners.delete(listener);
};
export function configureRuntime(value: RuntimeContext, handler?: Api) {
  context = value;
  if (handler) api = handler;
  runtimeListeners.forEach((listener) => listener());
}
export function callRoomApi<T>(
  path: string,
  body: unknown,
  session: RoomSession | null,
): Promise<T> {
  if (!api) return Promise.reject(new Error("Connexion Owlbear en cours."));
  return api(path, body, session);
}
let foregroundBus: BroadcastChannel | undefined;
export function notifyViewReady() {
  foregroundBus?.postMessage({ type: "view-ready" });
}
const markEvent = (
  name: string,
  detail: unknown,
  from: "background" | "foreground",
) => {
  const event = new CustomEvent(name, { detail });
  Object.assign(event, { clapIpcEvent: from });
  return event;
};
const empty = {
  roomHeroes: [],
  heroProposals: [],
  privateRefs: [],
  roomInfo: null,
  sheetResources: {},
  requests: [],
  hideRolls: false,
  messages: [],
  session: null,
  members: [],
  connected: [],
  sheets: {},
  error: "",
  syncing: true,
  relayConfigured: false,
};
export const commands = new Set([
  "setRoomTitle",
  "linkSiteRoom",
  "unlinkSiteRoom",
  "createOwlbearInvite",
  "setPrivateRefs",
  "addRoomHero",
  "removeRoomHero",
  "resolveHeroProposal",
  "sendChat",
  "leave",
  "assignCharacter",
  "selectCharacter",
  "selectRoomHero",
  "changePassword",
  "kickPlayer",
  "linkResource",
  "heroAction",
  "transferMJ",
  "setRollVisibility",
  "requestRoll",
  "requestRolls",
  "broadcastRoll",
  "resumeLocalRoom",
  "resumeOwnedRoom",
  "enter",
  "exportArchive",
]);
export function sharedRoomClient<T extends object>(factory: () => T): T {
  if (!context)
    throw new Error(
      "Owlbear runtime must be configured before loading the room engine.",
    );
  if (context.background) return factory();
  const bus = new BroadcastChannel(context.channel);
  foregroundBus = bus;
  let snapshot: any = empty;
  const listeners = new Set<() => void>();
  const pending = new Map<
    string,
    {
      resolve: (v: unknown) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  const request = (method: string, args: unknown[]) =>
    new Promise<any>((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(
          new Error("Le moteur de salle ne répond pas. Recharge Owlbear."),
        );
      }, 120000);
      pending.set(id, { resolve, reject, timer });
      bus.postMessage({ type: "command", id, method, args });
    });
  let refresh: ReturnType<typeof setTimeout> | undefined;
  bus.onmessage = ({ data }) => {
    if (data?.type === "snapshot") {
      snapshot = data.snapshot;
      listeners.forEach((fn) => fn());
      if (!refresh)
        refresh = setTimeout(() => {
          refresh = undefined;
          window.dispatchEvent(new Event("clap-room-character-assigned"));
          window.dispatchEvent(new Event("focus"));
        }, 100);
    }
    if (
      data?.type === "event" &&
      ["clap-room-reward", "clap-room-character-assigned"].includes(data.name)
    ) {
      window.dispatchEvent(markEvent(data.name, data.detail, "background"));
      if (data.id) bus.postMessage({ type: "ack-event", id: data.id });
    }
    if (data?.type === "result") {
      const job = pending.get(data.id);
      if (!job) return;
      pending.delete(data.id);
      clearTimeout(job.timer);
      if (data.error) job.reject(new Error(data.error));
      else job.resolve(data.value);
    }
  };
  window.addEventListener("clap-character-saved", (event) => {
    if (!(event as Event & { clapIpcEvent?: string }).clapIpcEvent)
      bus.postMessage({
        type: "character-saved",
        character: (event as CustomEvent).detail,
      });
  });
  const sayHello = () => bus.postMessage({ type: "hello" });
  sayHello();
  const hello = setInterval(() => {
    if (snapshot !== empty) clearInterval(hello);
    else sayHello();
  }, 1000);
  window.addEventListener(
    "pagehide",
    () => {
      clearInterval(hello);
      bus.close();
    },
    { once: true },
  );
  return new Proxy({} as T, {
    get(_target, key) {
      if (key === "snapshot") return () => snapshot;
      if (key === "subscribe")
        return (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        };
      if (key === "restore" || key === "stop") return () => {}; // The background, not the popover, owns the connection.
      if (typeof key !== "string" || !commands.has(key)) return undefined;
      if (key === "exportArchive")
        return async () => {
          const result = await request(key, []);
          const url = URL.createObjectURL(result.blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = result.name;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 10000);
        };
      return (...args: unknown[]) => request(key, args);
    },
  });
}
export function serveRoomClient(
  client: any,
  channel: string,
  onMutation?: () => Promise<void>,
  integrationState?: () => Record<string, unknown>,
) {
  const bus = new BroadcastChannel(channel);
  const events = new Map<
    string,
    { type: string; name: string; detail: unknown; id?: string }
  >();
  const forward = (event: Event) => {
    if ((event as Event & { clapIpcEvent?: string }).clapIpcEvent) return;
    const packet = {
      type: "event",
      name: event.type,
      detail: (event as CustomEvent).detail,
      id: event.type === "clap-room-reward" ? crypto.randomUUID() : undefined,
    };
    if (packet.id) {
      events.set(packet.id, packet);
      if (events.size > 20) events.delete(events.keys().next().value!);
    }
    bus.postMessage(packet);
  };
  window.addEventListener("clap-room-reward", forward);
  window.addEventListener("clap-room-character-assigned", forward);
  const publish = () =>
    bus.postMessage({
      type: "snapshot",
      snapshot: { ...client.snapshot(), ...integrationState?.() },
    });
  const unsubscribe = client.subscribe(publish);
  window.addEventListener("clap-integration-state", publish);
  bus.onmessage = ({ data }) => {
    void (async () => {
      if (data?.type === "hello") {
        publish();
        return;
      }
      if (data?.type === "view-ready") {
        for (const event of events.values()) bus.postMessage(event);
        return;
      }
      if (data?.type === "ack-event") {
        events.delete(data.id);
        return;
      }
      if (data?.type === "character-saved") {
        const own = client.snapshot().session;
        if (
          own?.role === "mj" ||
          (own?.role === "player" && data.character?.id === own.characterId)
        )
          window.dispatchEvent(
            markEvent("clap-character-saved", data.character, "foreground"),
          );
        return;
      }
      if (
        data?.type !== "command" ||
        typeof data.id !== "string" ||
        !commands.has(data.method) ||
        !Array.isArray(data.args)
      )
        return;
      try {
        const value = await client[data.method](...data.args);
        await onMutation?.();
        bus.postMessage({ type: "result", id: data.id, value });
        publish();
      } catch (error) {
        bus.postMessage({
          type: "result",
          id: data.id,
          error: error instanceof Error ? error.message : "Action impossible.",
        });
      }
    })();
  };
  publish();
  return () => {
    unsubscribe();
    window.removeEventListener("clap-integration-state", publish);
    window.removeEventListener("clap-room-reward", forward);
    window.removeEventListener("clap-room-character-assigned", forward);
    bus.close();
  };
}
