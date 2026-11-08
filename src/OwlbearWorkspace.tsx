import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useRoom } from "@/hooks/use-room";
import { useLang } from "@/i18n/LanguageContext";
import type { Character } from "@/lib/characters";
import { loadDirectories } from "@/lib/directories";
import { loadToolDocuments, toolUrl, type ToolDocument } from "@/lib/toolDocuments";
import CharacterEditor from "@/pages/CharacterEditor";
import RoomHeroReserve from "@/components/RoomHeroReserve";
import RoomPlayersBoard from "@/components/RoomPlayersBoard";
import RoomHeroProposalDialog from "@/components/RoomHeroProposalDialog";
import RoomPrivateResources from "@/components/RoomPrivateResources";
import RoomProjectImport from "@/components/RoomProjectImport";
import RoomChat from "@/components/RoomChat";
import RoomRollRequests from "@/components/RoomRollRequests";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function Resources() {
  const room = useRoom();
  const { lang } = useLang();
  const [items, setItems] = useState<ToolDocument[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = () => {
      const directories = new Set(loadDirectories().filter(d => d.roomKey === room.session?.localRoomId).map(d => d.id));
      void loadToolDocuments().then(tools => { if (active) setItems(tools.filter(tool => directories.has(tool.directoryId))); }).catch(() => { if (active) setError(lang === "fr" ? "Chargement impossible." : "Unable to load resources."); });
    };
    refresh(); window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [room.session?.localRoomId, room.session?.gameGeneration, lang]);
  return <section className="space-y-4"><h2 className="font-display text-3xl">{lang === "fr" ? "Ressources du projet" : "Project resources"}</h2>{error && <p role="alert">{error}</p>}{!items.length && <p>{lang === "fr" ? "Aucune ressource dans ce projet." : "No resources in this project."}</p>}<div className="grid gap-4 sm:grid-cols-2">{items.map(tool => <Link key={tool.id} to={toolUrl(tool)} className="border-2 border-ink p-4 hover:border-accent">{tool.preview && <img src={tool.preview} alt="" loading="lazy" className="mb-3 max-h-48 w-full object-contain" />}<span className="font-bold">{tool.name}</span></Link>)}</div></section>;
}
export function OwlbearMJWorkspace({ characters }: { characters: Character[] }) {
  const room = useRoom();
  const { lang } = useLang();
  const [pane, setPane] = useState("heroes");
  if (room.session?.role !== "mj") return null;
  return <Tabs value={pane} onValueChange={setPane} className="space-y-4">
    <nav aria-label="Navigation MJ"><TabsList className="grid h-auto w-full grid-cols-4 bg-paper p-0" aria-label={lang === "fr" ? "Onglets MJ" : "GM tabs"}>{[["heroes", "Héros", "Heroes"], ["cards", "Cartes", "Cards"], ["resources", "Ressources", "Resources"], ["chat", "Discussion", "Chat"]].map(([id, fr, en]) => <TabsTrigger key={id} value={id} className="min-h-12 rounded-none border-b-2 border-transparent px-1 data-[state=active]:border-accent data-[state=active]:text-accent">{lang === "fr" ? fr : en}</TabsTrigger>)}</TabsList></nav>
    <RoomHeroProposalDialog />
    <TabsContent value="heroes" className="space-y-5"><RoomProjectImport /><RoomHeroReserve characters={characters} /><RoomPlayersBoard characters={characters} /></TabsContent>
    <TabsContent value="cards"><RoomPrivateResources characters={characters} /></TabsContent>
    <TabsContent value="resources"><Resources /></TabsContent>
    <TabsContent value="chat"><RoomChat messages={room.messages} memberId={room.session.id} members={room.members} /></TabsContent>
  </Tabs>;
}
export function OwlbearPlayerWorkspace({ characters: _characters, invitation: _invitation }: { characters: Character[]; invitation: string }) {
  const room = useRoom();
  const { lang } = useLang();
  const [pane, setPane] = useState("hero");
  const [requestId, setRequestId] = useState<string>();
  const [heroView, setHeroView] = useState(0);
  const [draft, setDraft] = useState("");
  const [recipient, setRecipient] = useState("");
  if (room.session?.role !== "player") return null;
  const chat = <RoomChat messages={room.messages} memberId={room.session.id} members={room.members} draft={draft} onDraftChange={setDraft} recipient={recipient} onRecipientChange={setRecipient} />;
  const requests = <RoomRollRequests onPerform={id => { setRequestId(id); setPane("hero"); setHeroView(n => n + 1); }} />;
  return room.session.characterId ? <CharacterEditor key={room.session.characterId} characterId={room.session.characterId} primaryInRoom compactRoom roomDiscussion={chat} roomRequests={requests} roomRequestId={requestId} roomHeroViewKey={heroView} /> : <Tabs value={pane} onValueChange={setPane} className="px-4"><TabsList className="grid h-auto w-full grid-cols-2" aria-label={lang === "fr" ? "Onglets joueur" : "Player tabs"}><TabsTrigger value="hero" className="min-h-12">{lang === "fr" ? "Mon héros" : "My hero"}</TabsTrigger><TabsTrigger value="chat" className="min-h-12">{lang === "fr" ? "Discussion" : "Chat"}</TabsTrigger></TabsList>{requests}<TabsContent value="hero"><p className="border-2 border-dashed border-ink/25 p-8 text-center">{lang === "fr" ? "Ton héros apparaîtra ici. Le MJ peut t’attribuer une fiche." : "Your hero will appear here. The GM can assign you a sheet."}</p></TabsContent><TabsContent value="chat">{chat}</TabsContent></Tabs>;
}
