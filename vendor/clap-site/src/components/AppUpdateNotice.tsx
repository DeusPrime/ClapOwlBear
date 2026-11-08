import { useEffect, useState } from "react";
import { useLang } from "@/i18n/LanguageContext";

declare const __APP_VERSION__: string;

export default function AppUpdateNotice() {
  const [available, setAvailable] = useState(false);
  const { lang } = useLang();
  useEffect(() => {
    if (import.meta.env.DEV) return;
    let stopped = false;
    let checking = false;
    const controller = new AbortController();
    const notify = () => setAvailable(true);
    const check = async () => {
      if (checking || document.visibilityState === "hidden") return;
      checking = true;
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (!stopped && typeof data.version === "string" && data.version !== __APP_VERSION__) setAvailable(true);
      } catch { /* Offline or older deployments: keep working and retry later. */ }
      finally { checking = false; }
    };
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    window.addEventListener("clap-update-available", notify);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => void check(), 120_000);
    void check();
    return () => {
      stopped = true; controller.abort(); window.clearInterval(timer);
      window.removeEventListener("clap-update-available", notify);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  if (!available) return null;
  return <aside role="status" className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[100] mx-auto flex max-w-lg flex-wrap items-center justify-between gap-3 border-2 border-ink bg-paper p-4 text-foreground shadow-xl">
    <div><p className="font-bold">{lang === "en" ? "A new version is available" : "Nouvelle version disponible"}</p><p className="text-sm">{lang === "en" ? "Save your work before refreshing." : "Enregistre ton travail avant d’actualiser."}</p></div>
    <button type="button" onClick={() => window.location.reload()} className="min-h-11 border-2 border-ink bg-accent px-4 py-2 font-bold text-background">{lang === "en" ? "Refresh" : "Actualiser"}</button>
  </aside>;
}
