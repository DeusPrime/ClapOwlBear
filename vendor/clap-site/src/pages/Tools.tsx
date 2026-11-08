import useScrollList from "@/hooks/use-scroll-list";
import { ListLoading } from "@/components/ListLoading";
import PageTour from "@/components/PageTour";
import { localizeText, localizeNode } from '@/i18n/localize';
import { failExportProgress, withExportProgress } from "@/lib/exportProgress";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Download, FileDown, FileImage, Images, Plus, Search, Trash2, WandSparkles, Wrench } from "lucide-react";
import ToolPreview from "@/components/ToolPreview";
import { downloadBlob } from "@/lib/characterPng";
import AppHeader from "@/components/AppHeader";
import RoleTabs from "@/components/RoleTabs";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { activeDirectory, selectDirectory } from "@/lib/directories";
import { deleteToolDocument, emptyToolPayload, loadToolDocuments, saveToolDocument, TOOL_TYPES, toolUrl, type ToolDocument, type ToolKind } from "@/lib/toolDocuments";
import { exportClapProject } from "@/lib/clapProject";

const button = "inline-flex min-h-11 items-center justify-center gap-2 border-2 border-ink px-4 py-2 text-sm font-bold hover:bg-ink/5 disabled:opacity-50";
const toolIcon = (kind: ToolKind) => kind === "a4-sheets" ? Images : kind === "book-background" ? FileImage : WandSparkles;

export default function Tools() {
  const navigate = useNavigate();
  const [directoryId, setDirectoryId] = useState(activeDirectory);
  const [tools, setTools] = useState<ToolDocument[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState<ToolKind | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [exportChoice, setExportChoice] = useState<ToolDocument | null>(null);
  useEffect(() => {
    let disposed = false;
    void loadToolDocuments().then(items => { if (!disposed) setTools(items); })
      .catch(cause => { if (!disposed) setError(cause instanceof Error ? cause.message : "Chargement impossible."); })
      .finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, []);
  function changeDirectory(id: string) { selectDirectory(id); setDirectoryId(id); }
  function begin(kind: ToolKind) { setCreating(kind); setName(TOOL_TYPES.find(type => type.kind === kind)!.label); setMenuOpen(false); setError(""); }
  async function create() {
    if (!creating || !name.trim()) return;
    setBusy(true); setError("");
    try {
      const item = await saveToolDocument({ id: crypto.randomUUID(), directoryId, kind: creating, name, updatedAt: Date.now(), data: null });
      navigate(toolUrl(item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Création impossible."); }
    finally { setBusy(false); }
  }
  async function remove(tool: ToolDocument) {
    if (!confirm(localizeText(`Supprimer la ressource « ${tool.name} » et ses images enregistrées ?`))) return;
    setBusy(true); setError("");
    try { await deleteToolDocument(tool.id); setTools(items => items.filter(item => item.id !== tool.id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Suppression impossible."); }
    finally { setBusy(false); }
  }
  async function exportTool(tool: ToolDocument, format: "render" | "png-zip" = "render") {
    return withExportProgress(async () => {
      setBusy(true); setError("");
      try {
        const { exportToolResult } = await import("@/lib/toolOutput");
        const result = await exportToolResult(tool, format);
        downloadBlob(result.blob, result.name);
      } catch (cause) { failExportProgress(); setError(cause instanceof Error ? cause.message : "Export impossible."); }
      finally { setBusy(false); }
    });
  }
  async function exportClap(tool: ToolDocument) {
    return withExportProgress(async () => {
      setBusy(true); setError("");
      try {
        const bytes = await exportClapProject(tool.data ?? emptyToolPayload(tool.kind));
        downloadBlob(new Blob([bytes as BlobPart], { type: "application/zip" }), `${tool.name.replace(/[<>:"/\\|?*]/g, "_")}.clap`);
      } catch (cause) { failExportProgress(); setError(cause instanceof Error ? cause.message : "Export .clap impossible."); }
      finally { setBusy(false); }
    }, "Export .clap");
  }
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
  const items = tools.filter(tool => tool.directoryId === directoryId && normalize(tool.name).includes(normalize(search.trim()))).sort((a, b) => b.updatedAt - a.updatedAt);
  const list = useScrollList(items, `${directoryId}:${search}`);
  return <div className="min-h-screen bg-paper text-foreground">
    <AppHeader title={localizeText("Ressources")} directoryId={directoryId} onDirectoryChange={changeDirectory} />
    <main className="container pt-24 pb-44 sm:pt-8 sm:pb-16">
      <RoleTabs />
        <PageTour page="tools" />
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-5">
        <div>
          <p className="typewriter text-xs uppercase tracking-widest text-accent">{localizeText("Les coulisses de ta prochaine partie")}</p>
          <h1 className="mt-2 hidden items-center gap-3 font-display text-4xl uppercase sm:flex sm:text-5xl"><Wrench size={32} className="shrink-0" />{localizeText("Mes ressources")}</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">{localizeText("Retrouve les planches A4, couvertures et conversions de ce projet ou crée une nouvelle ressource.")}</p>
        </div>
        <div data-tour="create" className="hidden flex-wrap gap-2 sm:flex">{TOOL_TYPES.map(type => <button key={type.kind} type="button" className={button} onClick={() => begin(type.kind)}><Plus size={16} />{localizeNode(type.label)}</button>)}</div>
      </header>
      <label className="mb-6 flex min-h-11 items-center gap-3 border-2 border-ink bg-paper px-3"><Search size={18} /><input data-tour="search" type="search" aria-label={localizeText("Rechercher une ressource")} placeholder={localizeText("Rechercher une ressource")} value={search} onChange={event => setSearch(event.target.value)} className="min-h-11 min-w-0 flex-1 bg-transparent outline-none" /></label>
      <ListLoading loading={loading} />
      {localizeNode(error && !creating && <p role="alert" className="mb-4 text-destructive">{localizeNode(error)}</p>)}
      {localizeNode(!loading && !items.length && <div className="border-2 border-dashed border-ink/30 px-6 py-12 text-center"><Images size={36} className="mx-auto mb-4 opacity-50" /><p className="font-bold">{localizeNode(search ? "Aucune ressource ne correspond à la recherche." : "Aucune ressource dans ce projet.")}</p><p className="mt-2 text-sm text-foreground/65">{localizeText("Utilisez le bouton + pour créer une planche, une couverture ou une conversion.")}</p></div>)}
      <div style={{ scrollMarginTop: 80 }} ref={list.gridRef} aria-busy={loading || list.pending} className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">{list.items.map(tool => {
        return <article key={tool.id} className="paper-card relative overflow-hidden">
          <Link to={toolUrl(tool)} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink">
            <ToolPreview tool={tool} />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/65 to-transparent px-3 pb-16 pt-10 text-white sm:px-4"><h2 className="break-words font-display text-2xl leading-tight sm:text-3xl">{localizeNode(tool.name)}</h2></div>
          </Link>
          <div className="absolute inset-x-2 bottom-2 z-[3] grid grid-cols-3 gap-1.5 sm:inset-x-3 sm:bottom-3">
            <button type="button" disabled={busy || !tool.data?.images.length} aria-label={localizeText(`Exporter ${tool.name}`)} title={localizeText("Exporter le rendu")} className="flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-md border border-white/25 bg-black/60 px-1 py-1 text-white shadow-[2px_2px_0_rgba(0,0,0,0.35)] backdrop-blur transition-colors hover:bg-paper hover:text-foreground disabled:opacity-50" onClick={() => tool.kind === "a4-sheets" ? setExportChoice(tool) : void exportTool(tool)}><Download size={15} /><span className="text-[10px]">{localizeText("Export")}</span></button>
            <button type="button" disabled={busy} aria-label={localizeText(`Exporter ${tool.name} en .clap`)} title={localizeText("Exporter le fichier .clap")} className="flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-md border border-white/25 bg-black/60 px-1 py-1 text-white shadow-[2px_2px_0_rgba(0,0,0,0.35)] backdrop-blur transition-colors hover:bg-paper hover:text-foreground disabled:opacity-50" onClick={() => void exportClap(tool)}><FileDown size={15} /><span className="text-[10px]">{localizeText(".clap")}</span></button>
            <button type="button" disabled={busy} aria-label={localizeText(`Supprimer ${tool.name}`)} title={localizeText("Supprimer")} className="flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-md border border-white/25 bg-black/60 px-1 py-1 text-white shadow-[2px_2px_0_rgba(0,0,0,0.35)] backdrop-blur transition-colors hover:bg-paper hover:text-foreground disabled:opacity-50 hover:border-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => void remove(tool)}><Trash2 size={15} /><span className="text-[10px]">{localizeText("Suppr.")}</span></button>
          </div>
        </article>;
      })}</div>
      <div ref={list.endRef} className="min-h-1"><ListLoading loading={list.pending} /></div>
    </main>
    <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end sm:hidden">
      {menuOpen && <div role="group" aria-label={localizeText("Créer une ressource")} className="mb-2 grid w-56 gap-2 border-2 border-ink bg-paper p-2 shadow-[4px_4px_0_hsl(var(--ink))]">{TOOL_TYPES.map(type => { const Icon = toolIcon(type.kind); return <button key={type.kind} type="button" onClick={() => begin(type.kind)} className="flex min-h-10 items-center gap-2 border-2 border-ink/25 px-3 text-left text-xs font-bold uppercase tracking-widest hover:border-ink hover:bg-ink hover:text-background"><Icon size={15} className="shrink-0" />{localizeNode(type.label)}</button>; })}</div>}
      <button type="button" data-tour="create" aria-label={localizeText(menuOpen ? "Fermer la création de ressource" : "Ajouter une ressource")} aria-expanded={menuOpen} className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-ink bg-accent text-background shadow-[4px_4px_0_hsl(var(--ink))] transition-transform hover:-translate-y-0.5" onClick={() => setMenuOpen(open => !open)}><Plus size={28} strokeWidth={3} className={`transition-transform duration-200 ${menuOpen ? "rotate-45" : "rotate-0"}`} /></button>
    </div>
    <Dialog open={exportChoice !== null} onOpenChange={open => { if (!open) setExportChoice(null); }}><DialogContent className="bg-paper">
      <DialogTitle>{localizeText("Exporter la planche A4")}</DialogTitle>
      <DialogDescription>{localizeText("Choisissez le PDF à imprimer ou un ZIP contenant chaque recto en PNG, avec titre et stylisation, orienté pour la lecture.")}</DialogDescription>
      <div className="grid gap-3">
        <button type="button" className={button} onClick={() => { const tool = exportChoice; setExportChoice(null); if (tool) void exportTool(tool); }}><FileDown size={18} />{localizeText("PDF A4")}</button>
        <button type="button" className={`${button} bg-accent text-background`} onClick={() => { const tool = exportChoice; setExportChoice(null); if (tool) void exportTool(tool, "png-zip"); }}><Download size={18} />{localizeText("Rectos PNG (ZIP)")}</button>
      </div>
    </DialogContent></Dialog>
    <Dialog open={creating !== null} onOpenChange={open => { if (!open && !busy) setCreating(null); }}><DialogContent className="bg-paper"><DialogTitle>{localizeText("Créer une ressource")}</DialogTitle><DialogDescription>{localizeText("Cette nouvelle ressource sera enregistrée dans le projet actif.")}</DialogDescription><form className="space-y-4" onSubmit={event => { event.preventDefault(); void create(); }}><label className="block text-sm font-bold">{localizeText("Nom de la ressource")}<input autoFocus required maxLength={120} disabled={busy} value={name} onChange={event => setName(event.target.value)} className="mt-2 min-h-11 w-full border-2 border-ink bg-paper px-3 py-2" /></label>{localizeNode(error && <p role="alert" className="text-destructive">{localizeNode(error)}</p>)}<button type="submit" disabled={busy || !name.trim()} className={button}>{localizeNode(busy ? "Création…" : "Créer et ouvrir")}</button></form></DialogContent></Dialog>
  </div>;
}
