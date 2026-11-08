import { useEffect, useRef } from "react";
import { ImageJobQueue, type ImageStyleJob } from "@/lib/imageJobQueue";

export function useImageJobQueue<T>(jobs: ImageStyleJob[], process: (job: ImageStyleJob, signal: AbortSignal) => Promise<T>, success: (job: ImageStyleJob, result: T) => void, failure: (job: ImageStyleJob, error: unknown) => void) {
  const callbacks = useRef({ process, success, failure });
  callbacks.current = { process, success, failure };
  const queue = useRef<ImageJobQueue<T>>();
  useEffect(() => {
    const instance = new ImageJobQueue<T>((job, signal) => callbacks.current.process(job, signal), (job, result) => callbacks.current.success(job, result), (job, error) => callbacks.current.failure(job, error));
    queue.current = instance;
    return () => instance.dispose();
  }, []);
  useEffect(() => { queue.current?.update(jobs); });
}
