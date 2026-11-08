import { localizeText, localizeNode } from '@/i18n/localize';
import { withExportProgress } from "@/lib/exportProgress";
import DirectoryMenu from "@/components/DirectoryMenu";
import { activeDirectory, selectDirectory } from "@/lib/directories";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Check, Download, FileText, Plus, Trash2, Upload, X } from "lucide-react";
import RoleTabs from "@/components/RoleTabs";
import PowerIcon from "@/components/PowerIcon";
import { Power, blankPower, deletePower, loadPowers, upsertPower } from "@/lib/powers";
import { downloadBlob } from "@/lib/characterPng";
import { exportPowerPng, exportPowersA4Pdf, importPowerPng } from "@/lib/powerPng";

const safeFileName = (name: string, fallback = "pouvoir") =>
  (name || fallback)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_") || fallback;

const PowersList = () => {
  const [allItems, setRoles] = useState<Power[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [directoryId, setDirectoryId] = useState(activeDirectory);
  const roles = allItems.filter(item => item.directoryId === directoryId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState<"pdf" | "delete" | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const navigate = useNavigate();

  const selectedRoles = roles.filter((r) => selectedIds.has(r.id));
  const selectionMode = selectedIds.size > 0;

  const refresh = async () => {
    const items = await loadPowers();
    setRoles(items.sort((a, b) => b.updatedAt - a.updatedAt));
  };

  useEffect(() => {
    document.title = "Pouvoirs — Clap & Role";
    void refresh();
  }, []);

  const createNew = async () => {
    const role = blankPower();
    await upsertPower(role);
    navigate(`/pouvoirs/${role.id}/edit`);
  };

  const handleExport = async (role: Power) => {
    return withExportProgress(async () => {
      const blob = await exportPowerPng(role);
      downloadBlob(blob, `${safeFileName(role.titre)}.png`);
    });
  };

  const handleExportPdf = async (role: Power) => {
    return withExportProgress(async () => {
      const blob = await exportPowersA4Pdf([role]);
      downloadBlob(blob, `${safeFileName(role.titre)}.pdf`);
    });
  };

  const handleDelete = async (role: Power) => {
    if (!confirm(localizeText(`Supprimer ${role.titre || "ce pouvoir"} ?`))) return;
    await deletePower(role.id);
    setSelectedIds((cur) => {
      const next = new Set(cur);
      next.delete(role.id);
      return next;
    });
    void refresh();
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

  const handleTileClick = (id: string) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    if (selectionMode) {
      toggleSelected(id);
      return;
    }
    navigate(`/pouvoirs/${id}`);
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

  const exportSelectionPdf = async () => {
    return withExportProgress(async () => {
      if (selectedRoles.length === 0) return;
      setBulkBusy("pdf");
      try {
        const blob = await exportPowersA4Pdf(selectedRoles);
        downloadBlob(blob, `clap_pouvoirs_a4.pdf`);
      } finally {
        setBulkBusy(null);
      }
    });
  };

  const deleteSelection = async () => {
    if (selectedRoles.length === 0) return;
    if (!confirm(localizeText(`Supprimer ${selectedRoles.length} pouvoir${selectedRoles.length > 1 ? "s" : ""} ?`))) return;
    setBulkBusy("delete");
    try {
      await Promise.all(selectedRoles.map((r) => deletePower(r.id)));
      clearSelection();
      void refresh();
    } finally {
      setBulkBusy(null);
    }
  };

  const importFile = async (file: File) => {
    const role = await importPowerPng(file);
    if (!role) {
      alert(localizeText("Ce PNG ne contient pas de pouvoir Clap & Role."));
      return false;
    }
    role.id = crypto.randomUUID();
    role.updatedAt = Date.now();
    await upsertPower(role);
    return true;
  };

  const importFiles = async (files: FileList | File[]) => {
    let imported = 0;
    for (const file of Array.from(files)) {
      if (await importFile(file)) imported += 1;
    }
    if (imported > 0) void refresh();
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) await importFiles(event.target.files);
    event.target.value = "";
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    if (event.dataTransfer.files) await importFiles(event.dataTransfer.files);
  };

  return (
    <div className="min-h-screen bg-paper text-foreground">
      <header className="border-b border-ink bg-paper/95 backdrop-blur fixed inset-x-0 sm:sticky top-0 z-40">
        <div className="container flex items-center justify-between h-16">
          <DirectoryMenu value={directoryId} onChange={id => { selectDirectory(id); setDirectoryId(id); setSelectedIds(new Set()); }} />
          <h1 className="font-display text-2xl tracking-wider md:text-3xl">{localizeText("Mes Pouvoirs")}</h1>
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="w-10 shrink-0" />
            <input ref={fileInput} type="file" accept="image/png" multiple className="hidden" onChange={handleImport} />
          </div>
        </div>
      </header>

      <main className="container pt-28 pb-12 sm:pt-12 pb-28 sm:pb-12">

        <RoleTabs />

        {localizeNode(selectionMode && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-2 border-ink bg-paper-dark/70 px-4 py-3 shadow-[4px_4px_0_hsl(var(--ink))]">
            <div className="flex items-center gap-2 typewriter text-sm font-bold uppercase tracking-widest">
              <Check size={16} />
              {localizeNode(selectedIds.size)}{localizeText(" selectionné")}{localizeNode(selectedIds.size > 1 ? "s" : "")}
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
              <button
                type="button"
                disabled={bulkBusy !== null}
                onClick={() => void exportSelectionPdf()}
                className="flex min-h-10 items-center justify-center gap-1.5 px-3 py-2 border-2 border-ink text-xs font-bold uppercase tracking-widest hover:bg-ink hover:text-background disabled:opacity-50"
              >
                <FileText size={14} />{localizeText(" PDF A4 ")}</button>
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
        ))}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.map((role) => {
            const selected = selectedIds.has(role.id);
            return (
              <article
                key={role.id}
                className={`paper-card relative overflow-hidden flex flex-col transition-transform ${
                  selectionMode ? "tile-wiggle" : ""
                } ${selected ? "ring-4 ring-accent" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => handleTileClick(role.id)}
                  onPointerDown={() => startLongPress(role.id)}
                  onPointerUp={cancelLongPress}
                  onPointerCancel={cancelLongPress}
                  onPointerLeave={cancelLongPress}
                  className="block aspect-[3/4] w-full bg-paper-dark relative overflow-hidden text-left"
                  aria-pressed={selected}
                >
                  {role.image ? (
                    <img src={role.image} alt={localizeText(role.titre)} className="absolute inset-0 h-full w-full origin-top -translate-y-[3%] scale-110 object-cover object-top" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <PowerIcon size={54} className="opacity-30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 pb-14 text-white">
                    <h3 className="font-display text-2xl leading-tight">{role.titre || localizeText("Sans nom")}</h3>
                    {role.description && <p className="typewriter text-xs opacity-80 mt-1 line-clamp-2">{role.description}</p>}
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
                <div className="absolute right-2 top-2 z-[3] sm:right-3 sm:top-3">
                  <button
                    type="button"
                    aria-label={localizeText("Supprimer")}
                    title={localizeText("Supprimer")}
                    onClick={() => void handleDelete(role)}
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-white/20 bg-black/35 text-white/85 shadow-[2px_2px_0_rgba(0,0,0,0.3)] backdrop-blur transition-colors hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="absolute bottom-2 right-2 z-[2] flex items-center gap-1.5 sm:bottom-3 sm:right-3">
                  <button
                    type="button"
                    aria-label={localizeText("Exporter PNG")}
                    title={localizeText("Exporter PNG")}
                    onClick={() => void handleExport(role)}
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-white/25 bg-black/45 text-white shadow-[2px_2px_0_rgba(0,0,0,0.35)] backdrop-blur transition-colors hover:bg-paper hover:text-foreground"
                  >
                    <Download size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={localizeText("Exporter PDF A4")}
                    title={localizeText("Exporter PDF A4")}
                    onClick={() => void handleExportPdf(role)}
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-white/25 bg-black/45 text-white shadow-[2px_2px_0_rgba(0,0,0,0.35)] backdrop-blur transition-colors hover:bg-paper hover:text-foreground"
                  >
                    <FileText size={15} />
                  </button>
                </div>
              </article>
            );
          })}

          <article className="paper-card overflow-hidden flex flex-col">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`block aspect-[3/4] w-full relative overflow-hidden border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-3 ${
                dragOver ? "border-accent bg-accent/10" : "border-ink/40 bg-paper-dark/30 hover:border-accent hover:bg-accent/5"
              }`}
            >
              <Upload size={40} className="opacity-60" />
              <div className="typewriter text-xs font-bold uppercase tracking-widest">{localizeText("Deposer des PNG")}</div>
              <div className="typewriter text-[10px] text-foreground/60">{localizeText("ou cliquer pour parcourir")}</div>
            </button>
            <div className="p-3 border-t border-ink/20">
              <button
                type="button"
                onClick={createNew}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-accent text-background text-xs font-bold uppercase tracking-widest hover:opacity-90"
              >
                <Plus size={14} />{localizeText(" Nouveau pouvoir ")}</button>
            </div>
          </article>
        </div>

        {localizeNode(roles.length === 0 && (
          <div className="mt-8 flex items-center gap-3 border-2 border-dashed border-ink/30 p-4 typewriter text-sm text-foreground/65">
            <PowerIcon size={12} />{localizeText(" Aucun pouvoir pour l'instant. ")}</div>
        ))}
      </main>
    </div>
  );
};

export default PowersList;
