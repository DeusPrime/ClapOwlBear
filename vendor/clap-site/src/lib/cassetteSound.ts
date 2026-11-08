import { createVhsTapeSamples } from "./vhsTapeSamples";

export function createCassetteSound() {
  let context: AudioContext | undefined;
  let output: GainNode | undefined;
  let tape: AudioBufferSourceNode | undefined;
  let active = false;
  const level = (volume: number) => {
    if (!context || !output) return;
    output.gain.cancelScheduledValues(context.currentTime);
    output.gain.setTargetAtTime(active ? volume * 0.18 : 0, context.currentTime, 0.018);
  };
  return {
    start(volume: number) {
      active = true;
      try {
        if (!context && volume > 0) {
          const Constructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (!Constructor) return;
          context = new Constructor();
          output = context.createGain(); output.gain.value = 0; output.connect(context.destination);
          const samples = createVhsTapeSamples(context.sampleRate);
          const buffer = context.createBuffer(1, samples.length, context.sampleRate);
          buffer.getChannelData(0).set(samples);
          tape = context.createBufferSource(); tape.buffer = buffer; tape.loop = true;
          tape.connect(output); tape.start();
        }
        if (context && tape) {
          tape.playbackRate.cancelScheduledValues(context.currentTime);
          tape.playbackRate.setValueAtTime(0.78, context.currentTime);
          tape.playbackRate.exponentialRampToValueAtTime(1, context.currentTime + 0.12);
        }
        void context?.resume().catch(() => {});
        level(volume);
      } catch { /* Fast forward remains usable when sound synthesis is unavailable. */ }
    },
    volume(volume: number) { if (active) { if (!context) this.start(volume); else level(volume); } },
    stop() {
      active = false; level(0);
      if (context && tape) {
        tape.playbackRate.cancelScheduledValues(context.currentTime);
        tape.playbackRate.setTargetAtTime(0.6, context.currentTime, 0.018);
      }
    },
    dispose() {
      active = false;
      tape?.stop();
      if (context) void context.close().catch(() => {});
      context = undefined; output = undefined; tape = undefined;
    },
  };
}
