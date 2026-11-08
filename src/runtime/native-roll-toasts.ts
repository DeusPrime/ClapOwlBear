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
export function createNativeRollToasts(api: ModalPort, url: string) {
  const id = 'fr.clap.owlbear/roll-toast';
  const queue: ToastRoll[] = [];
  let active: { token: string; roll: ToastRoll; displayed: boolean } | undefined;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const finish = async () => { active = undefined; clearTimeout(timer); await api.close(id).catch(() => {}); void next(); };
  const fail = async (error: unknown) => {
    if (!active) return;
    const { name, visual } = active.roll;
    api.report?.('Affichage des dés Owlbear indisponible : ' + (error instanceof Error ? error.message : String(error)));
    await api.fallback?.((name + ' · ' + visual.label + (visual.successes != null ? ' · ' + visual.successes : '')).slice(0,100)).catch(() => {});
    await finish();
  };
  const next = async () => {
    if (active || stopped || !queue.length) return;
    const token = crypto.randomUUID();active = { token, roll: queue.shift()!, displayed: false };
    const target = new URL(url); target.hash = ''; target.searchParams.set('toast',token);
    try {
      await api.open({ id, url: target.href, fullScreen: true, hideBackdrop: true, hidePaper: true, disablePointerEvents: true });
      if (stopped) { await finish(); return; }
      if (active?.token === token && !active.displayed) timer=setTimeout(()=>{void fail(new Error('Le toast ne confirme pas son ouverture.'));},5000);
    } catch(error) { await fail(error); }
  };
  const unsubscribe = api.listen(event => {
    const data=event.data;
    if (!active || event.connectionId!==api.connectionId || data?.token!==active.token) return;
    if(data.type==='ready') void api.post({type:'result',token:active.token,roll:active.roll}).catch(fail);
    if(data.type==='displayed' && !active.displayed) { active.displayed=true; clearTimeout(timer); api.report?.(''); timer=setTimeout(()=>{void finish();},4800); }
  });
  return {
    show: async (message: RoomChatMessage) => {
      if (stopped || message.hidden || message.privateTo || message.kind !== 'roll') return;
      queue.push(toastRoll(message)); if(queue.length>5)queue.shift();void next();
    },
    stop: () => { stopped=true;queue.length=0;unsubscribe();clearTimeout(timer);if(active)void finish(); },
  };
}
