import { localizeText, localizeNode } from '@/i18n/localize';
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Dices, EyeOff, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { roomClient } from "@/lib/roomClient";
import type { RoomChatMessage, RoomMember } from "@/lib/roomProtocol";

export default function RoomChat({ messages, memberId, members = [], draft, onDraftChange, recipient, onRecipientChange }: { messages: RoomChatMessage[]; memberId: string; members?: RoomMember[]; draft?: string; onDraftChange?: (value: string) => void; recipient?: string; onRecipientChange?: (value: string) => void }) {
  const [localText, setLocalText] = useState("");
  const text = draft ?? localText;
  const setText = onDraftChange ?? setLocalText;
  const [localRecipient, setLocalRecipient] = useState("");
  const target = recipient ?? localRecipient;
  const setTarget = onRecipientChange ?? setLocalRecipient;
  const recipients = members.filter(member => member.id !== memberId);
  const targetMissing = Boolean(target && !recipients.some(member => member.id === target));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => { if (follow.current && list.current) list.current.scrollTop = list.current.scrollHeight; }, [lastId]);
  async function send(event: FormEvent) {
    event.preventDefault();
    if (sending || !text.trim()) return;
    if (targetMissing) { setError("Ce membre n’est plus dans la salle. Choisis un destinataire avant d’envoyer."); return; }
    setSending(true); setError("");
    try { if (target) await roomClient.sendChat(text.trim(), target); else await roomClient.sendChat(text.trim()); setText(""); follow.current = true; if (list.current) list.current.scrollTop = list.current.scrollHeight; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible d’envoyer le message."); }
    finally { setSending(false); }
  }
  return <section aria-labelledby="room-chat-title" className="room-chat min-w-0 border-2 border-ink bg-background/40">
    <div className="room-chat-heading border-b border-ink/20 p-5"><h2 id="room-chat-title" className="flex items-center gap-2 font-display text-3xl"><MessageSquare size={24} />{localizeText("Discussion de la salle")}</h2><p className="mt-1 text-xs text-muted-foreground">{localizeText("Discussion de table et murmures privés.")}</p></div>
    <div ref={list} role="log" aria-label={localizeText("Messages de la salle")} aria-live="polite" aria-relevant="additions" tabIndex={0} onScroll={() => { const element = list.current; if (element) follow.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; }} className="room-chat-messages h-80 space-y-4 overflow-y-auto overscroll-contain p-4 sm:h-96 sm:p-5">
      {!messages.length && <p className="py-10 text-center text-sm text-muted-foreground">{localizeText("La discussion commence ici. Écris le premier message !")}</p>}
      {messages.map(message => <article key={message.id} className={`max-w-[95%] rounded-sm border border-ink/15 p-3 sm:max-w-[85%] ${message.sender === memberId ? "ml-auto bg-ink/5" : "bg-paper"}`}>
        <div className="mb-1 flex flex-wrap items-baseline gap-x-2 text-xs"><span className="break-all font-bold">{message.name}{message.role === "mj" ? " · MJ" : ""}{message.sender === memberId ? " · toi" : ""}</span><time dateTime={new Date(message.created).toISOString()} className="text-muted-foreground">{new Date(message.created).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</time></div>
        {message.kind === "roll" && <p className="mb-1 flex items-center gap-2 text-xs font-bold text-accent"><Dices size={14} />{localizeText("Jet de dés")}</p>}
        {message.kind === "whisper" ? <p className="mb-1 flex items-center gap-2 text-xs font-bold text-accent"><EyeOff size={14} />{localizeText("Murmure privé · ")}{message.sender === memberId ? `pour ${members.find(member => member.id === message.privateTo)?.name || 'un membre absent'}` : 'pour toi'}</p> : Boolean(message.hidden) && <p className="mb-1 flex items-center gap-2 text-xs text-muted-foreground"><EyeOff size={14} />{localizeText("Jet privé · visible uniquement par toi")}</p>}
        {message.kind === "request" && <p className="mb-1 text-xs font-bold text-accent">{localizeText("Demande de jet")}</p>}
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{message.text}</p>
      </article>)}
    </div>
    <form onSubmit={send} className="room-chat-composer space-y-3 border-t border-ink/20 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="room-chat-message" className="block text-sm font-bold">{localizeText("Ton message")}</label>
        <select aria-label={localizeText("Destinataire du message")} value={target} disabled={sending} onChange={event => { setTarget(event.target.value); setError(""); }} className="min-h-10 min-w-0 max-w-full border border-ink/20 bg-paper px-2 text-xs">
          <option value="">{localizeText("Toute la salle")}</option>
          {localizeNode(targetMissing && <option value={target}>{localizeText("Membre indisponible")}</option>)}
          {recipients.map(member => <option key={member.id} value={member.id}>{localizeText("Murmurer à ")}{localizeNode(member.name)}{localizeNode(member.role === 'mj' ? ' · MJ' : '')}</option>)}
        </select>
      </div>
      <div className="flex items-stretch gap-2 md:items-end">
        <Textarea id="room-chat-message" required maxLength={2000} rows={3} placeholder={localizeText(target ? "Écris ton murmure…" : "Écris à ta table…")} value={text} disabled={sending} className="h-11 min-h-11 min-w-0 flex-1 resize-none md:h-auto md:min-h-[80px] md:resize-y" onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
        <Button type="submit" aria-label={localizeText(sending ? "Envoi…" : "Envoyer")} disabled={sending || !text.trim()} className="h-11 w-11 shrink-0 px-0 md:w-auto md:px-4"><Send size={16} /><span className="hidden md:inline">{localizeNode(sending ? "Envoi…" : "Envoyer")}</span></Button>
      </div>
      {localizeNode(error && <p role="alert" className="text-sm text-destructive">{localizeNode(error)}</p>)}
      <p className="hidden text-xs text-muted-foreground md:block">{localizeText("Entrée : envoyer · Maj + Entrée : nouvelle ligne")}</p>
    </form>
  </section>;
}
