export type ImageStyleJob = { id: string; source: string; strength: number; width: number; height: number; maxDimension?: number };
export function imageProcessingLimits(device: { hardwareConcurrency?: number; deviceMemory?: number } = typeof navigator === "undefined" ? {} : navigator) {
  const cores = device.hardwareConcurrency ?? 2, memory = device.deviceMemory ?? 4;
  return { concurrency: memory <= 2 ? 1 : Math.max(1, Math.min(memory >= 8 ? 3 : 2, Math.floor(cores / 2))), pixels: memory >= 8 ? 6_000_000 : 4_000_000 };
}
const same = (a: ImageStyleJob, b: ImageStyleJob) => a.source === b.source && a.strength === b.strength && a.maxDimension === b.maxDimension;
function pixels(job: ImageStyleJob) {
  const scale = job.maxDimension ? Math.min(1, job.maxDimension / Math.max(job.width, job.height)) : 1;
  return Math.max(1, job.width * job.height * scale * scale);
}

export class ImageJobQueue<T> {
  private jobs: ImageStyleJob[] = [];
  private active = new Map<string, { job: ImageStyleJob; controller: AbortController }>();
  private completed = new Map<string, ImageStyleJob>();
  private timer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  constructor(private process: (job: ImageStyleJob, signal: AbortSignal) => Promise<T>, private success: (job: ImageStyleJob, result: T) => void,
    private failure: (job: ImageStyleJob, error: unknown) => void, private limits = imageProcessingLimits()) {}
  update(jobs: ImageStyleJob[]) {
    this.jobs = jobs;
    const current = new Map(jobs.map(job => [job.id, job]));
    for (const [id, entry] of this.active) {
      const job = current.get(id);
      if (!job || !same(job, entry.job)) { entry.controller.abort(); this.active.delete(id); }
    }
    for (const [id, done] of this.completed) if (!current.has(id) || !same(current.get(id)!, done)) this.completed.delete(id);
    const waiting = jobs.some(job => !this.active.has(job.id) && !this.completed.has(job.id));
    if (waiting && !this.timer && !this.disposed) this.timer = setTimeout(() => { this.timer = undefined; this.pump(); }, 180);
    if (!waiting) { clearTimeout(this.timer); this.timer = undefined; }
  }
  private pump() {
    if (this.disposed || this.timer) return;
    while (this.active.size < this.limits.concurrency) {
      const used = Array.from(this.active.values()).reduce((sum, entry) => sum + pixels(entry.job), 0);
      const job = this.jobs.find(job => !this.active.has(job.id) && !this.completed.has(job.id) && (!this.active.size || used + pixels(job) <= this.limits.pixels));
      if (!job) break;
      const entry = { job, controller: new AbortController() };
      this.active.set(job.id, entry);
      void (async () => {
        try {
          const result = await this.process(job, entry.controller.signal);
          if (!this.disposed && !entry.controller.signal.aborted) { this.completed.set(job.id, job); this.success(job, result); }
        } catch (error) {
          if (!this.disposed && !entry.controller.signal.aborted) { this.completed.set(job.id, job); this.failure(job, error); }
        } finally {
          if (this.active.get(job.id) === entry) this.active.delete(job.id);
          this.pump();
        }
      })();
    }
  }
  dispose() {
    this.disposed = true; clearTimeout(this.timer);
    for (const entry of this.active.values()) entry.controller.abort();
    this.active.clear();
  }
}
