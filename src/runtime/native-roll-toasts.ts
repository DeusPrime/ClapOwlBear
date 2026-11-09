import type { RoomChatMessage } from '@/lib/roomProtocol';
import type { RollVisual } from '@/lib/rollVisual';
export type ToastRoll = { name: string; visual: Omit<RollVisual,'outcome'|'potential'> & { outcome: RollVisual['outcome'] | 'neutral'; potential?: number }; dark: boolean; lang: 'fr'|'en' };
export function toastRoll(message: RoomChatMessage): ToastRoll {
  const first = message.text.split('\n')[0].slice(0,100);
  const match = message.text.match(/D(4|6|8|10|12|20)\s*:\s*(\d+)/);
  const legacyDice = match && Number(match[2]) <= Number(match[1]) ? [{ sides: Number(match[1]) as 4|6|8|10|12|20, value: Number(match[2]), kind: 'diff' as const, outcome: 'neutral' as const }] : [];
  return { name: message.name, visual: message.rollVisual || { label: first, outcome: 'neutral', dice: legacyDice }, dark: localStorage.getItem('clap-theme') === 'dark', lang: localStorage.getItem('clap-lang') === 'en' ? 'en' : 'fr' };
}
type ModalPort = {
  open: (options: { id: string; url: string; fullScreen: boolean; hideBackdrop: boolean; hidePaper: boolean; disablePointerEvents: boolean }) => Promise<void>;
  close: (id: string) => Promise<void>;
  connectionId: string;
  listen: (callback: (event: { connectionId: string; data: any }) => void) => () => void;
  post: (data: unknown) => Promise<void>;
  fallback?: (text: string) => Promise<unknown>;
  report?: (error: string) => void;
};
export type ToastEntry = { id: string; roll: ToastRoll };
export function createNativeRollToasts(api: ModalPort, url: string) {
  const id = 'fr.clap.owlbear/roll-toast';
  type Entry = ToastEntry & { timer?: ReturnType<typeof setTimeout> };
  type Session = { token: string; ready: boolean; entries: Entry[]; timer?: ReturnType<typeof setTimeout> };
  let session: Session | undefined;
  let closing: Promise<void> = Promise.resolve();
  let stopped = false;
  const close = (current: Session) => {
    if (session !== current) return;
    session = undefined;
    clearTimeout(current.timer);
    current.entries.forEach(entry => clearTimeout(entry.timer));
    closing = api.close(id).catch(() => {});
  };
  const fail = async (current: Session, error: unknown) => {
    if (session !== current) return;
    api.report?.('Affichage des dés Owlbear indisponible : ' + (error instanceof Error ? error.message : String(error)));
    const entries = [...current.entries];
    close(current);
    for (const { roll: { name, visual } } of entries) {
      await api.fallback?.((name + ' · ' + visual.label + (visual.successes != null ? ' · ' + visual.successes : '')).slice(0,100)).catch(() => {});
    }
  };
  const publish = (current: Session) => {
    if (session !== current || !current.ready) return;
    void api.post({ type: 'result', token: current.token, rolls: current.entries.map(({ id, roll }) => ({ id, roll })) }).catch(error => fail(current, error));
  };
  const unsubscribe = api.listen(event => {
    const current = session, data = event.data;
    if (!current || event.connectionId !== api.connectionId || data?.token !== current.token) return;
    if (data.type === 'ready') { current.ready = true; publish(current); }
    if (data.type === 'displayed') {
      const entry = current.entries.find(entry => entry.id === data.id);
      if (!entry || entry.timer) return;
      clearTimeout(current.timer);
      api.report?.('');
      entry.timer = setTimeout(() => {
        if (session !== current) return;
        current.entries = current.entries.filter(item => item !== entry);
        if (current.entries.length) publish(current);
        else close(current);
      }, 4800);
    }
  });
  return {
    show: async (message: RoomChatMessage) => {
      if (stopped || message.hidden || message.privateTo || message.kind !== 'roll') return;
      await closing;
      if (stopped) return;
      const entry: Entry = { id: crypto.randomUUID(), roll: toastRoll(message) };
      if (session) { session.entries.push(entry); publish(session); return; }
      const current: Session = { token: crypto.randomUUID(), ready: false, entries: [entry] };
      session = current;
      const target = new URL(url); target.hash = ''; target.searchParams.set('toast', current.token);
      current.timer = setTimeout(() => { void fail(current, new Error('Le toast ne confirme pas son ouverture.')); }, 5000);
      try {
        await api.open({ id, url: target.href, fullScreen: true, hideBackdrop: true, hidePaper: true, disablePointerEvents: true });
      } catch (error) { await fail(current, error); }
    },
    stop: () => { stopped = true; unsubscribe(); if (session) close(session); },
  };
}
