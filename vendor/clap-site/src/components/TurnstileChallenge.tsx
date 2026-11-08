import { localizeText, localizeNode } from '@/i18n/localize';
import { useEffect, useRef, useState } from "react";
import { loadTurnstile } from "@/lib/turnstile";

export default function TurnstileChallenge({ siteKey, action, onToken, revision, language = "fr" }: {
  siteKey?: string | null; action: "register" | "login"; onToken: (token: string) => void; revision: number; language?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let cancelled = false;
    let widget: string | undefined;
    onToken("");
    setState("loading");
    if (!siteKey) { setState("error"); return; }
    const failed = () => { if (!cancelled) { onToken(""); setState("error"); } };
    void loadTurnstile().then(() => {
      if (cancelled || !container.current || !window.turnstile) return;
      widget = window.turnstile.render(container.current, {
        sitekey: siteKey, action, language, size: "flexible",
        callback: (token: string) => { if (!cancelled) { onToken(token); setState("ready"); } },
        "expired-callback": () => { if (!cancelled) onToken(""); },
        "timeout-callback": () => { if (!cancelled) onToken(""); },
        "error-callback": failed,
      });
      setState("ready");
    }).catch(failed);
    return () => { cancelled = true; if (widget !== undefined) window.turnstile?.remove(widget); };
  }, [siteKey, action, onToken, revision, language]);
  return <div className="space-y-2">
    <div ref={container} aria-label={localizeText("Vérification anti-robot Cloudflare")} />
    {localizeNode(state === "loading" && <p role="status" className="text-xs text-muted-foreground">{localizeText("Chargement de la vérification anti-robot…")}</p>)}
    {localizeNode(state === "error" && <p role="alert" className="text-sm text-destructive">{localizeText("La vérification anti-robot est indisponible. Rechargez la page pour réessayer.")}</p>)}
  </div>;
}
