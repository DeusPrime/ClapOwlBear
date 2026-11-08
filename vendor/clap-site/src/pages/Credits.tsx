import { localizeText, localizeNode } from '@/i18n/localize';
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LanguageProvider, useLang } from "@/i18n/LanguageContext";
import { ArrowLeft, FastForward, Pencil, Volume2, VolumeX } from "lucide-react";

import { useQueryClient } from "@tanstack/react-query";
import { useAccount } from "@/lib/community";
import { DEFAULT_CREDITS, useCredits, type CreditsDocument } from "@/lib/credits";
import CreditsEditor from "@/components/CreditsEditor";
import { CREDITS_FAST_SPEED, useCreditsPlayback } from "@/hooks/use-credits-playback";

const Page = () => {
  const { t, lang } = useLang();
  const { user } = useAccount();
  const query = useCredits();
  const client = useQueryClient();
  const content = query.data ?? DEFAULT_CREDITS;
  const [editing, setEditing] = useState(false);
  const [playback, setPlayback] = useState(0);
  const closeEditor = () => { setEditing(false); setPlayback(value => value + 1); };
  const saved = (document: CreditsDocument) => { client.setQueryData(["content", "credits"], document); closeEditor(); };
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVolume] = useState(50);
  const rollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => { document.title = "Crédits — Clap & Role"; }, []);
  const finished = useCallback(() => navigate("/"), [navigate]);
  const { fast, showThanks, startFast, stopFast, syncAudio } = useCreditsPlayback({ audio: audioRef, roll: rollRef, paused: editing, revision: playback, volume, onFinished: finished });
  const changeVolume = (value: number) => {
    setVolume(value);
    if (audioRef.current?.paused && !fast && !editing && value > 0) syncAudio(true);
  };

  return (
    <div className={`credits-screen fixed inset-0 bg-black text-white overflow-hidden ${fast ? "credits-fast" : ""}`}>
      <Link
        to="/"
        className="fixed top-6 left-6 z-50 flex items-center gap-2 text-white/70 hover:text-white text-sm uppercase tracking-widest font-bold transition-colors"
      >
        <ArrowLeft size={16} />
        {t("back_home")}
      </Link>

      {localizeNode(user?.admin && <div className="fixed bottom-6 right-6 z-50"><button type="button" disabled={!query.data} onClick={() => setEditing(true)} className="flex items-center gap-2 border border-white/50 bg-black/90 px-4 py-3 text-sm hover:bg-white/15 disabled:opacity-50"><Pencil size={16} />{localizeText("Modifier les crédits")}</button>{localizeNode(query.isError && <button type="button" onClick={() => void query.refetch()} className="mt-2 block text-sm underline">{localizeText("Réessayer le chargement")}</button>)}</div>)}
      {editing && user?.admin && <CreditsEditor initial={content} onSaved={saved} onClose={closeEditor} />}
      <div className="fixed top-16 right-6 sm:top-6 z-50 flex items-center gap-3 rounded bg-black/70 px-3 py-2 text-white/80">
        {localizeNode(volume === 0 ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />)}
        <input type="range" min={0} max={100} step={1} value={volume} onChange={(event) => changeVolume(Number(event.target.value))} aria-label={localizeText("Volume de la musique")} aria-valuetext={`${volume} %`} className="w-24 sm:w-32 accent-white cursor-pointer" />
        <span className="typewriter text-xs tabular-nums w-10 text-right" aria-hidden="true">{localizeNode(volume)} %</span>
      </div>

      <audio ref={audioRef} src="/ClapOwlBear/audio/credits-theme.mp3" preload="auto" />

      {showThanks && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-black animate-fade-in">
          <h2 className="font-display text-5xl md:text-7xl tracking-widest text-white text-center px-6">
            {content.thanks}
          </h2>
        </div>
      )}

      <div role="region" aria-label={localizeText("Générique — maintenir pour avancer rapidement")} aria-describedby="credits-transport-help" tabIndex={0}
        className="absolute inset-0 flex touch-none select-none items-start justify-center overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-300"
        onPointerDown={event => {
          if (event.button !== 0 || event.isPrimary === false) return;
          event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
          try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Window listeners handle release without pointer capture. */ }
          startFast();
        }}
        onPointerUp={stopFast} onPointerCancel={stopFast} onLostPointerCapture={stopFast}
        onContextMenu={event => event.preventDefault()}
        onKeyDown={event => { if ([" ", "ArrowRight"].includes(event.key)) { event.preventDefault(); startFast(); } }}
        onKeyUp={event => { if ([" ", "ArrowRight"].includes(event.key)) { event.preventDefault(); stopFast(); } }}
      >

        <div ref={rollRef} className="credits-roll w-full max-w-2xl px-6 text-center" style={{ transform: "translateY(100vh)", willChange: "transform" }}>
          <h1 className="font-display text-6xl md:text-8xl tracking-widest mb-4">{content.title}</h1>
          <p className="typewriter text-lg text-white/70 mb-24">{content.subtitle}</p>

          {content.sections.map((s, i) => (
            <div key={i} className="mb-16">
              <p className="typewriter text-sm uppercase tracking-[0.3em] text-white/60 mb-3">
                {lang === "en" ? s.role_en?.trim() || s.role : s.role}
              </p>
              {s.names.map((n, j) => (
                <p key={j} className="font-display text-2xl md:text-3xl tracking-wide">
                  {n}
                </p>
              ))}
            </div>
          ))}

          <div className="my-32">
            <p className="font-display text-3xl md:text-4xl">{content.ending}</p>
          </div>

          <p className="typewriter text-xs text-white/40 mb-4">
            © {localizeNode(new Date().getFullYear())}{localizeText(" Clap & Role ")}</p>
          <p className="typewriter text-xs text-white/40 mb-24">{localizeText("// SCENE.FIN")}</p>
        </div>
      </div>

      <div className="pointer-events-none fixed bottom-6 left-6 z-40 max-w-[60%] text-[10px] uppercase tracking-widest text-white/50" id="credits-transport-help">{localizeText("Maintenez le clic, le doigt ou la barre espace pour avancer.")}</div>
      {localizeNode(fast && <div className="pointer-events-none fixed inset-0 z-40" aria-hidden="true">
        <div className="cassette-lines absolute inset-0" />
        <div className="absolute left-1/2 top-28 flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded border border-amber-200/50 bg-black/85 px-4 py-3 font-mono text-xs tracking-widest text-amber-100 sm:top-8">
          <span className="cassette-reel" /><FastForward size={22} fill="currentColor" /><span className="cassette-reel" />
          <span>{localizeText("AVANCE RAPIDE ×")}{localizeNode(CREDITS_FAST_SPEED)}</span>
        </div>
      </div>)}
      <span role="status" className="sr-only">{localizeNode(fast ? "Avance rapide" : "Lecture normale")}</span>
      <style>{localizeNode(`
        .credits-fast .credits-roll { text-shadow: 2px 0 #ffcf7660, -2px 0 #85dfff50; filter: contrast(1.2); }
        .cassette-lines { opacity: .17; background: repeating-linear-gradient(0deg, transparent 0 5px, #f3d9a4 6px, transparent 7px 11px); animation: cassette-tracking .18s linear infinite; }
        .cassette-reel { display: block; width: 22px; height: 22px; border: 2px solid currentColor; border-radius: 50%; background: repeating-conic-gradient(currentColor 0deg 22deg, transparent 22deg 90deg); animation: cassette-spool .3s linear infinite; }
        @keyframes cassette-spool { to { transform: rotate(360deg); } }
        @keyframes cassette-tracking { to { transform: translateY(11px); } }
        @media (prefers-reduced-motion: reduce) { .cassette-lines, .cassette-reel { animation: none; } .credits-fast .credits-roll { text-shadow: none; } }
      `)}</style>
    </div>
  );
};

const Credits = () => (
  <LanguageProvider>
    <Page />
  </LanguageProvider>
);

export default Credits;
