import {
  lazy,
  Suspense,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  Link,
  useParams,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { useRoom } from "@/hooks/use-room";
import { roomClient } from "@/lib/roomClient";
import { loadCharacters, type Character } from "@/lib/characters";
import { activeDirectory } from "@/lib/directories";
import RoomMJWorkspace from "@/components/RoomMJWorkspace";
import RoomPlayerWorkspace from "@/components/RoomPlayerWorkspace";
import RoomManagement from "@/components/RoomManagement";
import RoomHeroReserve from "@/components/RoomHeroReserve";
import LocalRoomLibrary from "@/components/LocalRoomLibrary";
import RoomRewardNotification from "@/components/RoomRewardNotification";
import GlobalExportLoader from "@/components/GlobalExportLoader";
import GameMenu from "./GameMenu";
import {
  runtimeInfo,
  runtimeSubscribe,
  notifyViewReady,
  siteInvitation,
} from "./runtime/client";
import SiteLinkPanel from "./SiteLinkPanel";
import Logo from "@/components/clap/Logo";
import { Button } from "@/components/ui/button";
import "@/index.css";
import "@/styles/interface.css";
import "./integration.css";
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Characters = lazy(() => import("@/pages/CharactersList"));
const HeroEditor = lazy(() => import("@/pages/CharacterEditor"));
const Resources = lazy(() => import("@/pages/ResourcesList"));
const Detail = lazy(() => import("@/pages/ResourceDetail"));
const Tools = lazy(() => import("@/pages/Tools"));
const Film = lazy(() => import("@/pages/FilmBookEditor"));
const Poker = lazy(() => import("@/pages/ImageConverter"));
const Converter = lazy(() => import("@/pages/SingleImageConverter"));
const Backgrounds = lazy(() => import("@/pages/BookBackgroundGenerator"));
const KeyRoles = lazy(() => import("@/pages/KeyRolesList"));
const KeyEditor = lazy(() => import("@/pages/KeyRoleEditor"));
const Figurants = lazy(() => import("@/pages/FigurantsList"));
const FigurantEditor = lazy(() => import("@/pages/FigurantEditor"));
const Profiles = lazy(() => import("@/pages/ProfilesList"));
const ProfileEditor = lazy(() => import("@/pages/ProfileEditor"));
const Powers = lazy(() => import("@/pages/PowersList"));
const PowerEditor = lazy(() => import("@/pages/PowerEditor"));
const Vehicles = lazy(() => import("@/pages/VehiclesList"));
const VehicleEditor = lazy(() => import("@/pages/VehicleEditor"));
function useGM() {
  const room = useRoom(),
    info = useSyncExternalStore(runtimeSubscribe, runtimeInfo);
  return room.session?.role === "mj" || (!room.session && info?.role === "GM");
}
function GM({ children }: { children: ReactNode }) {
  return useGM() ? <>{children}</> : <Navigate to="/app/salle" replace />;
}
function RoomAdmin({ children }: { children: ReactNode }) {
  const info = useSyncExternalStore(runtimeSubscribe, runtimeInfo);
  return useGM() || info?.role === "GM" ? (
    <>{children}</>
  ) : (
    <Navigate to="/app/salle" replace />
  );
}
function HeroRoute() {
  const { id } = useParams(),
    room = useRoom();
  return room.session?.role === "mj" || id === room.session?.characterId ? (
    <HeroEditor />
  ) : (
    <Navigate to="/app/salle" replace />
  );
}
function useHeroes() {
  const [heroes, setHeroes] = useState<Character[]>([]);
  useEffect(() => {
    let active = true;
    const update = () => {
      void loadCharacters()
        .then((value) => {
          if (active) setHeroes(value);
        })
        .catch(() => {});
    };
    update();
    window.addEventListener("focus", update);
    window.addEventListener("clap-room-character-assigned", update);
    return () => {
      active = false;
      window.removeEventListener("focus", update);
      window.removeEventListener("clap-room-character-assigned", update);
    };
  }, []);
  return heroes;
}
function RoomView() {
  const room = useRoom(),
    heroes = useHeroes(),
    gm = useGM();
  const [connectionError, setConnectionError] = useState("");
  const info = useSyncExternalStore(runtimeSubscribe, runtimeInfo);
  if (!room.session)
    return (
      <main className="container py-10">
        <h1 className="font-display text-3xl">Connexion à la salle</h1>
        <p className="mt-4 text-sm">
          {room.exitNotice ||
            room.error ||
            "Le MJ doit ouvrir CLAP! dans la salle Owlbear. La connexion des joueurs se fait automatiquement."}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Vous devez utiliser le manifeste à jour, avec sa page d’arrière-plan.
        </p>
        <div className="mt-5 flex gap-3">
          <Button
            onClick={() => {
              void roomClient
                .enter(
                  info?.name || "Joueur",
                  info?.mode === "site"
                    ? info.code
                    : gm
                      ? undefined
                      : info?.code,
                  undefined,
                  { title: "Salle CLAP!" },
                )
                .catch((error) => setConnectionError(error.message));
            }}
          >
            {info?.mode === "site"
              ? "Rejoindre la salle du site"
              : gm
                ? "Ouvrir une partie"
                : "Rejoindre la partie"}
          </Button>
          {gm && (
            <Link to="/settings" className="p-3 text-sm underline">
              Reprendre une sauvegarde
            </Link>
          )}
        </div>
        {connectionError && <p role="alert">{connectionError}</p>}
      </main>
    );
  return (
    <main className="owlbear-room min-w-0 pb-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 px-4 py-3">
        <div>
          <h1 className="font-display text-2xl">
            {room.roomInfo?.title || "Salle CLAP!"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {room.session.name} · {room.session.role === "mj" ? "MJ" : "Joueur"}{" "}
            · {room.connected.length} connexion(s)
          </p>
        </div>
        {room.session.role === "mj" && (
          <RoomManagement invitation={siteInvitation()} />
        )}
      </div>
      {room.error && (
        <p
          role="alert"
          className="mx-4 mb-4 border border-destructive p-3 text-sm text-destructive"
        >
          {room.error}
        </p>
      )}
      {room.session.role === "mj" ? (
        <div className="px-4">
          <RoomHeroReserve characters={heroes} />
          <div className="mt-5">
            <RoomMJWorkspace characters={heroes} />
          </div>
        </div>
      ) : (
        <RoomPlayerWorkspace
          characters={heroes}
          invitation={siteInvitation()}
        />
      )}
    </main>
  );
}
function Settings() {
  const room = useRoom();
  const [title, setTitle] = useState(room.roomInfo?.title || "Salle CLAP!");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="container space-y-6 py-6">
      <h1 className="font-display text-3xl">Votre salle Owlbear</h1>
      <SiteLinkPanel />
      {room.session?.role === "mj" || !room.session ? (
        <>
          <p className="text-sm">
            Partie privée à cette salle Owlbear, absente de l’annuaire du site.
            Les invitations et les accès sont gérés dans Owlbear.
          </p>
          <form
            className="space-y-3 border border-ink/20 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                await roomClient.setRoomTitle(title);
                setNotice("Nom de la partie enregistré.");
              });
            }}
          >
            <label className="block font-bold" htmlFor="room-title">
              Nom de la partie
            </label>
            <input
              id="room-title"
              className="w-full border border-ink/20 bg-paper p-3"
              value={title}
              maxLength={80}
              required
              disabled={busy || !room.session}
              onChange={(event) => setTitle(event.target.value)}
            />
            <Button type="submit" disabled={busy || !room.session}>
              Enregistrer
            </Button>
          </form>
          <section className="space-y-3 border border-ink/20 p-4">
            <h2 className="font-display text-2xl">
              Importer un projet .clapStudio
            </h2>
            <input
              aria-label="Importer un projet .clapStudio"
              type="file"
              accept=".clapStudio"
              disabled={busy || !room.session}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file)
                  void run(async () => {
                    const { importProject } = await import("./project");
                    const result = await importProject(
                      await file.arrayBuffer(),
                      setNotice,
                    );
                    setNotice(
                      `Projet « ${result.project.name} » importé. Les héros et cartes sont disponibles dans votre salle.`,
                    );
                    window.dispatchEvent(new Event("focus"));
                  });
              }}
            />
          </section>
          <section className="space-y-3 border border-ink/20 p-4">
            <h2 className="font-display text-2xl">Exporter la partie</h2>
            <p className="text-sm">
              Le fichier .clapSalle contient l’état de la partie, les héros, les
              fiches attribuées et leurs ressources. Il se réimporte dans le
              site CLAP!.
            </p>
            <Button
              disabled={busy || !room.session}
              onClick={() =>
                void run(async () => {
                  await roomClient.exportArchive();
                })
              }
            >
              Exporter la salle .clapSalle
            </Button>
          </section>
          <section className="space-y-3 border border-ink/20 p-4">
            <h2 className="font-display text-2xl">
              Reprendre une salle sauvegardée
            </h2>
            <p className="text-xs text-muted-foreground">
              Fermez la partie courante depuis « Gérer la salle » avant d’en
              ouvrir une autre. Les sauvegardes restent sur cet appareil.
            </p>
            <LocalRoomLibrary
              busy={busy || Boolean(room.session)}
              onOpen={(record) =>
                void run(async () => {
                  await roomClient.resumeLocalRoom(record.id);
                })
              }
            />
          </section>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Les outils du MJ seront accessibles après la transmission du rôle
          depuis le site.
        </p>
      )}
      {busy && <p role="status">Traitement en cours…</p>}
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </main>
  );
}
export function Shell() {
  const gm = useGM(),
    info = useSyncExternalStore(runtimeSubscribe, runtimeInfo),
    nativeAdmin = info?.role === "GM";
  useEffect(() => {
    notifyViewReady();
  }, []);
  return (
    <>
      <header className="owlbear-header flex items-center gap-3 border-b border-ink/15 bg-paper px-4 py-2">
        <GameMenu
          value={activeDirectory()}
          onChange={() => window.dispatchEvent(new Event("focus"))}
        />
        <Logo className="h-10 w-10 shrink-0" />
        <Link to="/app/salle" className="min-w-0 flex-1 font-display text-xl">
          Clap & Role
        </Link>
        <span className="text-[10px] text-muted-foreground">Owlbear · 0.2</span>
      </header>
      {(gm || nativeAdmin) && (
        <nav
          className="flex gap-2 border-b border-ink/15 bg-paper px-4 py-2"
          aria-label="Navigation MJ"
        >
          <NavLink to="/app/salle">Salle</NavLink>
          {gm && <NavLink to="/app/studio">Projet</NavLink>}
          <NavLink to="/settings">Import / export</NavLink>
        </nav>
      )}
      <Suspense
        fallback={
          <p className="p-6" role="status">
            Chargement…
          </p>
        }
      >
        <Routes>
          <Route path="/" element={<Navigate to="/app/salle" replace />} />
          <Route path="/app/salle" element={<RoomView />} />
          <Route
            path="/app/studio"
            element={
              <GM>
                <Dashboard />
              </GM>
            }
          />
          <Route
            path="/settings"
            element={
              <RoomAdmin>
                <Settings />
              </RoomAdmin>
            }
          />
          <Route
            path="/characters"
            element={
              <GM>
                <Characters />
              </GM>
            }
          />
          <Route path="/characters/:id" element={<HeroRoute />} />
          <Route
            path="/ressources"
            element={
              <GM>
                <Resources />
              </GM>
            }
          />
          <Route
            path="/outils"
            element={
              <GM>
                <Tools />
              </GM>
            }
          />
          <Route
            path="/outils/film"
            element={<Navigate to="/film" replace />}
          />
          <Route
            path="/film"
            element={
              <GM>
                <Film />
              </GM>
            }
          />
          <Route
            path="/outils/cartes-poker"
            element={
              <GM>
                <Poker />
              </GM>
            }
          />
          <Route
            path="/outils/conversion-image"
            element={
              <GM>
                <Converter />
              </GM>
            }
          />
          <Route
            path="/outils/fonds-livre"
            element={
              <GM>
                <Backgrounds />
              </GM>
            }
          />
          {[
            ["/key-roles", <KeyRoles />, <KeyEditor />, "key-role"],
            ["/figurants", <Figurants />, <FigurantEditor />, "figurant"],
            ["/profils", <Profiles />, <ProfileEditor />, "profile"],
            ["/pouvoirs", <Powers />, <PowerEditor />, "power"],
            ["/vehicules", <Vehicles />, <VehicleEditor />, "vehicle"],
          ].map(([path, list, editor, kind]) => (
            <Route key={String(path)}>
              <Route
                path={String(path)}
                element={<GM>{list as ReactNode}</GM>}
              />
              <Route
                path={`${path}/new`}
                element={<GM>{editor as ReactNode}</GM>}
              />
              <Route
                path={`${path}/:id/edit`}
                element={<GM>{editor as ReactNode}</GM>}
              />
              <Route
                path={`${path}/:id`}
                element={
                  <GM>
                    <Detail kind={kind as any} />
                  </GM>
                }
              />
            </Route>
          ))}
          <Route path="*" element={<Navigate to="/app/salle" replace />} />
        </Routes>
      </Suspense>
      <RoomRewardNotification />
    </>
  );
}
const queries = new QueryClient();
export function mount() {
  document.documentElement.classList.add("clap-interface");
  const theme = localStorage.getItem("clap-theme");
  document.documentElement.classList.toggle("dark", theme === "dark");
  const root = createRoot(document.getElementById("app")!);
  root.render(
    <LanguageProvider>
      <QueryClientProvider client={queries}>
        <TooltipProvider>
          <Toaster />
          <GlobalExportLoader />
          <HashRouter>
            <Shell />
          </HashRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </LanguageProvider>,
  );
  return root;
}
