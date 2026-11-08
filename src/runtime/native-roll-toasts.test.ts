// @vitest-environment jsdom
﻿import { afterEach, expect, it, vi } from 'vitest';
import { createNativeRollToasts } from './native-roll-toasts';
afterEach(() => vi.useRealTimers());
const roll = { id: 1, sender: 'p', name: 'Léa', role: 'player' as const, text: 'Force\nD8 : 5 · Potentiel 6 · Réussite : 5', created: 1, kind: 'roll' as const };
it('opens a compact graphic result on the table without intercepting map controls and closes it automatically', async () => {
  vi.useFakeTimers();
  const api = { open: vi.fn(async (_options: any) => {}), close: vi.fn(async () => {}) };
  const toasts = createNativeRollToasts(api, 'https://example.com/roll-toast.html');
  await toasts.show(roll);
  expect(api.open).toHaveBeenCalledWith(expect.objectContaining({ fullScreen: true, hideBackdrop: true, hidePaper: true, disablePointerEvents: true }));
  const payload = JSON.parse(decodeURIComponent(api.open.mock.calls[0][0].url.split('#')[1]));
  expect(payload.name).toBe('Léa'); expect(payload.visual.label).toBe('Force');
  expect(JSON.stringify(payload)).not.toContain('Potentiel 6');
  expect(payload.visual.dice).toEqual([expect.objectContaining({ sides: 8, value: 5 })]);
  await vi.advanceTimersByTimeAsync(4800);
  expect(api.close).toHaveBeenCalledTimes(1); toasts.stop();
});
it('queues public results without replacing a running animation and never displays hidden rolls', async () => {
  vi.useFakeTimers();
  const api = { open: vi.fn(async (_options: any) => {}), close: vi.fn(async () => {}) };
  const toasts = createNativeRollToasts(api, 'https://example.com/roll-toast.html');
  await toasts.show({ ...roll, hidden: true }); await toasts.show({ ...roll, privateTo: 'gm' });
  expect(api.open).not.toHaveBeenCalled();
  await toasts.show(roll); await toasts.show({ ...roll, id: 2, name: 'MJ' });
  expect(api.open).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(4800); expect(api.open).toHaveBeenCalledTimes(2);
  toasts.stop(); await vi.advanceTimersByTimeAsync(10000); expect(api.open).toHaveBeenCalledTimes(2);
});
