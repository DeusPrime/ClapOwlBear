import { localizeText, localizeNode } from '@/i18n/localize';
import { useEffect, useRef, useState } from "react";
import cover from "@/assets/book-cover.png";
import { communityRequest } from "@/lib/community";

interface Props {
  onUnlock: () => void;
}

const PASSWORD = "Clap2539";

const ComingSoon = ({ onUnlock }: Props) => {
  const [clicks, setClicks] = useState(0);
  const [showInput, setShowInput] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resetTimer = useRef<number | null>(null);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [subscription, setSubscription] = useState<"idle" | "pending" | "success">("idle");
  const [subscriptionError, setSubscriptionError] = useState("");

  const subscribe = async (event: React.FormEvent) => {
    event.preventDefault();
    if (subscription === "pending") return;
    setSubscription("pending");
    setSubscriptionError("");
    try {
      await communityRequest("/launch/subscribe", { email: email.trim(), consent });
      setSubscription("success");
      setEmail("");
    } catch {
      setSubscription("idle");
      setSubscriptionError("L’inscription n’a pas pu être enregistrée. Réessaie dans un instant.");
    }
  };

  useEffect(() => {
    document.title = "Clap & Role — Prochainement";
  }, []);

  useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  const handleClick = () => {
    if (showInput) return;
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setClicks(0), 1500);
    setClicks((c) => {
      const next = c + 1;
      if (next >= 3) {
        setShowInput(true);
        return 0;
      }
      return next;
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value === PASSWORD) {
      sessionStorage.setItem("clap-unlocked", "1");
      localStorage.setItem("clap-unlocked", "1");
      onUnlock();
    } else {
      setError(true);
      setValue("");
      setTimeout(() => setError(false), 600);
    }
  };

  return (
    <div className="dark min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-4 py-10 gap-8">
      <div
        className="relative cursor-pointer select-none"
        onClick={handleClick}
        aria-label={localizeText("Couverture Clap & Role")}
      >
        <img
          src={cover}
          alt={localizeText("Clap & Role — couverture")}
          className="w-[80vw] max-w-md h-auto block"
          style={{
            boxShadow:
              "12px 16px 40px hsl(var(--ink) / 0.45), 4px 6px 12px hsl(var(--ink) / 0.35)",
          }}
        />
        <div className="absolute top-6 -right-4 md:-right-8 rotate-6">
          <div className="ribbon text-base md:text-xl px-6 py-2 shadow-lg">{localizeText(" Prochainement ")}</div>
        </div>
      </div>

      <section className="w-full max-w-md text-center space-y-4" aria-labelledby="launch-title">
        <h1 id="launch-title" className="text-2xl font-bold">{localizeText("Bientôt, l’aventure commence.")}</h1>
        <p className="text-muted-foreground">{localizeText("Laisse ton email pour être prévenu de l’ouverture de Clap & Role.")}</p>
        {subscription === "success" ? (
          <p role="status" className="border border-accent p-4">{localizeText("Merci ! Ton inscription est enregistrée. Tu seras prévenu à l’ouverture.")}</p>
        ) : (
          <form onSubmit={subscribe} className="space-y-3 text-left">
            <label htmlFor="launch-email" className="block text-sm">{localizeText("Ton adresse email")}</label>
            <input id="launch-email" type="email" autoComplete="email" required maxLength={254}
              value={email} onChange={event => setEmail(event.target.value)} disabled={subscription === "pending"}
              className="w-full border border-input bg-background px-4 py-3 focus-visible:outline-accent" placeholder="toi@exemple.fr" />
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)}
                disabled={subscription === "pending"} className="mt-1 shrink-0" />
              <span>{localizeText("J’accepte que mon adresse email soit conservée pour me prévenir de l’ouverture du site.")}</span>
            </label>
            <button type="submit" disabled={subscription === "pending"}
              className="w-full bg-accent text-accent-foreground px-4 py-3 font-bold disabled:opacity-60">
              {localizeText(subscription === "pending" ? "Enregistrement…" : "Préviens-moi à l’ouverture")}
            </button>
            {subscriptionError && <p role="alert" className="text-sm text-destructive">{localizeText(subscriptionError)}</p>}
          </form>
        )}
      </section>

      {localizeNode(showInput && (
        <form onSubmit={submit} className="flex flex-col items-center gap-3">
          <input
            ref={inputRef}
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="••••••••"
            className={`border-2 border-ink bg-paper text-foreground px-4 py-2 font-mono text-center tracking-widest outline-none focus:border-accent transition-colors ${
              error ? "animate-pulse border-destructive" : ""
            }`}
          />
        </form>
      ))}
    </div>
  );
};

export default ComingSoon;
