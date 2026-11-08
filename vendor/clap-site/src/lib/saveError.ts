import { localizeText } from '@/i18n/localize';
import { toast } from "sonner";

export function reportSaveError(error: unknown) {
  toast.error(localizeText(error instanceof Error ? error.message : "Enregistrement impossible. Vérifie les champs."), { id: "save-validation-error" });
}
