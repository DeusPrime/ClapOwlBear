import { localizeText, localizeNode } from '@/i18n/localize';
import { useBackNavigation } from "@/hooks/use-back-navigation";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { ArrowLeft, Save } from "lucide-react";
import { useExitConfirmation } from "@/hooks/use-exit-confirmation";
import { activeDirectory } from "@/lib/directories";
import { emptyToolPayload, getToolDocument, saveToolDocument, TOOL_TYPES, type ToolKind, type ToolPayload } from "@/lib/toolDocuments";

export default function ToolDocumentBar({ kind, data, onLoad, disabled = false }: { kind: ToolKind; data: ToolPayload; onLoad: (data: ToolPayload) => void; disabled?: boolean }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const goBack = useBackNavigation("/outils");
  const { requestExit, dialog } = useExitConfirmation();
  const [header, setHeader] = useState<HTMLElement | null>(null);
  const baseline = useRef<string | null>(null);
  const resetBaseline = useRef(false);
  const signature = JSON.stringify(data, (key, value) => ["url", "styledUrl", "styledStrength"].includes(key) ? undefined : value);
  const savedDetails = useRef({ name: TOOL_TYPES.find(type => type.kind === kind)!.label, directoryId: activeDirectory() });
  const id = params.get("outil");
  const [name, setName] = useState(TOOL_TYPES.find(type => type.kind === kind)!.label);
  const [directoryId, setDirectoryId] = useState(activeDirectory);
  const [loading, setLoading] = useState(Boolean(id));
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const restore = useRef(onLoad);
  restore.current = onLoad;
  useEffect(() => { setHeader(document.getElementById("tool-editor-header")); }, []);
  useEffect(() => {
    if (baseline.current === null || resetBaseline.current) { baseline.current = signature; resetBaseline.current = false; }
  }, [signature]);
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true); setMissing(false); setError("");
    void getToolDocument(id).then(document => {
      if (cancelled) return;
      if (!document || document.kind !== kind) { setMissing(true); throw new Error("Ressource introuvable ou de type différent. Revenez à la liste des ressources."); }
      setName(document.name); setDirectoryId(document.directoryId);
      savedDetails.current = { name: document.name, directoryId: document.directoryId };
      resetBaseline.current = true;
      restore.current(document.data ?? emptyToolPayload(kind));
    }).catch(cause => { if (!cancelled) { setMissing(true); setError(cause instanceof Error ? cause.message : "Ouverture impossible."); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, kind]);
  async function save() {
    setBusy(true); setError("");
    try {
      await saveToolDocument({ id: id ?? crypto.randomUUID(), directoryId, kind, name, data, updatedAt: Date.now() });
      baseline.current = signature;
      savedDetails.current = { name, directoryId };
      navigate("/outils");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Enregistrement impossible."); }
    finally { setBusy(false); }
  }
  const blocked = !name.trim() || loading || busy || disabled || missing;
  return <>
    {header && createPortal(<div className="container flex h-16 items-center justify-between gap-4">
      <button type="button" aria-label={localizeText("Retour")} disabled={loading || busy} onClick={() => requestExit(baseline.current !== signature || name !== savedDetails.current.name || directoryId !== savedDetails.current.directoryId, goBack)} className="flex h-11 shrink-0 items-center gap-2 text-sm font-bold uppercase tracking-widest hover:text-accent"><ArrowLeft size={16} /><span className="hidden md:inline">{localizeText("Retour")}</span></button>
      <h1 className="truncate font-display text-xl tracking-wider md:text-2xl">{name || localizeText("Sans nom")}</h1>
      <span data-mobile-help className="empty:hidden shrink-0 sm:hidden" />
      <button type="button" aria-label={localizeText("Enregistrer")} onClick={() => void save()} disabled={blocked} className="flex h-11 shrink-0 items-center justify-center gap-2 bg-accent px-3 text-xs font-bold uppercase tracking-widest text-background disabled:opacity-50"><Save size={16} /><span className="hidden md:inline">{localizeNode(busy ? "Enregistrement…" : "Enregistrer")}</span></button>
    </div>, header)}
    {localizeNode(dialog)}
    <fieldset disabled={disabled || loading || busy || missing} className="mb-6 space-y-3 border-2 border-ink/30 p-4">
    <legend className="px-2 font-bold">{localizeText("Ma ressource")}</legend>
    <label className="block text-sm font-bold">{localizeText("Nom de la ressource")}<input value={name} maxLength={120} onChange={event => setName(event.target.value)} className="mt-2 min-h-11 w-full border-2 border-ink bg-paper px-3 py-2 font-normal" /></label>
    <p className="text-xs text-foreground/60">{localizeText("Enregistrez vos modifications avant de quitter cette ressource.")}</p>
    {localizeNode(loading && <p role="status">{localizeText("Ouverture de la ressource…")}</p>)}
    {localizeNode(error && <p role="alert" className="text-sm text-destructive">{localizeNode(error)}</p>)}
  </fieldset></>;
}
