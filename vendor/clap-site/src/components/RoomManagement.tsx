import {isLinkedSite} from '@owlbear/runtime/client';
import { localizeText, localizeNode } from '@/i18n/localize';
import { useEffect, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { Copy, Link2, Settings, Shield, Users, LogOut, Trash2, Crown, UserMinus, MoreVertical, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useRoom } from "@/hooks/use-room";
import { roomClient } from "@/lib/roomClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RoomHeroReserve from './RoomHeroReserve';
import RoomProjectImport from './RoomProjectImport';
import { loadCharacters, type Character } from '@/lib/characters';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
type Panel = "project" | "invitation" | "members" | "password" | "transfer" | "leave" | "heroes" | "owlbear";
const titles = { project: "Changer de projet", owlbear: "Relier Owlbear Rodeo", heroes: "Gérer les héros", invitation: "Inviter à la salle", members: "Membres de la salle", password: "Mot de passe de la salle", transfer: "Transmettre le rôle de MJ", leave: "Quitter la salle" };
export default function RoomManagement({ invitation, compact = false, onShowHeroes, onChooseHero, extraActions }: { invitation: string; compact?: boolean; onShowHeroes?: () => void; onChooseHero?: () => void; extraActions?: ReactNode }) {
  const room = useRoom();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [qr, setQr] = useState("");
  const [password, setPassword] = useState("");
  const [protectedRoom, setProtectedRoom] = useState(false);
  const [successor, setSuccessor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [owlbearCode, setOwlbearCode] = useState("");
  const [characters, setCharacters] = useState<Character[]>([]);
  useEffect(() => { if (panel === 'heroes') void loadCharacters().then(setCharacters).catch(() => setError('Impossible de charger les héros.')); }, [panel]);
  useEffect(() => { let active = true; if (panel === "invitation") void QRCode.toDataURL(invitation, { width: 224, margin: 3 }).then(value => { if (active) setQr(value); }).catch(() => {}); return () => { active = false; }; }, [panel, invitation]);
  if (!room.session) return null;
  const session = room.session;
  const isMJ = session.role === "mj";
  const open = (next: Panel) => { setPanel(next); setError(""); setNotice(""); setPassword(""); setProtectedRoom(Boolean(room.roomInfo?.locked)); };
  async function action(fn: () => Promise<void>, message = "") { setBusy(true); setError(""); setNotice(""); try { await fn(); setNotice(message); } catch (cause) { setError(cause instanceof Error ? cause.message : "Action impossible."); } finally { setBusy(false); } }
  async function copy(value: string) { try { await navigator.clipboard.writeText(value); toast.success(localizeText("Copié !")); } catch { setError("Copie indisponible. Sélectionne le lien pour le copier."); } }
  return <>
    <DropdownMenu><DropdownMenuTrigger asChild><Button data-tour="room-management" variant="outline" aria-label={localizeText(compact ? "Actions de la salle et du héros" : undefined)} className={compact ? "h-11 w-11 shrink-0 p-0" : undefined}>{localizeNode(compact ? <MoreVertical size={22} /> : <><Settings size={17} className="mr-2" />{localizeText("Gérer la salle")}</>)}</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-64 border-2 border-ink bg-paper p-2">
      {localizeNode(onShowHeroes && <DropdownMenuItem className="min-h-11 gap-3" onSelect={onShowHeroes}><Users size={17} />{localizeText("Héros de la salle")}</DropdownMenuItem>)}
      {localizeNode(onChooseHero && <DropdownMenuItem className="min-h-11 gap-3" onSelect={onChooseHero}><UserRound size={17} />{localizeNode(session.characterId ? "Changer de héros" : "Choisir mon héros")}</DropdownMenuItem>)}
      {localizeNode(isMJ && <DropdownMenuItem className="min-h-11 gap-3" onSelect={() => open('heroes')}><UserRound size={17} />{localizeText("Gérer les héros")}</DropdownMenuItem>)}
      {localizeNode(extraActions && <>{localizeNode(extraActions)}<DropdownMenuSeparator /></>)}
      {isLinkedSite() && <DropdownMenuItem className="min-h-11 gap-3" onSelect={() => open("invitation")}><Link2 size={17} />{localizeNode(compact ? "Inviter" : "Invitation")}</DropdownMenuItem>}
      <DropdownMenuItem className="min-h-11 gap-3" onSelect={() => open("members")}><Users size={17} />{localizeText("Membres de la salle")}</DropdownMenuItem>
      {localizeNode(isMJ && <>{isLinkedSite() && <DropdownMenuItem className="min-h-11 gap-3" onSelect={() => open("password")}><Shield size={17} />{localizeText("Modifier le mot de passe")}</DropdownMenuItem>}<DropdownMenuItem className="min-h-11 gap-3" onSelect={() => open("transfer")}><Crown size={17} />{localizeText("Transmettre le rôle de MJ")}</DropdownMenuItem></>)}
      {isMJ && <DropdownMenuItem className="min-h-11 gap-3" onSelect={() => { void roomClient.exportArchive().catch(cause => toast.error(localizeText(cause instanceof Error ? cause.message : 'Export impossible.'))); }}>{localizeText("Exporter la salle .clapSalle")}</DropdownMenuItem>}
      {isMJ && <DropdownMenuItem className="min-h-11 gap-3" onSelect={() => open('project')}><Settings size={17} />Changer de projet</DropdownMenuItem>}
      {isMJ && isLinkedSite() && <DropdownMenuItem className="min-h-11 gap-3" onSelect={() => open('owlbear')}><Link2 size={17} />{localizeText("Relier Owlbear Rodeo")}</DropdownMenuItem>}
      <DropdownMenuSeparator /><DropdownMenuItem className="min-h-11 gap-3 text-destructive" onSelect={() => open("leave")}>{localizeNode(isMJ ? <Trash2 size={17} /> : <LogOut size={17} />)}{localizeNode(isMJ ? "Fermer la salle" : "Quitter la salle")}</DropdownMenuItem>
    </DropdownMenuContent></DropdownMenu>
    <Dialog open={panel !== null} onOpenChange={value => { if (!value && !busy) setPanel(null); }}><DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto bg-paper">
      <DialogTitle className="pr-6 font-display text-3xl">{localizeNode(panel === "leave" && isMJ ? "Fermer la salle" : panel ? titles[panel] : "Gérer la salle")}</DialogTitle>
      <DialogDescription>{localizeNode(room.roomInfo?.title || "Votre salle de jeu")}</DialogDescription>
      {panel === "project" && isMJ && <RoomProjectImport management onComplete={() => setPanel(null)} />}
      {panel === 'owlbear' && isMJ && <div className="space-y-4"><p className="text-sm">Le code autorise les membres de ta salle Owlbear à rejoindre cette partie comme joueurs, sans leur communiquer le mot de passe. La salle sera masquée dans l’annuaire public du site.</p><p className="text-sm">Colle ensuite ce code dans l’extension CLAP! d’Owlbear. Pour piloter la partie depuis Owlbear comme MJ, utilise « Transmettre le rôle de MJ » après la connexion du participant Owlbear.</p><Button disabled={busy} onClick={() => void action(async () => { const result = await roomClient.createOwlbearInvite(); setOwlbearCode(result.code); })}>Générer un code de liaison</Button>{owlbearCode && <><Input aria-label="Code de liaison Owlbear" readOnly value={owlbearCode} onFocus={event => event.target.select()} /><Button variant="outline" onClick={() => void copy(owlbearCode)}>Copier le code</Button><p className="text-xs text-muted-foreground">Ce code donne uniquement un accès joueur. Le regénérer révoque le précédent. Il expire avec la fermeture de la salle.</p></>}</div>}
      {localizeNode(panel === 'heroes' && isMJ && <RoomHeroReserve characters={characters} />)}
      {localizeNode(panel === "invitation" && <div className="space-y-4"><p className="font-mono text-xl tracking-widest">{localizeNode(session.room)}</p><Button variant="outline" onClick={() => void copy(session.room)}><Copy size={15} className="mr-2" />{localizeText("Copier l’identifiant")}</Button><Input aria-label={localizeText("Lien d’invitation")} value={invitation} readOnly onFocus={event => event.target.select()} /><Button variant="outline" onClick={() => void copy(invitation)}>{localizeText("Copier le lien")}</Button>{localizeNode(qr && <img src={qr} alt={localizeText("QR code pour rejoindre la salle")} width={224} height={224} className="mx-auto" />)}<p className="text-sm text-muted-foreground">{localizeNode(room.roomInfo?.locked ? "Le mot de passe de la salle sera demandé aux invités." : "Les invités rejoignent la salle comme joueurs.")}</p></div>)}
      {panel === "members" && <ul className="divide-y divide-ink/15">{room.members.map(member => <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="break-all font-bold">{localizeNode(member.name)}{member.platform === 'owlbear' ? ' · Owlbear' : ''}{localizeNode(member.id === session.id ? " · toi" : "")}</p><p className="text-xs text-muted-foreground">{localizeNode(member.role === "mj" ? "MJ" : "Joueur")} · {localizeNode(member.id === session.id || member.online ? "Connecté" : "Absent")}</p></div>{localizeNode(isMJ && member.role === "player" && <Button variant="outline" disabled={busy} aria-label={localizeText(`Expulser ${member.name}`)} onClick={() => void action(() => roomClient.kickPlayer(member.id))}><UserMinus size={15} className="mr-2" />{localizeText("Expulser")}</Button>)}</li>)}</ul>}
      {localizeNode(panel === "password" && isMJ && <form className="space-y-4" onSubmit={event => { event.preventDefault(); void action(() => roomClient.changePassword(protectedRoom ? password : ""), protectedRoom ? "Mot de passe mis à jour." : "Protection retirée."); }}><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={protectedRoom} disabled={busy} onChange={event => setProtectedRoom(event.target.checked)} />{localizeText("Protéger la salle par un mot de passe")}</label>{localizeNode(protectedRoom && <div className="space-y-2"><label htmlFor="room-new-password" className="text-sm font-bold">{localizeText("Nouveau mot de passe")}</label><Input id="room-new-password" type="password" autoComplete="new-password" required maxLength={128} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></div>)}<p className="text-xs text-muted-foreground">{localizeText("Ce changement concerne les prochaines entrées dans la salle.")}</p><Button disabled={busy} type="submit">{localizeText("Enregistrer le mot de passe")}</Button></form>)}
      {panel === "transfer" && isMJ && <form className="space-y-4" onSubmit={event => { event.preventDefault(); void action(async () => { await roomClient.transferMJ(successor); setPanel(null); }); }}><p className="text-sm">{localizeText("Le joueur choisi devient le MJ de CLAP!. Pour une partie locale Owlbear, donne-lui d’abord le rôle MJ Owlbear.")}</p><label className="sr-only" htmlFor="room-successor">{localizeText("Nouveau MJ")}</label><select id="room-successor" required disabled={busy} value={successor} onChange={event => setSuccessor(event.target.value)} className="min-h-11 w-full border border-ink bg-paper px-3"><option value="">{localizeText("Choisir un joueur…")}</option>{room.members.filter(member => member.role === "player" && (isLinkedSite() || member.owlbearRole === 'GM') && room.connected.includes(member.id)).map(member => <option key={member.id} value={member.id}>{localizeNode(member.name)}{member.platform === 'owlbear' ? ' · Owlbear' : ''}</option>)}</select><Button type="submit" disabled={busy || !successor}>{localizeText("Transférer le rôle de MJ")}</Button></form>}
      {localizeNode(panel === "leave" && <div className="space-y-4"><p className="text-sm">{localizeNode(isMJ ? "La salle sera fermée pour les joueurs et sauvegardée sur cet appareil. Tu pourras la rouvrir depuis « Mes salles »." : "Tu vas quitter cette salle.")}</p><div className="flex flex-wrap gap-3"><Button variant="destructive" disabled={busy} onClick={() => void action(() => roomClient.leave())}>{localizeNode(isMJ ? "Fermer et sauvegarder" : "Quitter la salle")}</Button><Button variant="outline" disabled={busy} onClick={() => setPanel(null)}>{localizeText("Annuler")}</Button></div></div>)}
      {localizeNode(error && <p role="alert" className="text-sm text-destructive">{localizeNode(error)}</p>)}{localizeNode(notice && <p role="status" className="text-sm">{localizeNode(notice)}</p>)}
    </DialogContent></Dialog>
  </>;
}
