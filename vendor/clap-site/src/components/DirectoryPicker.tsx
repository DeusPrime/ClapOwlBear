import { localizeText, localizeNode } from '@/i18n/localize';
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, FolderOpen, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { createDirectory, directoryName, isProtectedDirectory, loadDirectories, renameDirectory } from "@/lib/directories";
import { deleteDirectoryWithContents } from "@/lib/deleteDirectory";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import DirectoryBackSettings from "./DirectoryBackSettings";
import ProjectExportActions from "./ProjectExportActions";
import ProjectImportButton from "./ProjectImportButton";
import { appMenuRow } from "./app-menu-styles";

export default function DirectoryPicker({ value, onChange, manage = false, mobileMenu = false, createOnly = false }: { value: string; onChange: (id: string) => void; manage?: boolean; mobileMenu?: boolean; createOnly?: boolean }) {
  const id = useId();
  const managementId = useId();
  const newMenuId = useId();
  const newMenu = useRef<HTMLDivElement>(null);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  useEffect(() => {
    if (!newMenuOpen) return;
    const outside = (event: PointerEvent) => { if (!newMenu.current?.contains(event.target as Node)) setNewMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setNewMenuOpen(false); };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [newMenuOpen]);
  const [managementOpen, setManagementOpen] = useState(false);
  const directories = loadDirectories();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const create = () => {
    try {
      if (renaming) { renameDirectory(value, name); onChange(value); }
      else { const directory = createDirectory(name); onChange(directory.id); }
      setName(""); setCreating(false); setRenaming(false); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Création impossible."); }
  };
  const remove = async () => {
    setDeleting(true); setError("");
    try {
      const next = await deleteDirectoryWithContents(value);
      onChange(next); setConfirmDelete(false); setCreating(false); setRenaming(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Suppression impossible."); }
    finally { setDeleting(false); }
  };
  const menuAction = appMenuRow;
  return <div data-tour={createOnly ? "project-create" : undefined} className={mobileMenu ? "space-y-2 [&_svg]:shrink-0" : manage ? "mb-4 flex flex-wrap items-start gap-3" : "mb-4 space-y-3"}>
    {localizeNode(!createOnly && <label htmlFor={id} className={mobileMenu ? "flex items-center gap-2 px-3 pb-1 text-xs text-foreground/60" : `flex items-center gap-2 typewriter text-sm font-bold ${manage ? "min-h-11" : ""}`}><FolderOpen size={mobileMenu ? 15 : 18} />{localizeNode(mobileMenu ? "Projet actif" : "Projet")}</label>)}
    <div className={mobileMenu ? "flex flex-col gap-1" : `flex min-w-0 flex-wrap gap-2 ${manage ? "max-w-3xl flex-1" : ""}`}>
      {!createOnly && <select id={id} value={value} onChange={event => { onChange(event.target.value); setCreating(false); setRenaming(false); setManagementOpen(false); setError(""); }} className={`min-h-11 min-w-0 flex-1 rounded-sm border-2 border-ink bg-paper px-3 py-2 typewriter text-sm ${manage && !mobileMenu ? "min-w-40 sm:max-w-72" : ""}`}>
        {localizeNode(!directories.some(item => item.id === value) && <option value={value}>{localizeNode(directoryName(value))}</option>)}
        {directories.map(item => <option key={item.id} value={item.id}>{localizeNode(item.name)}</option>)}
      </select>}
      <div ref={newMenu} className={mobileMenu ? "min-w-0" : "relative"}>
        <button type="button" aria-label={localizeText("Nouveau projet")} aria-expanded={newMenuOpen} aria-controls={newMenuId} onClick={() => setNewMenuOpen(open => !open)} className={mobileMenu ? `${menuAction} font-medium text-foreground` : createOnly ? "fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full border-2 border-ink bg-accent text-background shadow-lg sm:static sm:h-auto sm:w-auto sm:gap-2 sm:rounded-none sm:bg-transparent sm:px-3 sm:py-2 sm:text-foreground sm:shadow-none" : "flex min-h-11 items-center gap-2 border-2 border-ink px-3 py-2 typewriter text-xs"}><Plus size={createOnly ? 28 : 16} /><span className={createOnly ? "hidden sm:block" : "flex-1"}>{localizeText("Nouveau projet")}</span><ChevronDown size={14} className={`${createOnly ? "hidden sm:block" : ""} ${newMenuOpen ? "rotate-180" : ""}`} /></button>
        <div id={newMenuId} hidden={!newMenuOpen} role="group" aria-label={localizeText("Nouveau projet")} className={mobileMenu ? "ml-3 border-l border-ink/15 pl-2" : `${createOnly ? "fixed bottom-40 right-4 z-50 sm:absolute sm:bottom-auto sm:top-full sm:right-0" : "absolute left-0 top-full z-30"} mt-2 w-80 max-w-[calc(100vw-3rem)] border-2 border-ink bg-paper p-2 shadow-[4px_4px_0_hsl(var(--ink))]`}>
          <button type="button" className={menuAction} onClick={() => { setNewMenuOpen(false); setCreating(true); setRenaming(false); setName(""); setError(""); }}><Plus size={16} />{localizeText("Créer un projet vide")}</button>
          <ProjectImportButton className={menuAction} />
        </div>
      </div>
      {localizeNode(manage && <>
        <button type="button" className={mobileMenu ? `${menuAction}` : `flex min-h-11 items-center gap-2 border-2 border-ink px-3 py-2 typewriter text-xs ${managementOpen ? "bg-ink text-background" : "hover:bg-ink/5"}`} aria-expanded={managementOpen} aria-controls={managementId} onClick={() => setManagementOpen(open => !open)}><Settings2 size={16} /><span className="flex-1">{localizeText("Gérer ce projet")}</span><ChevronDown size={16} className={`transition-transform ${managementOpen ? "rotate-180" : ""}`} /></button>
        <div id={managementId} hidden={!managementOpen} className={mobileMenu ? "ml-3 border-l border-ink/15 pl-2" : "basis-full border border-ink/25 bg-paper-dark/20 p-3 sm:p-4"}>
          {localizeNode(!mobileMenu ? <div className="grid gap-5 sm:grid-cols-2">
            <section className="space-y-1"><h2 className="mb-2 px-3 typewriter text-[11px] font-bold uppercase tracking-widest text-foreground/55">{localizeText("Exporter le projet")}</h2><ProjectExportActions directoryId={value} className={menuAction} /></section>
            <section className="space-y-1"><h2 className="mb-2 px-3 typewriter text-[11px] font-bold uppercase tracking-widest text-foreground/55">{localizeText("Paramètres du projet")}</h2>
              <DirectoryBackSettings key={value} directoryId={value} triggerClassName={menuAction} />
              <button type="button" disabled={isProtectedDirectory(value)} onClick={() => { setRenaming(true); setCreating(false); setName(directoryName(value)); setError(""); }} className={`${menuAction} disabled:cursor-not-allowed disabled:opacity-40`}><Pencil size={16} />{localizeText("Renommer")}</button>
              {localizeNode(isProtectedDirectory(value) ? <p className="px-3 py-2 text-xs text-foreground/50">{localizeText("Le projet Général ne peut être renommé ni supprimé.")}</p> : <button type="button" onClick={() => { setError(""); setConfirmDelete(true); }} className={`${menuAction} border-t border-ink/15 text-destructive`}><Trash2 size={16} />{localizeText("Supprimer le projet")}</button>)}
            </section>
          </div> : <>
          <DirectoryBackSettings key={value} directoryId={value} triggerClassName={mobileMenu ? menuAction : undefined} />
          <ProjectExportActions directoryId={value} className={mobileMenu ? menuAction : undefined} />
          <button type="button" disabled={isProtectedDirectory(value)} title={localizeText(isProtectedDirectory(value) ? "Le projet Général ne peut pas être renommé." : undefined)} onClick={() => { setRenaming(true); setCreating(false); setName(directoryName(value)); setError(""); }} className={`${mobileMenu ? menuAction : "flex min-h-11 items-center gap-2 border-2 border-ink px-3 py-2 typewriter text-xs"} disabled:cursor-not-allowed disabled:opacity-40`}><Pencil size={16} />{localizeText("Renommer")}</button>
          {localizeNode(mobileMenu && isProtectedDirectory(value) ? <p className="px-3 py-2 text-xs leading-relaxed text-foreground/50">{localizeText("Le projet Général est conservé par défaut.")}</p> : <button type="button" disabled={isProtectedDirectory(value)} title={isProtectedDirectory(value) ? "Le projet Général ne peut pas être supprimé." : undefined} onClick={() => { setError(""); setConfirmDelete(true); }} className={mobileMenu ? `${menuAction} mt-2 border-t border-ink/15 text-destructive` : "flex min-h-11 items-center gap-2 border-2 border-destructive px-3 py-2 typewriter text-xs text-destructive disabled:cursor-not-allowed disabled:opacity-50"}><Trash2 size={16} />{localizeText("Supprimer le projet")}</button>)}
          </>)}
        </div>
      </>)}
    </div>
    {(creating || renaming) && <div className={mobileMenu ? "flex flex-col gap-3 border-2 border-ink/15 bg-paper-dark/40 p-4 [&>input]:min-h-12 [&>input]:w-full [&>input]:text-base" : "flex basis-full flex-wrap gap-2"}>
      <input autoFocus aria-label={localizeText("Nom du projet")} value={name} maxLength={80} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); create(); } }} placeholder={localizeText("Ex. Campagne western")} className="min-w-0 flex-1 border-2 border-ink bg-paper px-3 py-2 typewriter text-sm" />
      <button type="button" onClick={create} disabled={!name.trim()} className="border-2 border-ink bg-ink px-4 py-2 text-background disabled:opacity-50">{renaming ? "Enregistrer le nom" : "Créer"}</button>
      <button type="button" onClick={() => { setCreating(false); setRenaming(false); setError(""); }} className="border-2 border-ink px-4 py-2">{localizeText("Annuler")}</button>
    </div>}
    {localizeNode(error && !confirmDelete && <p role="alert" className="text-sm text-destructive">{localizeNode(error)}</p>)}
    <AlertDialog open={confirmDelete} onOpenChange={open => { if (!deleting) setConfirmDelete(open); }}>
      <AlertDialogContent className="max-h-[90dvh] overflow-y-auto bg-paper">
        <AlertDialogTitle>{localizeText("Supprimer « ")}{localizeNode(directoryName(value))} » ?</AlertDialogTitle>
        <AlertDialogDescription>{localizeText("Tous les héros et toutes les cartes de ce projet seront supprimés définitivement, même s’ils ne sont pas affichés par les filtres actuels. Les liens vers ces cartes seront retirés des héros des autres projets. Cette action est irréversible.")}</AlertDialogDescription>
        {localizeNode(directories.length === 1 && <p className="text-sm">{localizeText("Un projet « Général » vide sera créé pour continuer à organiser vos fiches.")}</p>)}
        {localizeNode(error && <p role="alert" className="text-sm text-destructive">{localizeNode(error)}</p>)}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>{localizeText("Annuler")}</AlertDialogCancel>
          <button type="button" disabled={deleting} onClick={() => void remove()} className="min-h-11 border-2 border-destructive bg-destructive px-4 py-2 font-bold text-white disabled:opacity-50">{localizeNode(deleting ? "Suppression…" : "Supprimer définitivement")}</button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
