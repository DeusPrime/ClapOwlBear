import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { createCassetteSound } from "@/lib/cassetteSound";

export const CREDITS_FAST_SPEED = 8;
const ROLL_DURATION = 124000;
const THANKS_AT = 123000;
const END_AT = 128000;

export function useCreditsPlayback({ audio, roll, paused, revision, volume, onFinished }: {
  audio: RefObject<HTMLAudioElement>; roll: RefObject<HTMLDivElement>; paused: boolean; revision: number; volume: number; onFinished: () => void;
}) {
  const [fast, setFast] = useState(false);
  const [showThanks, setShowThanks] = useState(false);
  const elapsed = useRef(0);
  const lastFrame = useRef<number | null>(null);
  const fastRef = useRef(false);
  const pausedRef = useRef(paused);
  const volumeRef = useRef(volume);
  const sound = useRef<ReturnType<typeof createCassetteSound>>();
  pausedRef.current = paused;
  volumeRef.current = volume;

  const syncAudio = useCallback((play: boolean) => {
    const element = audio.current;
    if (!element) return;
    const target = Math.min(elapsed.current / 1000, Number.isFinite(element.duration) ? element.duration : Infinity);
    try { element.currentTime = target; } catch { /* loadedmetadata retries seeking if necessary. */ }
    element.playbackRate = 1;
    element.volume = volumeRef.current / 100;
    element.muted = volumeRef.current === 0;
    if (play && !pausedRef.current && !document.hidden && !element.ended) void element.play().catch(() => {});
  }, [audio]);
  const stopFast = useCallback(() => {
    if (!fastRef.current) return;
    fastRef.current = false;
    setFast(false);
    sound.current?.stop();
    syncAudio(true);
  }, [syncAudio]);
  const startFast = useCallback(() => {
    if (pausedRef.current || document.hidden || fastRef.current || elapsed.current >= END_AT) return;
    fastRef.current = true;
    setFast(true);
    audio.current?.pause();
    sound.current ??= createCassetteSound();
    sound.current.start(volumeRef.current / 100);
  }, [audio]);

  useEffect(() => {
    const element = audio.current;
    if (element) { element.volume = volume / 100; element.muted = volume === 0; }
    sound.current?.volume(volume / 100);
  }, [audio, volume]);

  useEffect(() => {
    elapsed.current = 0;
    lastFrame.current = null;
    fastRef.current = false;
    setFast(false); setShowThanks(false);
    sound.current?.stop();
    const element = audio.current;
    if (roll.current) roll.current.style.transform = "translateY(100vh)";
    if (paused) { element?.pause(); return; }
    syncAudio(true);
    let frame: number;
    let finished = false;
    const tick = (timestamp: number) => {
      if (!document.hidden) {
        if (lastFrame.current !== null) elapsed.current = Math.min(END_AT, elapsed.current + Math.max(0, timestamp - lastFrame.current) * (fastRef.current ? CREDITS_FAST_SPEED : 1));
        lastFrame.current = timestamp;
        const progress = Math.min(1, elapsed.current / ROLL_DURATION);
        if (roll.current) roll.current.style.transform = `translateY(calc(${100 * (1 - progress)}vh - ${100 * progress}%))`;
        if (elapsed.current >= THANKS_AT) setShowThanks(true);
        if (elapsed.current >= END_AT && !finished) {
          finished = true;
          fastRef.current = false; setFast(false); sound.current?.stop(); element?.pause();
          onFinished(); return;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const loaded = () => { syncAudio(!fastRef.current); };
    const visibility = () => {
      lastFrame.current = null;
      stopFast();
      if (document.hidden) element?.pause(); else syncAudio(true);
    };
    const keyUp = (event: KeyboardEvent) => { if ([" ", "ArrowRight"].includes(event.key)) stopFast(); };
    element?.addEventListener("loadedmetadata", loaded);
    window.addEventListener("pointerup", stopFast);
    window.addEventListener("pointercancel", stopFast);
    window.addEventListener("blur", stopFast);
    window.addEventListener("keyup", keyUp);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      element?.removeEventListener("loadedmetadata", loaded);
      window.removeEventListener("pointerup", stopFast);
      window.removeEventListener("pointercancel", stopFast);
      window.removeEventListener("blur", stopFast);
      window.removeEventListener("keyup", keyUp);
      document.removeEventListener("visibilitychange", visibility);
      fastRef.current = false; sound.current?.stop(); element?.pause();
    };
  }, [audio, roll, paused, revision, onFinished, syncAudio, stopFast]);
  useEffect(() => () => sound.current?.dispose(), []);
  return { fast, showThanks, startFast, stopFast, syncAudio };
}
