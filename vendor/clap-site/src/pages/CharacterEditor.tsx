import PageTour from "@/components/PageTour";
import OtherAccessoriesEditor from "@/components/OtherAccessoriesEditor";
import { localizeText, localizeNode } from '@/i18n/localize';
import { useBackNavigation } from "@/hooks/use-back-navigation";
import { useRoom } from "@/hooks/use-room";
import type { RoomRollRequest } from "@/lib/roomProtocol";
import { failExportProgress, withExportProgress } from "@/lib/exportProgress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { reportSaveError } from "@/lib/saveError";
import { useExitConfirmation } from "@/hooks/use-exit-confirmation";
import RoomResourceView from "@/components/RoomResourceView";
import HeroResourcePicker from "@/components/HeroResourcePicker";
import ImageEditorField from "@/components/ImageEditorField";
import PortraitColorPicker from "@/components/PortraitColorPicker";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ChangeEvent, ClipboardEvent, ReactNode, cloneElement, isValidElement, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, ArrowLeft, Backpack, Bold, BookOpen, Brain, Dices, Download, Eye, HeartCrack, Italic, Link2, List, ListOrdered, MoreVertical, Pencil, Plus, Save, Shield, Sparkles, Trash2, Underline, Upload, UserCircle, X } from "lucide-react";
import CriticalDialog from "@/components/CriticalDialog";
import RollDialog, { InjuryPenaltyOption, RollSelection } from "@/components/RollDialog";
import {
  Character,
  LinkedResourceType,
  FACET_LABELS,
  FACET_SKILLS,
  Facet,
  GRIEF_CAPACITY,
  GRIEF_LEVELS,
  INJURY_CAPACITY,
  INJURY_LEVELS,
  INJURY_LOCATIONS,
  STRESS_CAPACITY,
  STRESS_LEVELS,
  getCharacter,
  upsertCharacter,
  characterHasCriticalState,
} from "@/lib/characters";
import { downloadBlob, exportCharacterPng } from "@/lib/characterPng";
import { exportHeroCardsA6Pdf } from "@/lib/heroCardsA6Pdf";
import { escapeHtml, richTextToHtml, richTextToPlainText } from "@/lib/richText";
import ExportLoader from "@/components/ExportLoader";
import { loadFigurants, upsertFigurant, type Figurant } from "@/lib/figurants";
import { loadKeyRoles, upsertKeyRole, type KeyRole } from "@/lib/keyRoles";
import { loadPowers, upsertPower, type Power } from "@/lib/powers";
import { loadProfiles, upsertProfile, type Profile } from "@/lib/profiles";
import { loadVehicles, upsertVehicle, type Vehicle } from "@/lib/vehicles";
import { importFigurantPng } from "@/lib/figurantPng";
import { importKeyRolePng } from "@/lib/keyRolePng";
import { importPowerPng } from "@/lib/powerPng";
import { importProfilePng } from "@/lib/profilePng";
import { importVehiclePng } from "@/lib/vehiclePng";
import { resourceContentId } from "@/lib/resourceBundle";
import HeroResourcePreview from "@/components/ResourceCardPreview";

type Mode = "view" | "edit";
type Tab = "discussion" | "identity" | "attributes" | "traits" | "gear" | "state" | "cards" | "notes" | "resources";
type HeroCardTab = "identity" | "attributes" | "traits" | "state" | "notes" | "back";

const TABS: { id: Tab; label: string }[] = [
  { id: "identity", label: "Identité" },
  { id: "attributes", label: "Attributs" },
  { id: "traits", label: "Traits" },
  { id: "state", label: "Constantes" },
  { id: "notes", label: "Notes" },
  { id: "resources", label: "Cartes liées" },
];

const TAB_ICONS: Record<Tab, typeof UserCircle> = {
  discussion: MessageSquare,
  identity: UserCircle,
  attributes: Dices,
  traits: Sparkles,
  gear: Backpack,
  state: HeartCrack,
  cards: UserCircle,
  notes: BookOpen,
  resources: Link2,
};

type HeroResource =
  | { type: "key-role"; item: KeyRole; href: string; label: string }
  | { type: "figurant"; item: Figurant; href: string; label: string }
  | { type: "profile"; item: Profile; href: string; label: string }
  | { type: "power"; item: Power; href: string; label: string }
  | { type: "vehicle"; item: Vehicle; href: string; label: string };

const heroResourceKey = (resource: { type: LinkedResourceType; item: { id: string } }) => `${resource.type}:${resource.item.id}`;
const linkedResourceKey = (resource: { type: LinkedResourceType; id: string }) => `${resource.type}:${resource.id}`;

const facetColor: Record<Facet, { ring: string; text: string; bg: string }> = {
  corps: { ring: "stroke-[#7F240F]", text: "text-[#7F240F]", bg: "fill-[#7F240F]/20" },
  esprit: { ring: "stroke-[#3E7A2F]", text: "text-[#3E7A2F]", bg: "fill-[#3E7A2F]/20" },
  ame: { ring: "stroke-[#253A72]", text: "text-[#253A72]", bg: "fill-[#253A72]/20" },
};

const facetPaint: Record<Facet, { reel: string; dark: string; label: string }> = {
  corps: { reel: "#7F240F", dark: "#2b0c05", label: "#7F240F" },
  esprit: { reel: "#3E7A2F", dark: "#14290f", label: "#3E7A2F" },
  ame: { reel: "#253A72", dark: "#0c1326", label: "#253A72" },
};

const REEL_INK = "#0b0a08";
const REEL_PAPER = "#eee9de";
const REEL_VALUE = REEL_INK;
const HERO_CARD_SEQUEL_ICONS = {
  injury: "/ClapOwlBear/hero-card-icons/critical-heart.png",
  stress: "/ClapOwlBear/hero-card-icons/critical-brain.png",
  grief: "/ClapOwlBear/hero-card-icons/critical-eye.png",
} as const;

const clampAttributeValue = (value: number) => Math.max(-1, Math.min(6, value));
const clampSupernaturalValue = (value: number) => Math.max(0, Math.min(5, value));
const clampDestinDiceCount = (value: number) => (Number.isFinite(value) ? Math.min(100, Math.max(0, Math.floor(value))) : 0);

const parseAttributeInput = (value: string) => {
  const normalized = value.replace(/[^\d-]/g, "").replace(/(?!^)-/g, "");
  if (normalized === "") return null;
  if (normalized === "-") return -1;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? clampAttributeValue(parsed) : null;
};

const AttributeNumberInput = ({ value, onCommit }: { value: number; onCommit: (value: number) => void }) => {
  const [draft, setDraft] = useState(String(value));
  const previousValue = useRef(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  return (
    <input maxLength={100000}
      type="text"
      inputMode="numeric"
      pattern="-?[0-9]*"
      value={draft}
      onFocus={() => {
        focused.current = true;
        previousValue.current = value;
        setDraft("");
      }}
      onChange={(event) => {
        const raw = event.target.value.replace(/[^\d-]/g, "").replace(/(?!^)-/g, "");
        const validDraft = raw === "" || raw === "-" || raw === "-1" || /^[0-6]$/.test(raw);
        if (!validDraft) return;
        setDraft(raw);
        const next = parseAttributeInput(raw);
        if (next !== null) onCommit(next);
      }}
      onBlur={() => {
        focused.current = false;
        const next = parseAttributeInput(draft);
        if (next === null) {
          setDraft(String(previousValue.current));
          onCommit(previousValue.current);
        } else {
          setDraft(String(next));
          onCommit(next);
        }
      }}
      className="h-8 w-9 border-0 bg-transparent text-center typewriter text-base font-bold outline-none drop-shadow-[1px_1px_0_rgba(255,255,255,0.85)] focus:ring-2 focus:ring-accent/50"
      style={{ color: REEL_VALUE, backgroundColor: "transparent" }}
    />
  );
};

const parseSupernaturalInput = (value: string) => {
  const normalized = value.replace(/\D/g, "");
  if (normalized === "") return 0;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? clampSupernaturalValue(parsed) : 0;
};

const pointOnCircle = (cx: number, cy: number, r: number, angle: number) => ({
  x: cx + Math.cos(angle) * r,
  y: cy + Math.sin(angle) * r,
});

const supernaturalStarAngles = (angle: number, count: number, spread = 0.095) =>
  Array.from({ length: count }, (_, index) => angle + (index - (count - 1) / 2) * spread);

const annularSectorPath = (cx: number, cy: number, rOuter: number, rInner: number, start: number, end: number) => {
  const outerStart = pointOnCircle(cx, cy, rOuter, start);
  const outerEnd = pointOnCircle(cx, cy, rOuter, end);
  const innerEnd = pointOnCircle(cx, cy, rInner, end);
  const innerStart = pointOnCircle(cx, cy, rInner, start);
  const largeArc = end - start > Math.PI ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
};

const arcPath = (cx: number, cy: number, r: number, start: number, end: number, sweep = 1) => {
  const from = pointOnCircle(cx, cy, r, start);
  const to = pointOnCircle(cx, cy, r, end);
  const largeArc = Math.abs(end - start) > Math.PI ? 1 : 0;
  return `M ${from.x} ${from.y} A ${r} ${r} 0 ${largeArc} ${sweep} ${to.x} ${to.y}`;
};

const labelArcPath = (cx: number, cy: number, r: number, centerAngle: number, halfAngle: number) => {
  const bottomHalf = Math.sin(centerAngle) > 0.2;
  return bottomHalf
    ? arcPath(cx, cy, r, centerAngle + halfAngle, centerAngle - halfAngle, 0)
    : arcPath(cx, cy, r, centerAngle - halfAngle, centerAngle + halfAngle, 1);
};

/* ---------- inputs ---------- */
const TextField = ({
  label, value, onChange, mode, className = "",
}: { label: string; value: string; onChange: (v: string) => void; mode: Mode; className?: string }) => (
  <label className={`block ${className}`}>
    <span className="typewriter text-[10px] uppercase tracking-[0.25em] text-foreground/60">{localizeNode(label)}</span>
    {localizeNode(mode === "edit" ? (
      <input maxLength={100000}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-2 py-1.5 bg-transparent border-b-2 border-ink/40 focus:border-accent outline-none typewriter text-sm"
      />
    ) : (
      <p className="mt-1 px-2 py-1.5 typewriter text-sm border-b-2 border-transparent min-h-[34px]">
        {localizeNode(value || <span className="text-foreground/30">—</span>)}
      </p>
    ))}
  </label>
);

const TextAreaField = ({
  label, value, onChange, mode, rows = 6,
}: { label: string; value: string; onChange: (v: string) => void; mode: Mode; rows?: number }) => (
  <label className="block">
    <span className="typewriter text-[10px] uppercase tracking-[0.25em] text-foreground/60">{localizeNode(label)}</span>
    {localizeNode(mode === "edit" ? (
      <textarea maxLength={100000}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-2 py-1.5 bg-transparent border border-ink/40 focus:border-accent outline-none typewriter text-sm resize-y"
      />
    ) : (
      <div className="mt-1 px-2 py-1.5 typewriter text-sm whitespace-pre-wrap min-h-[120px]">
        {localizeNode(value || <span className="text-foreground/30">—</span>)}
      </div>
    ))}
  </label>
);

type RichTextCommand = "bold" | "italic" | "underline" | "insertUnorderedList" | "insertOrderedList";
type InlineRichTextCommand = "bold" | "italic" | "underline";

const INLINE_RICH_TEXT_COMMANDS: InlineRichTextCommand[] = ["bold", "italic", "underline"];

const RichTextField = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => {
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
    if (editor.current && editor.current.innerHTML !== html) editor.current.innerHTML = html;
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
      ...(INLINE_RICH_TEXT_COMMANDS.includes(command as InlineRichTextCommand) ? { [command]: !activeCommands[command] } : {}),
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

  const toolButton = (command: RichTextCommand, labelText: string, icon: ReactNode) => (
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
        {localizeNode(toolButton("underline", "Souligne", <Underline size={15} />))}
        {localizeNode(toolButton("insertUnorderedList", "Liste a puces", <List size={15} />))}
        {localizeNode(toolButton("insertOrderedList", "Liste numerotee", <ListOrdered size={15} />))}
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
        className="min-h-[160px] w-full border border-ink/35 bg-background/35 px-3 py-2 typewriter text-base leading-relaxed outline-none transition-colors focus:border-accent focus:bg-background/60 focus:ring-2 focus:ring-accent/20 [&_em]:italic [&_i]:italic [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-bold [&_u]:underline [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
      />
    </div>
  );
};

/* ---------- Reel (Bobine) ---------- */
type ReelProps = {
  facet: Facet;
  skills: Record<string, number>;
  supernatural: Record<string, number>;
  onSkill: (facet: Facet, skill: string, value: number) => void;
  onSupernatural: (facet: Facet, skill: string, value: number) => void;
  mode: Mode;
  penalty: number;
  selectedKeys: Set<string>;
  onToggleSelect: (sel: RollSelection) => void;
  canSelectMore: boolean;
  supernaturalEnabled: boolean;
};

const numberRecordEqual = (a: Record<string, number>, b: Record<string, number>) => {
  if (a === b) return true;
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((key) => a[key] === b[key]);
};

const selectedKeysEqualForFacet = (facet: Facet, a: Set<string>, b: Set<string>) =>
  FACET_SKILLS[facet].every((skill) => a.has(`${facet}::${skill}`) === b.has(`${facet}::${skill}`));

const Reel = memo(({
  facet, skills, supernatural, onSkill, onSupernatural, mode, penalty,
  selectedKeys, onToggleSelect, canSelectMore, supernaturalEnabled,
}: ReelProps) => {
  const names = FACET_SKILLS[facet];
  const color = facetColor[facet];
  const paint = facetPaint[facet];
  const size = 352;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 138;
  const rPanelOuter = 112;
  const rPanelInner = 68;
  const rInner = 43;
  const segment = (Math.PI * 2) / names.length;
  const panelHalfAngle = segment * 0.27;
  const labelRadius = rOuter - 15;
  const supernaturalRadius = labelRadius + 22;
  const reelId = `reel-${facet}`;

  const effSkill = (s: string) => {
    const base = skills[s] ?? 0;
    return base >= 0 ? Math.max(base - penalty, 0) : base;
  };
  const effCore = Math.max(...names.map(effSkill));
  const critical = effCore <= 0;
  const coreOffsetX = facet === "ame" ? -2 : 0;
  const coreOffsetY = facet === "corps" ? 5 : 3;

  return (
    <div className="attribute-reel-wrap mx-auto flex w-full flex-col items-center justify-self-center" style={{ ["--reel-color" as string]: paint.reel }}>
      <h3 className="attribute-reel-title relative z-[5] font-display text-4xl mb-[-8px] -rotate-2" style={{ color: paint.label }}>{localizeNode(FACET_LABELS[facet])}</h3>
      <div className="attribute-reel-frame relative -mt-2">
        <div className="attribute-reel relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 z-[1] w-full h-full pointer-events-none">
          <defs>
            {names.map((s, i) => {
              const a = (i / names.length) * Math.PI * 2 - Math.PI / 2;
              const halfAngle = Math.min(segment * 0.43, Math.max(0.23, localizeText(s).length * 0.048));
              return <path key={s} id={`${reelId}-${i}`} d={labelArcPath(cx, cy, labelRadius, a, halfAngle)} />;
            })}
          </defs>
          <circle cx={cx} cy={cy} r={rOuter} fill={paint.reel} stroke={REEL_INK} strokeWidth={7} />
          {names.map((_, i) => {
            const a = ((i + 0.5) / names.length) * Math.PI * 2 - Math.PI / 2;
            const p1 = pointOnCircle(cx, cy, rInner, a);
            const p2 = pointOnCircle(cx, cy, rOuter - 5, a);
            return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={REEL_INK} strokeWidth={9} strokeLinecap="round" opacity={0.92} />;
          })}
          {names.map((s, i) => {
            const a = (i / names.length) * Math.PI * 2 - Math.PI / 2;
            const key = `${facet}::${s}`;
            const isSel = selectedKeys.has(key);
            return (
              <path
                key={s}
                d={annularSectorPath(cx, cy, rPanelOuter, rPanelInner, a - panelHalfAngle, a + panelHalfAngle)}
                fill={isSel ? paint.reel : REEL_PAPER}
                stroke={isSel ? "#fff7df" : REEL_INK}
                strokeWidth={4}
              />
            );
          })}
          {names.map((s, i) => {
            return (
              <text
                key={s}
                fill="#fff7df"
                stroke="rgba(0,0,0,0.96)"
                strokeWidth="3.2"
                strokeLinejoin="round"
                paintOrder="stroke fill"
                fontFamily="'Courier Prime', 'Courier New', monospace"
                fontSize="16"
                fontWeight={800}
                textAnchor="middle"
                dominantBaseline="central"
              >
                <textPath href={`#${reelId}-${i}`} startOffset="50%">
                  {localizeNode(s.toUpperCase())}
                </textPath>
              </text>
            );
          })}
          <circle cx={cx} cy={cy} r={rInner + 12} fill={paint.reel} stroke={REEL_INK} strokeWidth={7} />
          <circle cx={cx} cy={cy} r={rInner - 2} fill={REEL_PAPER} stroke="rgba(255,255,255,0.45)" strokeWidth={2} />
          <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={2} />
        </svg>

        {/* Center core (derived: max of effective skills) */}
        <div
          className="absolute z-[3] flex items-center justify-center pointer-events-none"
          style={{ left: cx, top: cy, transform: `translate(calc(-50% + ${coreOffsetX}px), calc(-50% + ${coreOffsetY}px))` }}
        >
          <div
            title={localizeText("Maximum des attributs (séquelles déduites)")}
            className={`w-12 h-12 rounded-full bg-transparent border-0 flex items-center justify-center font-display text-2xl drop-shadow-[1px_1px_0_rgba(255,255,255,0.8)] ${
              critical ? "text-destructive animate-pulse" : color.text
            }`}
          >
            {localizeNode(effCore)}
          </div>
        </div>

        {/* Skills around the wheel */}
        {names.map((s, i) => {
          const a = (i / names.length) * Math.PI * 2 - Math.PI / 2;
          const r = (rPanelInner + rPanelOuter) / 2;
          const needsValueOffset = s === "Précision" || s === "Influence" || s === "Mobilité";
          const x = cx + Math.cos(a) * r + (s === "Mobilité" ? -2 : needsValueOffset ? -1 : 0);
          const y = cy + Math.sin(a) * r + (i === 0 ? 3 : 0) + (needsValueOffset ? -2 : s === "Instinct" || s === "Perception" ? -2 : s === "Logique" ? -3 : 0);
          const base = skills[s] ?? 0;
          const v = effSkill(s);
          const key = `${facet}::${s}`;
          const isSel = selectedKeys.has(key);
          const disabled = !isSel && !canSelectMore;
          return (
            <div key={s} className="absolute z-[4] flex flex-col items-center" style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}>
              {localizeNode(mode === "edit" ? (
                <AttributeNumberInput value={base} onCommit={(next) => onSkill(facet, s, next)} />
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    onToggleSelect({
                      facet,
                      name: s,
                      value: v,
                      baseValue: base,
                      penalty,
                      supernaturalDice: supernaturalEnabled ? clampSupernaturalValue(supernatural[s] ?? 0) : 0,
                    })
                  }
                  title={localizeText(penalty > 0 ? `${base} − ${penalty} séquelle${penalty > 1 ? "s" : ""}` : undefined)}
                  className={`group flex h-16 w-20 items-center justify-center border-0 bg-transparent typewriter text-base font-bold transition-opacity ${
                    disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                  }`}
                  style={{ color: isSel ? "#fff7df" : REEL_VALUE }}
                >
                  <span
                    className={`drop-shadow-[1px_1px_0_rgba(255,255,255,0.85)] ${isSel ? "reel-value-pulse text-lg font-black" : ""}`}
                  >
                    {localizeNode(v)}
                  </span>
                </button>
              ))}
            </div>
          );
        })}
        {supernaturalEnabled && names.map((s, i) => {
          const a = (i / names.length) * Math.PI * 2 - Math.PI / 2;
          const value = clampSupernaturalValue(supernatural[s] ?? 0);
          if (mode === "edit") {
            const controlGap = 0.12 + Math.max(value, 1) * 0.035;
            const isBottomAttribute = Math.sin(a) > 0;
            const controls =
              value === 0
                ? [{ kind: "plus", angle: a }]
                : [
                    { kind: "minus", angle: a + (isBottomAttribute ? controlGap : -controlGap) },
                    { kind: "value", angle: a },
                    { kind: "plus", angle: a + (isBottomAttribute ? -controlGap : controlGap) },
                  ];
            return (
              <div key={`${s}-supernatural`} className="attribute-supernatural-stepper absolute inset-0 z-[5]" aria-label={localizeText(`Points surnaturels ${s}: ${value}`)}>
                {controls.map((control) => {
                  const controlX = cx + Math.cos(control.angle) * supernaturalRadius;
                  const controlY = cy + Math.sin(control.angle) * supernaturalRadius;
                  const commonStyle = {
                    left: controlX,
                    top: controlY,
                    transform: `translate(-50%, -50%) rotate(${control.angle + Math.PI / 2}rad)`,
                  };
                  if (control.kind === "minus") {
                    return (
                      <button
                        key="minus"
                        type="button"
                        className="attribute-supernatural-button attribute-supernatural-button-minus"
                        aria-label={localizeText(`Retirer un point surnaturel à ${s}`)}
                        onClick={() => onSupernatural(facet, s, value - 1)}
                        disabled={value <= 0}
                        style={commonStyle}
                      >
                        -
                      </button>
                    );
                  }
                  if (control.kind === "plus") {
                    return (
                      <button
                        key="plus"
                        type="button"
                        className="attribute-supernatural-button attribute-supernatural-button-plus"
                        aria-label={localizeText(`Ajouter un point surnaturel à ${s}`)}
                        onClick={() => onSupernatural(facet, s, value + 1)}
                        disabled={value >= 5}
                        style={commonStyle}
                      >
                        +
                      </button>
                    );
                  }
                  return (
                    <span key="value" aria-hidden="true" style={commonStyle}>
                      {localizeNode("★".repeat(value))}
                    </span>
                  );
                })}
              </div>
            );
          }
          const x = cx + Math.cos(a) * supernaturalRadius;
          const y = cy + Math.sin(a) * supernaturalRadius;
          return (
            <div key={`${s}-supernatural`} className="attribute-supernatural-marker absolute z-[5]" style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}>
              {value > 0 ? (
                <span className="attribute-supernatural-stars" aria-label={localizeText(`${value} points surnaturels`)}>
                  {supernaturalStarAngles(a, value, 0.058).map((starAngle, starIndex) => {
                    const starRadius = 4;
                    const starX = Math.cos(starAngle - a) * starRadius;
                    const starY = Math.sin(starAngle - a) * starRadius;
                    return (
                      <span
                        key={starIndex}
                        style={{
                          left: `calc(50% + ${starX}px)`,
                          top: `calc(50% + ${starY}px)`,
                          transform: `translate(-50%, -50%) rotate(${starAngle + Math.PI / 2}rad)`,
                        }}
                      >
                        ★
                      </span>
                    );
                  })}
                </span>
              ) : null}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  if (prev.facet !== next.facet || prev.mode !== next.mode || prev.penalty !== next.penalty) return false;
  if (prev.supernaturalEnabled !== next.supernaturalEnabled) return false;
  if (!numberRecordEqual(prev.skills, next.skills)) return false;
  if (!numberRecordEqual(prev.supernatural, next.supernatural)) return false;
  if (next.mode === "edit") return true;
  return prev.canSelectMore === next.canSelectMore && selectedKeysEqualForFacet(prev.facet, prev.selectedKeys, next.selectedKeys);
});

/* ---------- Film-frame cell with icon (Blessure / Stress / Chagrin) ---------- */
const StateCell = ({
  checked, onClick, capacity, renderIcon, activeClass, shielded = false,
}: {
  checked: boolean;
  onClick: () => void;
  capacity: number;
  renderIcon: (size: number) => React.ReactNode;
  activeClass: string;
  shielded?: boolean;
}) => {
  const iconSize = capacity >= 2 ? 18 : 22;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={checked}
      className={`relative w-14 h-12 mx-auto border-2 border-ink/40 bg-paper-dark/30 hover:border-accent transition-colors flex items-center justify-center gap-0.5 overflow-hidden ${
        checked ? `${activeClass} border-current` : capacity > 0 ? "text-foreground/15" : "text-transparent"
      }`}
    >
      <span className="absolute left-0 top-0 bottom-0 w-1 flex flex-col justify-evenly">
        <span className="block w-1 h-1 bg-ink/40" />
        <span className="block w-1 h-1 bg-ink/40" />
        <span className="block w-1 h-1 bg-ink/40" />
      </span>
      <span className="absolute right-0 top-0 bottom-0 w-1 flex flex-col justify-evenly">
        <span className="block w-1 h-1 bg-ink/40" />
        <span className="block w-1 h-1 bg-ink/40" />
        <span className="block w-1 h-1 bg-ink/40" />
      </span>
      {capacity === 0 ? null : Array.from({ length: capacity }).map((_, i) => (
        <span key={i}>{localizeNode(renderIcon(iconSize))}</span>
      ))}
      {localizeNode(shielded && (
        <span className="absolute top-0.5 right-1.5 text-[#253A72] pointer-events-none drop-shadow">
          <Shield size={12} strokeWidth={2.5} fill="currentColor" fillOpacity={0.25} />
        </span>
      ))}
    </button>
  );
};

const StateSummaryCard = ({
  title, value, penaltyLabel, icon, colorClass, detail,
}: {
  title: string;
  value: number;
  penaltyLabel: string;
  icon: React.ReactNode;
  colorClass: string;
  detail?: string;
}) => (
  <div className="border-2 border-ink bg-paper-dark/35 p-4 shadow-[3px_3px_0_hsl(var(--ink))]">
    <div className="flex items-center justify-between gap-3">
      <div className={`flex items-center gap-2 ${colorClass}`}>
        {localizeNode(icon)}
        <span className="font-display text-3xl leading-none">{localizeNode(value)}</span>
      </div>
      <span className="typewriter text-[10px] uppercase tracking-widest text-foreground/60 text-right">{localizeNode(title)}</span>
    </div>
    <div className="mt-3 flex items-center justify-between gap-3 border-t border-ink/20 pt-2">
      <span className={`typewriter text-sm font-bold ${value > 0 ? colorClass : "text-foreground/40"}`}>
        {localizeNode(penaltyLabel)}
      </span>
      {localizeNode(detail && <span className="typewriter text-[10px] uppercase tracking-widest text-foreground/55">{localizeNode(detail)}</span>)}
    </div>
  </div>
);

const ConditionTrack = ({
  title, levels, values, capacities, total, maxLevel, colorClass, accentClass, icon, criticalLabel, criticalChecked, onClick, onSetLevel, onCritical,
}: {
  title: string;
  levels: string[];
  values: boolean[];
  capacities: number[];
  total: number;
  maxLevel: number;
  colorClass: string;
  accentClass: string;
  icon: React.ReactNode;
  criticalLabel: string;
  criticalChecked: boolean;
  onClick: (index: number) => void;
  onSetLevel: (level: number) => void;
  onCritical: () => void;
}) => (
  <div className="paper-card p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-display text-2xl">{localizeNode(title)}</h2>
        <p className="typewriter text-xs uppercase tracking-widest text-foreground/55">
          {localizeNode(maxLevel > 0 ? levels[maxLevel - 1] : "Stable")}
        </p>
      </div>
      <div className={`flex items-center gap-2 typewriter text-sm uppercase tracking-widest ${colorClass}`}>
        {localizeNode(icon)}
        <span className="font-bold">{localizeNode(total)}</span>
      </div>
    </div>
    <div className="mb-4 hidden items-center gap-3 md:flex">
      <input maxLength={100000}
        type="range"
        min={0}
        max={levels.length}
        value={maxLevel}
        onChange={(e) => onSetLevel(parseInt(e.target.value, 10))}
        className={`flex-1 cursor-pointer ${accentClass}`}
      />
      <span className={`font-display text-2xl w-8 text-center ${colorClass}`}>{localizeNode(maxLevel)}</span>
    </div>
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-8">
      {levels.map((level, index) => {
        const checked = values[index];
        const capacity = capacities[index] ?? 0;
        return (
          <button
            key={level}
            type="button"
            onClick={() => onClick(index)}
            aria-pressed={checked}
            className={`min-h-[76px] border-2 px-1 py-2 transition-colors ${
              checked ? `${colorClass} border-current bg-paper-dark` : "border-ink/25 text-foreground/45 hover:border-accent"
            }`}
          >
            <div className="font-display text-xl leading-none">{localizeNode(index + 1)}</div>
            <div className="mt-1 typewriter text-[9px] uppercase leading-tight">{localizeNode(level)}</div>
            <div className="mt-1 flex justify-center gap-0.5">
              {capacity > 0 && Array.from({ length: capacity }).map((_, i) => (
                <span key={i}>{localizeNode(icon)}</span>
              ))}
            </div>
          </button>
        );
      })}
      <button
        type="button"
        disabled={maxLevel < levels.length}
        onClick={onCritical}
        className={`min-h-[76px] border-2 px-1 py-2 transition-colors ${
          criticalChecked
            ? `${colorClass} border-current bg-current/10`
            : maxLevel >= levels.length
            ? "border-ink/35 bg-transparent text-foreground/70 hover:border-accent hover:bg-paper-dark/40"
            : "cursor-not-allowed border-ink/15 text-foreground/25"
        }`}
      >
        <div className="flex h-full flex-col items-center justify-center gap-1">
          {localizeNode(icon)}
          <span className="typewriter text-[9px] font-bold uppercase leading-tight">{localizeNode(criticalLabel)}</span>
          {localizeNode(maxLevel >= levels.length && !criticalChecked && (
            <span className="typewriter text-[8px] uppercase tracking-widest text-foreground/45">{localizeText("Disponible")}</span>
          ))}
        </div>
      </button>
    </div>
  </div>
);

const CardSection = ({
  title, children, className = "", style,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) => (
  <section className={`hero-card-section ${className}`} style={style}>
    <h3 className="hero-card-section-title">{localizeNode(title)}</h3>
    {children}
  </section>
);

const SequelMark = ({ value, icon }: { value: number; icon: React.ReactNode }) => {
  if (value <= 0) return <span className="hero-card-sequel is-empty" aria-hidden="true" />;
  return (
    <span className={`hero-card-sequel ${value > 1 ? "is-stacked" : ""}`}>
      {Array.from({ length: value }).map((_, index) => (
        <span key={index} className="hero-card-sequel-icon">
          {localizeNode(isValidElement(icon) ? cloneElement(icon, { key: index } as React.Attributes) : icon)}
        </span>
      ))}
    </span>
  );
};

const HeroCardSequelIcon = ({ src, className = "" }: { src: string; className?: string }) => (
  <img src={src} alt="" className={`hero-card-sequel-image ${className}`} draggable={false} />
);

type CardCheckTarget =
  | { kind: "injury"; loc: string; index: number }
  | { kind: "stress" | "grief"; index: number };

const CardCheckCell = ({
  checked, label, sequel, icon, onClick, onContextMenu, ariaLabel, checkColor,
}: {
  checked: boolean;
  label?: string;
  sequel: number;
  icon: React.ReactNode;
  onClick?: () => void;
  onContextMenu?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  ariaLabel?: string;
  checkColor?: string;
}) => (
  <button
    type="button"
    className="hero-card-check-cell"
    onClick={onClick}
    onContextMenu={onContextMenu}
    aria-label={localizeText(ariaLabel)}
    aria-pressed={checked}
    style={checkColor ? ({ "--hero-card-check-color": checkColor } as React.CSSProperties) : undefined}
  >
    <span className={`hero-card-checkbox ${checked ? "is-checked" : ""}`}>
      {localizeNode(checked && <span className="hero-card-checkmark">X</span>)}
    </span>
    <SequelMark value={sequel} icon={icon} />
    {localizeNode(label && <span className="hero-card-cell-label">{localizeNode(label)}</span>)}
  </button>
);

const CardLevelHeader = ({ labels }: { labels: string[] }) => (
  <div className="hero-card-level-header">
    {labels.map((label, index) => (
      <span key={`${label}-${index}`}>
        <strong>{localizeNode(index + 1)}</strong>
        {localizeNode(label)}
      </span>
    ))}
  </div>
);

const CardTrack = ({
  labels, checked, capacities, sequelIcon, onChange, onColorMenu, getCheckColor, ariaPrefix,
}: {
  labels: string[];
  checked: boolean[];
  capacities: number[];
  sequelIcon: React.ReactNode;
  onChange: (index: number) => void;
  onColorMenu: (event: React.MouseEvent<HTMLButtonElement>, index: number) => void;
  getCheckColor: (index: number) => string;
  ariaPrefix: string;
}) => (
  <div className="hero-card-state-track">
    <CardLevelHeader labels={labels} />
    <div className="hero-card-track">
      {labels.map((label, index) => (
        <CardCheckCell
          key={`${label}-${index}`}
          checked={checked[index] ?? false}
          sequel={capacities[index] ?? 0}
          icon={sequelIcon}
          onClick={() => onChange(index)}
          onContextMenu={(event) => onColorMenu(event, index)}
          checkColor={getCheckColor(index)}
          ariaLabel={`${ariaPrefix} ${index + 1} - ${label}`}
        />
      ))}
    </div>
  </div>
);

const shortText = (value: string, fallback = "") => value.trim() || fallback;

const accessoriesToRichText = (items: Character["autresAccessoires"]) =>
  items
    .map((item) => {
      const title = item.nom.trim();
      const name = (title ? `<strong>${escapeHtml(title)}</strong>` : "") + ((item.quantite ?? 1) > 1 ? ` × ${item.quantite}` : "");
      const detail = item.proprietes.trim();
      if (name && detail) return `${name} : ${richTextToHtml(detail)}`;
      if (name) return name;
      return detail;
    })
    .filter(Boolean)
    .join("<br>");


const heroHeaderFontSize = (name: string) => {
  const length = name.length;
  if (length <= 16) return "3.9mm";
  if (length <= 24) return "3.25mm";
  if (length <= 34) return "2.75mm";
  if (length <= 46) return "2.35mm";
  return "2mm";
};

const HeroCardHeader = ({
  tab,
  name,
  style,
}: {
  tab: HeroCardTab;
  name: string;
  style: React.CSSProperties;
}) => {
  const Icon = tab === 'back' ? BookOpen : TAB_ICONS[tab];
  return (
    <header className="hero-card-header" style={style}>
      <Icon size={20} strokeWidth={2.4} />
      <span title={localizeText(name)}>{localizeNode(name)}</span>
    </header>
  );
};

const densityScale = (score: number, comfortableScore: number, minimum = 0.58) =>
  Math.max(minimum, Math.min(1, comfortableScore / Math.max(score, comfortableScore)));

const textDensityScale = (score: number, comfortableScore: number, minimum = 0.62) =>
  Number(densityScale(score, comfortableScore, minimum).toFixed(3));

const splitTextIntoCardPages = (value: string, maxChars = 1250, followingMaxChars = maxChars) => {
  const text = value.trim();
  if (!text) return [""];
  const pages: string[] = [];
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  let page = "";

  const pushPage = () => {
    if (page.trim()) pages.push(page.trim());
    page = "";
  };

  const pageCapacity = () => Math.max(1, pages.length === 0 ? maxChars : followingMaxChars);

  paragraphs.forEach((paragraph) => {
    const next = page ? `${page}\n\n${paragraph}` : paragraph;
    if (next.length <= pageCapacity()) {
      page = next;
      return;
    }

    if (page) pushPage();
    if (paragraph.length <= pageCapacity()) {
      page = paragraph;
      return;
    }

    paragraph.split(/\s+/).forEach((word) => {
      const candidate = page ? `${page} ${word}` : word;
      if (candidate.length > pageCapacity() && page) pushPage();
      page = page ? `${page} ${word}` : word;
    });
  });

  pushPage();
  return pages.length ? pages : [""];
};

const splitNotesIntoCardPages = (value: string, maxVisualLines: number, charsPerLine: number) => {
  if (!value) return [""];
  const pages: string[] = [];
  let pageLines: string[] = [];
  let visualLines = 0;

  const pushPage = () => {
    pages.push(pageLines.join("\n"));
    pageLines = [];
    visualLines = 0;
  };

  value.replace(/\r/g, "").split("\n").forEach((line) => {
    const lineCost = Math.max(1, Math.ceil(Math.max(line.length, 1) / Math.max(1, charsPerLine)));
    if (pageLines.length > 0 && visualLines + lineCost > maxVisualLines) pushPage();
    pageLines.push(line);
    visualLines += lineCost;
  });

  if (pageLines.length > 0 || pages.length === 0) pushPage();
  return pages;
};

const splitTextIntoMeasuredCardPages = (
  value: string,
  firstPageLines: number,
  followingPageLines: number,
  charsPerLine: number,
) => {
  if (!value.trim()) return [""];
  const pages: string[] = [];
  let pageLines: string[] = [];
  let usedLines = 0;
  const safeCharsPerLine = Math.max(1, charsPerLine);
  const capacity = () => Math.max(1, pages.length === 0 ? firstPageLines : followingPageLines);
  const pushPage = () => {
    pages.push(pageLines.join("\n"));
    pageLines = [];
    usedLines = 0;
  };

  value.replace(/\r/g, "").split("\n").forEach((sourceLine) => {
    let remaining = sourceLine;
    do {
      const availableLines = capacity() - usedLines;
      if (availableLines <= 0) {
        pushPage();
        continue;
      }
      const availableChars = availableLines * safeCharsPerLine;
      if (Math.max(remaining.length, 1) <= availableChars) {
        pageLines.push(remaining);
        usedLines += Math.max(1, Math.ceil(Math.max(remaining.length, 1) / safeCharsPerLine));
        remaining = "";
        continue;
      }

      let splitAt = remaining.lastIndexOf(" ", availableChars);
      if (splitAt <= 0) splitAt = availableChars;
      pageLines.push(remaining.slice(0, splitAt).trimEnd());
      remaining = remaining.slice(splitAt).trimStart();
      usedLines = capacity();
      if (remaining) pushPage();
    } while (remaining);
  });

  if (pageLines.length > 0 || pages.length === 0) pushPage();
  return pages;
};

const CHECK_COLOR_PALETTE = [
  { id: "default", label: "Defaut", value: "" },
  { id: "red", label: "Rouge", value: "#7F240F" },
  { id: "green", label: "Vert", value: "#3E7A2F" },
  { id: "blue", label: "Bleu", value: "#253A72" },
  { id: "gold", label: "Or", value: "#a56712" },
  { id: "black", label: "Noir", value: "#19120d" },
];

const CARD_REEL_IMAGES: Record<Facet, string> = {
  corps: "/ClapOwlBear/reels/corps.png",
  esprit: "/ClapOwlBear/reels/esprit.png",
  ame: "/ClapOwlBear/reels/ame.png",
};

const safePdfFileName = (name: string) => (name || "personnage").replace(/\s+/g, "_");

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const escapeXmlText = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const resourceDataUrls = new Map<string, Promise<string>>();

const resourceToDataUrl = (url: string) => {
  const absoluteUrl = new URL(url, window.location.href).href;
  if (!resourceDataUrls.has(absoluteUrl)) {
    resourceDataUrls.set(
      absoluteUrl,
      fetch(absoluteUrl).then((response) => {
        if (!response.ok) throw new Error(`Carte introuvable: ${absoluteUrl}`);
        return response.blob().then(blobToDataUrl);
      }),
    );
  }
  return resourceDataUrls.get(absoluteUrl)!;
};

const inlineCssUrls = async (cssText: string) => {
  const replacements = await Promise.all(
    Array.from(cssText.matchAll(/url\(["']?([^"')]+)["']?\)/g)).map(async ([full, url]) => {
      if (!url || url.startsWith("data:") || url.startsWith("#")) return [full, full] as const;
      try {
        return [full, `url("${await resourceToDataUrl(url)}")`] as const;
      } catch {
        return [full, full] as const;
      }
    }),
  );

  return replacements.reduce((next, [from, to]) => next.replaceAll(from, to), cssText);
};

const collectStylesheetText = async () => {
  const cssText = Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules)
          .map((rule) => {
            const text = rule.cssText;
            if (text.startsWith("@import") || text.startsWith("@font-face")) return "";
            return text;
          })
          .join("\n");
      } catch {
        return "";
      }
    })
    .join("\n");

  const safeCssText = cssText
    .replace(/@import[^;]+;/g, "")
    .replace(/@font-face\s*{[^}]*}/g, "")
    .replace(/url\(["']?https?:\/\/[^"')]+["']?\)/g, "none");

  return inlineCssUrls(safeCssText);
};

const inlineCloneImages = async (source: HTMLElement, clone: HTMLElement) => {
  const images = Array.from(clone.querySelectorAll("img"));
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      try {
        img.setAttribute("src", await resourceToDataUrl(src));
      } catch {
        /* Keep the original src if an optional image cannot be inlined. */
      }
    }),
  );

  const svgImages = Array.from(clone.querySelectorAll("image"));
  await Promise.all(
    svgImages.map(async (image) => {
      const href = image.getAttribute("href") || image.getAttribute("xlink:href");
      if (!href || href.startsWith("data:")) return;
      try {
        image.setAttribute("href", await resourceToDataUrl(href));
        image.removeAttribute("xlink:href");
      } catch {
        /* Keep the original href if an optional image cannot be inlined. */
      }
    }),
  );

  const sourceElements = [source, ...Array.from(source.querySelectorAll<HTMLElement>("*"))];
  const cloneElements = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))];
  await Promise.all(
    sourceElements.map(async (sourceElement, index) => {
      const backgroundImage = getComputedStyle(sourceElement).backgroundImage;
      if (!backgroundImage || backgroundImage === "none" || !backgroundImage.includes("url(")) return;
      const cloneElement = cloneElements[index];
      if (!cloneElement) return;
      const inlined = await Promise.all(
        Array.from(backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)).map(async ([full, url]) => {
          try {
            return [full, `url("${await resourceToDataUrl(url)}")`] as const;
          } catch {
            return [full, full] as const;
          }
        }),
      );
      cloneElement.style.backgroundImage = inlined.reduce(
        (next, [from, to]) => next.replace(from, to),
        backgroundImage,
      );
    }),
  );
};

const openHeroCardsA6Print = async (cards: HTMLElement[], title: string, printWindow: Window) => {
  const cssText = await collectStylesheetText();
  const clones = await Promise.all(
    cards.slice(0, 4).map(async (card) => {
      const clone = card.cloneNode(true) as HTMLElement;
      const cardInk = getComputedStyle(card).getPropertyValue("--hero-card-ink").trim();
      if (cardInk) clone.style.setProperty("--hero-card-ink", cardInk);
      clone.style.setProperty("max-width", "none", "important");
      clone.style.setProperty("width", "105mm", "important");
      clone.style.setProperty("height", "148mm", "important");
      clone.style.setProperty("aspect-ratio", "105 / 148", "important");
      await inlineCloneImages(card, clone);
      return new XMLSerializer().serializeToString(clone);
    }),
  );

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeXmlText(title)}</title>
        <style>${escapeXmlText(cssText)}</style>
        <style>
          @page { size: A4 portrait; margin: 0; }
          * { box-sizing: border-box; }
          html, body { margin: 0; min-height: 297mm; background: #fff; }
          body {
            margin: 0;
            overflow: hidden;
            position: relative;
            width: 210mm;
            height: 297mm;
          }
          .print-hint {
            color: #3a1307;
            font-family: system-ui, sans-serif;
            font-size: 12px;
            left: 8mm;
            position: fixed;
            right: 8mm;
            top: 4mm;
            z-index: 10;
          }
          .a6-slot {
            display: block;
            height: 148mm;
            overflow: hidden;
            position: fixed;
            width: 105mm;
          }
          .a6-slot:nth-of-type(1) { left: 0; top: 0; }
          .a6-slot:nth-of-type(2) { left: 105mm; top: 0; }
          .a6-slot:nth-of-type(3) { left: 0; top: 148mm; }
          .a6-slot:nth-of-type(4) { left: 105mm; top: 148mm; }
          .a6-slot-inner {
            display: block;
            height: 148mm;
            width: 105mm;
          }
          .a6-slot .hero-print-card {
            border: 3mm solid var(--hero-card-ink, #3a1307);
            box-shadow: none !important;
            break-inside: avoid;
            flex: 0 0 auto;
            height: 148mm !important;
            max-width: none !important;
            transform: none !important;
            transform-origin: center center !important;
            width: 105mm !important;
          }
          .a6-slot .hero-character-card {
            overflow: hidden !important;
          }
          .a6-slot .hero-card-identity,
          .a6-slot .hero-card-identity h3,
          .a6-slot .hero-card-identity dt,
          .a6-slot .hero-card-identity dd,
          .a6-slot .hero-card-concept {
            color: var(--hero-card-ink, #3a1307) !important;
          }
          .a6-slot .hero-card-injury-header,
          .a6-slot .hero-card-injury-row {
            grid-template-columns: 25mm minmax(0, 1fr) !important;
          }
          .a6-slot .hero-card-injury-header > span {
            font-size: 2.6mm !important;
            line-height: 1 !important;
          }
          .a6-slot .hero-card-level-header span {
            font-size: calc(1.9mm * var(--hero-card-copy-scale)) !important;
            line-height: 1 !important;
          }
          .a6-slot .hero-card-location {
            gap: 0.8mm !important;
            grid-template-columns: minmax(0, 1fr) 5.7mm !important;
          }
          .a6-slot .hero-card-location > span {
            font-size: calc(3.1mm * var(--hero-card-copy-scale)) !important;
            line-height: 1 !important;
            overflow-wrap: normal !important;
            word-break: normal !important;
          }
          .a6-slot .hero-card-location strong {
            font-size: calc(2.3mm * var(--hero-card-copy-scale)) !important;
          }
          .a6-slot .hero-card-cell-label {
            font-size: calc(1.55mm * var(--hero-card-copy-scale)) !important;
          }
          .hero-card-check-menu,
          .hero-card-color-picker {
            display: none !important;
          }
          @media print {
            .print-hint { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="print-hint">Pour une vraie taille A6 : impression A4, echelle 100%, marges aucune, en-tetes/pieds de page desactives.</div>
        ${clones
          .map((clone) => `<div class="a6-slot"><div class="a6-slot-inner">${clone}</div></div>`)
          .join("")}
      </body>
    </html>`);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
};

const MiniFacetReel = ({
  facet,
  skills,
  supernatural,
  penalty = 0,
  splashOnly = false,
  labelsOnly = false,
  selectedKeys,
  onToggleSelect,
  canSelectMore = true,
  supernaturalEnabled,
}: {
  facet: Facet;
  skills: Record<string, number>;
  supernatural: Record<string, number>;
  penalty?: number;
  splashOnly?: boolean;
  labelsOnly?: boolean;
  selectedKeys?: Set<string>;
  onToggleSelect?: (sel: RollSelection) => void;
  canSelectMore?: boolean;
  supernaturalEnabled: boolean;
}) => {
  const names = FACET_SKILLS[facet];
  const paint = facetPaint[facet];
  const size = 260;
  const imageHeight = 390;
  const cx = size / 2;
  const cy = imageHeight / 2;
  const segment = (Math.PI * 2) / names.length;
  // Follow the painted rim, whose centre differs slightly from the SVG centre
  // after each reel image's rotation/reflection.
  const labelRing = {
    corps: { x: 130, y: 196.5, radius: 95 },
    esprit: { x: 131, y: 194, radius: 95 },
    ame: { x: 126.5, y: 194, radius: 96 },
  }[facet];
  const labelRadius = labelRing.radius;
  const supernaturalLabelRadius = labelRadius + 9;
  const valueRadius = 66;
  const reelId = `card-reel-${facet}${splashOnly ? "-splash" : labelsOnly ? "-labels" : ""}`;
  const labelOffset = facet === "esprit" || facet === "ame" ? "5px" : "0px";
  const coreOffsetX = facet === "ame" ? -2 : 0;
  const coreOffsetY = facet === "corps" ? 13 : 11;
  const reelImageTransform =
    facet === "corps"
      ? `rotate(-70 ${cx} ${cy})`
    : facet === "esprit"
      ? `translate(${size} 0) scale(-1 1) rotate(-288 ${cx} ${cy})`
    : facet === "ame"
      ? `rotate(432 ${cx} ${cy})`
      : undefined;
  const effectiveSkill = (name: string) => {
    const base = skills[name] ?? 0;
    return base >= 0 ? Math.max(base - penalty, 0) : base;
  };
  const core = Math.max(...names.map(effectiveSkill));

  return (
    <article
      className={`hero-mini-reel ${splashOnly ? "is-splash-layer" : ""} ${labelsOnly ? "is-label-layer" : ""}`}
      aria-hidden={splashOnly || labelsOnly}
      style={{ ["--hero-mini-reel-label-offset" as string]: labelOffset }}
    >
      <h4 style={{ color: paint.label }}>{localizeNode(FACET_LABELS[facet])}</h4>
      <svg
        viewBox={`0 0 ${size} ${imageHeight}`}
        aria-label={localizeText(`Bobine ${FACET_LABELS[facet]}`)}
        className={onToggleSelect && !splashOnly ? "hero-mini-reel-svg is-clickable" : undefined}
      >
        <defs>
          <filter id={`${reelId}-invert-alpha`} x="0" y="0" width={size} height={imageHeight} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -1 1" /></filter>
          <mask id={`${reelId}-notches`} x="0" y="0" width={size} height={imageHeight} maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }}><image href={CARD_REEL_IMAGES[facet]} x={0} y={0} width={size} height={imageHeight} preserveAspectRatio="xMidYMid meet" transform={reelImageTransform} filter={`url(#${reelId}-invert-alpha)`} /></mask>
          <clipPath id={`${reelId}-image-clip`}>
            <circle cx={cx} cy={cy} r="118" />
          </clipPath>
          {names.map((name, index) => {
            const a = (index / names.length) * Math.PI * 2 - Math.PI / 2;
            const halfAngle = Math.min(segment * 0.45, Math.max(0.3, localizeText(name).length * 0.055));
            return (
              <g key={name}>
                <path id={`${reelId}-${index}`} d={labelArcPath(labelRing.x, labelRing.y, labelRadius, a, halfAngle)} />
                <path id={`${reelId}-${index}-supernatural`} d={labelArcPath(labelRing.x, labelRing.y, supernaturalLabelRadius, a, halfAngle)} />
              </g>
            );
          })}
        </defs>
        {localizeNode(!labelsOnly && <image
          href={CARD_REEL_IMAGES[facet]}
          x={0}
          y={0}
          width={size}
          height={imageHeight}
          preserveAspectRatio="xMidYMid meet"
          transform={reelImageTransform}
          clipPath={splashOnly ? undefined : `url(#${reelId}-image-clip)`}
        />)}
        {!splashOnly && (
          <>
        {labelsOnly && names.map((name, index) => (
          <text
            key={name}
            fill="#fff7df"
            stroke="rgba(0,0,0,0.96)"
            strokeWidth="2.6"
            strokeLinejoin="round"
            paintOrder="stroke fill"
            fontFamily="'Courier Prime', 'Courier New', monospace"
            fontSize="15.5"
            fontWeight={800}
            textAnchor="middle"
            dominantBaseline="central"
          >
            <textPath href={`#${reelId}-${index}`} startOffset="50%">
              {localizeNode(name.toUpperCase())}
            </textPath>
          </text>
        ))}
        {!labelsOnly && <>
        <text
          x={cx + coreOffsetX}
          y={cy + coreOffsetY}
          fill={paint.reel}
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="2"
          paintOrder="stroke fill"
          fontFamily="'Anton', 'Impact', sans-serif"
          fontSize="32"
          fontWeight={800}
          textAnchor="middle"
        >
          {localizeNode(core)}
        </text>
        {names.map((name, index) => {
          const a = (index / names.length) * Math.PI * 2 - Math.PI / 2;
          const needsValueOffset = name === "Précision" || name === "Influence" || name === "Mobilité";
          const x = cx + Math.cos(a) * valueRadius + (name === "Mobilité" ? -2 : needsValueOffset ? -1 : 0);
          const y = cy + Math.sin(a) * valueRadius + 6 + (index === 0 ? 3 : 0) + (needsValueOffset ? -2 : name === "Instinct" || name === "Perception" ? -2 : name === "Logique" ? -3 : 0);
          const value = effectiveSkill(name);
          const base = skills[name] ?? 0;
          const key = `${facet}::${name}`;
          const isSelected = selectedKeys?.has(key) ?? false;
          const disabled = !isSelected && !canSelectMore;
          return (
            <g
              key={name}
              aria-label={localizeText(`${name} ${value}`)}
              aria-disabled={disabled || undefined}
              data-facet={facet}
              data-name={name}
              data-value={value}
              data-base={base}
              data-penalty={penalty}
              data-supernatural={supernaturalEnabled ? clampSupernaturalValue(supernatural[name] ?? 0) : 0}
              className={onToggleSelect ? `hero-mini-reel-value ${isSelected ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}` : undefined}
            >
              {localizeNode(isSelected && (
                <path
                  className="hero-mini-reel-value-fill"
                  d={annularSectorPath(cx, cy, 94, 37, a - segment * .45, a + segment * .45)}
                  mask={`url(#${reelId}-notches)`}
                  fill={paint.reel}
                />
              ))}
              <text
                x={x}
                y={y}
                fill={isSelected ? "#fff7df" : REEL_VALUE}
                stroke={isSelected ? "rgba(0,0,0,0.95)" : "rgba(255,255,255,0.85)"}
                strokeWidth="2"
                paintOrder="stroke fill"
                fontFamily="'Courier Prime', 'Courier New', monospace"
                fontSize={isSelected ? "23" : "20"}
                fontWeight={800}
                textAnchor="middle"
              >
                {localizeNode(value)}
              </text>
            </g>
          );
        })}
        </>}
        {labelsOnly && supernaturalEnabled && names.map((name, index) => {
          const value = clampSupernaturalValue(supernatural[name] ?? 0);
          if (value <= 0) return null;
          return (
            <text
              key={`${name}-supernatural`}
              className="hero-mini-reel-supernatural"
              fill="#fff7df"
              stroke="rgba(0,0,0,0.92)"
              strokeWidth="1.6"
              paintOrder="stroke fill"
              fontFamily="'Courier Prime', 'Courier New', monospace"
              fontSize="8.8"
              fontWeight={800}
              textAnchor="middle"
              dominantBaseline="central"
            >
              <textPath href={`#${reelId}-${index}-supernatural`} startOffset="50%">
                {localizeNode("★".repeat(value))}
              </textPath>
            </text>
          );
        })}
          </>
        )}
      </svg>
    </article>
  );
};

const characterProtectionByLoc = (c: Character | null): Record<string, number> => {
    const map: Record<string, number> = Object.fromEntries(INJURY_LOCATIONS.map((l) => [l, 0]));
    if (!c) return map;
    const cap = (n: number) => Math.min(7, isNaN(n) ? 0 : n);
    for (const armure of c!.armures) {
      const groups = (armure.protection || "").split("/").map((g) => g.replace(/\D/g, ""));
      if (groups.length === 0) continue;
      const [gTete = "", gSup = "", gCentre = "", gInf = ""] = groups;
      const slot: Record<string, number> = {
        "Tête": cap(parseInt(gTete[0] ?? "0", 10)),
        "Supérieure Gauche": cap(parseInt(gSup[0] ?? "0", 10)),
        "Supérieure Droite": cap(parseInt(gSup[1] ?? gSup[0] ?? "0", 10)),
        "Centrale": cap(parseInt(gCentre[0] ?? "0", 10)),
        "Inférieure Gauche": cap(parseInt(gInf[0] ?? "0", 10)),
        "Inférieure Droite": cap(parseInt(gInf[1] ?? gInf[0] ?? "0", 10)),
      };
      for (const l of INJURY_LOCATIONS) {
        if (slot[l] > map[l]) map[l] = slot[l];
      }
    }
    return map;
};

export const CharacterCards = ({
  c,
  activeCardTab,
  boardRef,
  selectedKeys = new Set<string>(),
  onToggleSelect,
  canSelectMore = false,
  injuryTotal = INJURY_LOCATIONS.reduce((sum, loc) => sum + (c!.injuries[loc] ?? []).reduce((n, checked, i) => n + (checked ? INJURY_CAPACITY[loc]?.[i] ?? 0 : 0), 0), 0),
  stressTotal = c!.stress.reduce((sum, checked, i) => sum + (checked ? STRESS_CAPACITY[i] ?? 0 : 0), 0),
  griefTotal = c!.griefs.reduce((sum, checked, i) => sum + (checked ? GRIEF_CAPACITY[i] ?? 0 : 0), 0),
  stressMax = c!.stress.lastIndexOf(true) + 1,
  griefMax = c!.griefs.lastIndexOf(true) + 1,
  protectionByLoc = characterProtectionByLoc(c),
  onInjuryChange = () => {},
  onStressChange = () => {},
  onGriefChange = () => {},
  onCheckColorChange = () => {},
  onCriticalSummaryToggle = () => {},
  onNotesChange,
}: {
  c: Character;
  activeCardTab: HeroCardTab;
  boardRef?: React.RefObject<HTMLDivElement>;
  selectedKeys?: Set<string>;
  onToggleSelect?: (sel: RollSelection) => void;
  canSelectMore?: boolean;
  injuryTotal?: number;
  stressTotal?: number;
  griefTotal?: number;
  stressMax?: number;
  griefMax?: number;
  protectionByLoc?: Record<string, number>;
  onInjuryChange?: (loc: string, index: number) => void;
  onStressChange?: (index: number) => void;
  onGriefChange?: (index: number) => void;
  onCheckColorChange?: (target: CardCheckTarget, color: string) => void;
  onCriticalSummaryToggle?: (kind: "agony" | "mentalBreak" | "emotionalBreak") => void;
  onNotesChange?: (notes: string) => void;
}) => {
  const localCardBoardRef = useRef<HTMLDivElement>(null);
  const cardBoardRef = boardRef ?? localCardBoardRef;
  const [checkColorMenu, setCheckColorMenu] = useState<{
    x: number;
    y: number;
    target: CardCheckTarget;
  } | null>(null);
  const [notePageMetrics, setNotePageMetrics] = useState({ lines: 32, charsPerLine: 52 });
  const [lorePageMetrics, setLorePageMetrics] = useState({ firstLines: 12, followingLines: 32, charsPerLine: 52 });
  const inventoryWeapons = c!.armes.filter((item) => item.nom || item.degats || item.proprietes);
  const inventoryArmors = c!.armures.filter((item) => item.nom || item.poids || item.protection || item.proprietes);
  const inventoryRichText = accessoriesToRichText(c!.autresAccessoires);
  const inventoryNotes = richTextToPlainText(inventoryRichText).trim();
  const inventoryScore =
    inventoryWeapons.reduce((sum, item) => sum + item.nom.length + item.degats.length + item.proprietes.length, 0) +
    inventoryArmors.reduce((sum, item) => sum + item.nom.length + item.poids.length + item.protection.length + item.proprietes.length, 0) +
    inventoryNotes.length +
    (inventoryWeapons.length + inventoryArmors.length) * 28;

  const identityScore = c!.nom.length * 1.4 + c!.concept.length + c!.replique.length + c!.age.length + c!.taille.length + c!.poids.length;
  const identityScale = densityScale(identityScore, 260, 0.02);
  const constantsScale = 1;
  const specialiteCopyScale = textDensityScale(richTextToPlainText(c!.specialite).length, 150);
  const inventoryCopyScale = textDensityScale(inventoryScore, 500, 0.52);
  useLayoutEffect(() => {
    const section = cardBoardRef.current?.querySelector<HTMLElement>(".hero-card-traits-section");
    const copy = section?.querySelector<HTMLElement>(".hero-card-copy");
    if (!section || !copy) return;
    let disposed = false;
    const fit = () => {
      if (disposed || !section.clientHeight) return;
      const css = getComputedStyle(section);
      const available = section.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom) - 1;
      const setScale = (scale: number) => section.style.setProperty("--hero-card-section-copy-scale", String(scale));
      setScale(1);
      if (copy.scrollHeight <= available) return;
      let low = 0.05, high = 1;
      for (let step = 0; step < 12; step += 1) {
        const middle = (low + high) / 2;
        setScale(middle);
        if (copy.scrollHeight <= available) low = middle;
        else high = middle;
      }
      setScale(low);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(section);
    void document.fonts?.ready.then(fit);
    return () => { disposed = true; observer.disconnect(); };
  }, [c!.traits, c!.autresAccessoires, c!.armes, c!.armures, activeCardTab, cardBoardRef]);
  const identityLorePages = useMemo(
    () => splitTextIntoMeasuredCardPages(
      c!.lore,
      lorePageMetrics.firstLines,
      lorePageMetrics.followingLines,
      lorePageMetrics.charsPerLine,
    ),
    [c!.lore, lorePageMetrics],
  );
  const notePages = useMemo(
    () => splitNotesIntoCardPages(c!.notes, notePageMetrics.lines, notePageMetrics.charsPerLine),
    [c!.notes, notePageMetrics],
  );
  const restoreNotesCaret = (globalCaretOffset: number) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const editors = Array.from(cardBoardRef.current?.querySelectorAll<HTMLTextAreaElement>(".hero-note-card-editable:not(.hidden) .hero-card-copy-editable") ?? []);
      let remainingOffset = globalCaretOffset;
      let targetEditor = editors[editors.length - 1];
      for (const editor of editors) {
        const pageLength = editor.value.length;
        if (remainingOffset <= pageLength) {
          targetEditor = editor;
          break;
        }
        remainingOffset -= pageLength + 1;
      }
      if (!targetEditor) return;
      targetEditor.focus();
      const caretOffset = Math.min(remainingOffset, targetEditor.value.length);
      targetEditor.setSelectionRange(caretOffset, caretOffset);
    }));
  };
  const heroHeaderName = shortText(c!.nom);
  const heroHeaderStyle = { ["--hero-card-header-font-size" as string]: heroHeaderFontSize(heroHeaderName) };
  const penaltyByFacet = useMemo<Record<Facet, number>>(
    () => ({
      corps: injuryTotal,
      esprit: stressTotal,
      ame: griefTotal,
    }),
    [injuryTotal, stressTotal, griefTotal],
  );
  const effectiveCardCore = (facet: Facet) => {
    const values = FACET_SKILLS[facet].map((name) => {
      const base = c!.facets[facet].skills[name] ?? 0;
      return base >= 0 ? Math.max(base - penaltyByFacet[facet], 0) : base;
    });
    return Math.max(...values);
  };
  const stateCriticalSummary = {
    agony:
      Object.values(c!.criticalStates.agony).some(Boolean) ||
      effectiveCardCore("corps") <= 0,
    mentalBreak: c!.criticalStates.mentalBreak || stressMax >= STRESS_LEVELS.length || effectiveCardCore("esprit") <= 0,
    emotionalBreak: c!.criticalStates.emotionalBreak || griefMax >= GRIEF_LEVELS.length || effectiveCardCore("ame") <= 0,
  };
  const openCheckColorMenu = (event: React.MouseEvent<HTMLButtonElement>, target: CardCheckTarget) => {
    event.preventDefault();
    setCheckColorMenu({ x: event.clientX, y: event.clientY, target });
  };
  const selectNearestMiniReelValue = (event: React.MouseEvent<HTMLDivElement>) => {
    const values = Array.from(event.currentTarget.querySelectorAll<SVGGElement>(".hero-mini-reel-value[data-facet][data-name][data-value]"));
    let nearest: { element: SVGGElement; distance: number } | null = null;

    for (const element of values) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const distance = Math.hypot(event.clientX - x, event.clientY - y);
      if (!nearest || distance < nearest.distance) nearest = { element, distance };
    }

    if (!nearest || nearest.distance > 82) return;
    const facet = nearest.element.dataset.facet as Facet | undefined;
    const name = nearest.element.dataset.name;
    const value = Number(nearest.element.dataset.value);
    const baseValue = Number(nearest.element.dataset.base);
    const penalty = Number(nearest.element.dataset.penalty);
    const supernaturalDice = Number(nearest.element.dataset.supernatural ?? 0);
    if (!facet || !name || !Number.isFinite(value)) return;
    const key = `${facet}::${name}`;
    const isSelected = selectedKeys.has(key);
    if (!isSelected && !canSelectMore) return;
    onToggleSelect?.({
      facet,
      name,
      value,
      baseValue: Number.isFinite(baseValue) ? baseValue : value,
      penalty: Number.isFinite(penalty) ? Math.max(0, penalty) : 0,
      supernaturalDice: Number.isFinite(supernaturalDice) ? clampSupernaturalValue(supernaturalDice) : 0,
    });
  };
  useEffect(() => {
    if (!checkColorMenu) return;
    const close = () => setCheckColorMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [checkColorMenu]);

  useEffect(() => {
    const board = cardBoardRef.current;
    if (!board) return;

    const updateMobileCardZoom = () => {
      if (!window.matchMedia("(max-width: 520px)").matches) {
        board.style.removeProperty("--hero-card-mobile-zoom");
        return;
      }

      const card = board.querySelector<HTMLElement>(".hero-print-card");
      if (!card?.offsetWidth || !board.clientWidth) return;
      const zoom = Math.min(1, (board.clientWidth - 1) / card.offsetWidth);
      board.style.setProperty("--hero-card-mobile-zoom", zoom.toFixed(4));
    };

    updateMobileCardZoom();
    const resizeObserver = new ResizeObserver(updateMobileCardZoom);
    resizeObserver.observe(board);
    window.addEventListener("orientationchange", updateMobileCardZoom);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("orientationchange", updateMobileCardZoom);
    };
  }, [cardBoardRef]);

  useEffect(() => {
    if (activeCardTab !== "notes") return;
    const measure = () => {
      const section = cardBoardRef.current?.querySelector<HTMLElement>(".hero-note-card-editable:not(.hidden) .hero-card-lore-section");
      const editor = section?.querySelector<HTMLElement>(".hero-card-copy-editable");
      if (!section || !editor) return;
      const computed = getComputedStyle(editor);
      const lineHeight = Number.parseFloat(computed.lineHeight);
      const availableHeight = section.clientHeight - editor.offsetTop - 4;
      if (!Number.isFinite(lineHeight) || lineHeight <= 0 || availableHeight <= 0) return;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;
      context.font = `${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`;
      const averageCharacterWidth = context.measureText(localizeText("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")).width / 52;
      const next = {
        lines: Math.max(1, Math.floor(availableHeight / lineHeight)),
        charsPerLine: Math.max(1, Math.floor(editor.clientWidth / Math.max(averageCharacterWidth, 1))),
      };
      setNotePageMetrics((current) => current.lines === next.lines && current.charsPerLine === next.charsPerLine ? current : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (cardBoardRef.current) observer.observe(cardBoardRef.current);
    return () => observer.disconnect();
  }, [activeCardTab, cardBoardRef]);

  useEffect(() => {
    if (activeCardTab !== "identity") return;
    const measure = () => {
      const firstSection = cardBoardRef.current?.querySelector<HTMLElement>(".hero-character-card:not(.hidden) .hero-card-identity-lore-section");
      const firstCopy = firstSection?.querySelector<HTMLElement>(".hero-card-copy");
      if (!firstSection || !firstCopy) return;

      const computed = getComputedStyle(firstCopy);
      const lineHeight = Number.parseFloat(computed.lineHeight);
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) return;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;
      context.font = `${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`;
      const averageCharacterWidth = context.measureText(localizeText("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")).width / 52;
      const charsPerLine = Math.max(1, Math.floor(firstCopy.clientWidth / Math.max(averageCharacterWidth, 1)));
      // The flex text area already reserves space for story points when present.
      // Measuring it also works when that optional block is absent.
      const firstHeight = firstCopy.clientHeight - 4;
      if (firstHeight <= 0 || firstCopy.clientWidth <= 0) return;

      const followingSection = cardBoardRef.current?.querySelector<HTMLElement>(".hero-lore-card:not(.hidden) .hero-card-lore-section");
      const followingCopy = followingSection?.querySelector<HTMLElement>(".hero-card-copy");
      const followingHeight = followingSection && followingCopy
        ? followingSection.clientHeight - followingCopy.offsetTop - 4
        : lineHeight * 32;
      const next = {
        firstLines: Math.max(1, Math.floor(firstHeight / lineHeight)),
        followingLines: Math.max(1, Math.floor(followingHeight / lineHeight)),
        charsPerLine,
      };
      setLorePageMetrics((current) =>
        current.firstLines === next.firstLines &&
        current.followingLines === next.followingLines &&
        current.charsPerLine === next.charsPerLine
          ? current
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (cardBoardRef.current) observer.observe(cardBoardRef.current);
    const firstCopy = cardBoardRef.current?.querySelector<HTMLElement>(".hero-character-card:not(.hidden) .hero-card-copy");
    if (firstCopy) observer.observe(firstCopy);
    return () => observer.disconnect();
  }, [activeCardTab, cardBoardRef, identityLorePages.length]);

  return (
    <section className="space-y-6" style={{ ["--hero-card-ink" as string]: c!.cardInk }}>
      <div className="hero-card-board hero-card-board-single" ref={cardBoardRef}>
        <article className={`hero-print-card hero-card-has-header hero-character-card ${activeCardTab === "identity" ? "" : "hidden"}`} style={{ ["--hero-card-copy-scale" as string]: identityScale }}>
          <HeroCardHeader tab="identity" name={heroHeaderName} style={heroHeaderStyle} />
          {localizeNode(c!.portrait && (
            <div className="hero-card-portrait-watermark" aria-hidden="true">
              <img src={c!.portrait} alt="" draggable={false} />
            </div>
          ))}
          <div className="hero-card-identity">
            <div className="min-w-0">
              <h3>{shortText(c!.nom)}</h3>
              <dl>
                <div><dt>{localizeText("Age")}</dt><dd>{localizeNode(shortText(c!.age))}</dd></div>
                <div><dt>{localizeText("Taille")}</dt><dd>{localizeNode(shortText(c!.taille))}</dd></div>
                <div><dt>{localizeText("Poids")}</dt><dd>{localizeNode(shortText(c!.poids))}</dd></div>
              </dl>
              <p className="hero-card-concept">{localizeNode(shortText(c!.concept))}</p>
            </div>
          </div>

          <CardSection
            title={localizeText(identityLorePages.length > 1 ? `Histoire 1/${identityLorePages.length}` : "Histoire")}
            className="hero-card-lore-section hero-card-identity-lore-section"
            style={{ ["--hero-card-section-copy-scale" as string]: densityScale((identityLorePages[0] ?? "").length, 660, 0.68) }}
          >
            <p className="hero-card-copy">{localizeNode(identityLorePages[0])}</p>
            {localizeNode((c!.pointsRecits ?? 0) !== 0 && (
              <div className="hero-card-story-points" aria-label={localizeText(`${c!.pointsRecits} points de recit`)}>
                <span>{localizeText("Points de recit")}</span>
                <strong>{localizeNode(c!.pointsRecits)}</strong>
              </div>
            ))}
          </CardSection>

          <footer className="hero-card-citation">
            {localizeNode(shortText(c!.replique) && <span>« {localizeNode(shortText(c!.replique))} »</span>)}
          </footer>
        </article>

        {identityLorePages.slice(1).map((page, index) => {
          const pageIndex = index + 2;
          const loreScale = densityScale(page.length, 1120, 0.72);
          return (
            <article
              key={`identity-lore-${index}-${page.slice(0, 12)}`}
              className={`hero-print-card hero-card-has-header hero-lore-card ${activeCardTab === "identity" ? "" : "hidden"}`}
              style={{ ["--hero-card-copy-scale" as string]: loreScale }}
            >
              <HeroCardHeader tab="identity" name={heroHeaderName} style={heroHeaderStyle} />
              <CardSection title={localizeText(`Histoire ${pageIndex}/${identityLorePages.length}`)} className="hero-card-lore-section">
                <p className="hero-card-copy">{localizeNode(page)}</p>
              </CardSection>
              <footer className="hero-card-citation">
                {localizeNode(shortText(c!.replique) && <span>« {localizeNode(shortText(c!.replique))} »</span>)}
              </footer>
            </article>
          );
        })}

        <article className={`hero-print-card hero-card-has-header hero-attributes-card ${activeCardTab === "attributes" ? "" : "hidden"}`}>
          <HeroCardHeader tab="attributes" name={heroHeaderName} style={heroHeaderStyle} />

          <CardSection title={localizeText("Attributs")} className="hero-card-reels-section">
            <div className="hero-card-mini-reels" onClick={selectNearestMiniReelValue}>
              <div className="hero-card-mini-reel-layer hero-card-mini-reel-splashes">
                {(["corps", "esprit", "ame"] as Facet[]).map((facet) => (
                  <MiniFacetReel
                    key={facet}
                    facet={facet}
                    skills={c!.facets[facet].skills}
                    supernatural={c!.facets[facet].supernatural}
                    penalty={penaltyByFacet[facet]}
                    splashOnly
                    supernaturalEnabled={c!.supernaturalEnabled}
                  />
                ))}
              </div>
              <div className="hero-card-mini-reel-layer hero-card-mini-reel-faces">
                {(["corps", "esprit", "ame"] as Facet[]).map((facet) => (
                  <MiniFacetReel
                    key={facet}
                    facet={facet}
                    skills={c!.facets[facet].skills}
                    supernatural={c!.facets[facet].supernatural}
                    penalty={penaltyByFacet[facet]}
                    selectedKeys={selectedKeys}
                    onToggleSelect={onToggleSelect}
                    canSelectMore={canSelectMore}
                    supernaturalEnabled={c!.supernaturalEnabled}
                  />
                ))}
              </div>
              <div className="hero-card-mini-reel-layer hero-card-mini-reel-labels" aria-hidden="true">
                {(["corps", "esprit", "ame"] as Facet[]).map((facet) => (
                  <MiniFacetReel
                    key={facet}
                    facet={facet}
                    skills={c!.facets[facet].skills}
                    supernatural={c!.facets[facet].supernatural}
                    labelsOnly
                    supernaturalEnabled={c!.supernaturalEnabled}
                  />
                ))}
              </div>
            </div>
          </CardSection>

          <CardSection title={localizeText("Specialites")} className="hero-card-text-section hero-card-special-section" style={{ ["--hero-card-section-copy-scale" as string]: specialiteCopyScale }}>
            <div className="hero-card-copy" dangerouslySetInnerHTML={{ __html: richTextToHtml(c!.specialite) }} />
          </CardSection>

          <footer className="hero-card-citation">
            {localizeNode(shortText(c!.replique) && <span>« {localizeNode(shortText(c!.replique))} »</span>)}
          </footer>
        </article>

        <article className={`hero-print-card hero-card-has-header hero-traits-card ${activeCardTab === "traits" ? "" : "hidden"}`}>
          <HeroCardHeader tab="traits" name={heroHeaderName} style={heroHeaderStyle} />

          <CardSection title={localizeText("Traits")} className="hero-card-text-section hero-card-traits-section">
            <div className="hero-card-traits-background" aria-hidden="true">
              <img src="/ClapOwlBear/trait-background.png" alt="" draggable={false} />
            </div>
            <div className="hero-card-copy" dangerouslySetInnerHTML={{ __html: richTextToHtml(c!.traits) }} />
          </CardSection>

          <CardSection title={localizeText("Accessoires")} className="hero-card-inventory-section" style={{ ["--hero-card-inventory-copy-scale" as string]: inventoryCopyScale }}>
            <div className="hero-card-inventory-watermarks" aria-hidden="true">
              <img src="/ClapOwlBear/inventory-backpack.png" alt="" draggable={false} />
              <img src="/ClapOwlBear/inventory-flashlight.png" alt="" draggable={false} />
              <img src="/ClapOwlBear/inventory-armor.png" alt="" draggable={false} />
              <img src="/ClapOwlBear/inventory-pistol.png" alt="" draggable={false} />
              <img src="/ClapOwlBear/inventory-sword.png" alt="" draggable={false} />
            </div>
            <div className="hero-card-inventory">
              {inventoryWeapons.length > 0 && (
                <div className={`hero-card-inventory-table hero-card-inventory-weapons ${inventoryWeapons.some(item => item.proprietes.trim()) ? "" : "is-without-properties"}`}>
                  <div className="hero-card-inventory-row is-header">
                    <span>{localizeText("Armes")}</span>
                    <span>{localizeText("Degats")}</span>
                    <span>{localizeText("Proprietes")}</span>
                  </div>
                  {inventoryWeapons.map((item, index) => (
                    <div key={`${item.nom}-${index}`} className="hero-card-inventory-row">
                      <span>{item.nom}</span>
                      <span>{localizeNode(item.degats)}</span>
                      <span>{localizeNode(item.proprietes)}</span>
                    </div>
                  ))}
                </div>
              )}
              {inventoryArmors.length > 0 && (
                <div className={`hero-card-inventory-table hero-card-inventory-armors ${inventoryArmors.some(item => item.proprietes.trim()) ? "" : "is-without-properties"}`}>
                  <div className="hero-card-inventory-row is-header">
                    <span>{localizeText("Armures")}</span>
                    <span>{localizeText("Poids")}</span>
                    <span>{localizeText("Protection")}</span>
                    <span>{localizeText("Proprietes")}</span>
                  </div>
                  {inventoryArmors.map((item, index) => (
                    <div key={`${item.nom}-${index}`} className="hero-card-inventory-row">
                      <span>{item.nom}</span>
                      <span>{localizeNode(item.poids)}</span>
                      <span>{localizeNode(item.protection)}</span>
                      <span>{localizeNode(item.proprietes)}</span>
                    </div>
                  ))}
                </div>
              )}
              {inventoryNotes && <div className="hero-card-inventory-notes" dangerouslySetInnerHTML={{ __html: richTextToHtml(inventoryRichText) }} />}
            </div>
          </CardSection>

          <footer className="hero-card-citation">
            {localizeNode(shortText(c!.replique) && <span>« {localizeNode(shortText(c!.replique))} »</span>)}
          </footer>
        </article>

        <article className={`hero-print-card hero-card-has-header hero-state-card ${activeCardTab === "state" ? "" : "hidden"}`} style={{ ["--hero-card-copy-scale" as string]: constantsScale }}>
          <HeroCardHeader tab="state" name={heroHeaderName} style={heroHeaderStyle} />

          <CardSection title={localizeText("Blessures")} className="hero-card-state-section hero-card-injury-section">
            <div className="hero-card-injury-header">
              <span>{localizeText("Zone / protection")}</span>
              <CardLevelHeader labels={INJURY_LEVELS} />
            </div>
            <div className="hero-card-injury-grid">
              {INJURY_LOCATIONS.map((loc) => {
                const values = c!.injuries[loc] ?? [];
                const level = values.lastIndexOf(true) + 1;
                const protection = protectionByLoc[loc] ?? 0;
                return (
                  <div key={loc} className="hero-card-injury-row">
                    <div className="hero-card-location">
                      <span>{localizeNode(loc)}</span>
                      <strong aria-label={localizeText(`Protection ${protection}`)}>
                        <Shield size={18} />
                        <span>{localizeNode(protection)}</span>
                      </strong>
                    </div>
                    <div className="hero-card-condition-cells">
                      {INJURY_LEVELS.map((injuryLevel, index) => (
                        <CardCheckCell
                          key={injuryLevel}
                          checked={index < level}
                          sequel={INJURY_CAPACITY[loc]?.[index] ?? 0}
                          icon={<HeroCardSequelIcon src={HERO_CARD_SEQUEL_ICONS.injury} className="hero-card-sequel-heart" />}
                          onClick={() => onInjuryChange(loc, index)}
                          onContextMenu={(event) => openCheckColorMenu(event, { kind: "injury", loc, index })}
                          checkColor={c!.cardCheckColors.injuries[loc]?.[index] ?? ""}
                          ariaLabel={`Blessure ${loc} niveau ${index + 1} - ${injuryLevel}`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardSection>

          <CardSection title={localizeText("Stress")} className="hero-card-state-section hero-card-stress-section">
            <CardTrack
              labels={STRESS_LEVELS}
              checked={c!.stress}
              capacities={STRESS_CAPACITY}
              sequelIcon={<HeroCardSequelIcon src={HERO_CARD_SEQUEL_ICONS.stress} className="hero-card-sequel-brain" />}
              onChange={onStressChange}
              onColorMenu={(event, index) => openCheckColorMenu(event, { kind: "stress", index })}
              getCheckColor={(index) => c!.cardCheckColors.stress[index] ?? ""}
              ariaPrefix="Stress niveau"
            />
          </CardSection>

          <CardSection title={localizeText("Chagrins")} className="hero-card-state-section hero-card-grief-section">
            <CardTrack
              labels={GRIEF_LEVELS}
              checked={c!.griefs}
              capacities={GRIEF_CAPACITY}
              sequelIcon={<HeroCardSequelIcon src={HERO_CARD_SEQUEL_ICONS.grief} className="hero-card-sequel-eye" />}
              onChange={onGriefChange}
              onColorMenu={(event, index) => openCheckColorMenu(event, { kind: "grief", index })}
              getCheckColor={(index) => c!.cardCheckColors.griefs[index] ?? ""}
              ariaPrefix="Chagrin niveau"
            />
          </CardSection>

          <CardSection title={localizeText("Etats critiques")} className="hero-card-state-section hero-card-critical-section">
            <div className="hero-card-critical-summary" aria-label={localizeText("Etats critiques")}>
              {[
                { label: "Agonie", kind: "agony" as const, checked: stateCriticalSummary.agony },
                { label: "Délire", kind: "mentalBreak" as const, checked: stateCriticalSummary.mentalBreak },
                { label: "Désespoir", kind: "emotionalBreak" as const, checked: stateCriticalSummary.emotionalBreak },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className={`hero-card-critical-summary-item is-${item.kind}`}
                  onClick={() => onCriticalSummaryToggle(item.kind)}
                  aria-pressed={item.checked}
                >
                  <span className={`hero-card-critical-summary-box ${item.checked ? "is-checked" : ""}`}>
                    {localizeNode(item.checked && "X")}
                  </span>
                  {localizeNode(item.label)}
                </button>
              ))}
            </div>
          </CardSection>

          <footer className="hero-card-citation">
            {localizeNode(shortText(c!.replique) && <span>« {localizeNode(shortText(c!.replique))} »</span>)}
          </footer>
        </article>

        {notePages.map((page, index) => {
          const noteScale = 1;
          return (
            <article
              key={`notes-${index}`}
              className={`hero-print-card hero-card-has-header hero-lore-card ${onNotesChange ? "hero-note-card-editable" : ""} ${activeCardTab === "notes" ? "" : "hidden"}`}
              style={{ ["--hero-card-copy-scale" as string]: noteScale }}
              onClick={(event) => {
                if (!onNotesChange) return;
                const editor = event.currentTarget.querySelector<HTMLElement>(".hero-card-copy-editable");
                if (editor && document.activeElement !== editor) editor.focus();
              }}
            >
              <HeroCardHeader tab="notes" name={heroHeaderName} style={heroHeaderStyle} />
              <CardSection title={localizeText(notePages.length > 1 ? `Notes ${index + 1}/${notePages.length}` : "Notes")} className="hero-card-lore-section">
                <textarea maxLength={100000}
                  className={`hero-card-copy ${onNotesChange ? "hero-card-copy-editable" : ""}`}
                  value={page}
                  readOnly={!onNotesChange}
                  aria-label={localizeText(notePages.length > 1 ? `Notes ${index + 1}` : "Notes")}
                  onKeyDown={(event) => {
                    if (!onNotesChange || event.key !== "Backspace" || index === 0) return;
                    if (event.currentTarget.selectionStart !== 0 || event.currentTarget.selectionEnd !== 0) return;

                    event.preventDefault();
                    const nextPages = [...notePages];
                    const currentPage = event.currentTarget.value;
                    const previousPage = nextPages[index - 1];
                    const previousCaretOffset = nextPages
                      .slice(0, index - 1)
                      .reduce((offset, notePage) => offset + notePage.length + 1, previousPage.length);
                    nextPages[index - 1] = `${previousPage}${currentPage}`;
                    nextPages.splice(index, 1);
                    onNotesChange(nextPages.join("\n"));
                    restoreNotesCaret(previousCaretOffset);
                  }}
                  onChange={(event) => {
                    if (!onNotesChange) return;
                    const nextPages = [...notePages];
                    nextPages[index] = event.currentTarget.value;
                    const localCaretOffset = event.currentTarget.selectionStart;
                    const globalCaretOffset = nextPages
                      .slice(0, index)
                      .reduce((offset, notePage) => offset + notePage.length + 1, localCaretOffset);
                    onNotesChange(nextPages.join("\n"));
                    restoreNotesCaret(globalCaretOffset);
                  }}
                />
              </CardSection>
              <footer className="hero-card-citation">
                {localizeNode(shortText(c!.replique) && <span>« {localizeNode(shortText(c!.replique))} »</span>)}
              </footer>
            </article>
          );
        })}

        <article className={`hero-print-card hero-back-card ${activeCardTab === "back" ? "" : "hidden"}`}>
          <div className="hero-back-portrait">
            {localizeNode(c!.portrait ? (
              <img src={c!.portrait} alt="" draggable={false} />
            ) : (
              <div className="hero-back-portrait-empty" aria-hidden="true">
                <UserCircle size={88} />
              </div>
            ))}
            <div className="hero-back-watermark" aria-hidden="true">
              {shortText(c!.nom)}
            </div>
          </div>
        </article>
      </div>
      {checkColorMenu && (
        <div
          className="hero-card-check-menu"
          style={{ left: checkColorMenu.x, top: checkColorMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          {CHECK_COLOR_PALETTE.map((color) => (
            <button
              key={color.id}
              type="button"
              className="hero-card-check-color"
              style={{ ["--check-color" as string]: color.value || "var(--hero-card-ink, #3a1307)" }}
              onClick={() => {
                onCheckColorChange(checkColorMenu.target, color.value);
                setCheckColorMenu(null);
              }}
            >
              <span aria-hidden="true" />
              {localizeNode(color.label)}
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

const CharacterEditor = ({ characterId, onClose, primaryInRoom = false, roomRequestId, roomDiscussion, roomRequests, roomContextLabel, roomHeroViewKey, roomNavigation, renderRoomMenu }: { characterId?: string; onClose?: () => void; primaryInRoom?: boolean; roomRequestId?: string; roomDiscussion?: ReactNode; roomRequests?: ReactNode; roomContextLabel?: string; roomHeroViewKey?: number; roomNavigation?: ReactNode; renderRoomMenu?: (actions: ReactNode) => ReactNode } = {}) => {
  const { requestExit, dialog: exitDialog } = useExitConfirmation();
  const { id: routeId } = useParams();
  const id = characterId ?? routeId;
  const embedded = Boolean(characterId);
  const location = useLocation();
  const room = useRoom();
  const [roomRollRequest, setRoomRollRequest] = useState<RoomRollRequest | null>(null);
  const openedRoomRequest = useRef("");
  const navigate = useNavigate();
  const goBack = useBackNavigation("/characters");
  const [c, setC] = useState<Character | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [tab, setTab] = useState<Tab>("identity");
  const swipeStart = useRef<{ x: number; y: number; id: number } | null>(null);
  const [wideRoom, setWideRoom] = useState(() => primaryInRoom && window.matchMedia("(min-width: 1200px)").matches);
  useEffect(() => {
    if (!primaryInRoom) return;
    const media = window.matchMedia("(min-width: 1200px)");
    const refresh = () => setWideRoom(media.matches);
    refresh();
    media.addEventListener("change", refresh);
    return () => media.removeEventListener("change", refresh);
  }, [primaryInRoom]);
  useEffect(() => { if (wideRoom && tab === "discussion") setTab("identity"); }, [wideRoom, tab]);
  const sheetTabs = mode === "edit" ? TABS.filter((item) => item.id !== "state") : TABS;
  const editorTabs = primaryInRoom && !wideRoom ? [...sheetTabs, { id: "discussion" as Tab, label: "Discussion" }] : sheetTabs;
  useEffect(() => { if (roomHeroViewKey) setTab("identity"); }, [roomHeroViewKey]);
  const [selection, setSelection] = useState<RollSelection[]>([]);
  const [rollOpen, setRollOpen] = useState(false);
  const [lockedRollSelectionKey, setLockedRollSelectionKey] = useState<string | null>(null);
  const [lockedRollSelectionCanChange, setLockedRollSelectionCanChange] = useState(false);
  const [contextualRollOptions, setContextualRollOptions] = useState<RollSelection[]>([]);
  const [showMobileStateDetails, setShowMobileStateDetails] = useState(false);
  const [exportingA6Pdf, setExportingA6Pdf] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);
  const [heroResources, setHeroResources] = useState<HeroResource[]>([]);
  const [roomResource, setRoomResource] = useState<HeroResource | null>(null);
  const [resourceDragActive, setResourceDragActive] = useState(false);
  const [resourceImportBusy, setResourceImportBusy] = useState(false);
  const resourceDragDepth = useRef(0);
  const heroCardBoardRef = useRef<HTMLDivElement>(null);
  const editSnapshotRef = useRef<Character | null>(null);

  const refreshHeroResources = useCallback(async () => {
    const [roles, figurants, profiles, powers, vehicles] = await Promise.all([
      loadKeyRoles(),
      loadFigurants(),
      loadProfiles(),
      loadPowers(),
      loadVehicles(),
    ]);
    const resources: HeroResource[] = [
      ...roles.map((item): HeroResource => ({ type: "key-role", item, href: `/key-roles/${item.id}`, label: "Rôle clé" })),
      ...figurants.map((item): HeroResource => ({ type: "figurant", item, href: `/figurants/${item.id}`, label: "Figurant" })),
      ...profiles.map((item): HeroResource => ({ type: "profile", item, href: `/profils/${item.id}`, label: "Profil" })),
      ...powers.map((item): HeroResource => ({ type: "power", item, href: `/pouvoirs/${item.id}`, label: "Pouvoir" })),
      ...vehicles.map((item): HeroResource => ({ type: "vehicle", item, href: `/vehicules/${item.id}`, label: "Véhicule" })),
    ];
    resources.sort((a, b) => (a.item.titre || "").localeCompare(b.item.titre || "", "fr", { sensitivity: "base" }));
    setHeroResources(resources);
  }, []);

  useEffect(() => {
    void refreshHeroResources();
  }, [refreshHeroResources]);

  const selectedKeys = useMemo(
    () => new Set(selection.map((s) => `${s.facet}::${s.name === FACET_LABELS[s.facet as Facet] ? "__core" : s.name}`)),
    [selection],
  );

  // Reset selection when leaving view mode or switching tab
  useEffect(() => {
    if (mode === "edit") setSelection([]);
  }, [mode]);

  useEffect(() => {
    if (tab !== "state") setShowMobileStateDetails(false);
  }, [tab]);

  useEffect(() => {
    if (new URLSearchParams(location.search).get("tab") === "resources") setTab("resources");
  }, [location.search]);

  const toggleSelect = useCallback((sel: RollSelection) => {
    setLockedRollSelectionKey(null);
    setLockedRollSelectionCanChange(false);
    setContextualRollOptions([]);
    setSelection((cur) => {
      const k = `${sel.facet}::${sel.name === FACET_LABELS[sel.facet as Facet] ? "__core" : sel.name}`;
      const exists = cur.find((x) => `${x.facet}::${x.name === FACET_LABELS[x.facet as Facet] ? "__core" : x.name}` === k);
      if (exists) return cur.filter((x) => x !== exists);
      if (cur.length >= 2) return cur;
      const next = [...cur, sel];
      if (next.length === 2) setRollOpen(true);
      return next;
    });
  }, []);


  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const loadCharacter = async () => {
    const ch = await getCharacter(id);
    if (cancelled) return;
    if (!ch) {
      if (onClose) onClose(); else navigate("/characters");
      return;
    }
    setC(ch);
    // New / empty character → start in edit mode
    if (!ch.nom) {
      editSnapshotRef.current = structuredClone(ch);
      setMode("edit");
    }
    document.title = `${ch.nom || "Personnage"} — Clap & Role`;
    };

    void loadCharacter();

    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  const isEdit = mode === "edit";

  useEffect(() => {
    const receiveRoomChange = (event: Event) => {
      const hero = (event as CustomEvent<{ character?: Character }>).detail?.character;
      if (!hero || hero.id !== id) return;
      const patch = { armes: hero.armes, armures: hero.armures, autresAccessoires: hero.autresAccessoires, linkedResources: hero.linkedResources };
      setC(current => current?.id === hero.id ? { ...current, ...patch } : current);
      if (editSnapshotRef.current?.id === hero.id) editSnapshotRef.current = { ...editSnapshotRef.current, ...patch };
    };
    window.addEventListener("clap-room-character-assigned", receiveRoomChange);
    return () => window.removeEventListener("clap-room-character-assigned", receiveRoomChange);
  }, [id]);

  const update = (patch: Partial<Character>) => setC((cur) => (cur ? { ...cur, ...patch } : cur));

  const toggleLinkedResource = useCallback((resource: HeroResource) => {
    setC(current => {
      if (!current) return current;
      const key = heroResourceKey(resource);
      const alreadyLinked = current.linkedResources.some(linked => linkedResourceKey(linked) === key);
      return { ...current, linkedResources: alreadyLinked
        ? current.linkedResources.filter(linked => linkedResourceKey(linked) !== key)
        : [...current.linkedResources, { type: resource.type, id: resource.item.id }] };
    });
  }, []);

  const importHeroResourcePng = async (file: File): Promise<HeroResource | null> => {
    const keyRole = await importKeyRolePng(file);
    if (keyRole) {
      keyRole.id = await resourceContentId("key-role", keyRole);
      await upsertKeyRole(keyRole);
      return { type: "key-role", item: keyRole, href: `/key-roles/${keyRole.id}`, label: "Rôle clé" };
    }
    const figurant = await importFigurantPng(file);
    if (figurant) {
      figurant.id = await resourceContentId("figurant", figurant);
      await upsertFigurant(figurant);
      return { type: "figurant", item: figurant, href: `/figurants/${figurant.id}`, label: "Figurant" };
    }
    const profile = await importProfilePng(file);
    if (profile) {
      profile.id = await resourceContentId("profile", profile);
      await upsertProfile(profile);
      return { type: "profile", item: profile, href: `/profils/${profile.id}`, label: "Profil" };
    }
    const power = await importPowerPng(file);
    if (power) {
      power.id = await resourceContentId("power", power);
      await upsertPower(power);
      return { type: "power", item: power, href: `/pouvoirs/${power.id}`, label: "Pouvoir" };
    }
    const vehicle = await importVehiclePng(file);
    if (vehicle) {
      vehicle.id = await resourceContentId("vehicle", vehicle);
      await upsertVehicle(vehicle);
      return { type: "vehicle", item: vehicle, href: `/vehicules/${vehicle.id}`, label: "Véhicule" };
    }
    return null;
  };

  const importHeroResourceFiles = async (files: FileList | File[]) => {
    if (!c) return;
    const pngFiles = Array.from(files).filter((file) => file.type === "image/png" || file.name.toLowerCase().endsWith(".png"));
    if (pngFiles.length === 0) return;
    setResourceImportBusy(true);
    try {
      const imported: HeroResource[] = [];
      for (const file of pngFiles) {
        const resource = await importHeroResourcePng(file);
        if (resource) imported.push(resource);
      }
      if (imported.length > 0) {
        const existing = new Set(c!.linkedResources.map(linkedResourceKey));
        update({
          linkedResources: [
            ...c!.linkedResources,
            ...imported
              .filter((resource) => !existing.has(heroResourceKey(resource)))
              .map((resource) => ({ type: resource.type, id: resource.item.id })),
          ],
        });
        await refreshHeroResources();
      }
      if (imported.length === 0) alert(localizeText("Aucune carte Clap & Role lisible dans ces PNG."));
      else if (imported.length < pngFiles.length) alert(localizeText(`${imported.length}/${pngFiles.length} carte(s) importée(s).`));
    } finally {
      setResourceImportBusy(false);
    }
  };

  const updateDestinDiceCount = (value: number) => {
    if (!c) return;
    const next = clampDestinDiceCount(value);
    if (next === c!.destinDiceCount) return;
    const confirmed = window.confirm(localizeText(`Changer le nombre de Déstin lancé de ${c!.destinDiceCount} à ${next} ?`));
    if (!confirmed) return;
    update({ destinDiceCount: next });
  };

  // Autosave on any change to the character
  const loadedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!c) return;
    if (mode === "edit") return;
    if (loadedIdRef.current !== c!.id) {
      loadedIdRef.current = c!.id;
      return; // skip first sync after load
    }
    const t = setTimeout(() => void upsertCharacter(c).catch(reportSaveError), 200);
    return () => clearTimeout(t);
  }, [c, mode]);


  const save = async () => {
    if (!c) return;
    await upsertCharacter(c);
    editSnapshotRef.current = structuredClone(c);
    setMode("view");
    if (embedded) window.dispatchEvent(new Event('clap-room-character-assigned'));
  };

  const startEditing = () => {
    if (!c) return;
    editSnapshotRef.current = structuredClone(c);
    setMode("edit");
    setTab("identity");
  };

  const handleBackToCharacters = async () => {
    if (!c || !isEdit) {
      if (onClose) { if (c) await upsertCharacter(c); onClose(); } else goBack();
      return;
    }
    const snapshot = editSnapshotRef.current;
    const hasChanges = !snapshot || JSON.stringify(c) !== JSON.stringify(snapshot);
    requestExit(hasChanges, () => { if (onClose) onClose(); else goBack(); });
  };

  const handleExport = async () => {
    return withExportProgress(async () => {
      if (!c) return;
      setExportingPng(true);
      try {
        await upsertCharacter(c);
        const blob = await exportCharacterPng(c);
        downloadBlob(blob, `${(c!.nom || "personnage").replace(/\s+/g, "_")}.png`);
      } finally {
        setExportingPng(false);
      }
    });
  };

  const handleExportA6Pdf = async () => {
    return withExportProgress(async () => {
      if (!c) return;
      await upsertCharacter(c);
      setExportingA6Pdf(true);
      try {
        const cards = Array.from(heroCardBoardRef.current?.querySelectorAll<HTMLElement>(".hero-print-card") ?? []);
        await exportHeroCardsA6Pdf(c, c!.cardInk, cards);
      } catch (error) { failExportProgress();
        console.error(error);
        alert(localizeText(`Impossible de générer le PDF A6.${error instanceof Error ? `\n${error.message}` : ""}`));
      } finally {
        setExportingA6Pdf(false);
      }
    });
  };


  const updateFacet = (f: Facet, patch: Partial<Character["facets"][Facet]>) =>
    c && update({ facets: { ...c!.facets, [f]: { ...c!.facets[f], ...patch } } });

  const updateSkill = useCallback((f: Facet, skill: string, v: number) => {
    setC((cur) =>
      cur
        ? {
            ...cur,
            facets: {
              ...cur.facets,
              [f]: {
                ...cur.facets[f],
                skills: { ...cur.facets[f].skills, [skill]: clampAttributeValue(v) },
              },
            },
          }
        : cur,
    );
  }, []);

  const updateSupernatural = useCallback((f: Facet, skill: string, v: number) => {
    setC((cur) =>
      cur
        ? {
            ...cur,
            facets: {
              ...cur.facets,
              [f]: {
                ...cur.facets[f],
                supernatural: { ...cur.facets[f].supernatural, [skill]: clampSupernaturalValue(v) },
              },
            },
          }
        : cur,
    );
  }, []);

  // Slider behaviour: clicking an empty cell fills up to it; clicking a checked cell
  // clears it and every following cell.
  const setLevelArr = (current: boolean[], idx: number): boolean[] => {
    const target = current[idx] ? idx : idx + 1;
    return current.map((_, i) => i < target);
  };

  const resetUncheckedCardColors = (colors: string[], checked: boolean[]) =>
    colors.map((color, index) => (checked[index] ? color : ""));

  const setInjuryLevel = (loc: string, idx: number) => {
    if (!c) return;
    const next = setLevelArr(c!.injuries[loc] ?? [], idx);
    const patch: Partial<Character> = {
      injuries: { ...c!.injuries, [loc]: next },
      cardCheckColors: {
        ...c!.cardCheckColors,
        injuries: {
          ...c!.cardCheckColors.injuries,
          [loc]: resetUncheckedCardColors(c!.cardCheckColors.injuries[loc] ?? Array(7).fill(""), next),
        },
      },
    };
    if (next.lastIndexOf(true) + 1 < INJURY_LEVELS.length && c!.criticalStates.agony[loc]) {
      patch.criticalStates = {
        ...c!.criticalStates,
        agony: { ...c!.criticalStates.agony, [loc]: false },
      };
    }
    update(patch);
  };

  const setInjuryLevelN = (loc: string, n: number) => {
    if (!c) return;
    const len = INJURY_LEVELS.length;
    const next = Array.from({ length: len }, (_, i) => i < n);
    const patch: Partial<Character> = {
      injuries: { ...c!.injuries, [loc]: next },
      cardCheckColors: {
        ...c!.cardCheckColors,
        injuries: {
          ...c!.cardCheckColors.injuries,
          [loc]: resetUncheckedCardColors(c!.cardCheckColors.injuries[loc] ?? Array(7).fill(""), next),
        },
      },
    };
    if (n < len && c!.criticalStates.agony[loc]) {
      patch.criticalStates = {
        ...c!.criticalStates,
        agony: { ...c!.criticalStates.agony, [loc]: false },
      };
    }
    update(patch);
  };

  const setStateArr = (key: "stress" | "griefs", idx: number) => {
    if (!c) return;
    const next = setLevelArr(c[key], idx);
    const patch = {
      [key]: next,
      cardCheckColors: {
        ...c!.cardCheckColors,
        [key]: resetUncheckedCardColors(c!.cardCheckColors[key], next),
      },
    } as Partial<Character>;
    if (next.lastIndexOf(true) + 1 < c[key].length) {
      if (key === "stress" && c!.criticalStates.mentalBreak) {
        patch.criticalStates = { ...c!.criticalStates, mentalBreak: false };
      }
      if (key === "griefs" && c!.criticalStates.emotionalBreak) {
        patch.criticalStates = { ...c!.criticalStates, emotionalBreak: false };
      }
    }
    update(patch);
  };

  const setStateLevelN = (key: "stress" | "griefs", n: number) => {
    if (!c) return;
    const len = c[key].length;
    const next = Array.from({ length: len }, (_, i) => i < n);
    const patch = {
      [key]: next,
      cardCheckColors: {
        ...c!.cardCheckColors,
        [key]: resetUncheckedCardColors(c!.cardCheckColors[key], next),
      },
    } as Partial<Character>;
    if (n < len) {
      if (key === "stress" && c!.criticalStates.mentalBreak) {
        patch.criticalStates = { ...c!.criticalStates, mentalBreak: false };
      }
      if (key === "griefs" && c!.criticalStates.emotionalBreak) {
        patch.criticalStates = { ...c!.criticalStates, emotionalBreak: false };
      }
    }
    update(patch);
  };

  const advanceStateFromGiveMeans = (success: boolean) => {
    setC((cur) => {
      if (!cur) return cur;
      const nextStressLevel = Math.min(cur.stress.lastIndexOf(true) + 2, cur.stress.length);
      const nextStress = Array.from({ length: cur.stress.length }, (_, i) => i < nextStressLevel);
      const patch: Partial<Character> = {
        stress: nextStress,
        cardCheckColors: {
          ...cur.cardCheckColors,
          stress: resetUncheckedCardColors(cur.cardCheckColors.stress, nextStress),
        },
      };

      if (!success) {
        const nextGriefLevel = Math.min(cur.griefs.lastIndexOf(true) + 2, cur.griefs.length);
        const nextGriefs = Array.from({ length: cur.griefs.length }, (_, i) => i < nextGriefLevel);
        patch.griefs = nextGriefs;
        patch.cardCheckColors = {
          ...patch.cardCheckColors!,
          griefs: resetUncheckedCardColors(cur.cardCheckColors.griefs, nextGriefs),
        };
      }

      return { ...cur, ...patch };
    });
  };

  const advanceInjuryFromPullRope = (loc: string) => {
    setC((cur) => {
      if (!cur || !INJURY_LOCATIONS.includes(loc)) return cur;
      const current = cur.injuries[loc] ?? Array(7).fill(false);
      const nextLevel = Math.min(current.lastIndexOf(true) + 2, current.length);
      if (nextLevel <= current.lastIndexOf(true) + 1) return cur;
      const next = Array.from({ length: current.length }, (_, i) => i < nextLevel);
      return {
        ...cur,
        injuries: { ...cur.injuries, [loc]: next },
        cardCheckColors: {
          ...cur.cardCheckColors,
          injuries: {
            ...cur.cardCheckColors.injuries,
            [loc]: resetUncheckedCardColors(cur.cardCheckColors.injuries[loc] ?? Array(7).fill(""), next),
          },
        },
      };
    });
  };

  const setCardCheckColor = (target: CardCheckTarget, color: string) => {
    if (!c) return;
    const current = c!.cardCheckColors;
    if (target.kind === "injury") {
      const currentLoc = current.injuries[target.loc] ?? Array(7).fill("");
      const nextLoc = [...currentLoc];
      nextLoc[target.index] = color;
      update({
        cardCheckColors: {
          ...current,
          injuries: { ...current.injuries, [target.loc]: nextLoc },
        },
      });
      return;
    }

    const key = target.kind === "stress" ? "stress" : "griefs";
    const next = [...current[key]];
    next[target.index] = color;
    update({ cardCheckColors: { ...current, [key]: next } });
  };

  const toggleAgony = (loc: string) => {
    if (!c || (c!.injuries[loc] ?? []).lastIndexOf(true) + 1 < INJURY_LEVELS.length) return;
    const next = !c!.criticalStates.agony[loc];
    update({
      criticalStates: {
        ...c!.criticalStates,
        agony: { ...c!.criticalStates.agony, [loc]: next },
      },
    });
    if (next) setCritical("corps");
  };

  const toggleCriticalState = (key: "mentalBreak" | "emotionalBreak", facet: Facet) => {
    if (!c) return;
    const maxed = key === "mentalBreak" ? stressMax >= STRESS_LEVELS.length : griefMax >= GRIEF_LEVELS.length;
    if (!maxed) return;
    const next = !c!.criticalStates[key];
    update({ criticalStates: { ...c!.criticalStates, [key]: next } });
    if (next) setCritical(facet);
  };

  const toggleCriticalSummary = (kind: "agony" | "mentalBreak" | "emotionalBreak") => {
    if (!c) return;
    if (kind === "agony") {
      const next = !Object.values(c!.criticalStates.agony).some(Boolean);
      update({
        criticalStates: {
          ...c!.criticalStates,
          agony: Object.fromEntries(INJURY_LOCATIONS.map((loc) => [loc, next])),
        },
      });
      if (next) setCritical("corps");
      return;
    }
    const next = !c!.criticalStates[kind];
    update({ criticalStates: { ...c!.criticalStates, [kind]: next } });
    if (next) setCritical(kind === "mentalBreak" ? "esprit" : "ame");
  };

  const markAllCriticalStates = () => {
    if (!c) return;
    update({
      climaxUsed: true,
      criticalStates: {
        ...c!.criticalStates,
        agony: Object.fromEntries(INJURY_LOCATIONS.map((loc) => [loc, true])),
        mentalBreak: true,
        emotionalBreak: true,
      },
    });
  };

  const stressMax = useMemo(() => (c ? c!.stress.lastIndexOf(true) + 1 : 0), [c?.stress]);
  const griefMax = useMemo(() => (c ? c!.griefs.lastIndexOf(true) + 1 : 0), [c?.griefs]);

  const injuryTotal = useMemo(() => {
    if (!c) return 0;
    let n = 0;
    for (const loc of INJURY_LOCATIONS) {
      const arr = c!.injuries[loc] ?? [];
      const cap = INJURY_CAPACITY[loc] ?? [];
      for (let i = 0; i < arr.length; i++) if (arr[i]) n += cap[i] ?? 0;
    }
    return n;
  }, [c?.injuries]);
  const injuryPenaltyOptions = useMemo<InjuryPenaltyOption[]>(() => {
    if (!c) return [];
    return INJURY_LOCATIONS.map((loc) => {
      const checked = c!.injuries[loc] ?? [];
      const cap = INJURY_CAPACITY[loc] ?? [];
      const penalty = checked.reduce((sum, value, index) => sum + (value ? cap[index] ?? 0 : 0), 0);
      const sequels = checked
        .map((value, index) => (value ? INJURY_LEVELS[index] : ""))
        .filter(Boolean)
        .join(", ");
      return { id: loc, label: loc, penalty, sequels: sequels || "Aucune sequelle" };
    }).filter((option) => option.penalty > 0);
  }, [c?.injuries]);
  const stressTotal = useMemo(
    () => (c ? c!.stress.reduce((s, v, i) => s + (v ? STRESS_CAPACITY[i] ?? 0 : 0), 0) : 0),
    [c?.stress],
  );
  const griefTotal = useMemo(
    () => (c ? c!.griefs.reduce((s, v, i) => s + (v ? GRIEF_CAPACITY[i] ?? 0 : 0), 0) : 0),
    [c?.griefs],
  );

  const penaltyByFacet: Record<Facet, number> = {
    corps: injuryTotal,
    esprit: stressTotal,
    ame: griefTotal,
  };

  const rollSelectionOptions = useMemo<RollSelection[]>(() => {
    if (!c) return [];
    return (Object.keys(FACET_LABELS) as Facet[]).flatMap((facet) =>
      FACET_SKILLS[facet].map((name) => {
        const baseValue = c!.facets[facet].skills[name] ?? 0;
        const penalty = facet === "corps" ? injuryTotal : facet === "esprit" ? stressTotal : griefTotal;
        const value = baseValue >= 0 ? Math.max(baseValue - penalty, 0) : baseValue;
        return {
          facet,
          name,
          value,
          baseValue,
          penalty,
          supernaturalDice: c!.supernaturalEnabled ? clampSupernaturalValue(c!.facets[facet].supernatural[name] ?? 0) : 0,
        };
      }),
    );
  }, [c?.facets, c?.supernaturalEnabled, injuryTotal, stressTotal, griefTotal]);

  useEffect(() => {
    const requestId = roomRequestId || new URLSearchParams(location.search).get('roomRoll');
    if (!c || !requestId || openedRoomRequest.current === requestId || room.session?.role !== 'player' || room.session.characterId !== c!.id) return;
    const request = room.requests.find(request => request.id === requestId && request.target === room.session!.id);
    if (!request) return;
    const requested = request.attributes.map(attribute => rollSelectionOptions.find(option => option.facet === attribute.facet && option.name === attribute.name));
    if (requested.some(option => !option)) return;
    openedRoomRequest.current = requestId;
    setRoomRollRequest(request);
    setSelection(requested as RollSelection[]);
    setContextualRollOptions([]);
    setLockedRollSelectionKey(null);
    setLockedRollSelectionCanChange(false);
    setRollOpen(true);
  }, [c, location.search, room.session, room.requests, rollSelectionOptions, roomRequestId]);

  const useActivePower = (power: Power) => {
    const forcedAttribute = rollSelectionOptions.find((option) => option.name === power.attribut);
    if (!forcedAttribute) {
      alert(localizeText("L’attribut associé à ce pouvoir n’existe pas sur ce héros."));
      return;
    }
    setSelection([forcedAttribute]);
    setLockedRollSelectionKey(`${forcedAttribute.facet}::${forcedAttribute.name}`);
    setLockedRollSelectionCanChange(false);
    setContextualRollOptions([]);
    setRollOpen(true);
  };

  const useVehicle = (vehicle: Vehicle) => {
    const vehicleOptions: RollSelection[] = [
      { facet: "vehicle", name: "Maniabilité", value: Number.parseInt(vehicle.maniabilite, 10) || 0 },
      { facet: "vehicle", name: "Vitesse", value: Number.parseInt(vehicle.vitesse, 10) || 0 },
    ];
    setSelection([vehicleOptions[0]]);
    setLockedRollSelectionKey("vehicle::Maniabilité");
    setLockedRollSelectionCanChange(true);
    setContextualRollOptions(vehicleOptions);
    setRollOpen(true);
  };

  // Protection per location, taking the max across all armors.
  // Format: 4 groupes séparés par "/" :
  //   Tête (1 chiffre) / SupG+SupD (2 chiffres) / Centrale (1 chiffre) / InfG+InfD (2 chiffres)
  // Ex: "1/25/6/32" → Tête 1, Sup G 2, Sup D 5, Centre 6, Inf G 3, Inf D 2.
  // Chaque valeur est plafonnée à 7.
  const protectionByLoc = useMemo<Record<string, number>>(() => {
    return characterProtectionByLoc(c);
  }, [c?.armures]);

  const effectiveCores = useMemo<Record<Facet, number>>(() => {
    const cores: Record<Facet, number> = { corps: 0, esprit: 0, ame: 0 };
    if (!c) return cores;
    for (const f of Object.keys(FACET_LABELS) as Facet[]) {
      const skills = c!.facets[f].skills;
      cores[f] = Math.max(...FACET_SKILLS[f].map((s) => {
        const base = skills[s] ?? 0;
        return base >= 0 ? Math.max(base - penaltyByFacet[f], 0) : base;
      }));
    }
    return cores;
  }, [c?.facets, penaltyByFacet]);

  const effectiveCore = (f: Facet): number => effectiveCores[f];

  const [critical, setCritical] = useState<Facet | null>(null);
  const prevCoresRef = useRef<Record<Facet, number> | null>(null);
  useEffect(() => {
    const cores = effectiveCores;
    const prev = prevCoresRef.current;
    if (prev) {
      for (const f of ["corps", "esprit", "ame"] as Facet[]) {
        if (prev[f] > 0 && cores[f] <= 0) {
          setCritical(f);
          break;
        }
      }
    }
    prevCoresRef.current = cores;
  }, [effectiveCores]);

  const { linkedHeroResources, availableHeroResources } = useMemo(() => {
    const linkedKeys = new Set(c?.linkedResources.map(linkedResourceKey));
    const linked: HeroResource[] = [], available: HeroResource[] = [];
    for (const resource of heroResources) {
      if (linkedKeys.has(heroResourceKey(resource))) linked.push(resource);
      else if (resource.item.directoryId === c?.directoryId) available.push(resource);
    }
    return { linkedHeroResources: linked, availableHeroResources: available };
  }, [heroResources, c?.linkedResources, c?.directoryId]);

  useEffect(() => {
    if (c?.climaxUsed && !characterHasCriticalState(c)) {
      setC(current => current?.climaxUsed && !characterHasCriticalState(current) ? { ...current, climaxUsed: false } : current);
    }
  }, [c]);

  if (!c) return null;

  const corpsInAgony = effectiveCore("corps") <= 0;
  const mentalBreakActive = c!.criticalStates.mentalBreak || stressMax >= STRESS_LEVELS.length || effectiveCore("esprit") <= 0;
  const emotionalBreakActive = c!.criticalStates.emotionalBreak || griefMax >= GRIEF_LEVELS.length || effectiveCore("ame") <= 0;
  const criticalRollLocked =
    corpsInAgony ||
    Object.values(c!.criticalStates.agony).some(Boolean) ||
    mentalBreakActive ||
    emotionalBreakActive;

  const handleResourceDragEnter = (event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    resourceDragDepth.current += 1;
    setResourceDragActive(true);
  };
  const handleResourceDragOver = (event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };
  const handleResourceDragLeave = (event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    resourceDragDepth.current = Math.max(0, resourceDragDepth.current - 1);
    if (resourceDragDepth.current === 0) setResourceDragActive(false);
  };
  const handleResourceDrop = (event: React.DragEvent) => {
    event.preventDefault();
    resourceDragDepth.current = 0;
    setResourceDragActive(false);
    void importHeroResourceFiles(event.dataTransfer.files);
  };



  return (
    <div
      className={`character-editor-page min-h-screen bg-paper text-foreground pb-24 ${embedded ? "room-character-editor" : ""} ${primaryInRoom && tab === "discussion" && !wideRoom ? "room-player-chat-open" : ""} ${isEdit ? "is-editing" : ""}`}
      onDragEnter={tab === "resources" && !isEdit ? handleResourceDragEnter : undefined}
      onDragOver={tab === "resources" && !isEdit ? handleResourceDragOver : undefined}
      onDragLeave={tab === "resources" && !isEdit ? handleResourceDragLeave : undefined}
      onDrop={tab === "resources" && !isEdit ? handleResourceDrop : undefined}
    >
      {localizeNode(exitDialog)}
      {localizeNode(embedded && roomResource && <RoomResourceView resource={roomResource} onClose={() => setRoomResource(null)} />)}
      <ExportLoader visible={exportingPng || exportingA6Pdf} label={localizeText(exportingA6Pdf ? "Export PDF A6" : "Export PNG")} />
      {localizeNode((resourceDragActive || resourceImportBusy) && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/75 p-4 backdrop-blur-sm">
          <div className="flex min-h-64 w-full max-w-xl flex-col items-center justify-center gap-4 border-2 border-dashed border-accent bg-paper px-6 py-10 text-center shadow-[6px_6px_0_hsl(var(--ink))]">
            <Upload size={42} strokeWidth={2.5} className="text-accent" />
            <div>
              <p className="font-display text-3xl leading-none">{localizeNode(resourceImportBusy ? "Import en cours" : "Déposer les PNG")}</p>
              <p className="mt-2 typewriter text-sm text-foreground/65">
                {localizeNode(resourceImportBusy ? "Ajout aux cartes globales et au héros..." : "Les nouvelles cartes seront ajoutées aux cartes globales puis liées à ce héros.")}
              </p>
            </div>
          </div>
        </div>
      ))}
      <header className="border-b border-ink bg-paper/95 backdrop-blur sticky top-0 z-10">
        <div className="container flex items-center justify-between h-16 gap-4">
          {localizeNode(primaryInRoom ? roomNavigation : <button type="button" aria-label={localizeText(embedded ? "Fermer ma fiche" : "Retour")} onClick={() => void handleBackToCharacters()} className="flex h-9 w-9 items-center justify-center gap-2 text-sm uppercase tracking-widest font-bold hover:text-accent md:w-auto md:px-0">
            <ArrowLeft size={16} />
            <span className="hidden md:inline">{localizeNode(embedded ? "Fermer la fiche" : "Retour")}</span>
          </button>)}
          <h1 className="font-display text-xl md:text-2xl tracking-wider truncate">
            {c!.nom || localizeText("Sans nom")}
            {localizeNode(roomContextLabel && <span className="block truncate font-sans text-xs font-normal tracking-normal text-muted-foreground">{localizeNode(roomContextLabel)}</span>)}
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            <span data-mobile-help className="empty:hidden shrink-0 sm:hidden" />{localizeNode(!primaryInRoom && <span aria-hidden="true" className="hidden w-10 shrink-0 sm:block" />)}
            {localizeNode(primaryInRoom && renderRoomMenu?.(<><DropdownMenuItem disabled={isEdit} onSelect={startEditing} className="min-h-11 gap-3"><Pencil size={18} />{localizeText("Modifier le héros")}</DropdownMenuItem><DropdownMenuItem disabled={exportingPng || exportingA6Pdf} onSelect={() => { void handleExport(); }} className="min-h-11 gap-3"><Download size={18} />{localizeText("Exporter en PNG")}</DropdownMenuItem><DropdownMenuItem disabled={exportingPng || exportingA6Pdf} onSelect={() => { void handleExportA6Pdf(); }} className="min-h-11 gap-3"><Download size={18} />{localizeText("Exporter en PDF A6")}</DropdownMenuItem></>))}
            {localizeNode(isEdit ? <button type="button" data-tour="hero-actions" aria-label={localizeText("Sauvegarder")} onClick={() => void save()} className="flex h-11 shrink-0 items-center justify-center gap-2 bg-accent px-3 text-xs font-bold uppercase tracking-widest text-background hover:opacity-90">
              <Save size={18} /><span className="hidden md:inline">{localizeText("Sauvegarder")}</span>
            </button> : primaryInRoom ? null : <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" data-tour="hero-actions" aria-label={localizeText("Actions du héros")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
                  <MoreVertical size={22} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="w-64 max-w-[calc(100vw-2rem)] border-2 border-ink bg-paper p-2 text-foreground shadow-[4px_4px_0_hsl(var(--ink))]">
                <DropdownMenuLabel className="px-3 py-2 typewriter text-xs uppercase tracking-widest text-foreground/60">{localizeText("Actions du héros")}</DropdownMenuLabel>
                <DropdownMenuItem onSelect={startEditing} className="min-h-12 cursor-pointer gap-3 px-3">
                  <Pencil size={18} />{localizeText("Modifier le héros ")}</DropdownMenuItem>
                <DropdownMenuSeparator className="bg-ink/15" />
                <DropdownMenuLabel className="px-3 py-2 typewriter text-xs uppercase tracking-widest text-foreground/60">{localizeText("Exporter")}</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => { void handleExport(); }} disabled={exportingPng || exportingA6Pdf} className="min-h-12 cursor-pointer gap-3 px-3">
                  <Download size={18} />{localizeText("Exporter en PNG ")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { void handleExportA6Pdf(); }} disabled={exportingPng || exportingA6Pdf} className="min-h-12 cursor-pointer gap-3 px-3">
                  <Download size={18} />{localizeText("Exporter en PDF A6 ")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>)}
          </div>
        </div>

        {/* Tabs */}
        {(!wideRoom || isEdit) && <div className={embedded && !primaryInRoom ? "container overflow-x-auto" : "container hidden overflow-x-auto md:block"}>
          <nav data-tour="hero-tabs" className="flex gap-1 border-t border-ink/20">
            {editorTabs.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-3 typewriter text-xs uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${
                    active ? "border-accent text-accent" : "border-transparent text-foreground/60 hover:text-foreground"
                  }`}
                >
                  {localizeNode(t.label)}
                </button>
              );
            })}
            <div className="ml-auto flex items-center">
              <span className="typewriter text-[10px] uppercase tracking-widest text-foreground/50 mr-2 flex items-center gap-1">
                {localizeNode(isEdit ? <Pencil size={12} /> : <Eye size={12} />)}{localizeText(" Mode ")}{localizeNode(isEdit ? "édition" : "jeu")}
              </span>
            </div>
          </nav>
        </div>}
      </header>

      <main
        onTouchStart={(event) => {
          swipeStart.current = null;
          if (isEdit || wideRoom || event.touches.length !== 1 || tab === "discussion") return;
          if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"], [role="slider"], [role="dialog"]')) return;
          const touch = event.touches[0];
          swipeStart.current = { x: touch.clientX, y: touch.clientY, id: touch.identifier };
        }}
        onTouchMove={(event) => {
          const start = swipeStart.current;
          if (!start) return;
          const touch = Array.from(event.touches).find((item) => item.identifier === start.id);
          if (event.touches.length !== 1 || !touch || Math.abs(touch.clientY - start.y) > 40) swipeStart.current = null;
        }}
        onTouchCancel={() => { swipeStart.current = null; }}
        onTouchEnd={(event) => {
          const start = swipeStart.current;
          swipeStart.current = null;
          if (!start || isEdit || wideRoom) return;
          const touch = Array.from(event.changedTouches).find((item) => item.identifier === start.id);
          if (!touch) return;
          const dx = touch.clientX - start.x;
          const dy = touch.clientY - start.y;
          if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
          const index = TABS.findIndex((item) => item.id === tab);
          const next = TABS[index + (dx < 0 ? 1 : -1)];
          if (next) setTab(next.id);
        }}
        className={`container py-8 pb-28 md:pb-8 ${primaryInRoom ? "room-player-layout" : "space-y-10"} ${isEdit ? "character-editor-edit-main" : ""}`}>
        {!embedded && !primaryInRoom && <PageTour onHeroTabChange={setTab} key={tab === "resources" ? "hero-resources" : isEdit ? "hero-edit" : "hero-detail"} page={tab === "resources" ? "hero-resources" : isEdit ? "hero-edit" : "hero-detail"} />}
        {localizeNode(roomRequests && <div className="room-player-requests">{localizeNode(roomRequests)}</div>)}
        <div hidden={!wideRoom && tab !== "discussion"} className="room-player-discussion">{localizeNode(roomDiscussion)}</div>
        <div hidden={!wideRoom && tab === "discussion"} className="room-player-sheet space-y-10">
        {localizeNode(!isEdit && (wideRoom || tab === "identity") && (
          <CharacterCards
            c={c}
            activeCardTab="identity"
            boardRef={!wideRoom || tab === "identity" ? heroCardBoardRef : undefined}
            selectedKeys={selectedKeys}
            onToggleSelect={toggleSelect}
            canSelectMore={selection.length < 2}
            injuryTotal={injuryTotal}
            stressTotal={stressTotal}
            griefTotal={griefTotal}
            stressMax={stressMax}
            griefMax={griefMax}
            protectionByLoc={protectionByLoc}
            onInjuryChange={setInjuryLevel}
            onStressChange={(index) => setStateArr("stress", index)}
            onGriefChange={(index) => setStateArr("griefs", index)}
            onCheckColorChange={setCardCheckColor}
            onCriticalSummaryToggle={toggleCriticalSummary}
          />
        ))}

        {localizeNode(!isEdit && (wideRoom || tab === "attributes") && (
          <CharacterCards
            c={c}
            activeCardTab="attributes"
            boardRef={!wideRoom || tab === "attributes" ? heroCardBoardRef : undefined}
            selectedKeys={selectedKeys}
            onToggleSelect={toggleSelect}
            canSelectMore={selection.length < 2}
            injuryTotal={injuryTotal}
            stressTotal={stressTotal}
            griefTotal={griefTotal}
            stressMax={stressMax}
            griefMax={griefMax}
            protectionByLoc={protectionByLoc}
            onInjuryChange={setInjuryLevel}
            onStressChange={(index) => setStateArr("stress", index)}
            onGriefChange={(index) => setStateArr("griefs", index)}
            onCheckColorChange={setCardCheckColor}
            onCriticalSummaryToggle={toggleCriticalSummary}
          />
        ))}

        {/* IDENTITY */}
        {isEdit && tab === "identity" && (
          <section className="paper-card p-6 grid md:grid-cols-[220px_1fr] gap-6">
            <div>
              <ImageEditorField portrait aspectRatio={2 / 3} label={localizeText("Portrait")} value={c!.portrait} editing={c!.portraitEditing} onChange={(portrait, portraitEditing, dominantColor) => update({ portrait, portraitEditing, ...(dominantColor ? { cardInk: dominantColor } : {}) })} />

            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 content-start">
              <TextField mode={mode} label={localizeText("Nom")} value={c!.nom} onChange={(v) => update({ nom: v })} className="col-span-2 sm:col-span-4" />
              <TextField mode={mode} label={localizeText("Âge")} value={c!.age} onChange={(v) => update({ age: v })} />
              <TextField mode={mode} label={localizeText("Taille")} value={c!.taille} onChange={(v) => update({ taille: v })} />
              <TextField mode={mode} label={localizeText("Poids")} value={c!.poids} onChange={(v) => update({ poids: v })} />
              <label className="block">
                <span className="typewriter text-[10px] uppercase tracking-[0.25em] text-foreground/60">{localizeText("Points de Récits")}</span>
                {localizeNode(isEdit ? (
                  <input maxLength={100000}
                    type="number"
                    value={c!.pointsRecits}
                    onChange={(e) => update({ pointsRecits: Number(e.target.value) })}
                    className="w-full mt-1 px-2 py-1.5 bg-transparent border-b-2 border-ink/40 focus:border-accent outline-none typewriter text-sm"
                  />
                ) : (
                  <p className="mt-1 px-2 py-1.5 typewriter text-sm font-bold text-accent">{localizeNode(c!.pointsRecits)}</p>
                ))}
              </label>
              <div className="col-span-2 block">
                <span className="typewriter text-[10px] uppercase tracking-[0.25em] text-foreground/60">{localizeText("Couleur des cartes")}</span>
                <div className="mt-1 flex flex-wrap items-center gap-2 border-b-2 border-ink/40 px-2 py-1.5">
                  <input maxLength={100000}
                    type="color"
                    value={c!.cardInk}
                    onChange={(e) => update({ cardInk: e.target.value })}
                    className="h-6 w-10 cursor-pointer border border-ink/30 bg-transparent p-0"
                    aria-label={localizeText("Couleur des cartes")}
                  />
                  <span className="typewriter text-xs font-bold uppercase tracking-widest text-foreground/65">{localizeNode(c!.cardInk)}</span>
                  <PortraitColorPicker source={c!.portrait} onSelect={cardInk => update({ cardInk })} />
                </div>
              </div>
              <TextField mode={mode} label={localizeText("Concept")} value={c!.concept} onChange={(v) => update({ concept: v })} className="col-span-2 sm:col-span-4" />
              <TextField mode={mode} label={localizeText("Réplique fétiche")} value={c!.replique} onChange={(v) => update({ replique: v })} className="col-span-2 sm:col-span-4" />
            </div>
          </section>
        )}

        {localizeNode(isEdit && tab === "attributes" && (
          <section className="paper-card p-5">
            <h2 className="font-display text-2xl mb-4">{localizeText("Spécial")}</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="typewriter text-[10px] uppercase tracking-[0.25em] text-foreground/60">{localizeText("Déstin lancé")}</span>
                <input maxLength={100000}
                  type="number"
                  min={0}
                  step={1}
                  value={c!.destinDiceCount}
                  onChange={(e) => updateDestinDiceCount(Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1.5 bg-transparent border-b-2 border-ink/40 focus:border-accent outline-none typewriter text-sm"
                />
              </label>
              <label className="flex items-center gap-3 border-2 border-ink/30 bg-paper-dark/25 px-3 py-2">
                <input maxLength={100000}
                  type="checkbox"
                  checked={c!.supernaturalEnabled}
                  onChange={(e) => update({ supernaturalEnabled: e.target.checked })}
                  className="h-4 w-4 accent-accent"
                />
                <span className="typewriter text-[10px] font-bold uppercase tracking-[0.25em] text-foreground/70">{localizeText(" Attributs surnaturels ")}</span>
              </label>
              <label className="flex items-center gap-3 border-2 border-ink/30 bg-paper-dark/25 px-3 py-2">
                <input maxLength={100000}
                  type="checkbox"
                  checked={c!.mandatoryComplication}
                  onChange={(e) => update({ mandatoryComplication: e.target.checked })}
                  className="h-4 w-4 accent-accent"
                />
                <span className="typewriter text-[10px] font-bold uppercase tracking-[0.25em] text-foreground/70">{localizeText(" Complication obligatoire ")}</span>
              </label>
            </div>
          </section>
        ))}

        {/* ATTRIBUTES */}
        {isEdit && tab === "attributes" && (
          <section className="paper-card px-2 py-5 sm:p-6">
            {localizeNode(!isEdit && (
              <div className="mb-6 flex min-h-[54px] items-center justify-between flex-wrap gap-3 border-2 border-dashed border-ink/30 p-3">
                <div className="typewriter text-xs uppercase tracking-widest text-foreground/70 leading-5">
                  {localizeNode(selection.length === 0
                    ? "Clique sur deux attributs pour préparer un jet"
                    : selection.length === 1
                    ? `1 attribut choisi (${selection[0].name}) — sélectionne-en un second`
                    : `Potentiel ${selection[0].value + selection[1].value} — ${selection[0].name} + ${selection[1].name}`)}
                </div>
                <div className="flex items-center gap-2">
                  {localizeNode(selection.length > 0 && (
                    <button
                      onClick={() => setSelection([])}
                      className="typewriter text-xs uppercase tracking-widest text-foreground/60 hover:text-destructive px-2 py-1"
                    >{localizeText(" Réinitialiser ")}</button>
                  ))}
                </div>
              </div>
            ))}
            <div className="grid gap-8 xl:grid-cols-3 items-start justify-items-center overflow-visible px-0 sm:gap-10 sm:px-3">
              {(Object.keys(FACET_LABELS) as Facet[]).map((f) => (
                <Reel
                  key={f}
                  facet={f}
                  skills={c!.facets[f].skills}
                  supernatural={c!.facets[f].supernatural}
                  onSkill={updateSkill}
                  onSupernatural={updateSupernatural}
                  mode={mode}
                  penalty={penaltyByFacet[f]}
                  selectedKeys={selectedKeys}
                  onToggleSelect={toggleSelect}
                  canSelectMore={selection.length < 2}
                  supernaturalEnabled={c!.supernaturalEnabled}
                />
              ))}
            </div>
          </section>
        )}


        {/* TRAITS */}
        {localizeNode(!isEdit && (wideRoom || tab === "traits") && (
          <CharacterCards
            c={c}
            activeCardTab="traits"
            boardRef={!wideRoom || tab === "traits" ? heroCardBoardRef : undefined}
            selectedKeys={selectedKeys}
            onToggleSelect={toggleSelect}
            canSelectMore={selection.length < 2}
            injuryTotal={injuryTotal}
            stressTotal={stressTotal}
            griefTotal={griefTotal}
            stressMax={stressMax}
            griefMax={griefMax}
            protectionByLoc={protectionByLoc}
            onInjuryChange={setInjuryLevel}
            onStressChange={(index) => setStateArr("stress", index)}
            onGriefChange={(index) => setStateArr("griefs", index)}
            onCheckColorChange={setCardCheckColor}
            onCriticalSummaryToggle={toggleCriticalSummary}
          />
        ))}

        {localizeNode(isEdit && tab === "traits" && (
          <section className="grid md:grid-cols-2 gap-6">
            <div className="paper-card p-5">
              <h2 className="font-display text-2xl mb-3">{localizeText("Traits")}</h2>
              <RichTextField label={localizeText("Traits")} value={c!.traits} onChange={(value) => update({ traits: value })} />
            </div>
            <div className="paper-card p-5">
              <h2 className="font-display text-2xl mb-3">{localizeText("Spécialité")}</h2>
              <RichTextField label={localizeText("Spécialité")} value={c!.specialite} onChange={(value) => update({ specialite: value })} />
            </div>
          </section>
        ))}

        {/* GEAR */}
        {isEdit && tab === "traits" && (
          <section className="paper-card p-5 space-y-8">
            {/* Armes */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-2xl">{localizeText("Armes")}</h2>
                {isEdit && (
                  <button
                    onClick={() => update({ armes: [...c!.armes, { nom: "", degats: "", proprietes: "" }] })}
                    className="flex items-center gap-1 text-xs typewriter uppercase tracking-widest hover:text-accent"
                  >
                    <Plus size={14} />{localizeText(" Ajouter ")}</button>
                )}
              </div>
              <div className="space-y-2" role="table" aria-label={localizeText("Armes")}>
                <div className="grid grid-cols-12 gap-2 border border-ink/30 bg-paper-dark/35 px-2 py-1.5 typewriter text-[10px] uppercase tracking-widest text-foreground/70" role="row">
                  <span className="col-span-4" role="columnheader">{localizeText("Nom")}</span>
                  <span className="col-span-2" role="columnheader">{localizeText("Degats")}</span>
                  <span className="col-span-5" role="columnheader">{localizeText("Proprietes")}</span>
                  <span className="col-span-1 text-right" role="columnheader">{localizeText("Action")}</span>
                </div>
                {localizeNode(c!.armes.length === 0 && !isEdit && (
                  <p className="typewriter text-sm text-foreground/40 italic">{localizeText("Aucune arme.")}</p>
                ))}
                {c!.armes.map((a, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center" role="row">
                    {isEdit ? (
                      <>
                        <input maxLength={100000} value={a.nom} onChange={(e) => { const arr = [...c!.armes]; arr[i] = { ...a, nom: e.target.value }; update({ armes: arr }); }} className="col-span-4 px-2 py-1 bg-transparent border border-ink/30 typewriter text-sm" />
                        <input maxLength={100000} value={a.degats} onChange={(e) => { const arr = [...c!.armes]; arr[i] = { ...a, degats: e.target.value }; update({ armes: arr }); }} className="col-span-2 px-2 py-1 bg-transparent border border-ink/30 typewriter text-sm" />
                        <input maxLength={100000} value={a.proprietes} onChange={(e) => { const arr = [...c!.armes]; arr[i] = { ...a, proprietes: e.target.value }; update({ armes: arr }); }} className="col-span-5 px-2 py-1 bg-transparent border border-ink/30 typewriter text-sm" />
                        <button onClick={() => update({ armes: c!.armes.filter((_, k) => k !== i) })} className="col-span-1 text-foreground/50 hover:text-destructive">
                          <Trash2 size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="col-span-4 typewriter text-sm">{a.nom || "—"}</span>
                        <span className="col-span-2 typewriter text-sm">{localizeNode(a.degats || "—")}</span>
                        <span className="col-span-6 typewriter text-sm text-foreground/70">{localizeNode(a.proprietes || "—")}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Armures */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-2xl">{localizeText("Armures")}</h2>
                {isEdit && (
                  <button
                    onClick={() => update({ armures: [...c!.armures, { nom: "", poids: "", protection: "", proprietes: "" }] })}
                    className="flex items-center gap-1 text-xs typewriter uppercase tracking-widest hover:text-accent"
                  >
                    <Plus size={14} />{localizeText(" Ajouter ")}</button>
                )}
              </div>
              <div className="space-y-2" role="table" aria-label={localizeText("Armures")}>
                <div className="grid grid-cols-12 gap-2 border border-ink/30 bg-paper-dark/35 px-2 py-1.5 typewriter text-[10px] uppercase tracking-widest text-foreground/70" role="row">
                  <span className="col-span-3" role="columnheader">{localizeText("Nom")}</span>
                  <span className="col-span-2" role="columnheader">{localizeText("Poids")}</span>
                  <span className="col-span-2" role="columnheader">{localizeText("Protection")}</span>
                  <span className="col-span-4" role="columnheader">{localizeText("Proprietes")}</span>
                  <span className="col-span-1 text-right" role="columnheader">{localizeText("Action")}</span>
                </div>
                {localizeNode(c!.armures.length === 0 && !isEdit && (
                  <p className="typewriter text-sm text-foreground/40 italic">{localizeText("Aucune armure.")}</p>
                ))}
                {c!.armures.map((p, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center" role="row">
                    {isEdit ? (
                      <>
                        <input maxLength={100000} value={p.nom} onChange={(e) => { const arr = [...c!.armures]; arr[i] = { ...p, nom: e.target.value }; update({ armures: arr }); }} className="col-span-3 px-2 py-1 bg-transparent border border-ink/30 typewriter text-sm" />
                        <input maxLength={100000} value={p.poids} onChange={(e) => { const arr = [...c!.armures]; arr[i] = { ...p, poids: e.target.value }; update({ armures: arr }); }} className="col-span-2 px-2 py-1 bg-transparent border border-ink/30 typewriter text-sm" />
                        <input
                          value={p.protection}
                          inputMode="numeric"
                          maxLength={9}
                          placeholder={localizeText("ex: 1/25/6/32")}
                          onChange={(e) => {
                            // Garde uniquement les chiffres (max 6), chacun plafonné à 7,
                            // puis insère les "/" automatiquement au format D/DD/D/DD.
                            const digits = e.target.value.replace(/\D/g, "").slice(0, 6)
                              .split("").map((d) => String(Math.min(7, parseInt(d, 10))));
                            let out = "";
                            const lens = [1, 2, 1, 2];
                            let idx = 0;
                            for (let g = 0; g < lens.length && idx < digits.length; g++) {
                              if (g > 0) out += "/";
                              out += digits.slice(idx, idx + lens[g]).join("");
                              idx += lens[g];
                            }
                            const arr = [...c!.armures];
                            arr[i] = { ...p, protection: out };
                            update({ armures: arr });
                          }}
                          className="col-span-2 px-2 py-1 bg-transparent border border-ink/30 typewriter text-sm"
                        />
                        <input maxLength={100000} value={p.proprietes} onChange={(e) => { const arr = [...c!.armures]; arr[i] = { ...p, proprietes: e.target.value }; update({ armures: arr }); }} className="col-span-4 px-2 py-1 bg-transparent border border-ink/30 typewriter text-sm" />
                        <button onClick={() => update({ armures: c!.armures.filter((_, k) => k !== i) })} className="col-span-1 text-foreground/50 hover:text-destructive">
                          <Trash2 size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="col-span-3 typewriter text-sm">{p.nom || "—"}</span>
                        <span className="col-span-2 typewriter text-sm">{localizeNode(p.poids || "—")}</span>
                        <span className="col-span-2 typewriter text-sm">{localizeNode(p.protection || "—")}</span>
                        <span className="col-span-5 typewriter text-sm text-foreground/70">{localizeNode(p.proprietes || "—")}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <OtherAccessoriesEditor items={c!.autresAccessoires} onChange={(items) => update({ autresAccessoires: items })} />
          </section>
        )}

        {/* STATE */}
        {localizeNode(!isEdit && (wideRoom || tab === "state") && (
          <CharacterCards
            c={c}
            activeCardTab="state"
            boardRef={!wideRoom || tab === "state" ? heroCardBoardRef : undefined}
            selectedKeys={selectedKeys}
            onToggleSelect={toggleSelect}
            canSelectMore={selection.length < 2}
            injuryTotal={injuryTotal}
            stressTotal={stressTotal}
            griefTotal={griefTotal}
            stressMax={stressMax}
            griefMax={griefMax}
            protectionByLoc={protectionByLoc}
            onInjuryChange={setInjuryLevel}
            onStressChange={(index) => setStateArr("stress", index)}
            onGriefChange={(index) => setStateArr("griefs", index)}
            onCheckColorChange={setCardCheckColor}
            onCriticalSummaryToggle={toggleCriticalSummary}
          />
        ))}

        {isEdit && false && (
          <div className="space-y-6">
            <section className="md:hidden border-2 border-ink bg-paper-dark/35 px-3 py-2 shadow-[3px_3px_0_hsl(var(--ink))]">
              <div className="grid grid-cols-3 items-center divide-x divide-ink/20">
                <div className="flex items-center justify-center gap-1.5 text-[#7F240F]">
                  <HeartCrack size={17} strokeWidth={1.8} />
                  <span className="font-display text-2xl leading-none">{localizeNode(injuryTotal)}</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[#3E7A2F]">
                  <Brain size={17} strokeWidth={1.8} />
                  <span className="font-display text-2xl leading-none">{localizeNode(stressTotal)}</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[#253A72]">
                  <Eye size={17} strokeWidth={1.8} />
                  <span className="font-display text-2xl leading-none">{localizeNode(griefTotal)}</span>
                </div>
              </div>
            </section>

            <section className="hidden gap-4 md:grid md:grid-cols-3">
              <StateSummaryCard
                title={localizeText("Blessures")}
                value={injuryTotal}
                penaltyLabel={`Corps -${injuryTotal}`}
                icon={<HeartCrack size={26} strokeWidth={1.8} />}
                colorClass="text-[#7F240F]"
                detail={injuryTotal > 0 ? "Impact physique" : "Aucune sequelle"}
              />
              <StateSummaryCard
                title={localizeText("Stress")}
                value={stressTotal}
                penaltyLabel={`Esprit -${stressTotal}`}
                icon={<Brain size={26} strokeWidth={1.8} />}
                colorClass="text-[#3E7A2F]"
                detail={stressMax > 0 ? STRESS_LEVELS[stressMax - 1] : "Calme"}
              />
              <StateSummaryCard
                title={localizeText("Chagrins")}
                value={griefTotal}
                penaltyLabel={`Ame -${griefTotal}`}
                icon={<Eye size={26} strokeWidth={1.8} />}
                colorClass="text-[#253A72]"
                detail={griefMax > 0 ? GRIEF_LEVELS[griefMax - 1] : "Stable"}
              />
            </section>

            <section className="paper-card p-4 md:hidden">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-2xl">{localizeText("Reglage rapide")}</h2>
                <span className="typewriter text-[10px] uppercase tracking-widest text-foreground/45">{localizeText(" Mobile ")}</span>
              </div>
              <div className="space-y-4">
                {INJURY_LOCATIONS.map((loc) => {
                  const values = c!.injuries[loc] ?? [];
                  const level = values.lastIndexOf(true) + 1;
                  const protection = protectionByLoc[loc] ?? 0;
                  const lineTotal = values.reduce(
                    (sum, checked, index) => sum + (checked ? INJURY_CAPACITY[loc]?.[index] ?? 0 : 0),
                    0,
                  );
                  return (
                    <label key={loc} className="block">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="typewriter text-[11px] font-bold uppercase tracking-widest">{localizeNode(loc)}</span>
                        <span className="flex items-center gap-2 typewriter text-[10px] uppercase tracking-widest">
                          {localizeNode(protection > 0 && (
                            <span className="inline-flex items-center gap-1 text-[#253A72]">
                              <Shield size={12} fill="currentColor" fillOpacity={0.18} /> {localizeNode(protection)}
                            </span>
                          ))}
                          <span className="text-[#7F240F]">-{localizeNode(lineTotal)}</span>
                          <span className="font-display text-xl leading-none text-[#7F240F]">{localizeNode(level)}</span>
                        </span>
                      </div>
                      <input maxLength={100000}
                        type="range"
                        min={0}
                        max={INJURY_LEVELS.length}
                        value={level}
                        onChange={(e) => setInjuryLevelN(loc, parseInt(e.target.value, 10))}
                        className="w-full cursor-pointer accent-[#7F240F]"
                        aria-label={localizeText(`Niveau de blessure ${loc}`)}
                      />
                    </label>
                  );
                })}

                <label className="block border-t border-ink/15 pt-4">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="typewriter text-[11px] font-bold uppercase tracking-widest">{localizeText("Stress")}</span>
                    <span className="flex items-center gap-2 typewriter text-[10px] uppercase tracking-widest">
                      <span className="text-[#3E7A2F]">-{localizeNode(stressTotal)}</span>
                      <span className="font-display text-xl leading-none text-[#3E7A2F]">{localizeNode(stressMax)}</span>
                    </span>
                  </div>
                  <input maxLength={100000}
                    type="range"
                    min={0}
                    max={STRESS_LEVELS.length}
                    value={stressMax}
                    onChange={(e) => setStateLevelN("stress", parseInt(e.target.value, 10))}
                    className="w-full cursor-pointer accent-[#3E7A2F]"
                    aria-label={localizeText("Niveau de stress")}
                  />
                </label>

                <label className="block">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="typewriter text-[11px] font-bold uppercase tracking-widest">{localizeText("Chagrins")}</span>
                    <span className="flex items-center gap-2 typewriter text-[10px] uppercase tracking-widest">
                      <span className="text-[#253A72]">-{localizeNode(griefTotal)}</span>
                      <span className="font-display text-xl leading-none text-[#253A72]">{localizeNode(griefMax)}</span>
                    </span>
                  </div>
                  <input maxLength={100000}
                    type="range"
                    min={0}
                    max={GRIEF_LEVELS.length}
                    value={griefMax}
                    onChange={(e) => setStateLevelN("griefs", parseInt(e.target.value, 10))}
                    className="w-full cursor-pointer accent-[#253A72]"
                    aria-label={localizeText("Niveau de chagrin")}
                  />
                </label>
              </div>
            </section>

            <button
              type="button"
              onClick={() => setShowMobileStateDetails((open) => !open)}
              aria-expanded={showMobileStateDetails}
              className="flex w-full items-center justify-between border-2 border-ink bg-paper px-4 py-3 shadow-[3px_3px_0_hsl(var(--ink))] md:hidden"
            >
              <span className="typewriter text-xs font-bold uppercase tracking-widest">{localizeText("Detail")}</span>
              <span className="font-display text-2xl leading-none">{localizeNode(showMobileStateDetails ? "-" : "+")}</span>
            </button>

            <section className={`${showMobileStateDetails ? "block" : "hidden"} paper-card p-5 md:block`}>
              <div className="flex flex-wrap items-center justify-between mb-5 gap-3">
                <div>
                  <h2 className="font-display text-2xl">{localizeText("Blessures")}</h2>
                  <p className="typewriter text-xs uppercase tracking-widest text-foreground/55">{localizeText(" Clique sur un niveau pour remplir la ligne, reclique pour reculer. ")}</p>
                </div>
                <span className="flex items-center gap-2 typewriter text-sm uppercase tracking-widest">
                  <HeartCrack size={18} className="text-[#7F240F]" />
                  <span className="font-bold text-[#7F240F]">{localizeNode(injuryTotal)}</span>
                  <span className="text-foreground/50">{localizeText("Corps -")}{localizeNode(injuryTotal)}</span>
                </span>
              </div>
              <div className="space-y-3">
                {INJURY_LOCATIONS.map((loc) => {
                  const values = c!.injuries[loc] ?? [];
                  const level = values.lastIndexOf(true) + 1;
                  const protection = protectionByLoc[loc] ?? 0;
                  const lineTotal = values.reduce(
                    (sum, checked, index) => sum + (checked ? INJURY_CAPACITY[loc]?.[index] ?? 0 : 0),
                    0,
                  );
                  const agonyChecked = c!.criticalStates.agony[loc] || (corpsInAgony && level >= INJURY_LEVELS.length);
                  return (
                    <article key={loc} className="border border-ink/25 bg-paper-dark/25 p-3">
                      <div className="grid gap-3 lg:grid-cols-[minmax(160px,210px)_1fr_minmax(72px,92px)] lg:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="typewriter text-sm font-bold uppercase tracking-widest">{localizeNode(loc)}</h3>
                            {localizeNode(protection > 0 && (
                              <span className="inline-flex items-center gap-1 border border-[#253A72]/50 px-1.5 py-0.5 typewriter text-[10px] uppercase tracking-widest text-[#253A72]">
                                <Shield size={11} fill="currentColor" fillOpacity={0.18} /> {localizeNode(protection)}
                              </span>
                            ))}
                          </div>
                          <div className="mt-2 hidden items-center gap-3 md:flex">
                            <input maxLength={100000}
                              type="range"
                              min={0}
                              max={INJURY_LEVELS.length}
                              value={level}
                              onChange={(e) => setInjuryLevelN(loc, parseInt(e.target.value, 10))}
                              className="min-w-0 flex-1 accent-[#7F240F] cursor-pointer"
                              aria-label={localizeText(`Niveau de blessure ${loc}`)}
                            />
                            <span className="font-display text-2xl text-[#7F240F] tabular-nums">{localizeNode(level)}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-8">
                          {INJURY_LEVELS.map((injuryLevel, index) => {
                            const checked = values[index] ?? false;
                            const capacity = INJURY_CAPACITY[loc]?.[index] ?? 0;
                            const shielded = protection >= index + 1;
                            return (
                              <button
                                key={injuryLevel}
                                type="button"
                                onClick={() => setInjuryLevel(loc, index)}
                                aria-pressed={checked}
                                className={`relative min-h-[72px] border-2 px-2 py-2 text-left transition-colors ${
                                  checked
                                    ? "border-[#7F240F] bg-[#7F240F]/10 text-[#7F240F]"
                                    : "border-ink/25 text-foreground/55 hover:border-accent hover:bg-paper-dark/40"
                                } ${shielded ? "shadow-[inset_0_0_0_2px_hsl(200_80%_45%_/_0.45)]" : ""}`}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <span className="font-display text-xl leading-none">{localizeNode(index + 1)}</span>
                                  {localizeNode(shielded && <Shield size={13} className="shrink-0 text-[#253A72]" fill="currentColor" fillOpacity={0.18} />)}
                                </div>
                                <div className="mt-1 typewriter text-[9px] uppercase leading-tight">{localizeNode(injuryLevel)}</div>
                                <div className="mt-1 flex min-h-[14px] gap-0.5">
                                  {capacity > 0 && Array.from({ length: capacity }).map((_, iconIndex) => (
                                    <HeartCrack key={iconIndex} size={13} strokeWidth={1.6} />
                                  ))}
                                </div>
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            disabled={level < INJURY_LEVELS.length}
                            onClick={() => toggleAgony(loc)}
                            className={`relative min-h-[72px] border-2 px-2 py-2 text-left transition-colors ${
                              agonyChecked
                                ? "border-[#7F240F] bg-[#7F240F]/10 text-[#7F240F]"
                                : level >= INJURY_LEVELS.length
                                ? "border-ink/35 bg-transparent text-foreground/70 hover:border-[#7F240F] hover:bg-paper-dark/40"
                                : "cursor-not-allowed border-ink/15 text-foreground/25"
                            }`}
                          >
                            <div className="flex h-full flex-col justify-center gap-1">
                              <HeartCrack size={16} strokeWidth={1.7} />
                              <span className="typewriter text-[9px] font-bold uppercase leading-tight">{localizeText("Agonie")}</span>
                              {localizeNode(level >= INJURY_LEVELS.length && !agonyChecked && (
                                <span className="typewriter text-[8px] uppercase tracking-widest text-foreground/45">{localizeText(" Disponible ")}</span>
                              ))}
                            </div>
                          </button>
                        </div>

                        <div className="flex items-center justify-between border-t border-ink/15 pt-2 lg:block lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0">
                          <span className="typewriter text-[10px] uppercase tracking-widest text-foreground/50">{localizeText("Malus")}</span>
                          <span className="font-display text-3xl leading-none text-[#7F240F]">-{localizeNode(lineTotal)}</span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className={`${showMobileStateDetails ? "grid" : "hidden"} gap-6 md:grid xl:grid-cols-2`}>
              <ConditionTrack
                title={localizeText("Stress")}
                levels={STRESS_LEVELS}
                values={c!.stress}
                capacities={STRESS_CAPACITY}
                total={stressTotal}
                maxLevel={stressMax}
                colorClass="text-[#3E7A2F]"
                accentClass="accent-[#3E7A2F]"
                icon={<Brain size={16} strokeWidth={1.6} />}
                criticalLabel="Délire"
                criticalChecked={mentalBreakActive}
                onClick={(index) => setStateArr("stress", index)}
                onSetLevel={(level) => setStateLevelN("stress", level)}
                onCritical={() => toggleCriticalState("mentalBreak", "esprit")}
              />
              <ConditionTrack
                title={localizeText("Chagrins")}
                levels={GRIEF_LEVELS}
                values={c!.griefs}
                capacities={GRIEF_CAPACITY}
                total={griefTotal}
                maxLevel={griefMax}
                colorClass="text-[#253A72]"
                accentClass="accent-[#253A72]"
                icon={<Eye size={16} strokeWidth={1.6} />}
                criticalLabel="Désespoir"
                criticalChecked={emotionalBreakActive}
                onClick={(index) => setStateArr("griefs", index)}
                onSetLevel={(level) => setStateLevelN("griefs", level)}
                onCritical={() => toggleCriticalState("emotionalBreak", "ame")}
              />
            </section>
          </div>
        )}

        {((!isEdit && wideRoom) || tab === "resources") && (
          <section className="space-y-10">
            {linkedHeroResources.length > 0 ? (
              <div className="-mx-6 grid justify-center gap-x-2 gap-y-5 min-[390px]:gap-x-[14px] [grid-template-columns:repeat(2,auto)] sm:mx-0 lg:[grid-template-columns:repeat(3,auto)]">
                {linkedHeroResources.map((resource) => (
                  <article key={heroResourceKey(resource)} className="relative flex w-fit min-w-0 flex-col">
                    <button
                      type="button"
                      data-tour="hero-linked-resource" onClick={() => { if (embedded) setRoomResource(resource); else navigate(resource.href, { state: { resourceOrigin: "character", characterId: c!.id, returnTo: location.pathname + location.search, returnState: location.state } }); }}
                      className="block overflow-visible bg-transparent text-left"
                    >
                      <HeroResourcePreview resource={resource} />
                    </button>
                    <div className="mt-2 flex min-w-0 items-center justify-end gap-1 sm:justify-between sm:gap-2">
                      <span className="hidden typewriter text-[10px] font-bold uppercase tracking-widest text-foreground/55 sm:inline">{localizeNode(resource.label)}</span>
                      <div className="flex min-w-0 items-center gap-1">
                        {localizeNode(resource.type === "power" && resource.item.activation.trim().toLowerCase() === "actif" && (
                          <button
                            type="button"
                            onClick={() => useActivePower(resource.item)}
                            className="flex h-9 min-w-0 items-center gap-1 rounded-md border border-accent bg-accent px-1.5 text-background shadow-[2px_2px_0_hsl(var(--ink))] hover:opacity-90 sm:px-2.5"
                          >
                            <Dices size={14} /> <span className="typewriter text-[9px] font-bold uppercase"><span className="sm:hidden">{localizeText("Utiliser")}</span><span className="hidden sm:inline">{localizeText("Utiliser ce pouvoir")}</span></span>
                          </button>
                        ))}
                        {localizeNode(resource.type === "vehicle" && (
                          <button
                            type="button"
                            onClick={() => useVehicle(resource.item)}
                            className="flex h-9 min-w-0 items-center gap-1 rounded-md border border-accent bg-accent px-1.5 text-background shadow-[2px_2px_0_hsl(var(--ink))] hover:opacity-90 sm:px-2.5"
                          >
                            <Dices size={14} /> <span className="typewriter text-[9px] font-bold uppercase"><span className="sm:hidden">{localizeText("Utiliser")}</span><span className="hidden sm:inline">{localizeText("Utiliser ce véhicule")}</span></span>
                          </button>
                        ))}
                        <button
                          type="button"
                          data-tour="hero-unlink-resource" onClick={() => toggleLinkedResource(resource)}
                          className="flex h-9 min-w-0 items-center gap-1 rounded-md border border-ink/20 bg-black/65 px-1.5 text-white shadow-[2px_2px_0_rgba(0,0,0,0.28)] hover:bg-destructive sm:px-2.5"
                        >
                          <X size={14} /> <span className="typewriter text-[9px] font-bold uppercase">{localizeText("Délier")}</span>
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="border-2 border-dashed border-ink/25 p-6 text-center typewriter text-sm text-foreground/55">{localizeText("Aucune carte liée à ce héros.")}</div>
            )}

            <div data-tour="hero-link-resource" className="flex justify-center border-t-2 border-ink/20 pt-6">
              <HeroResourcePicker resources={availableHeroResources} onSelect={toggleLinkedResource} />
            </div>

          </section>
        )}

        {/* NOTES */}
        {!isEdit && (wideRoom || tab === "notes") && (
          <CharacterCards
            c={c}
            activeCardTab="notes"
            boardRef={!wideRoom || tab === "notes" ? heroCardBoardRef : undefined}
            selectedKeys={selectedKeys}
            onToggleSelect={toggleSelect}
            canSelectMore={selection.length < 2}
            injuryTotal={injuryTotal}
            stressTotal={stressTotal}
            griefTotal={griefTotal}
            stressMax={stressMax}
            griefMax={griefMax}
            protectionByLoc={protectionByLoc}
            onInjuryChange={setInjuryLevel}
            onStressChange={(index) => setStateArr("stress", index)}
            onGriefChange={(index) => setStateArr("griefs", index)}
            onCheckColorChange={setCardCheckColor}
            onCriticalSummaryToggle={toggleCriticalSummary}
            onNotesChange={(notes) => update({ notes })}
          />
        )}

        {isEdit && tab === "notes" && (
          <section className="paper-card p-5">
            <h2 className="font-display text-2xl mb-3">{localizeText("Histoire & notes")}</h2>
            <TextAreaField
              mode={mode}
              label={localizeText("Histoire")}
              value={c!.lore}
              onChange={(v) => update({ lore: v })}
              rows={24}
            />
            <div className="mt-5">
              <TextAreaField
                mode={mode}
                label={localizeText("Notes")}
                value={c!.notes}
                onChange={(v) => update({ notes: v })}
                rows={24}
              />
            </div>
          </section>
        )}
        </div>
      </main>
      {(!embedded || primaryInRoom) && (!wideRoom || isEdit) && <nav data-tour="hero-tabs" aria-label={localizeText("Navigation de la fiche")} className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-paper/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-6px_18px_hsl(var(--ink)_/_0.18)] backdrop-blur md:hidden">
        <div className="flex justify-between gap-1">
          {editorTabs.map((t) => {
            const active = tab === t.id;
            const Icon = TAB_ICONS[t.id];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-label={localizeText(t.label)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[54px] ${primaryInRoom ? "flex-col" : ""} items-center justify-center gap-1.5 border-2 px-2 py-1.5 transition-[color,background-color,border-color,flex] ${
                  active
                    ? `min-w-0 flex-1 ${primaryInRoom ? "max-w-32" : "max-w-40"} border-accent bg-accent text-background shadow-[2px_2px_0_hsl(var(--ink))]`
                    : `${primaryInRoom ? "w-9" : "w-11"} shrink-0 border-transparent text-foreground/65 hover:border-ink/30 hover:text-foreground`
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                <span className={`max-w-full truncate typewriter text-[9px] font-bold uppercase leading-none tracking-wider ${active ? "inline" : "hidden"}`}>
                  {localizeNode(t.label)}
                </span>
              </button>
            );
          })}
        </div>
      </nav>}
      <RollDialog key={c!.id}
        forcePublic={new URLSearchParams(location.search).get("roomPublicRoll") === "1"}
        contextLabel={c!.nom || "Héros"}
        open={rollOpen}
        onOpenChange={(o) => {
          setRollOpen(o);
          if (!o) {
            setSelection([]);
            setRoomRollRequest(null);
            setLockedRollSelectionKey(null);
            setLockedRollSelectionCanChange(false);
            setContextualRollOptions([]);
          }
        }}
        selection={selection}
        initialDie={roomRollRequest?.die ?? 6}
        requestId={roomRollRequest?.id}
        selectionOptions={roomRollRequest ? [] : [...contextualRollOptions, ...rollSelectionOptions]}
        onSelectionChange={(nextSelection) => {
          const next = nextSelection.slice(0, 2);
          setSelection(next);
          if (lockedRollSelectionCanChange && next[0]?.facet === "vehicle") {
            setLockedRollSelectionKey(`${next[0].facet}::${next[0].name}`);
          }
        }}
        lockedSelectionKeys={roomRollRequest ? roomRollRequest.attributes.map(attribute => `${attribute.facet}::${attribute.name}`) : lockedRollSelectionKey ? [lockedRollSelectionKey] : []}
        requiredSelectionCount={roomRollRequest ? roomRollRequest.attributes.length : lockedRollSelectionKey ? 2 : 1}
        lockedSelectionCanChange={lockedRollSelectionCanChange}
        destinDiceCount={c!.destinDiceCount}
        mandatoryComplication={c!.mandatoryComplication}
        climaxUsed={c!.climaxUsed}
        criticalLocked={criticalRollLocked}
        criticalLockReasons={[...(corpsInAgony || Object.values(c!.criticalStates.agony).some(Boolean) ? ["Agonie"] : []), ...(mentalBreakActive ? ["Délire"] : []), ...(emotionalBreakActive ? ["Désespoir"] : [])]}
        injuryPenaltyOptions={injuryPenaltyOptions}
        onGiveMeans={advanceStateFromGiveMeans}
        onPullRopeRoll={advanceInjuryFromPullRope}
        onClimaxRoll={markAllCriticalStates}
      />
      <CriticalDialog facet={critical} onClose={() => setCritical(null)} />
    </div>
  );
};

export default CharacterEditor;
