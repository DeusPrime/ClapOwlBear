import { localizeText, localizeNode } from '@/i18n/localize';
import { useSyncExternalStore } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { getExportProgress, subscribeExportProgress } from "@/lib/exportProgress";
import ExportLoader from "./ExportLoader";

export default function GlobalExportLoader() {
  const state = useSyncExternalStore(subscribeExportProgress, getExportProgress);
  return <Dialog.Root open={state.active}><Dialog.Portal><Dialog.Content className="fixed inset-0 z-[201]" onEscapeKeyDown={event => event.preventDefault()} onInteractOutside={event => event.preventDefault()}>
    <Dialog.Title className="sr-only">{localizeNode(state.label)}</Dialog.Title><Dialog.Description className="sr-only">{localizeText("Préparation et téléchargement du fichier. Veuillez patienter.")}</Dialog.Description>
    <ExportLoader visible={state.active} label={localizeText(state.label)} progress={state.percent} detail={state.detail} />
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
