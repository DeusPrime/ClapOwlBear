type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
};
declare global { interface Window { turnstile?: Turnstile } }

let loading: Promise<void> | undefined;
export function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]');
    const script = existing || document.createElement("script");
    const cleanup = () => {
      clearTimeout(timeout);
      script.removeEventListener("load", loaded);
      script.removeEventListener("error", failed);
    };
    const loaded = () => { cleanup(); if (window.turnstile) resolve(); else reject(new Error("Turnstile unavailable")); };
    const failed = () => { cleanup(); if (!existing) script.remove(); reject(new Error("Turnstile unavailable")); };
    const timeout = window.setTimeout(failed, 15000);
    script.addEventListener("load", loaded);
    script.addEventListener("error", failed);
    if (!existing) {
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      document.head.appendChild(script);
    }
  }).catch(error => { loading = undefined; throw error; });
  return loading;
}
