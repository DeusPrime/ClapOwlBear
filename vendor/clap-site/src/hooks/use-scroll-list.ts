import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export function screenBatchSize(columns: number, tileHeight: number, rowGap: number, viewportHeight: number, top: number) {
  const available = Math.max(tileHeight, viewportHeight - Math.max(80, Math.min(top, 240)) - 140);
  return Math.max(1, columns) * Math.max(1, Math.floor((available + rowGap) / Math.max(1, tileHeight + rowGap)));
}

export default function useScrollList<T>(items: T[], resetKey: string) {
  const gridRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [batchSize, setBatchSize] = useState(2);
  const [revealed, setRevealed] = useState({ key: resetKey, count: 0 });
  const [pending, setPending] = useState(false);
  const count = Math.min(items.length, Math.max(batchSize, revealed.key === resetKey ? revealed.count : 0));
  const hasMore = count < items.length;

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const update = () => {
      const tile = grid.querySelector<HTMLElement>('article, .studio-project-tile');
      if (!tile) return;
      const tileHeight = tile.getBoundingClientRect().height;
      if (tileHeight <= 0) return;
      const style = getComputedStyle(grid);
      const columns = style.gridTemplateColumns.split(/\s+/).filter(Boolean).length;
      const next = screenBatchSize(columns, tileHeight, parseFloat(style.rowGap) || 0, window.innerHeight, grid.getBoundingClientRect().top + window.scrollY);
      setBatchSize(current => current === next ? current : next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(grid);
    if (grid.firstElementChild) observer.observe(grid.firstElementChild);
    window.addEventListener('resize', update);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, [items.length, resetKey]);

  useEffect(() => {
    const end = endRef.current;
    if (!end || !hasMore) { setPending(false); return; }
    let timer: number | undefined;
    let scheduled = false;
    setPending(false);
    const append = () => {
      if (scheduled) return;
      scheduled = true;
      setPending(true);
      // Give the loading indicator a paint before mounting the next screenful.
      timer = window.setTimeout(() => {
        setRevealed({ key: resetKey, count: count + batchSize });
        setPending(false);
      }, 100);
    };
    let observer: IntersectionObserver | undefined;
    const check = () => { if (end.getBoundingClientRect().top <= window.innerHeight + 160) append(); };
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) append(); }, { rootMargin: '160px 0px' });
      observer.observe(end);
    } else {
      check();
      window.addEventListener('scroll', check, { passive: true });
    }
    return () => { observer?.disconnect(); window.removeEventListener('scroll', check); window.clearTimeout(timer); };
  }, [count, batchSize, hasMore, resetKey]);

  return { gridRef, endRef, items: items.slice(0, count), pending, hasMore };
}
