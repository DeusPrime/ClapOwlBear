import { localizeText, localizeNode } from '@/i18n/localize';
import { useEffect, useRef, useState } from "react";
import { Image } from "lucide-react";
import { persistToolPreview, type ToolDocument } from "@/lib/toolDocuments";

const cache = new Map<string, Promise<string | null>>();
let queue = Promise.resolve();
function preview(tool: ToolDocument) {
  const key = `${tool.id}:${tool.updatedAt}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const result = queue.then(async () => {
    const source = await (await import("@/lib/toolOutput")).renderToolPreview(tool);
    try { await persistToolPreview(tool.id, tool.updatedAt, source); }
    catch { /* A storage failure must not hide a successfully rendered preview. */ }
    return source;
  });
  queue = result.then(() => undefined, () => undefined);
  cache.set(key, result);
  if (cache.size > 60) cache.delete(cache.keys().next().value!);
  void result.catch(() => cache.delete(key));
  return result;
}
export default function ToolPreview({ tool }: { tool: ToolDocument }) {
  const element = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState<string | null>(tool.preview ?? null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setSource(tool.preview ?? null); setFailed(false);
    if (tool.preview !== undefined) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      void preview(tool).then(value => { if (!cancelled) setSource(value); }).catch(() => { if (!cancelled) setFailed(true); });
    }, { rootMargin: "160px" });
    if (element.current) observer.observe(element.current);
    return () => { cancelled = true; observer.disconnect(); };
  }, [tool]);
  return <div ref={element} className="flex aspect-[210/297] w-full items-center justify-center overflow-hidden bg-ink/5">
    {localizeNode(source ? <img src={source} alt={localizeText(`Aperçu de ${tool.name}`)} className="h-full w-full object-contain" /> : <div className="p-4 text-center text-xs text-foreground/60"><Image size={36} className="mx-auto mb-3 opacity-50" /><span>{localizeNode(failed ? "Aperçu indisponible" : tool.data?.images.length ? "Préparation de l’aperçu…" : "Ajoutez vos images")}</span></div>)}
  </div>;
}
