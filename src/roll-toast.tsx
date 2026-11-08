import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import RollingDie from '@/components/RollingDie';
import RollOutcomeEffect from '@/components/RollOutcomeEffect';
import type { ToastRoll } from './runtime/native-roll-toasts';
import './roll-toast.css';
export function RollToast({ roll }: { roll: ToastRoll }) {
  const [rolling, setRolling] = useState(true);
  useEffect(() => { const timer = setTimeout(() => setRolling(false), 900); return () => clearTimeout(timer); }, []);
  const { visual, lang } = roll;
  const labels = lang === 'en' ? { neutral: 'Dice roll', failure: 'Failure', success: 'Success', prowess: 'Prowess', complication: 'Complication' } : { neutral: 'Jet de dés', failure: 'Échec', success: 'Réussite', prowess: 'Prouesse', complication: 'Complication' };
  const result = visual.groupCount ? `${visual.groupSuccesses} / ${visual.groupCount} ${lang === 'en' ? 'successes' : 'réussites'}` : labels[visual.outcome] + (visual.successes != null ? ` · ${visual.successes}` : '');
  return <aside className={`roll-toast tone-${visual.outcome}`} role="status" aria-live="polite" aria-label={lang === 'en' ? 'Public dice roll' : 'Jet de dés public'}>
    <div className="toast-heading"><img src="./icon.svg" alt="CLAP!" /><div><strong>{roll.name}</strong><p>{visual.label}</p></div><span className="potential" title={lang === 'en' ? 'Potential' : 'Potentiel'}>{visual.potential != null ? `P ${visual.potential}` : ''}</span></div>
    <div className="toast-dice">{visual.dice.slice(0,5).map((die,index) => <div className={`toast-die die-${die.outcome} kind-${die.kind}`} key={index}>
      <RollOutcomeEffect active={!rolling} outcome={die.outcome}><RollingDie sides={die.sides} index={index} rolling={rolling} compact className=""><span className={rolling ? 'invisible' : ''}>{die.value}</span></RollingDie></RollOutcomeEffect>
      <small>{die.kind === 'destin' ? 'D20' : die.kind === 'supernatural' ? `D${die.sides} ✦` : `D${die.sides}`}</small>
    </div>)}{visual.dice.length > 5 && <small className="more-dice">+{visual.dice.length-5}</small>}</div>
    <RollOutcomeEffect active={!rolling} outcome={visual.outcome}><p className={`toast-result ${rolling ? 'pending' : ''}`}>{rolling ? (lang === 'en' ? 'Rolling…' : 'Lancer…') : result}{!rolling && visual.prowess && visual.outcome === 'complication' ? ' ✦' : ''}</p></RollOutcomeEffect>
    <div className="toast-lifetime" aria-hidden="true" />
  </aside>;
}
try {
  const roll = JSON.parse(decodeURIComponent(location.hash.slice(1))) as ToastRoll;
  if (!roll?.visual || !Array.isArray(roll.visual.dice) || !['failure','success','prowess','complication','neutral'].includes(roll.visual.outcome)) throw new Error('Invalid roll');
  document.documentElement.classList.toggle('dark', roll.dark);
  document.documentElement.lang = roll.lang;
  createRoot(document.getElementById('app')!).render(<RollToast roll={roll} />);
} catch { /* Never replace the table with an error for an invalid transient toast. */ }
