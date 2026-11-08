/** Original procedural VHS transport: no recordings or third-party samples. */
export function createVhsTapeSamples(sampleRate: number, duration = 8): Float32Array {
  const samples = new Float32Array(Math.round(sampleRate * duration));
  const tau = Math.PI * 2;
  let randomState = 0x56a3f129;
  let lastNoise = 0;
  let peak = 0;
  for (let index = 0; index < samples.length; index++) {
    const t = index / sampleRate;
    // Uneven take-up reels and rapid flutter roughen the pitch instead of a clean siren.
    const phase = tau * 1580 * t + 118 * Math.sin(tau * 2.125 * t)
      + 27 * Math.sin(tau * 7.375 * t) + 2.4 * Math.sin(tau * 47.125 * t);
    const chatter = 0.7 + 0.3 * Math.sin(tau * 23.25 * t + 1.1 * Math.sin(tau * 3.875 * t));
    const reels = 0.8 + 0.2 * Math.sin(tau * 1.375 * t);
    const winding = 0.12 * Math.sin(phase) + 0.38 * Math.sin(2 * phase + 0.3)
      + 0.23 * Math.sin(3 * phase) + 0.09 * Math.sin(4 * phase + 0.7);
    const scrapePhase = tau * 3375 * t + 37 * Math.sin(tau * 5.125 * t)
      + 3.2 * Math.sin(tau * 61 * t);
    const scrape = 0.09 * Math.sin(scrapePhase) * (0.55 + 0.45 * Math.sin(tau * 13.625 * t));
    const motor = 0.045 * Math.sin(tau * 117 * t + 0.8 * Math.sin(tau * 2.125 * t));
    // Tiny dry mechanical grain; pitched components dominate, without a hiss bed.
    randomState ^= randomState << 13; randomState ^= randomState >>> 17; randomState ^= randomState << 5;
    const noise = (randomState >>> 0) / 0xffffffff * 2 - 1;
    const grain = (noise - lastNoise) * 0.012 * chatter;
    lastNoise = noise;
    const fade = Math.min(1, index / (sampleRate * 0.004), (samples.length - 1 - index) / (sampleRate * 0.004));
    const value = Math.tanh((winding * chatter * reels + scrape + motor + grain) * 1.3) * fade;
    samples[index] = value;
    peak = Math.max(peak, Math.abs(value));
  }
  if (peak > 0) for (let index = 0; index < samples.length; index++) samples[index] *= 0.72 / peak;
  return samples;
}
