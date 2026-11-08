import { localizeText, localizeNode } from '@/i18n/localize';
import { useState } from "react";
import { Images } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { directoryName, loadDirectories, resourceBackImage, updateDirectoryBack, type Directory } from "@/lib/directories";
import CardBackImageEditor from "./CardBackImageEditor";
import PokerCardBack from "./PokerCardBack";
import { RESOURCE_APPEARANCE } from "@/lib/resourceAppearance";
import type { ResourceKind } from "@/lib/dataValidation";

export default function DirectoryBackSettings({ directoryId, triggerClassName }: { directoryId: string; triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  const [backImages, setBackImages] = useState<NonNullable<Directory["backImages"]>>({});
  const [backImageEditings, setBackImageEditings] = useState<NonNullable<Directory["backImageEditings"]>>({});
  const [filmTitle, setFilmTitle] = useState("");
  const [error, setError] = useState("");
  const [previewType, setPreviewType] = useState<ResourceKind>("figurant");
  const button = "min-h-11 border-2 border-ink px-3 py-2 typewriter text-xs disabled:opacity-50";
  function edit() {
    const directory = loadDirectories().find(item => item.id === directoryId);
    const inherited = directory?.backImage ? Object.fromEntries(Object.keys(RESOURCE_APPEARANCE).map(type => [type, directory.backImage!])) : {};
    setBackImages({ ...inherited, ...directory?.backImages }); setBackImageEditings(directory?.backImageEditings ?? {}); setFilmTitle(directory?.backFilmTitle ?? ""); setError(""); setOpen(true);
  }
  async function save() {
    try { await updateDirectoryBack(directoryId, { backImages, backImageEditings, backFilmTitle: filmTitle }); setOpen(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Enregistrement impossible."); }
  }
  return <>
    <button type="button" className={triggerClassName ?? `${button} flex items-center gap-2`} onClick={edit}><Images size={16} />{localizeText("Dos des cartes")}</button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden bg-paper p-0">
      <div className="shrink-0 space-y-2 border-b border-ink/20 p-4 pr-12">
      <DialogTitle>{localizeText("Dos des cartes · ")}{localizeNode(directoryName(directoryId))}</DialogTitle>
      <DialogDescription>{localizeText("Choisis un type de carte pour personnaliser son fond dans ce projet. Le titre du film est commun à tous les types. Chaque dos garde le nom et la couleur de son type.")}</DialogDescription>
      </div>
      <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4">
      <label className="block text-sm">{localizeText("Type de carte")}<select aria-label={localizeText("Type de carte")} value={previewType} onChange={event => setPreviewType(event.target.value as ResourceKind)} className="mt-2 min-h-11 w-full border-2 border-ink bg-paper px-3 py-2">{Object.entries(RESOURCE_APPEARANCE).map(([type, appearance]) => <option key={type} value={type}>{localizeNode(appearance.label)}</option>)}</select></label>
      <div className="mx-auto w-36 aspect-[63/88]"><PokerCardBack image={{ backImage: resourceBackImage({ id: directoryId, name: "", backImages }, previewType), backFilmTitle: filmTitle, backLabel: RESOURCE_APPEARANCE[previewType].label, borderColor: RESOURCE_APPEARANCE[previewType].color }} /></div>
      <p className="text-center typewriter text-xs text-foreground/60">{localizeNode(backImages[previewType] ? "Fond personnalisé" : "Fond par défaut")} · {localizeNode(RESOURCE_APPEARANCE[previewType].label)}</p>
      <fieldset className="space-y-4">
        <label className="block font-bold">{localizeText("Titre du film")}<input aria-label={localizeText("Titre du film du projet")} maxLength={120} value={filmTitle} onChange={event => setFilmTitle(event.target.value)} placeholder={localizeText("Facultatif")} className="mt-2 min-h-11 w-full border-2 border-ink bg-paper px-3 py-2 font-normal" /></label>
        <CardBackImageEditor key={previewType} value={backImages[previewType]} editing={backImageEditings[previewType]} inputLabel="Fond du dos du projet" onChange={(image, editing) => {
          setBackImages(current => { const next = { ...current }; if (image) next[previewType] = image; else delete next[previewType]; return next; });
          setBackImageEditings(current => { const next = { ...current }; if (editing) next[previewType] = editing; else delete next[previewType]; return next; });
        }} />
      </fieldset>
      {localizeNode(error && <p role="alert" className="text-sm text-destructive">{localizeNode(error)}</p>)}
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-ink/20 p-4"><button type="button" className={button} onClick={() => setOpen(false)}>{localizeText("Annuler")}</button><button type="button" className={`${button} bg-ink text-background`} onClick={save}>{localizeText("Enregistrer le dos")}</button></div>
    </DialogContent></Dialog>
  </>;
}
