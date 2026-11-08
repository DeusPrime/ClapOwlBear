import useScrollList from "@/hooks/use-scroll-list";
import { ListLoading } from "@/components/ListLoading";
import PageTour from "@/components/PageTour";
import { localizeText, localizeNode } from '@/i18n/localize';
import UseHeroInRoom from "@/components/UseHeroInRoom";
import { failExportProgress, reportExportProgress, exportRange, withExportProgress } from "@/lib/exportProgress";
import AppHeader from "@/components/AppHeader";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { Archive, Check, Download, FileText, Plus, Search, Trash2, Upload, UserCircle, X } from "lucide-react";
import RoleTabs from "@/components/RoleTabs";
import {
  Character,
  blankCharacter,
  deleteCharacter,
  loadCharacters,
  upsertCharacter,
} from "@/lib/characters";
import { downloadBlob, exportCharacterPng, importCharacterPng } from "@/lib/characterPng";
import { importCharacterPdf, renderCharacterPdf } from "@/lib/characterPdf";
import { renderHeroCardsA6PdfFromView } from "@/lib/heroCardsExport";
import ExportLoader from "@/components/ExportLoader";
import { activeDirectory, moveToDirectory, selectDirectory } from "@/lib/directories";
import BulkDirectoryButton from "@/components/BulkDirectoryButton";
import CardTilt from "@/components/CardTilt";

const safeFileName = (name: string, fallback = "personnage") =>
  (name || fallback)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_") || fallback;

const uniqueFileName = (baseName: string, extension: string, usedNames: Set<string>) => {
  let filename = `${baseName}.${extension}`;
  let index = 2;
  while (usedNames.has(filename)) {
    filename = `${baseName}_${index}.${extension}`;
    index += 1;
  }
  usedNames.add(filename);
  return filename;
};

const CharactersList = () => {
  const [loading, setLoading] = useState(true);
  const [chars, setChars] = useState<Character[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState<"png" | "pdf" | "delete" | "directory" | null>(null);
  const [singleExportBusy, setSingleExportBusy] = useState<"png" | "pdf" | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [directoryId, setDirectoryId] = useState(activeDirectory);
  const changeDirectory = (id: string) => { selectDirectory(id); setDirectoryId(id); setSelectedIds(new Set()); };
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const dragDepth = useRef(0);
  const refreshSequence = useRef(0);

  const selectedCharacters = chars.filter((c) => selectedIds.has(c.id));
  const selectionMode = selectedIds.size > 0;
  const normalizedQuery = query.trim().toLocaleLowerCase("fr");
  const filteredChars = chars.filter(character => character.directoryId === directoryId && (!normalizedQuery || (character.nom || "").toLocaleLowerCase("fr").includes(normalizedQuery)));
  const list = useScrollList(filteredChars, `${directoryId}:${normalizedQuery}`);
  const allFilteredSelected = filteredChars.length > 0 && filteredChars.every(character => selectedIds.has(character.id));

  const refresh = async () => {
    const sequence = ++refreshSequence.current;
    setLoading(true);
    try {
      const characters = await loadCharacters(directoryId);
      if (sequence === refreshSequence.current) setChars(characters.sort((a, b) => b.updatedAt - a.updatedAt));
    } finally { if (sequence === refreshSequence.current) setLoading(false); }
  };

  useEffect(() => {
    document.title = "Héros — Clap & Role";
    void refresh();
    return () => { refreshSequence.current++; };
  }, [directoryId]);


  const createNew = async () => {
    const c = blankCharacter();
    await upsertCharacter(c);
    navigate(`/characters/${c.id}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(localizeText("Supprimer ce personnage ?"))) return;
    await deleteCharacter(id);
    setSelectedIds((cur) => {
      const next = new Set(cur);
      next.delete(id);
      return next;
    });
    void refresh();
  };

  const handleExportPng = async (c: Character) => {
    return withExportProgress(async () => {
      setSingleExportBusy("png");
      try {
        const blob = await exportCharacterPng(c);
        downloadBlob(blob, `${safeFileName(c.nom)}.png`);
      } finally {
        setSingleExportBusy(null);
      }
    });
  };

  const handleExportPdf = async (c: Character) => {
    return withExportProgress(async () => {
      setSingleExportBusy("pdf");
      try {
        const blob = await renderHeroCardsA6PdfFromView(c);
        downloadBlob(blob, `${safeFileName(c.nom)}_cartes_A6.pdf`);
      } catch (error) { failExportProgress();
        console.error(error);
        alert(localizeText("Impossible de g?n?rer le PDF A6." + (error instanceof Error ? "\n" + error.message : "")));
      } finally {
        setSingleExportBusy(null);
      }
    });
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());
  const directorySelection = async (directoryId: string) => {
    const changed = moveToDirectory(selectedCharacters, directoryId);
    setBulkBusy("directory");
    try { for (const character of changed) await upsertCharacter(character); await refresh(); clearSelection(); }
    finally { setBulkBusy(null); }
  };

  const handleTileClick = (id: string) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    if (selectionMode) {
      toggleSelected(id);
      return;
    }
    navigate(`/characters/${id}`);
  };

  const startLongPress = (id: string) => {
    longPressTriggered.current = false;
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      toggleSelected(id);
    }, 520);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const exportSelectionZip = async (format: "png" | "pdf") => {
    return withExportProgress(async () => {
      if (selectedCharacters.length === 0) return;
      setBulkBusy(format);
      try {
        const zip = new JSZip();
        const usedNames = new Set<string>();
        for (const [exportIndex, c] of selectedCharacters.entries()) {
          reportExportProgress(10 + exportIndex / selectedCharacters.length * 65);
          const baseName = safeFileName(c.nom);
          const blob = await exportRange(10 + exportIndex / selectedCharacters.length * 65, 10 + (exportIndex + 1) / selectedCharacters.length * 65, async () => format === "png" ? exportCharacterPng(c) : renderCharacterPdf(c));
          zip.file(uniqueFileName(baseName, format, usedNames), blob);
        }
        const blob = await zip.generateAsync({ type: "blob" }, metadata => reportExportProgress(75 + metadata.percent * .25));
        downloadBlob(blob, `clap_personnages_${format}.zip`);
      } finally {
        setBulkBusy(null);
      }
    });
  };

  const deleteSelection = async () => {
    if (selectedCharacters.length === 0) return;
    if (!confirm(localizeText(`Supprimer ${selectedCharacters.length} personnage${selectedCharacters.length > 1 ? "s" : ""} ?`))) return;
    setBulkBusy("delete");
    try {
      await Promise.all(selectedCharacters.map((c) => deleteCharacter(c.id)));
      clearSelection();
      void refresh();
    } finally {
      setBulkBusy(null);
    }
  };

  const importCharacterFile = async (file: File) => {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const character = isPdf ? await importCharacterPdf(file) : await importCharacterPng(file);
    return { character, isPdf };
  };

  const importFile = async (file: File) => {
    const { character, isPdf } = await importCharacterFile(file);
    if (!character) {
      alert(localizeText(isPdf ? "Ce PDF ne contient pas de fiche Clap & Role lisible." : "Ce PNG ne contient pas de fiche Clap & Role."));
      return false;
    }
    character.directoryId = directoryId;
    character.id = crypto.randomUUID();
    character.updatedAt = Date.now();
    await upsertCharacter(character);
    return true;
  };

  const importFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setImportBusy(true);
    try {
      let imported = 0;
      for (const file of list) {
        if (await importFile(file)) imported += 1;
      }
      if (imported > 0) void refresh();
    } finally {
      setImportBusy(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) await importFiles(e.target.files);
    e.target.value = "";
  };

  const handleDragEnter = (event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  };

  const handleDragOver = (event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    if (event.dataTransfer.files) await importFiles(event.dataTransfer.files);
  };

  return (
    <div className="min-h-screen bg-paper text-foreground" onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      <ExportLoader visible={singleExportBusy !== null || bulkBusy === "png" || bulkBusy === "pdf"} label={localizeText((singleExportBusy ?? bulkBusy) === "pdf" ? "Export PDF" : "Export PNG")} />
      {localizeNode((dragActive || importBusy) && (
        <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-background/75 p-4 backdrop-blur-sm">
          <div
            className={`flex min-h-64 w-full max-w-xl flex-col items-center justify-center gap-4 border-2 border-dashed px-6 py-10 text-center shadow-[6px_6px_0_hsl(var(--ink))] ${
              dragActive ? "border-accent bg-paper" : "border-ink bg-paper"
            }`}
          >
            <Upload size={42} strokeWidth={2.5} className="text-accent" />
            <div>
              <p className="font-display text-3xl leading-none">{localizeNode(importBusy ? "Import en cours" : "Deposer les fiches")}</p>
              <p className="mt-2 typewriter text-sm text-foreground/65">
                {localizeNode(importBusy ? "Lecture des fiches Clap & Role..." : "PNG ou PDF de heros. Depose dans la fenetre pour importer.")}
              </p>
            </div>
          </div>
        </div>
      ))}
      <AppHeader title={localizeText("Héros")} directoryId={directoryId} onDirectoryChange={changeDirectory} />
      <input ref={fileInput} type="file" accept="image/png,application/pdf,.pdf" multiple className="hidden" onChange={handleImport} />

      <main className="container pt-24 pb-28 sm:pt-8 sm:pb-12">

        <RoleTabs />
        <PageTour page="heroes" />
        <header className="mb-8 border-b-2 border-ink pb-5">
          <p className="typewriter text-xs uppercase tracking-widest text-accent">{localizeText("Les premiers rôles de ton histoire")}</p>
          <h1 className="mt-2 hidden items-center gap-3 font-display text-4xl uppercase sm:flex sm:text-5xl"><UserCircle size={32} className="shrink-0" />{localizeText("Mes héros")}</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">{localizeText("Retrouve les héros de ce projet ou crée un nouveau personnage pour ta prochaine partie.")}</p>
        </header>


        {selectionMode && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-2 border-ink bg-paper-dark/70 px-4 py-3 shadow-[4px_4px_0_hsl(var(--ink))]">
            <div className="flex items-center gap-2 typewriter text-sm font-bold uppercase tracking-widest">
              <Check size={16} />
              {localizeNode(selectedIds.size)}{localizeText(" selectionné")}{localizeNode(selectedIds.size > 1 ? "s" : "")}
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
              <button type="button" disabled={!filteredChars.length || bulkBusy !== null} onClick={() => setSelectedIds(allFilteredSelected ? new Set() : new Set(filteredChars.map(character => character.id)))} className="flex min-h-10 items-center gap-2 border-2 border-ink px-3 py-2 typewriter text-xs hover:bg-ink hover:text-background disabled:opacity-50">{localizeNode(allFilteredSelected ? <X size={14} /> : <Check size={14} />)}{localizeNode(allFilteredSelected ? "Tout désélectionner" : "Tout sélectionner")}</button>
              <BulkDirectoryButton count={selectedCharacters.length} disabled={bulkBusy !== null} onApply={directorySelection} />
              <button
                type="button"
                disabled={bulkBusy !== null}
                onClick={() => void exportSelectionZip("png")}
                className="flex min-h-10 items-center justify-center gap-1.5 px-3 py-2 border-2 border-ink text-xs font-bold uppercase tracking-widest hover:bg-ink hover:text-background disabled:opacity-50"
              >
                <Archive size={14} />{localizeText(" ZIP PNG ")}</button>
              <button
                type="button"
                disabled={bulkBusy !== null}
                onClick={() => void exportSelectionZip("pdf")}
                className="flex min-h-10 items-center justify-center gap-1.5 px-3 py-2 border-2 border-ink text-xs font-bold uppercase tracking-widest hover:bg-ink hover:text-background disabled:opacity-50"
              >
                <Archive size={14} />{localizeText(" ZIP PDF ")}</button>
              <button
                type="button"
                disabled={bulkBusy !== null}
                onClick={() => void deleteSelection()}
                className="flex min-h-10 items-center justify-center gap-1.5 px-3 py-2 border-2 border-destructive text-xs font-bold uppercase tracking-widest text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
              >
                <Trash2 size={14} />{localizeText(" Supprimer ")}</button>
              <button
                type="button"
                disabled={bulkBusy !== null}
                onClick={clearSelection}
                className="flex min-h-10 items-center justify-center gap-1.5 px-3 py-2 border-2 border-transparent text-xs font-bold uppercase tracking-widest hover:text-accent disabled:opacity-50"
                aria-label={localizeText("Annuler la sélection")}
              >
                <X size={14} />{localizeText(" Annuler ")}</button>
            </div>
          </div>
        )}

        <div className="mb-6 flex items-start gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/45" />
            <input
              data-tour="search" value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={localizeText("Rechercher un héros par nom")}
              className="h-12 w-full border-2 border-ink bg-paper pl-10 pr-3 typewriter text-sm outline-none focus:border-accent"
            />
          </div>
          <div className="relative hidden shrink-0 sm:block">
            <button
              type="button"
              data-tour="create" onClick={() => setCreateMenuOpen((open) => !open)}
              aria-expanded={createMenuOpen}
              className="flex h-12 items-center justify-center gap-2 border-2 border-ink bg-accent px-5 text-xs font-bold uppercase tracking-widest text-background shadow-[3px_3px_0_hsl(var(--ink))] hover:opacity-90"
            >
              <Plus size={18} strokeWidth={3} />{localizeText(" Ajouter ")}</button>
            {localizeNode(createMenuOpen && (
              <div className="absolute right-0 top-full z-30 mt-2 grid w-56 gap-2 border-2 border-ink bg-paper p-2 shadow-[4px_4px_0_hsl(var(--ink))]">
                <button
                  type="button"
                  onClick={() => {
                    setCreateMenuOpen(false);
                    void createNew();
                  }}
                  className="flex min-h-10 items-center gap-2 border-2 border-ink/25 px-3 text-left text-xs font-bold uppercase tracking-widest hover:border-ink hover:bg-ink hover:text-background"
                >
                  <Plus size={15} />{localizeText(" Créer un héros ")}</button>
                <button
                  type="button"
                  onClick={() => {
                    setCreateMenuOpen(false);
                    fileInput.current?.click();
                  }}
                  className="flex min-h-10 items-center gap-2 border-2 border-ink/25 px-3 text-left text-xs font-bold uppercase tracking-widest hover:border-ink hover:bg-ink hover:text-background"
                >
                  <Upload size={15} />{localizeText(" À partir d'un fichier ")}</button>
              </div>
            ))}
          </div>
        </div>

        <ListLoading loading={loading} />
        <div style={{ scrollMarginTop: 80 }} ref={list.gridRef} aria-busy={loading || list.pending} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {list.items.map((c) => {
            const selected = selectedIds.has(c.id);
            return (
              <article
                key={c.id}
                className={`relative overflow-visible flex flex-col transition-transform ${
                  selectionMode ? "tile-wiggle" : ""
                } ${selected ? "ring-4 ring-accent" : ""}`}
              >
                <CardTilt disabled={selectionMode}>
                <button
                  type="button"
                  onClick={() => handleTileClick(c.id)}
                  onPointerDown={() => startLongPress(c.id)}
                  onPointerUp={cancelLongPress}
                  onPointerCancel={cancelLongPress}
                  onPointerLeave={cancelLongPress}
                  className="block aspect-[3/4] w-full overflow-hidden rounded-[18px] border-[10px] bg-paper-dark relative text-left shadow-[0_10px_18px_rgba(0,0,0,0.22)]"
                  style={{ borderColor: c.cardInk || "#3a1307" }}
                  aria-pressed={selected}
                >
                  {c.portrait ? (
                    <img src={c.portrait} alt={localizeText(c.nom)} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover object-top" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#160d08] text-white/35">
                      <UserCircle size={96} />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex min-h-[4.8rem] items-center justify-center bg-black px-3 py-3 text-center text-white">
                    <h3 className="font-display text-2xl leading-none uppercase break-words">{c.nom || localizeText("Sans nom")}</h3>
                  </div>
                  {localizeNode(selectionMode && (
                    <span
                      className={`absolute right-14 top-3 flex h-9 w-9 items-center justify-center border-2 border-ink bg-paper text-foreground shadow-[2px_2px_0_hsl(var(--ink))] ${
                        selected ? "bg-accent text-background" : ""
                      }`}
                      aria-hidden="true"
                    >
                      {localizeNode(selected && <Check size={18} strokeWidth={3} />)}
                    </span>
                  ))}
                </button>

                </CardTilt>
                {localizeNode(!selectionMode && <UseHeroInRoom characterId={c.id} />)}

                <div className="mt-2 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    aria-label={localizeText("Supprimer")}
                    title={localizeText("Supprimer")}
                    onClick={() => handleDelete(c.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-ink/20 bg-black/65 text-white shadow-[2px_2px_0_rgba(0,0,0,0.28)] transition-colors hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={localizeText("Exporter PNG")}
                    title={localizeText("Exporter PNG")}
                    onClick={() => void handleExportPng(c)}
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-ink/20 bg-black/65 text-white shadow-[2px_2px_0_rgba(0,0,0,0.28)] transition-colors hover:bg-paper hover:text-foreground"
                  >
                    <Download size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={localizeText("Exporter PDF A6")}
                    title={localizeText("Exporter PDF A6")}
                    onClick={() => void handleExportPdf(c)}
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-ink/20 bg-black/65 text-white shadow-[2px_2px_0_rgba(0,0,0,0.28)] transition-colors hover:bg-paper hover:text-foreground"
                  >
                    <FileText size={15} />
                  </button>
                </div>
              </article>
            );
          })}
          <article className="hidden">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`block aspect-[3/4] w-full relative overflow-hidden border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-3 ${
                dragOver ? "border-accent bg-accent/10" : "border-ink/40 bg-paper-dark/30 hover:border-accent hover:bg-accent/5"
              }`}
            >
              <Upload size={40} className="opacity-60" />
              <div className="typewriter text-xs uppercase tracking-widest font-bold">{localizeText("Déposer des PNG/PDF")}</div>
              <div className="typewriter text-[10px] text-foreground/60">{localizeText("ou cliquer pour parcourir")}</div>
            </button>
          </article>
        </div>

        <div ref={list.endRef} className="min-h-1"><ListLoading loading={list.pending} /></div>
        {!loading && filteredChars.length === 0 && (
          <div className="mt-8 border-2 border-dashed border-ink/30 p-4 typewriter text-sm text-foreground/65">{localizeText(" Aucun héros ne correspond à ce nom. ")}</div>
        )}
      </main>

      <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end sm:hidden">
        {localizeNode(createMenuOpen && (
          <div className="mb-2 grid w-56 gap-2 border-2 border-ink bg-paper p-2 shadow-[4px_4px_0_hsl(var(--ink))]">
            <button
              type="button"
              onClick={() => {
                setCreateMenuOpen(false);
                void createNew();
              }}
              className="flex min-h-10 items-center gap-2 border-2 border-ink/25 px-3 text-left text-xs font-bold uppercase tracking-widest hover:border-ink hover:bg-ink hover:text-background"
            >
              <Plus size={15} />{localizeText(" Créer un héros ")}</button>
            <button
              type="button"
              onClick={() => {
                setCreateMenuOpen(false);
                fileInput.current?.click();
              }}
              className="flex min-h-10 items-center gap-2 border-2 border-ink/25 px-3 text-left text-xs font-bold uppercase tracking-widest hover:border-ink hover:bg-ink hover:text-background"
            >
              <Upload size={15} />{localizeText(" À partir d'un fichier ")}</button>
          </div>
        ))}
        <button
          type="button"
          data-tour="create" onClick={() => setCreateMenuOpen((open) => !open)}
          aria-label={localizeText("Ajouter un héros")}
          aria-expanded={createMenuOpen}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-ink bg-accent text-background shadow-[4px_4px_0_hsl(var(--ink))] transition-transform hover:-translate-y-0.5"
        >
          <Plus size={28} strokeWidth={3} className={`transition-transform duration-200 ${createMenuOpen ? "rotate-45" : "rotate-0"}`} />
        </button>
      </div>
    </div>
  );
};

export default CharactersList;
