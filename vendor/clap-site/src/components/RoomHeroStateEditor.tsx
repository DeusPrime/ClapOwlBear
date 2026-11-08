import { useRef, useState } from 'react';
import { INJURY_LOCATIONS, INJURY_LEVELS, STRESS_LEVELS, GRIEF_LEVELS, type Character } from '@/lib/characters';
import { roomClient } from '@/lib/roomClient';
import { roomHeroEditSignature } from '@/lib/roomInventoryChanges';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';

export default function RoomHeroStateEditor({ hero }: { hero: Character }) {
  const [draft, setDraft] = useState<Character | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const initialState = useRef('');
  const [category, setCategory] = useState<'armes' | 'armures' | 'autresAccessoires'>('autresAccessoires');
  const [item, setItem] = useState({ nom: '', proprietes: '', degats: '', poids: '', protection: '' });
  async function save() {
    if (!draft) return;
    setBusy(true); setError('');
    try { await roomClient.updateRoomHero(draft, draft.updatedAt, initialState.current); setDraft(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Modification impossible.'); }
    finally { setBusy(false); }
  }
  return <>
    <Button variant="outline" onClick={() => { initialState.current = roomHeroEditSignature(hero); setDraft(structuredClone(hero)); setError(''); setItem({ nom: '', proprietes: '', degats: '', poids: '', protection: '' }); }}>Blessures, état et inventaire</Button>
    <Dialog open={Boolean(draft)} onOpenChange={open => { if (!open && !busy) setDraft(null); }}><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto bg-paper">
      <DialogTitle>État de {hero.nom || 'ce héros'}</DialogTitle><DialogDescription>Ces changements sont enregistrés dans la salle. Le héros du projet d’origine reste inchangé.</DialogDescription>
      {draft && <form className="space-y-5" onSubmit={event => { event.preventDefault(); void save(); }}><fieldset disabled={busy} className="space-y-4">
        {INJURY_LOCATIONS.map(location => <fieldset key={location} className="rounded border border-ink/20 p-3"><legend className="px-1 font-bold">{location}</legend><div className="flex flex-wrap gap-3">{INJURY_LEVELS.map((level, index) => <label key={level} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(draft.injuries[location]?.[index])} onChange={event => setDraft({ ...draft, injuries: { ...draft.injuries, [location]: Array.from({ length: 7 }, (_, i) => i === index ? event.target.checked : Boolean(draft.injuries[location]?.[i])) } })} />{level}</label>)}</div></fieldset>)}
        {(['stress', 'griefs'] as const).map(field => <fieldset key={field} className="rounded border border-ink/20 p-3"><legend className="px-1 font-bold">{field === 'stress' ? 'Stress' : 'Griefs'}</legend><div className="flex flex-wrap gap-3">{(field === 'stress' ? STRESS_LEVELS : GRIEF_LEVELS).map((level, index) => <label key={level} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(draft[field][index])} onChange={event => setDraft({ ...draft, [field]: draft[field].map((value, i) => i === index ? event.target.checked : value) })} />{level}</label>)}</div></fieldset>)}
        <label className="block space-y-2 text-sm font-bold">Notes de partie<textarea rows={3} value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} className="w-full border border-ink bg-paper p-3 font-normal" /></label>
        <fieldset className="space-y-3 rounded border border-ink/20 p-3"><legend className="px-1 font-bold">Inventaire du héros dans la salle</legend>
          {(['armes', 'armures', 'autresAccessoires'] as const).flatMap(field => draft[field].map((value, index) => <div key={`${field}:${index}`} className="flex items-center justify-between gap-2 text-sm"><span>{value.nom || 'Objet'}</span><Button type="button" variant="outline" size="sm" onClick={() => setDraft({ ...draft, [field]: draft[field].filter((_, i) => i !== index) })}>Retirer</Button></div>))}
          <label className="block text-sm">Catégorie<select value={category} onChange={event => setCategory(event.target.value as typeof category)} className="mt-1 min-h-11 w-full border border-ink bg-paper p-2"><option value="autresAccessoires">Objet / accessoire</option><option value="armes">Arme</option><option value="armures">Armure</option></select></label>
          {(['nom', 'proprietes', ...(category === 'armes' ? ['degats'] : category === 'armures' ? ['poids', 'protection'] : [])] as (keyof typeof item)[]).map(key => <label key={key} className="block text-sm">{{ nom: 'Nom de l’objet', proprietes: 'Propriétés', degats: 'Dégâts', poids: 'Poids', protection: 'Protection' }[key]}<input value={item[key]} maxLength={key === 'proprietes' ? 2000 : key === 'nom' ? 300 : 100} onChange={event => setItem({ ...item, [key]: event.target.value })} className="mt-1 min-h-11 w-full border border-ink bg-paper p-2" /></label>)}
          <Button type="button" variant="outline" disabled={!item.nom.trim() || draft[category].length >= 100} onClick={() => { setDraft({ ...draft, [category]: [...draft[category], { ...item, nom: item.nom.trim() }] }); setItem({ nom: '', proprietes: '', degats: '', poids: '', protection: '' }); }}>Ajouter à l’inventaire</Button>
        </fieldset>
        <Button type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer dans la salle'}</Button>
      </fieldset></form>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </DialogContent></Dialog>
  </>;
}
