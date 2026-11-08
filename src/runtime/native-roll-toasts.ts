import type { RoomChatMessage } from '@/lib/roomProtocol';
import type { RollVisual } from '@/lib/rollVisual';
export type ToastRoll = { name: string; visual: Omit<RollVisual,'outcome'|'potential'> & { outcome: RollVisual['outcome'] | 'neutral'; potential?: number }; dark: boolean; lang: 'fr'|'en' };
export function toastRoll(message: RoomChatMessage): ToastRoll {
  const first = message.text.split('\n')[0].slice(0,100);
  const match = message.text.match(/D(4|6|8|10|12|20)\s*:\s*(\d+)/);
  const legacyDice = match && Number(match[2]) <= Number(match[1]) ? [{ sides: Number(match[1]) as 4|6|8|10|12|20, value: Number(match[2]), kind: 'diff' as const, outcome: 'neutral' as const }] : [];
  return { name: message.name, visual: message.rollVisual || { label: first, outcome: 'neutral', dice: legacyDice }, dark: localStorage.getItem('clap-theme') === 'dark', lang: localStorage.getItem('clap-lang') === 'en' ? 'en' : 'fr' };
}
type ModalPort = { open: (options: { id: string; url: string; fullScreen: boolean; hideBackdrop: boolean; hidePaper: boolean; disablePointerEvents: boolean }) => Promise<void>; close: (id: string) => Promise<void> };
export function createNativeRollToasts(api: ModalPort, url: string) {
  const id = 'fr.clap.owlbear/roll-toast';
  const queue: ToastRoll[] = [];
  let active = false, stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const next = async () => {
    if (active || stopped || !queue.length) return;
    active = true;
    const payload = queue.shift()!;
    try {
      await api.open({ id, url: url + '#' + encodeURIComponent(JSON.stringify(payload)), fullScreen: true, hideBackdrop: true, hidePaper: true, disablePointerEvents: true });
      if (stopped) { await api.close(id); return; }
      timer = setTimeout(() => { void api.close(id).catch(() => {}).finally(() => { active = false; void next(); }); }, 4800);
    } catch { active = false; if (queue.length) void next(); }
  };
  return {
    show: async (message: RoomChatMessage) => {
      if (stopped || message.hidden || message.privateTo || message.kind !== 'roll') return;
      queue.push(toastRoll(message));
      if (queue.length > 5) queue.shift();
      void next();
    },
    stop: () => { stopped = true; queue.length = 0; clearTimeout(timer); if (active) void api.close(id).catch(() => {}); },
  };
}
