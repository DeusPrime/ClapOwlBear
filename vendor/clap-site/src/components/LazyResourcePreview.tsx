import { localizeNode } from '@/i18n/localize';
import { ReactNode, startTransition, useEffect, useRef, useState } from "react";

const listeners = new Map<Element, (visible: boolean) => void>();
let viewportObserver: IntersectionObserver | undefined;

function observePreview(element: Element, onVisibility: (visible: boolean) => void) {
  if (!("IntersectionObserver" in window)) {
    onVisibility(true);
    return () => {};
  }
  viewportObserver ??= new IntersectionObserver(entries => {
    startTransition(() => {
      entries.forEach(entry => listeners.get(entry.target)?.(entry.isIntersecting));
    });
  }, { rootMargin: "300px 0px" });
  listeners.set(element, onVisibility);
  viewportObserver.observe(element);
  return () => {
    viewportObserver?.unobserve(element);
    listeners.delete(element);
    if (!listeners.size) {
      viewportObserver?.disconnect();
      viewportObserver = undefined;
    }
  };
}

type LazyResourcePreviewProps = {
  render: () => ReactNode;
};

/**
 * Resource cards contain a large decorative DOM tree. Keep off-screen cards as
 * dimensionally identical placeholders outside the viewport, including cards
 * already visited. One observer serves the whole list, including modal lists.
 */
const LazyResourcePreview = ({ render }: LazyResourcePreviewProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    return observePreview(host, setVisible);
  }, []);

  return (
    <div ref={hostRef} className="resource-card-preview-scale pointer-events-none">
      {localizeNode(visible ? render() : <div className="resource-card-preview-placeholder" aria-hidden="true" />)}
    </div>
  );
};

export default LazyResourcePreview;
