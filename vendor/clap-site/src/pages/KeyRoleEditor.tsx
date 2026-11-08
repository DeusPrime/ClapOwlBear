import CardEditorTabs from "@/components/CardEditorTabs";
import ResourceEditorTour from "@/components/ResourceEditorTour";
import { localizeText, localizeNode } from '@/i18n/localize';
import { reportSaveError } from "@/lib/saveError";
import ImageEditorField from "@/components/ImageEditorField";
import { ClipboardEvent, ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bold, Italic, List, ListOrdered, Plus, Save, Trash2, Underline } from "lucide-react";
import KeyRoleCard from "@/components/KeyRoleCard";
import { KeyRole, blankKeyRole, getKeyRole, upsertKeyRole } from "@/lib/keyRoles";
import { escapeHtml, richTextToHtml } from "@/lib/richText";

const TextField = ({
  label,
  value,
  onChange,
  className = "",
  helper,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  helper?: string;
  inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
}) => (
  <label className={`block ${className}`}>
    <span className="typewriter text-[11px] uppercase tracking-[0.18em] text-foreground/65">{localizeNode(label)}</span>
    <input maxLength={100000}
      value={value}
      inputMode={inputMode}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 min-h-11 w-full border border-ink/35 bg-background/35 px-3 py-2 typewriter text-base outline-none transition-colors placeholder:text-foreground/35 focus:border-accent focus:bg-background/60 focus:ring-2 focus:ring-accent/20"
    />
    {localizeNode(helper && <span className="mt-1 block text-xs leading-snug text-foreground/55">{localizeNode(helper)}</span>)}
  </label>
);

const TextAreaField = ({
  label,
  value,
  onChange,
  rows = 4,
  className = "",
  helper,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  className?: string;
  helper?: string;
}) => (
  <label className={`block ${className}`}>
    <span className="typewriter text-[11px] uppercase tracking-[0.18em] text-foreground/65">{localizeNode(label)}</span>
    <textarea maxLength={100000}
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 w-full resize-y border border-ink/35 bg-background/35 px-3 py-2 typewriter text-base leading-relaxed outline-none transition-colors placeholder:text-foreground/35 focus:border-accent focus:bg-background/60 focus:ring-2 focus:ring-accent/20"
    />
    {localizeNode(helper && <span className="mt-1 block text-xs leading-snug text-foreground/55">{localizeNode(helper)}</span>)}
  </label>
);

type RichTextCommand = "bold" | "italic" | "underline" | "insertUnorderedList" | "insertOrderedList";
type InlineRichTextCommand = "bold" | "italic" | "underline";

const INLINE_RICH_TEXT_COMMANDS: InlineRichTextCommand[] = ["bold", "italic", "underline"];

const RichTextField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => {
  const editor = useRef<HTMLDivElement>(null);
  const lastHtml = useRef("");
  const savedRange = useRef<Range | null>(null);
  const [activeCommands, setActiveCommands] = useState<Record<RichTextCommand, boolean>>({
    bold: false,
    italic: false,
    underline: false,
    insertUnorderedList: false,
    insertOrderedList: false,
  });

  const readCommandState = () => ({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      insertUnorderedList: document.queryCommandState("insertUnorderedList"),
      insertOrderedList: document.queryCommandState("insertOrderedList"),
  });

  const updateActiveCommands = () => {
    setActiveCommands((current) => {
      const detected = readCommandState();
      return {
        ...current,
        insertUnorderedList: detected.insertUnorderedList,
        insertOrderedList: detected.insertOrderedList,
      };
    });
  };

  const selectionIsInsideEditor = () => {
    const element = editor.current;
    const selection = window.getSelection();
    return Boolean(element && selection?.rangeCount && selection.anchorNode && element.contains(selection.anchorNode));
  };

  const saveSelection = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !selectionIsInsideEditor()) return;
    savedRange.current = selection.getRangeAt(0).cloneRange();
    updateActiveCommands();
  };

  const placeCaretAtEnd = () => {
    const element = editor.current;
    const selection = window.getSelection();
    if (!element || !selection) return;

    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    savedRange.current = range.cloneRange();
  };

  const restoreSelection = () => {
    const element = editor.current;
    const selection = window.getSelection();
    if (!element || !selection) return;

    element.focus();
    const range = savedRange.current;
    if (range && element.contains(range.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }

    placeCaretAtEnd();
  };

  useEffect(() => {
    const html = richTextToHtml(value);
    if (lastHtml.current === html) return;
    // Keep the native caret/selection while typing; sanitizing must not replace focused DOM nodes.
    if (editor.current && document.activeElement === editor.current) {
      lastHtml.current = html;
      return;
    }
    if (editor.current && editor.current.innerHTML !== html) {
      editor.current.innerHTML = html;
    }
    lastHtml.current = html;
  }, [value]);

  const emitChange = () => {
    const element = editor.current;
    if (!element) return;
    const text = element.textContent?.replace(/\u00a0/g, " ").trim() ?? "";
    const html = text ? richTextToHtml(element.innerHTML) : "";
    if (html.length > 100000) {
      element.innerHTML = lastHtml.current;
      reportSaveError(new Error("Texte trop long : maximum 100 000 caractères."));
      return;
    }
    lastHtml.current = html;
    onChange(html);
  };

  const applyInlineCommandState = (nextActiveCommands: Record<RichTextCommand, boolean>) => {
    INLINE_RICH_TEXT_COMMANDS.forEach((inlineCommand) => {
      if (document.queryCommandState(inlineCommand) !== nextActiveCommands[inlineCommand]) {
        document.execCommand(inlineCommand, false);
      }
    });
  };

  const runCommand = (command: RichTextCommand) => {
    restoreSelection();
    const selection = window.getSelection();
    const selectionWasCollapsed = selection ? selection.isCollapsed : true;

    const nextActiveCommands = {
      ...activeCommands,
      ...(INLINE_RICH_TEXT_COMMANDS.includes(command as InlineRichTextCommand)
        ? { [command]: !activeCommands[command] }
        : {}),
    };

    if (INLINE_RICH_TEXT_COMMANDS.includes(command as InlineRichTextCommand)) {
      applyInlineCommandState(nextActiveCommands);
      if (!selectionWasCollapsed) nextActiveCommands[command] = false;
    } else {
      document.execCommand(command, false);
      const detected = readCommandState();
      nextActiveCommands.insertUnorderedList = detected.insertUnorderedList;
      nextActiveCommands.insertOrderedList = detected.insertOrderedList;
    }

    saveSelection();
    setActiveCommands(nextActiveCommands);
    emitChange();
    editor.current?.focus();
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertHTML", false, escapeHtml(text).replace(/\r?\n/g, "<br>"));
    window.setTimeout(emitChange, 0);
  };

  const toolButton = (
    command: RichTextCommand,
    labelText: string,
    icon: ReactNode,
  ) => (
    <button
      type="button"
      aria-label={localizeText(labelText)}
      aria-pressed={activeCommands[command]}
      title={localizeText(labelText)}
      onMouseDown={(event) => {
        event.preventDefault();
        runCommand(command);
      }}
      className={`flex h-9 w-9 items-center justify-center border text-foreground/70 transition-colors hover:border-accent hover:text-accent ${
        activeCommands[command] ? "border-accent bg-accent text-background hover:text-background" : "border-ink/40"
      }`}
    >
      {localizeNode(icon)}
    </button>
  );

  return (
    <div className="block">
      <span className="typewriter text-[11px] uppercase tracking-[0.18em] text-foreground/65">{localizeNode(label)}</span>
      <div className="mt-1 flex flex-wrap gap-1 border border-ink/35 border-b-0 bg-paper-dark/25 p-1">
        {localizeNode(toolButton("bold", "Gras", <Bold size={15} />))}
        {localizeNode(toolButton("italic", "Italique", <Italic size={15} />))}
        {localizeNode(toolButton("underline", "Souligné", <Underline size={15} />))}
        {localizeNode(toolButton("insertUnorderedList", "Liste à puces", <List size={15} />))}
        {localizeNode(toolButton("insertOrderedList", "Liste numérotée", <ListOrdered size={15} />))}
      </div>
      <div
        ref={editor}
        contentEditable
        role="textbox"
        aria-label={localizeText(label)}
        aria-multiline="true"
        tabIndex={0}
        suppressContentEditableWarning
        onInput={() => {
          emitChange();
          saveSelection();
        }}
        onBlur={emitChange}
        onFocus={() => {
          saveSelection();
          updateActiveCommands();
        }}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onSelect={saveSelection}
        onPaste={handlePaste}
        className="min-h-[150px] w-full border border-ink/35 bg-background/35 px-3 py-2 typewriter text-base leading-relaxed outline-none transition-colors focus:border-accent focus:bg-background/60 focus:ring-2 focus:ring-accent/20 [&_em]:italic [&_i]:italic [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-bold [&_u]:underline [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
      />
    </div>
  );
};

const FormSection = ({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) => (
  <section className="paper-card p-4 sm:p-5">
    <div className="mb-5 flex flex-col gap-1 border-b border-ink/20 pb-3 sm:flex-row sm:items-end sm:justify-between">
      <h2 className="font-display text-2xl leading-none">{localizeNode(title)}</h2>
      <p className="typewriter text-[11px] uppercase tracking-[0.18em] text-foreground/55">{localizeNode(eyebrow)}</p>
    </div>
    {children}
  </section>
);



const KeyRoleEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const detailState = { ...location.state, returnTo: "/ressources", returnState: null };
  const [role, setRole] = useState<KeyRole | null>(null);
  const [mobileTab, setMobileTab] = useState<"edit" | "card">("edit");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!id || id === "new") {
        const item = blankKeyRole();
        await upsertKeyRole(item);
        if (!cancelled) navigate(`/key-roles/${item.id}/edit`, { replace: true });
        return;
      }
      const item = await getKeyRole(id);
      if (cancelled) return;
      if (!item) {
        navigate("/ressources");
        return;
      }
      setRole(item);
      document.title = `${item.titre || "Rôle clé"} — Clap & Role`;
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  useEffect(() => {
    if (!role) return;
    const timeout = window.setTimeout(() => void upsertKeyRole(role).catch(reportSaveError), 250);
    return () => window.clearTimeout(timeout);
  }, [role]);

  const update = (patch: Partial<KeyRole>) => setRole((current) => (current ? { ...current, ...patch } : current));

  const save = async () => {
    if (!role) return;
    await upsertKeyRole(role);
    navigate(`/key-roles/${role.id}`, { replace: true, state: detailState });
  };




  if (!role) return null;

  return (
    <div className="min-h-screen bg-paper pb-12 text-foreground">
      <header className="sticky top-0 z-10 border-b border-ink bg-paper/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link to={`/key-roles/${role.id}`} state={detailState} replace className="flex h-9 w-9 items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest hover:text-accent md:w-auto">
            <ArrowLeft size={16} />
            <span className="hidden md:inline">{localizeText("Carte")}</span>
          </Link>
          <h1 className="truncate font-display text-xl tracking-wider md:text-2xl">{role.titre || localizeText("Sans nom")}</h1>
          <div className="flex items-center gap-2">
            <span data-mobile-help className="empty:hidden shrink-0 sm:hidden" /><span aria-hidden="true" className="hidden w-10 shrink-0 sm:block" />

            <button
              type="button"
              onClick={save}
              data-tour="editor-save" aria-label={localizeText("Sauver")}
              className="flex h-9 w-9 items-center justify-center gap-2 bg-accent text-xs font-bold uppercase tracking-widest text-background hover:opacity-90 md:w-auto md:px-3 md:py-2"
            >
              <Save size={14} />
              <span className="hidden md:inline">{localizeText("Sauver")}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container grid gap-8 pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <CardEditorTabs value={mobileTab} onChange={setMobileTab} />

        <section className={`resource-edit-form ${mobileTab === "edit" ? "block" : "hidden"} space-y-6 lg:block`}>
          <ResourceEditorTour onStart={() => setMobileTab("edit")} />

          <FormSection title={localizeText("Haut de carte")} eyebrow={localizeText("Fond, titre")}>
            <div className="grid gap-5">
              <ImageEditorField aspectRatio={693 / 991} value={role.image} editing={role.imageEditing} onChange={(image, imageEditing) => update({ image, imageEditing })} />

              <div className="grid gap-4">
                <TextField
                  label={localizeText("Titre du role")}
                  value={role.titre}
                  onChange={(value) => update({ titre: value })}
                  helper={localizeText("Affiche en grand sous le bandeau.")}
                />
              </div>

              <TextAreaField
                label={localizeText("Description")}
                value={role.description}
                onChange={(value) => update({ description: value })}
                rows={4}
                helper={localizeText("Juste sous le titre sur la carte.")}
              />
            </div>
          </FormSection>

          <FormSection title={localizeText("Caracteristiques")} eyebrow={localizeText("Colonne centrale")}>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <TextField label={localizeText("PV")} value={role.pv} onChange={(value) => update({ pv: value })} inputMode="numeric" helper={localizeText("Affiche en haut a droite sur la carte.")} />
                <TextField label={localizeText("Corps")} value={role.corps} onChange={(value) => update({ corps: value })} inputMode="numeric" />
                <TextField label={localizeText("Esprit")} value={role.esprit} onChange={(value) => update({ esprit: value })} inputMode="numeric" />
                <TextField label={localizeText("Ame")} value={role.ame} onChange={(value) => update({ ame: value })} inputMode="numeric" />
              </div>
              <div className="grid gap-3 content-start">
                <TextField label={localizeText("Armure")} value={role.armure} onChange={(value) => update({ armure: value })} inputMode="numeric" />
              </div>
            </div>
          </FormSection>

          <FormSection title={localizeText("Degats")} eyebrow={`${role.armes.length}/4 armes`}>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-relaxed text-foreground/65">{localizeText("Cette zone apparait a droite des caracteristiques, sous l'armure.")}</p>
              <button
                type="button"
                onClick={() => update({ armes: [...role.armes, { nom: "", degats: "" }].slice(0, 4) })}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 border-2 border-ink px-3 text-xs font-bold uppercase tracking-widest transition-colors hover:bg-ink hover:text-background disabled:cursor-not-allowed disabled:opacity-45"
                disabled={role.armes.length >= 4}
              >
                <Plus size={14} />{localizeText(" Arme ")}</button>
            </div>
            <div className="space-y-3">
              {role.armes.map((arme, index) => (
                <div key={index} className="grid gap-3 border-l-2 border-ink/20 pl-3 sm:grid-cols-[minmax(0,1fr)_140px_44px] sm:items-start">
                  <TextField
                    label={localizeText(`Arme ${index + 1}`)}
                    value={arme.nom}
                    onChange={(value) => {
                      const armes = [...role.armes];
                      armes[index] = { ...arme, nom: value };
                      update({ armes });
                    }}
                  />
                  <TextField
                    label={localizeText("Degats")}
                    value={arme.degats}
                    onChange={(value) => {
                      const armes = [...role.armes];
                      armes[index] = { ...arme, degats: value };
                      update({ armes });
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => update({ armes: role.armes.filter((_, weaponIndex) => weaponIndex !== index) })}
                    className="flex h-11 items-center justify-center border border-transparent text-foreground/55 transition-colors hover:border-destructive/40 hover:text-destructive sm:mt-6"
                    aria-label={localizeText("Supprimer l'arme")}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </FormSection>

          <FormSection title={localizeText("Bas de carte")} eyebrow={localizeText("Capacites et citation")}>
            <div className="grid gap-5">
              <RichTextField label={localizeText("Capacites speciales")} value={role.special} onChange={(value) => update({ special: value })} />
              <TextField
                label={localizeText("Citation")}
                value={role.citation}
                onChange={(value) => update({ citation: value })}
                helper={localizeText("Elle apparait tout en bas, sous les capacites.")}
              />
            </div>
          </FormSection>

          <FormSection title={localizeText("Notes")} eyebrow={localizeText("Privees")}>
            <TextAreaField label={localizeText("Notes privees")} value={role.notes} onChange={(value) => update({ notes: value })} rows={8} />
          </FormSection>
        </section>

        <aside data-tour="editor-view-tabs" className={`${mobileTab === "card" ? "block" : "hidden"} lg:block lg:self-start`}>
          <div className="lg:fixed lg:right-8 lg:top-24 lg:w-[420px] lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto 2xl:right-[calc((100vw-1400px)/2+2rem)]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-2xl">{localizeText("Carte")}</h2>

            </div>
            <div className="max-w-full overflow-auto">
              <div className="w-fit overflow-hidden rounded-[18px]">
                <KeyRoleCard role={role} scale={0.52} />
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default KeyRoleEditor;
