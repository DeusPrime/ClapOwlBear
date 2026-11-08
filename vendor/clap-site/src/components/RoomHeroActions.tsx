import { localizeText, localizeNode } from '@/i18n/localize';
import { useState, type ReactNode } from "react";
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "./ui/context-menu";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import RoomLibraryPicker from "./RoomLibraryPicker";
import { roomClient } from "@/lib/roomClient";
import type { Character } from "@/lib/characters";
import type { RoomMember } from "@/lib/roomProtocol";
import { useRoom } from "@/hooks/use-room";

export default function RoomHeroActions({ member, hero, onRoll, children, enabled, toolbar = false }: { member: RoomMember; hero?: Character; onRoll: () => void; children: ReactNode; enabled: boolean; toolbar?: boolean }) {
  const [action, setAction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState<"armes" | "armures" | "autresAccessoires">("autresAccessoires");
  const [text, setText] = useState("");
  const [item, setItem] = useState({ nom: "", proprietes: "", degats: "", protection: "", poids: "" });
  async function perform(task: () => Promise<void>) { setBusy(true); setError(""); try { await task(); setAction(""); setItem({ nom: "", proprietes: "", degats: "", protection: "", poids: "" }); setText(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Action impossible."); } finally { setBusy(false); } }
  const labels = { link: "Lier une carte", add: "Ajouter un objet", remove: "Supprimer un objet", unlink: "Supprimer une liaison", whisper: "Murmurer" };
  if (!enabled) return <>{children}</>;
  return <>
    {toolbar && <div className="flex flex-wrap gap-2">{Object.entries(labels).filter(([key]) => key !== 'whisper').map(([key, label]) => <Button key={key} size="sm" variant="outline" disabled={!hero || !member.online} onClick={() => { setAction(key); setError(''); }}>{label}</Button>)}</div>}
    <ContextMenu><ContextMenuTrigger asChild>{children}</ContextMenuTrigger><ContextMenuContent>
      {Object.entries(labels).filter(([key]) => key !== "whisper").map(([key, label]) => <ContextMenuItem key={key} disabled={!hero || !member.online} onSelect={() => { setAction(key); setError(""); }}>{localizeNode(label)}</ContextMenuItem>)}
      <ContextMenuItem disabled={!hero} onSelect={onRoll}>{localizeText("Déclencher un jet")}</ContextMenuItem>
      <ContextMenuItem onSelect={() => { setAction("whisper"); setError(""); }}>{localizeText("Murmurer")}</ContextMenuItem>
    </ContextMenuContent></ContextMenu>
    <Dialog open={Boolean(action)} onOpenChange={open => { if (!open && !busy) setAction(""); }}><DialogContent className="max-h-[90dvh] overflow-y-auto bg-paper"><DialogTitle>{localizeNode(labels[action as keyof typeof labels])} · {hero?.nom || member.name}</DialogTitle><DialogDescription>{localizeText("Action du MJ pour ")}{localizeNode(member.name)}.</DialogDescription>
      <fieldset disabled={busy} className="space-y-4">
        {localizeNode(action === "link" && <RoomLibraryPicker onSelect={async resource => { if (resource.type === "hero") return; setBusy(true); try { await roomClient.linkResource(member.id, resource); setAction(""); } finally { setBusy(false); } }} />)}
        {action === "add" && <form className="space-y-3" onSubmit={event => { event.preventDefault(); void perform(() => roomClient.heroAction(member.id, { type: "add-item", category, item })); }}>
          <label className="block text-sm">{localizeText("Catégorie")}<select className="mt-1 w-full border border-ink bg-paper p-2" value={category} onChange={event => setCategory(event.target.value as typeof category)}><option value="autresAccessoires">{localizeText("Objet / accessoire")}</option><option value="armes">{localizeText("Arme")}</option><option value="armures">{localizeText("Armure")}</option></select></label>
          {([['nom', 'Nom'], ['proprietes', 'Propriétés'], ...(category === 'armes' ? [['degats', 'Dégâts']] : category === 'armures' ? [['poids', 'Poids'], ['protection', 'Protection']] : [])] as [keyof typeof item, string][]).map(([key, label]) => <label key={key} className="block text-sm">{localizeNode(label)}<input required={key === "nom"} maxLength={key === "proprietes" ? 2000 : key === "nom" ? 300 : 100} value={item[key]} onChange={event => setItem(previous => ({ ...previous, [key]: event.target.value }))} className="mt-1 w-full border border-ink bg-paper p-2" /></label>)}
          <Button type="submit" disabled={busy || !item.nom.trim()}>{localizeText("Donner l’objet")}</Button>
        </form>}
        {action === "remove" && hero && <div className="space-y-2">{(["armes", "armures", "autresAccessoires"] as const).map(category => hero[category].map((item, index) => <Button key={`${category}:${index}`} variant="outline" className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => void perform(() => roomClient.heroAction(member.id, { type: "remove-item", category, index, expected: JSON.stringify(item) }))}>{localizeText("Retirer : ")}{item.nom || "Objet sans nom"}</Button>))}{localizeNode(![...hero.armes, ...hero.armures, ...hero.autresAccessoires].length && <p>{localizeText("Inventaire vide.")}</p>)}</div>}
        {action === "unlink" && hero && <div className="space-y-2">{hero.linkedResources.map(link => <UnlinkButton key={`${link.type}:${link.id}`} link={link} memberId={member.id} perform={perform} />)}{localizeNode(!hero.linkedResources.length && <p>{localizeText("Aucune carte liée.")}</p>)}</div>}
        {action === "whisper" && <form className="space-y-3" onSubmit={event => { event.preventDefault(); void perform(() => roomClient.sendChat(text.trim(), member.id)); }}><label className="block text-sm">{localizeText("Message privé pour ")}{localizeNode(member.name)}<textarea required maxLength={2000} rows={4} value={text} onChange={event => setText(event.target.value)} className="mt-1 w-full border border-ink bg-paper p-2" /></label><p className="text-xs text-muted-foreground">{localizeText("Seuls ce joueur et toi verrez ce message dans la discussion.")}</p><Button type="submit" disabled={busy || !text.trim()}>{localizeText("Envoyer le murmure")}</Button></form>}
      </fieldset>
      {localizeNode(busy && <p role="status">{localizeText("Transmission au joueur…")}</p>)}{localizeNode(error && <p role="alert" className="text-sm text-destructive">{localizeNode(error)}</p>)}
    </DialogContent></Dialog>
  </>;
}

function UnlinkButton({ link, memberId, perform }: { link: Character['linkedResources'][number]; memberId: string; perform: (task: () => Promise<void>) => Promise<void> }) {
  const room = useRoom();
  const resource = room.sheetResources[memberId]?.find(resource => resource.type === link.type && resource.item.id === link.id);
  return <Button variant="outline" className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => void perform(() => roomClient.heroAction(memberId, { type: 'unlink-resource', resourceType: link.type, id: link.id }))}>{localizeText("Délier : ")}{resource?.item.titre || link.type}</Button>;
}
