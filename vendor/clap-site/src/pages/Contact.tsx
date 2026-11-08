import { localizeText, localizeNode } from '@/i18n/localize';
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { LanguageProvider, useLang } from "@/i18n/LanguageContext";

const API = "/api/contact";

export default function Contact() {
  return <LanguageProvider><ContactForm /></LanguageProvider>;
}

function ContactForm() {
  const { lang } = useLang();
  const en = lang === "en";
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const captcha = useRef<HTMLDivElement>(null);
  const widget = useRef<string>();

  useEffect(() => {
    document.title = "Contact — Clap & Role";
    let cancelled = false;
    let script: HTMLScriptElement | undefined;
    setToken("");
    setReady(false);
    setLoading(true);
    setError("");
    const unavailable = () => {
      if (!cancelled) {
        setLoading(false);
        setError(en ? "The contact form is temporarily unavailable. Please try again later." : "Le formulaire est temporairement indisponible. Réessaie plus tard.");
      }
    };
    async function load() {
      try {
        const response = await fetch(`${API}/config`, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error();
        const config = await response.json();
        if (cancelled) return;
        if (!config.available || !config.siteKey) { unavailable(); return; }
        const render = () => {
          if (cancelled || !captcha.current || !window.turnstile) return;
          widget.current = window.turnstile.render(captcha.current, {
            sitekey: config.siteKey, action: "contact", language: lang, size: "flexible",
            callback: (value: string) => { setToken(value); setError(""); },
            "expired-callback": () => setToken(""),
            "error-callback": () => { setToken(""); unavailable(); },
            "timeout-callback": () => setToken(""),
          });
          setReady(true);
          setLoading(false);
        };
        if (window.turnstile) render();
        else {
          script = document.createElement("script");
          script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
          script.async = true;
          script.onload = render;
          script.onerror = unavailable;
          document.head.appendChild(script);
        }
      } catch { unavailable(); }
    }
    void load();
    return () => {
      cancelled = true;
      if (widget.current !== undefined) window.turnstile?.remove(widget.current);
      widget.current = undefined;
      script?.remove();
    };
  }, [en, lang]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !token || !ready) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError("");
    setSent(false);
    try {
      const response = await fetch(API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.get("email"), subject: values.get("subject"), message: values.get("message"), token }),
        signal: AbortSignal.timeout(60000),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        throw new Error(en ? "Your message could not be sent. Check the form and CAPTCHA, then try again later." : result.error || "L'envoi a échoué. Réessaie plus tard.");
      }
      form.reset();
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error && cause.name === "Error" ? cause.message : en ? "Unable to confirm delivery. Please try again later." : "Impossible de confirmer l'envoi. Réessaie plus tard.");
    } finally {
      setBusy(false);
      setToken("");
      if (widget.current !== undefined) window.turnstile?.reset(widget.current);
    }
  }

  const inputClass = "w-full border-2 border-ink bg-background px-3 py-3 typewriter text-base placeholder:text-foreground/60 focus:outline-none focus:ring-2 focus:ring-accent";
  return (
    <div className="min-h-screen bg-paper text-foreground">
      <header className="border-b-2 border-ink">
        <div className="container flex items-center justify-between py-4">
          <Link to="/" className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest hover:text-accent"><ArrowLeft size={18} /> {localizeNode(en ? "Home" : "Accueil")}</Link>
          <span aria-hidden="true" className="w-10 shrink-0" />
        </div>
      </header>
      <main className="container max-w-2xl py-12 sm:py-20">
        <p className="typewriter text-sm uppercase tracking-widest text-accent mb-3">{localizeText("Clap & Role")}</p>
        <h1 className="font-display text-5xl sm:text-6xl mb-5">{localizeNode(en ? "Contact us" : "Nous contacter")}</h1>
        <form onSubmit={submit} className="paper-card p-5 sm:p-8 space-y-6" aria-busy={busy}>
          <input id="contact-email" name="email" type="email" autoComplete="email" aria-label={localizeText(en ? "Your email address" : "Ton adresse e-mail")} placeholder={localizeText(en ? "Your email address *" : "Ton adresse e-mail *")} required maxLength={254} disabled={busy} className={inputClass} />
          <input id="contact-subject" name="subject" aria-label={localizeText(en ? "Subject" : "Sujet")} placeholder={localizeText(en ? "Subject *" : "Sujet *")} required maxLength={160} disabled={busy} className={inputClass} />
          <textarea id="contact-message" name="message" aria-label={localizeText("Message")} placeholder={localizeText("Message *")} required maxLength={10000} rows={7} disabled={busy} className={`${inputClass} resize-y`} aria-describedby="contact-note" />
          <p id="contact-note" className="typewriter text-sm text-foreground/70">{localizeNode(en ? "* Required fields. Attachments are not allowed." : "* Champs obligatoires. Les pièces jointes ne sont pas autorisées.")}</p>
          <div aria-label={localizeText(en ? "Anti-bot verification" : "Vérification anti-robot")} ref={captcha} />
          {localizeNode(loading && <p role="status" className="typewriter text-sm">{localizeNode(en ? "Loading anti-bot verification…" : "Chargement de la vérification anti-robot…")}</p>)}
          {localizeNode(error && <p role="alert" className="typewriter text-sm text-destructive">{localizeNode(error)}</p>)}
          {sent && <p role="status" className="typewriter text-sm text-accent">{en ? "Your message has been sent. Thank you!" : "Ton message a bien été envoyé. Merci !"}</p>}
          <button type="submit" disabled={busy || !ready || !token} className="btn-clap w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"><Send size={16} /> {busy ? (en ? "Sending…" : "Envoi en cours…") : (en ? "Send message" : "Envoyer le message")}</button>
        </form>
      </main>
    </div>
  );
}
