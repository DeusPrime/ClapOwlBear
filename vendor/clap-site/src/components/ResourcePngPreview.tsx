import { localizeText, localizeNode } from '@/i18n/localize';
import { useEffect, useRef, useState } from "react";
import { acquireResourcePreviewUrl } from "@/lib/resourcePreviewPng";
import type { PreviewResource } from "./ResourceCardPreview";

function PngImage({ resource }: { resource: PreviewResource }) {
  const [source, setSource] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let release: (() => void) | undefined;
    acquireResourcePreviewUrl(resource).then(image => {
      if (cancelled) { image.release(); return; }
      release = image.release;
      setSource(image.url);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; release?.(); };
  }, [resource]);
  return source
    ? <img src={source} alt={localizeText(`Carte ${resource.item.titre || localizeText("sans nom")}`)} width={320} height={447} decoding="async" className="absolute inset-0 h-full w-full object-contain" />
    : <span className="absolute inset-0 flex items-center justify-center p-2 text-center typewriter text-xs text-foreground/50">{localizeNode(failed ? "Aperçu indisponible" : "Chargement de l’aperçu…")}</span>;
}

export default function ResourcePngPreview({ resource }: { resource: PreviewResource }) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    if (!("IntersectionObserver" in window)) { setVisible(true); return; }
    // A picker page contains at most 24 small PNGs. Retain decoded images until
    // the page closes rather than recreating URLs and decoding on every scroll.
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "150px 0px" });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={host} data-resource-png className="relative aspect-[744/1039] w-full overflow-hidden rounded-lg bg-paper-dark">
    {localizeNode(visible && <PngImage key={`${resource.type}:${resource.item.id}:${resource.item.updatedAt}`} resource={resource} />)}
  </div>;
}
