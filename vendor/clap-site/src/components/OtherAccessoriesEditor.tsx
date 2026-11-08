import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { localizeText } from '@/i18n/localize';
import { richTextToPlainText } from '@/lib/richText';
import type { AutreAccessoire } from '@/lib/characters';

export default function OtherAccessoriesEditor({ items, onChange }: {
  items: AutreAccessoire[]; onChange: (items: AutreAccessoire[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const change = (index: number, patch: Partial<AutreAccessoire>) => onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item));
  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const count = Number(quantity);
    if (!title.trim() || !Number.isInteger(count) || count < 0 || count > 999999 || items.length >= 100) return;
    onChange([...items, { nom: title.trim(), proprietes: description.trim(), quantite: count }]);
    setOpen(false);
  };
  return <div>
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-display text-2xl">{localizeText('Autres accessoires')}</h2>
      <Button type="button" variant="outline" disabled={items.length >= 100} onClick={() => { setTitle(''); setDescription(''); setQuantity('1'); setOpen(true); }}><Plus size={16} />{localizeText('Ajouter un accessoire')}</Button>
    </div>
    <div className="space-y-4">
      {items.map((item, index) => <div key={index} className="space-y-3 border border-ink/25 p-3">
        <div className="flex items-end gap-3">
          <label className="min-w-0 flex-1 space-y-1 text-sm"><span>{localizeText('Titre')} {index + 1}</span><Input maxLength={100000} value={item.nom} onChange={event => change(index, { nom: event.target.value })} /></label>
          <label className="w-24 shrink-0 space-y-1 text-sm"><span>{localizeText('Quantité')} {index + 1}</span><Input type="number" min={0} max={999999} step={1} value={item.quantite ?? 1} onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value)) change(index, { quantite: Math.max(0, Math.min(999999, Math.floor(value))) }); }} /></label>
          <Button type="button" variant="ghost" size="icon" aria-label={`${localizeText('Supprimer un accessoire')} ${index + 1}`} onClick={() => onChange(items.filter((_, i) => i !== index))}><Trash2 size={16} /></Button>
        </div>
        <label className="block space-y-1 text-sm"><span>{localizeText('Description')} {index + 1}</span><Textarea rows={3} maxLength={100000} value={richTextToPlainText(item.proprietes)} onChange={event => change(index, { proprietes: event.target.value })} /></label>
      </div>)}
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto bg-paper">
        <DialogTitle>{localizeText('Ajouter un accessoire')}</DialogTitle>
        <DialogDescription>{localizeText('Renseigne le titre, la description et la quantité de cet accessoire.')}</DialogDescription>
        <form onSubmit={add} className="space-y-4">
          <label className="block space-y-1 text-sm"><span>{localizeText('Titre')}</span><Input required maxLength={100000} value={title} onChange={event => setTitle(event.target.value)} /></label>
          <label className="block space-y-1 text-sm"><span>{localizeText('Description')}</span><Textarea rows={4} maxLength={100000} value={description} onChange={event => setDescription(event.target.value)} /></label>
          <label className="block space-y-1 text-sm"><span>{localizeText('Quantité')}</span><Input required type="number" min={0} max={999999} step={1} value={quantity} onChange={event => setQuantity(event.target.value)} /></label>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>{localizeText('Annuler')}</Button><Button type="submit" disabled={!title.trim()}>{localizeText('Ajouter')}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}
