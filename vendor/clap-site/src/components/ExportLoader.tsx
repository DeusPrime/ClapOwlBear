import { localizeText, localizeNode } from '@/i18n/localize';
import { LoaderCircle } from "lucide-react";

const ExportLoader = ({ visible, label = "Export en cours", progress, detail }: { visible: boolean; label?: string; progress?: number; detail?: string }) => {
  if (!visible) return null;
  return (
    <div className={`fixed inset-0 ${progress === undefined ? "z-[100]" : "z-[200]"} flex items-center justify-center bg-background/75 p-4 backdrop-blur-sm`} role="status" aria-live="polite">
      <div className="flex min-w-64 flex-col items-center gap-4 border-2 border-ink bg-paper px-8 py-7 text-center shadow-[6px_6px_0_hsl(var(--ink))]">
        <LoaderCircle size={38} className="animate-spin text-accent" />
        <p className="font-display text-2xl leading-none">{localizeNode(label)}</p>
        {localizeNode(progress !== undefined && <div className="w-full min-w-48 space-y-2"><div role="progressbar" aria-label={localizeText("Progression de l’export")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-3 overflow-hidden border border-ink bg-ink/10"><div className="h-full bg-accent transition-[width]" style={{ width: `${progress}%` }} /></div><p className="text-lg font-bold tabular-nums">{localizeNode(progress)} %</p></div>)}
        <p className="max-w-72 break-words typewriter text-xs text-foreground/55">{localizeNode(detail || "Préparation du fichier…")}</p>
      </div>
    </div>
  );
};

export default ExportLoader;
