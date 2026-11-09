import { localizeText, localizeNode } from '@/i18n/localize';
import { useState, type ReactNode } from 'react';
import { Trash2, UserRound } from 'lucide-react';
import { CharacterCards } from '@/pages/CharacterEditor';
import type { Character } from '@/lib/characters';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import RoomHeroStateEditor from './RoomHeroStateEditor';

export default function RoomSavedHeroCard({ hero, onRemove, status = 'Disponible', removable = true, children, onOpen }: { hero: Character; onRemove: () => Promise<void>; status?: string; removable?: boolean; children?: ReactNode; onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'identity' | 'attributes' | 'traits' | 'state' | 'notes' | 'back'>('identity');
  return <li className="min-w-0 space-y-2">
    <button type="button" className="block w-full text-left" onClick={() => onOpen ? onOpen() : setOpen(true)} aria-label={localizeText(`Consulter ${hero.nom || 'ce héros'}`)}><div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded bg-ink/5">{localizeNode(hero.portrait ? <img src={hero.portrait} alt="" className="h-full w-full object-cover" /> : <UserRound size={40} />)}</div><span className="mt-2 block break-words font-semibold">{hero.nom || 'Héros sans nom'}</span></button>
    <p className="text-xs text-muted-foreground">{localizeNode(status)}</p>
    {children}
    <Button variant="outline" className="w-full" onClick={() => onOpen ? onOpen() : setOpen(true)}>{localizeText("Consulter")}</Button>
    <Button variant="outline" disabled={!removable} className="w-full" aria-label={localizeText(`Supprimer ${hero.nom || 'ce héros'} de la salle`)} onClick={() => void onRemove()}><Trash2 size={16} className="mr-2" />{localizeText("Supprimer")}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[94dvh] max-w-5xl overflow-y-auto bg-paper"><DialogTitle>{hero.nom || 'Héros sans nom'}</DialogTitle><DialogDescription>{localizeText("Fiche du héros conservée dans la salle, avec sa progression. Les héros disponibles peuvent être attribués ou choisis par les joueurs.")}</DialogDescription>
      <RoomHeroStateEditor hero={hero} />
      <nav className="flex flex-wrap gap-2" aria-label="Pages de la fiche">{(['identity', 'attributes', 'traits', 'state', 'notes', 'back'] as const).map((value, index) => <Button key={value} size="sm" variant={tab === value ? 'default' : 'outline'} onClick={() => setTab(value)}>{['Identité', 'Attributs', 'Équipement', 'État', 'Notes', 'Portrait'][index]}</Button>)}</nav>
      <div className="overflow-x-auto"><CharacterCards c={hero} activeCardTab={tab} /></div>
    </DialogContent></Dialog>
  </li>;
}
