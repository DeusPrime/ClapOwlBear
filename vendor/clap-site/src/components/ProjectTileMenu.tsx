import { localizeText, localizeNode } from '@/i18n/localize';
import { memo, useState } from 'react';
import { MoreVertical, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import ImageEditorField from './ImageEditorField';
import defaultProjectPoster from '@/assets/project-poster-default.webp';
import DirectoryBackSettings from './DirectoryBackSettings';
import ProjectExportActions from './ProjectExportActions';
import { activeDirectory, DEFAULT_DIRECTORY, renameDirectory, updateDirectoryPoster, type Directory } from '@/lib/directories';
import { deleteDirectoryWithContents } from '@/lib/deleteDirectory';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from './ui/alert-dialog';

const ProjectTileMenu = memo(function ProjectTileMenu({ project, onChange }: { project: Directory; onChange: (id?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const protectedProject = project.id === DEFAULT_DIRECTORY || project.name.trim().toLocaleLowerCase('fr') === 'général';
  async function remove() {
    setDeleting(true); setDeleteError('');
    try {
      await deleteDirectoryWithContents(project.id);
      setConfirmDelete(false); setOpen(false); onChange(activeDirectory());
    } catch (cause) { setDeleteError(cause instanceof Error ? cause.message : 'Suppression impossible.'); }
    finally { setDeleting(false); }
  }
  return <>
    <button type="button" className="studio-project-menu" aria-label={localizeText(`Options du projet ${project.name}`)} aria-haspopup="dialog" onClick={() => { setName(project.name); setError(''); setOpen(true); }}><MoreVertical size={20} /></button>
    <Dialog open={open} onOpenChange={value => { if (deleting) return; setOpen(value); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto bg-paper">
        <DialogTitle>{localizeText("Modifier le projet")}</DialogTitle>
        <DialogDescription>{localizeNode(project.name)}{localizeText(" — Nom, affiche et paramètres de ce projet.")}</DialogDescription>
        <form className="space-y-3 border-b border-ink/10 pb-5" onSubmit={event => {
          event.preventDefault();
          try { renameDirectory(project.id, name); onChange(); setError(''); }
          catch (cause) { setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.'); }
        }}>
          <label className="block text-sm font-semibold">{localizeText("Nom du projet")}<input className="mt-2 min-h-11 w-full rounded border border-ink/20 bg-paper px-3 font-normal disabled:opacity-60" value={name} maxLength={80} disabled={protectedProject} onChange={event => setName(event.target.value)} /></label>
          {protectedProject ? <p className="text-xs text-muted-foreground">{localizeText("Le nom du projet Général est conservé par défaut.")}</p> : <button className="btn-clap" disabled={!name.trim() || name.trim() === project.name}>{localizeText("Enregistrer le nom")}</button>}
        </form>
        <section className="space-y-3 border-b border-ink/10 pb-5" aria-label={localizeText("Image du projet")}>
          <h3 className="font-semibold">{localizeText("Affiche du projet")}</h3>
          <ImageEditorField label={localizeText("Affiche du projet")} inputLabel="Importer une affiche" removeLabel="Rétablir l’affiche par défaut" value={project.posterImage || defaultProjectPoster} removable={!!project.posterImage} editing={project.posterEditing} aspectRatio={3 / 4} maxImageDimension={1000} onChange={(image, editing) => {
            try { updateDirectoryPoster(project.id, image, editing); setError(''); onChange(); }
            catch (cause) { setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.'); }
          }} />
          <p className="text-xs text-muted-foreground">{localizeText("Sans image personnalisée, l’affiche cinéma par défaut est utilisée. Les modifications de l’image sont enregistrées immédiatement.")}</p>
        </section>
        {!protectedProject && <button type="button" className="flex min-h-11 items-center gap-2 border-t border-ink/15 pt-3 text-sm text-destructive" onClick={() => { setDeleteError(''); setConfirmDelete(true); }}><Trash2 size={16} />{localizeText('Supprimer le projet')}</button>}
        <section className="space-y-2" aria-label={localizeText("Paramètres du projet")}>
          <h3 className="font-semibold">{localizeText("Cartes et exports")}</h3>
          <DirectoryBackSettings directoryId={project.id} />
          <ProjectExportActions directoryId={project.id} className="flex min-h-11 w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-ink/5 disabled:opacity-50" />
        </section>
        {localizeNode(error && <p role="alert" className="text-sm text-destructive">{localizeNode(error)}</p>)}
        <button type="button" className="min-h-11 justify-self-end rounded border border-ink/20 px-4 text-sm" onClick={() => setOpen(false)}>{localizeText("Fermer")}</button>
      </DialogContent>
    </Dialog>
    <AlertDialog open={confirmDelete} onOpenChange={value => { if (!deleting) setConfirmDelete(value); }}>
      <AlertDialogContent className="bg-paper">
        <AlertDialogTitle>{localizeText('Supprimer le projet')}{' « '}{project.name}{' » ?'}</AlertDialogTitle>
        <AlertDialogDescription>{localizeText('Cette action supprime définitivement le projet et tous ses héros, cartes et ressources.')}</AlertDialogDescription>
        {deleteError && <p role="alert" className="text-sm text-destructive">{localizeText(deleteError)}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>{localizeText('Annuler')}</AlertDialogCancel>
          <button type="button" disabled={deleting} onClick={() => void remove()} className="min-h-11 border-2 border-destructive bg-destructive px-4 py-2 font-bold text-white disabled:opacity-50">{localizeText(deleting ? 'Suppression…' : 'Supprimer définitivement')}</button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
});

export default ProjectTileMenu;
