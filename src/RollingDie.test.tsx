// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import RollingDie from '@/components/RollingDie';

it.each([false, true])('uses the full site dice animation with reduced motion %s', async reduced => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const cancel = vi.fn();
  const animate = vi.fn((_frames: Keyframe[], _options: KeyframeAnimationOptions) => ({ cancel }));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
  Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
  try {
    await act(async () => root.render(<RollingDie sides={6} index={0} className="" />));
    expect(animate).toHaveBeenCalledOnce();
    const frames = animate.mock.calls[0][0] as Keyframe[];
    expect(frames[0].transform).not.toBe(frames.at(-1)?.transform);
    expect(frames.at(-1)?.transform).toBe('translate3d(0, 0px, 0) rotate(0deg)');
    expect(frames[0].transform).toBe('translate3d(0, 0px, 0) rotate(-640deg)');
    expect(frames.some(frame => !String(frame.transform).startsWith('translate3d(0, 0px, 0)'))).toBe(true);
    expect(animate.mock.calls[0][1].duration).toBe(760);
    await act(async () => root.render(<RollingDie sides={6} index={0} className="" rolling={false} />));
    expect(cancel).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    if (original) Object.defineProperty(HTMLElement.prototype, 'animate', original);
    else delete (HTMLElement.prototype as any).animate;
    vi.unstubAllGlobals();
  }
});
