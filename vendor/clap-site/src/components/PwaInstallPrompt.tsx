import { localizeText, localizeNode } from '@/i18n/localize';
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const SESSION_DISMISS_KEY = "clap-pwa-install-dismissed-session";

const InstallContext = createContext<{ installEvent: BeforeInstallPromptEvent | null; hidden: boolean; dismiss: () => void; install: () => Promise<void> } | null>(null);

export const PwaInstallProvider = ({ children }: { children: ReactNode }) => {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(() => sessionStorage.getItem(SESSION_DISMISS_KEY) === "1");

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
      setHidden(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
      setHidden(true);
    }
    setInstallEvent(null);
  };

  const dismiss = () => {
    sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    setHidden(true);
  };

  return (
    <InstallContext.Provider value={{ installEvent, hidden, dismiss, install }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-3xl px-4 [&>div]:pointer-events-auto">
        <PwaInstallPrompt />
      </div>
    </InstallContext.Provider>
  );
};

const PwaInstallPrompt = () => {
  const context = useContext(InstallContext);
  if (!context || context.hidden || isStandalone() || (!context.installEvent && !isIos())) return null;
  const { installEvent, dismiss, install } = context;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-2 border-ink bg-paper-dark/80 px-4 py-3 shadow-[4px_4px_0_hsl(var(--ink))]">
      <div>
        <p className="typewriter text-sm font-bold uppercase tracking-widest">{localizeText("Installer l'application")}</p>
        <p className="mt-1 text-sm text-foreground/70">
          {localizeNode(installEvent
            ? "Accède à tes personnages plus vite, même hors ligne."
            : "Sur iPhone/iPad : ouvre Partager, puis Ajouter à l'écran d'accueil.")}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {localizeNode(installEvent && (
          <button
            type="button"
            onClick={() => void install()}
            className="flex items-center gap-1.5 px-3 py-2 border-2 border-ink text-xs font-bold uppercase tracking-widest hover:bg-ink hover:text-background"
          >
            <Download size={14} />{localizeText(" Installer ")}</button>
        ))}
        <button
          type="button"
          onClick={dismiss}
          className="flex h-9 w-9 items-center justify-center hover:text-accent"
          aria-label={localizeText("Masquer")}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default PwaInstallPrompt;
