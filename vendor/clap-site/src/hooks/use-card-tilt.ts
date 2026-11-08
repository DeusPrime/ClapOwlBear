import { useEffect, useRef, type PointerEvent } from "react";

type OrientationAPI = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
let permissionRequest: Promise<string> | undefined;

export function useCardTilt(disabled = false, amplitude = 15) {
  const host = useRef<HTMLDivElement>(null);
  const sensorActive = useRef(false);
  const sensorPaused = useRef(false);
  const recalibrateSensor = useRef<() => void>(() => {});
  const reset = () => {
    host.current?.style.setProperty("--card-tilt-x", "0deg");
    host.current?.style.setProperty("--card-tilt-y", "0deg");
  };
  useEffect(() => { if (disabled || amplitude === 0) reset(); }, [disabled, amplitude]);
  useEffect(() => {
    if (disabled || amplitude === 0 || !window.isSecureContext || !window.matchMedia("(pointer: coarse)").matches) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let origin: { beta: number; gamma: number; angle: number } | undefined;
    let frame = 0;
    let listening = false;
    let disposed = false;
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (sensorPaused.current || reducedMotion.matches || document.hidden || event.beta === null || event.gamma === null) return;
      const element = host.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const angle = window.screen.orientation?.angle ?? 0;
      if (!origin || angle !== origin.angle) origin = { beta: event.beta, gamma: event.gamma, angle };
      const beta = ((event.beta - origin.beta + 540) % 360) - 180;
      const gamma = event.gamma - origin.gamma;
      const radians = angle * Math.PI / 180;
      const clamp = (value: number) => Math.max(-1, Math.min(1, value / 30)) * Math.min(amplitude, 10);
      const x = clamp(beta * Math.cos(radians) + gamma * Math.sin(radians));
      const y = clamp(gamma * Math.cos(radians) - beta * Math.sin(radians));
      sensorActive.current = true;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        element.style.setProperty("--card-tilt-x", `${-x}deg`);
        element.style.setProperty("--card-tilt-y", `${y}deg`);
      });
    };
    const start = () => {
      if (listening || disposed) return;
      listening = true;
      window.addEventListener("deviceorientation", onOrientation);
    };
    const api = window.DeviceOrientationEvent as OrientationAPI | undefined;
    const enable = () => {
      if (sensorPaused.current || reducedMotion.matches) return;
      if (api?.requestPermission) {
        permissionRequest ??= api.requestPermission().catch(() => "denied");
        void permissionRequest.then(result => { if (result === "granted") start(); });
      } else start();
    };
    const element = host.current;
    // iOS requires a direct user gesture before requesting sensor access.
    if (!api?.requestPermission) enable();
    element?.addEventListener("click", enable);
    const recalibrate = () => { cancelAnimationFrame(frame); origin = undefined; sensorActive.current = false; reset(); };
    recalibrateSensor.current = recalibrate;
    document.addEventListener("visibilitychange", recalibrate);
    reducedMotion.addEventListener("change", recalibrate);
    return () => {
      disposed = true;
      recalibrateSensor.current = () => {};
      cancelAnimationFrame(frame);
      window.removeEventListener("deviceorientation", onOrientation);
      element?.removeEventListener("click", enable);
      document.removeEventListener("visibilitychange", recalibrate);
      reducedMotion.removeEventListener("change", recalibrate);
      sensorActive.current = false;
      reset();
    };
  }, [disabled, amplitude]);
  const tilt = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || amplitude === 0 || event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
    event.currentTarget.style.setProperty("--card-tilt-x", `${-y * amplitude}deg`);
    event.currentTarget.style.setProperty("--card-tilt-y", `${x * amplitude}deg`);
  };
  const toggleSensor = () => {
    sensorPaused.current = !sensorPaused.current;
    recalibrateSensor.current();
    reset();
  };
  return { host, tilt, toggleSensor, reset: () => { if (!sensorActive.current) reset(); } };
}
