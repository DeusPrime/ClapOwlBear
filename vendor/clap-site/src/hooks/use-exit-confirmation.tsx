import { localizeText } from '@/i18n/localize';
import { useRef, useState } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

export function useExitConfirmation() {
  const [open, setOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);
  const requestExit = (dirty: boolean, leave: () => void) => {
    if (!dirty) { leave(); return; }
    pending.current = leave;
    setOpen(true);
  };
  const dialog = <AlertDialog open={open} onOpenChange={value => { setOpen(value); if (!value) pending.current = null; }}>
    <AlertDialogContent className="bg-paper">
      <AlertDialogTitle>{localizeText("Quitter l’édition ?")}</AlertDialogTitle>
      <AlertDialogDescription>{localizeText("Vos modifications ne sont pas enregistrées. Si vous quittez cette vue, elles seront perdues.")}</AlertDialogDescription>
      <AlertDialogFooter>
        <AlertDialogCancel>{localizeText("Annuler")}</AlertDialogCancel>
        <AlertDialogAction onClick={() => { const leave = pending.current; pending.current = null; leave?.(); }}>{localizeText("Sortir tout de même")}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
  return { requestExit, dialog };
}
