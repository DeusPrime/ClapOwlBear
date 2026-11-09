import {afterRollPaint} from '@owlbear/runtime/after-roll-paint';
import type { RollVisual } from "@/lib/rollVisual";
import RollOutcomeEffect from "./RollOutcomeEffect";
import RollingDie from "./RollingDie";
import RollAttributeDial, { facetNames } from "./RollAttributeDial";
import DiceModel, { type DiceSides } from "./DiceModel";
import { localizeText, localizeNode } from '@/i18n/localize';
import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Check, Dices, Sparkles, ThumbsDown, Zap } from "lucide-react";
import { useRoom } from "@/hooks/use-room";
import { roomClient } from "@/lib/roomClient";

export type RollSelection = {
  facet: string;
  name: string;
  value: number;
  baseValue?: number;
  penalty?: number;
  supernaturalDice?: number;
};
export type InjuryPenaltyOption = { id: string; label: string; penalty: number; sequels: string };

type Modifier = "neutral" | "advantage" | "disadvantage";
const DICE_TONES: Record<DiceSides, string> = {
  4: "text-blue-800 dark:text-blue-300",
  6: "text-green-800 dark:text-green-300",
  8: "text-yellow-800 dark:text-yellow-300",
  10: "text-orange-800 dark:text-orange-300",
  12: "text-red-800 dark:text-red-300",
  20: "text-sky-800 dark:text-sky-300",
};
const DICE = [4, 6, 8, 10, 12] as const;
type DieFace = (typeof DICE)[number];
const DIFFICULTIES: Record<DieFace, { name: string; description: string }> = {
  4: { name: "Normal", description: "Réalisable par tout le monde avec quelques efforts." },
  6: { name: "Difficile", description: "Exigeant mais possible." },
  8: { name: "Très difficile", description: "Un vrai défi." },
  10: { name: "Improbable", description: "Presque impossible." },
  12: { name: "Prodigieux", description: "Digne de ce qu’on raconte dans les légendes." },
};
type ResultCandidate = { kind: "diff" | "destin" | "supernatural"; value: number; index?: number };
type DisplayDie = ResultCandidate & { sides: DiceSides; label: string; chosen?: boolean; unavailable?: boolean; prowess?: boolean; complication?: boolean };
type RollResult = {
  diffRolls: number[];
  chosenDiff: number;
  chosenDiffIndex: number;
  diffChoiceMode: Modifier;
  disadvantageAbsorbed: boolean;
  supernaturalRolls: number[];
  destinRolls: number[];
  ignoredInjury: InjuryPenaltyOption | null;
  climaxFacets: string[];
};

const rollDie = (sides: number) => 1 + Math.floor(Math.random() * sides);

export const chooseAdvantageDieIndex = (rolls: number[], potential: number) => {
  const candidates = rolls.map((value, index) => ({ value, index }));
  const successes = candidates.filter(({ value }) => value <= potential);
  // Keep the strongest success; a higher roll above potential is a failure.
  return (successes.length > 0 ? successes : candidates)
    .reduce((best, candidate) => candidate.value > best.value ? candidate : best).index;
};

export const chooseDisadvantageDieIndex = (rolls: number[], potential: number) => {
  if (rolls.length <= 1) return 0;

  const usefulRolls = rolls
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => value <= potential);
  const discardedIndex = (usefulRolls.length > 0 ? usefulRolls : rolls.map((value, index) => ({ value, index })))
    .reduce((best, candidate) => candidate.value > best.value ? candidate : best).index;

  return rolls.findIndex((_, index) => index !== discardedIndex);
};

const candidateRank = (kind: ResultCandidate["kind"]) => {
  if (kind === "supernatural") return 3;
  if (kind === "destin") return 2;
  return 1;
};

const finalSuccesses = (candidate: ResultCandidate) => candidate.value + (candidate.kind === "supernatural" ? 1 : 0);

const recommendLabel = (candidate: ResultCandidate, die: DieFace) => {
  if (candidate.kind === "destin") return "Destin";
  if (candidate.kind === "supernatural") return `De surnaturel D${die}`;
  return `Difficulte D${die}`;
};

const selectionKey = (item: Pick<RollSelection, "facet" | "name">) => `${item.facet}::${item.name}`;
const FACET_OUT_LABELS: Record<string, string> = {
  corps: "le corps",
  esprit: "l'esprit",
  ame: "l'ame",
};

const climaxLine = (facets: string[]) => {
  const labels = facets.map((facet) => FACET_OUT_LABELS[facet] ?? facet).filter(Boolean);
  if (labels.length === 0) return "Quelque chose cede dans le personnage. La scene continue sans lui.";
  if (labels.length === 1) return `${labels[0][0].toUpperCase()}${labels[0].slice(1)} ne tient plus. Le personnage reste debout une seconde de trop, puis la scene le reclame.`;
  const last = labels[labels.length - 1];
  return `${labels.slice(0, -1).join(", ")} et ${last} ne tiennent plus. Le personnage brule tout ce qu'il lui restait pour finir la prise.`;
};

export default function RollDialog({
  open,
  onOpenChange,
  selection,
  selectionOptions = [],
  onSelectionChange,
  destinDiceCount = 1,
  mandatoryComplication = false,
  criticalLocked = false,
  climaxUsed = false,
  criticalLockReasons = [],
  injuryPenaltyOptions = [],
  onGiveMeans,
  onPullRopeRoll,
  onClimaxRoll,
  simple = false,
  cardPotential = false,
  figurantGroup = false,
  lockedSelectionKeys = [],
  requiredSelectionCount = 1,
  lockedSelectionCanChange = false,
  initialDie = 6,
  requestId,
  forcePublic = false,
  contextLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selection: RollSelection[];
  selectionOptions?: RollSelection[];
  onSelectionChange?: (selection: RollSelection[]) => void;
  destinDiceCount?: number;
  mandatoryComplication?: boolean;
  criticalLocked?: boolean;
  climaxUsed?: boolean;
  criticalLockReasons?: string[];
  injuryPenaltyOptions?: InjuryPenaltyOption[];
  onGiveMeans?: (success: boolean) => void;
  onPullRopeRoll?: (injuryId: string) => void;
  onClimaxRoll?: () => void;
  simple?: boolean;
  cardPotential?: boolean;
  figurantGroup?: boolean;
  lockedSelectionKeys?: string[];
  requiredSelectionCount?: number;
  lockedSelectionCanChange?: boolean;
  initialDie?: DieFace;
  requestId?: string;
  forcePublic?: boolean;
  contextLabel?: string;
}) {
  const { session: roomSession, hideRolls } = useRoom();
  const dialogContent = useRef<HTMLDivElement>(null);
  const rollBody = useRef<HTMLDivElement>(null);
  const rollDisabledDescriptionId = useId();
  const [logError, setLogError] = useState("");
  const [logging, setLogging] = useState(false);
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const pendingLog = useRef<{ label: string; summary: string; id: string; requestId?: string; rollVisual?: RollVisual } | null>(null);
  const requestResolved = useRef(false);
  const [die, setDie] = useState<DieFace>(6);
  useEffect(() => { if (open) { setDie(initialDie); setLogError(""); pendingLog.current = null; requestResolved.current = false; } }, [open, requestId, initialDie]);
  const [mod, setMod] = useState<Modifier>("neutral");
  const [isRolling, setIsRolling] = useState(false);
  const [figurantCount, setFigurantCount] = useState(1);
  const [groupResults, setGroupResults] = useState<RollResult[]>([]);
  const [resultView, setResultView] = useState(false);
  const [attributeFacet, setAttributeFacet] = useState<string | null>(null);
  const [result, setResult] = useState<null | RollResult>(null);
  const [injuryMenuOpen, setInjuryMenuOpen] = useState(false);
  const [ignoredInjury, setIgnoredInjury] = useState<InjuryPenaltyOption | null>(null);
  const [selectionMenuOpen, setSelectionMenuOpen] = useState(false);
  const [selectionMenuAnchor, setSelectionMenuAnchor] = useState<string | null>(null);
  const [climaxSelected, setClimaxSelected] = useState(false);
  const [climaxSpent, setClimaxSpent] = useState(false);
  useEffect(() => { if (!criticalLocked) setClimaxSpent(false); }, [criticalLocked]);
  const [climaxFacets, setClimaxFacets] = useState<string[] | null>(null);
  const [localDestinDiceCount, setLocalDestinDiceCount] = useState(destinDiceCount);

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setResult(null);
      setGroupResults([]);
      setIsRolling(false);
      setResultView(false);
      setIgnoredInjury(null);
      setInjuryMenuOpen(false);
      setSelectionMenuOpen(selection.length < requiredSelectionCount && selectionOptions.length > 0);
      setSelectionMenuAnchor(selection[0] ? selectionKey(selection[0]) : null);
      setClimaxSelected(false);
      setClimaxFacets(null);
      setLocalDestinDiceCount(destinDiceCount);
    }
    wasOpen.current = open;
  }, [open, selection, requiredSelectionCount, selectionOptions.length, destinDiceCount]);

  const corpsSelectionCount = selection.filter((item) => item.facet === "corps").length;
  const selectedKeys = new Set(selection.map(selectionKey));
  const lockedKeys = new Set(lockedSelectionKeys);
  const availableSelections = selectionOptions.length > 0 ? selectionOptions : selection;
  const activeIgnoredInjury = result?.ignoredInjury ?? ignoredInjury;
  const displayedSelections = selection.map((item) => {
    const baseValue = cardPotential ? item.value : item.baseValue ?? item.value;
    const initialPenalty = cardPotential ? 0 : Math.max(0, item.penalty ?? 0);
    const ignoredPenalty = item.facet === "corps" && activeIgnoredInjury ? activeIgnoredInjury.penalty : 0;
    const penalty = Math.max(0, initialPenalty - ignoredPenalty);
    const value = baseValue >= 0 ? Math.max(baseValue - penalty, 0) : baseValue;
    return { ...item, baseValue, penalty, value };
  });
  const ignoredInjuryBonus = displayedSelections.reduce((sum, item, index) => sum + Math.max(0, item.value - selection[index].value), 0);
  const totalPenalty = displayedSelections.reduce((sum, item) => sum + item.penalty, 0);
  const potential = Math.max(1, displayedSelections.reduce((sum, item) => sum + item.value, 0));
  const canPullRope = corpsSelectionCount > 0 && injuryPenaltyOptions.length > 0;
  const supernaturalDice = selection.reduce((sum, item) => sum + Math.max(0, item.supernaturalDice ?? 0), 0);
  const disadvantageAbsorbed = mod === "disadvantage" && supernaturalDice > 0;
  const effectiveSupernaturalDice = disadvantageAbsorbed ? supernaturalDice - 1 : supernaturalDice;
  const activeDestinDiceCount = simple ? localDestinDiceCount : destinDiceCount;
  const normalizedDestinDiceCount = Number.isFinite(activeDestinDiceCount) ? Math.max(0, Math.floor(activeDestinDiceCount)) : 0;
  const climaxUnavailable = climaxUsed || climaxSpent;
  const climaxAllowed = criticalLocked && climaxSelected && !climaxUnavailable;
  const controlsLocked = criticalLocked && !climaxAllowed;
  const selectionIncomplete = selection.length < requiredSelectionCount;
  const rollDisabled = isRolling || (criticalLocked && !climaxAllowed) || selectionIncomplete || logging || visibilityBusy || Boolean(pendingLog.current);
  const giveMeansDisabled = isRolling || (criticalLocked && !climaxAllowed) || logging || visibilityBusy || Boolean(pendingLog.current);

  const rollDisabledReason = [
    criticalLocked && !climaxAllowed ? `${localizeText("Jet bloqué par un état critique")} : ${(criticalLockReasons.length ? criticalLockReasons : ["État critique"]).map(reason => localizeText(reason)).join(", ")}.${climaxUnavailable ? ` ${localizeText("Climax déjà utilisé. Sors de tous les états critiques pour le réutiliser.")}` : !simple ? ` ${localizeText("Active Climax dans les attributs pour effectuer ce jet.")}` : ""}` : "",
    selectionIncomplete ? localizeText("Sélectionne les attributs requis en cliquant sur le potentiel.") : "",
    visibilityBusy ? localizeText("Mise à jour de la visibilité du jet en cours…") : "",
  ].filter(Boolean).join(" ");

  const chooseSelection = (option: RollSelection) => {
    if (!onSelectionChange) return;
    const key = selectionKey(option);
    if (simple) {
      onSelectionChange([option]);
      setSelectionMenuAnchor(key);
      setResult(null);
      return;
    }
    if (lockedSelectionCanChange && selectionMenuAnchor && lockedKeys.has(selectionMenuAnchor)) {
      const lockedSelection = selection.find((item) => selectionKey(item) === selectionMenuAnchor);
      if (lockedSelection && option.facet === lockedSelection.facet) {
        onSelectionChange(selection.map((item) => selectionKey(item) === selectionMenuAnchor ? option : item));
        setSelectionMenuAnchor(selectionKey(option));
          setResult(null);
        return;
      }
    }
    if (selectedKeys.has(key)) {
      setSelectionMenuAnchor(key);
      return;
    }

    if (selection.length >= 2) {
      const replaceableSelection = selection.find((item) => !lockedKeys.has(selectionKey(item))) ?? selection[selection.length - 1];
      const replacementKey =
        selectionMenuAnchor && selectedKeys.has(selectionMenuAnchor) && !lockedKeys.has(selectionMenuAnchor)
          ? selectionMenuAnchor
          : selectionKey(replaceableSelection);
      onSelectionChange(selection.map((item) => (selectionKey(item) === replacementKey ? option : item)).slice(0, 2));
      setSelectionMenuAnchor(key);
      return;
    }

    onSelectionChange([...selection, option].slice(0, 2));
    setSelectionMenuAnchor(key);
  };

  useEffect(() => {
    if (!isRolling) return;
    const timer = window.setTimeout(() => setIsRolling(false), 900);
    return () => window.clearTimeout(timer);
  }, [isRolling]);
  const animateRoll = () => setIsRolling(true);
  const prepareNewRoll = () => { setResultView(false); setResult(null); setGroupResults([]); setIgnoredInjury(null); setInjuryMenuOpen(false); setClimaxSelected(false); };
  useEffect(() => { if (open) { dialogContent.current?.focus(); if (resultView && rollBody.current) rollBody.current.scrollTop = 0; } }, [resultView, open]);
  const selectedFacets = Array.from(new Set(selection.map((item) => item.facet)));

  const createRollResult = (rollIgnoredInjury: InjuryPenaltyOption | null, rollClimaxFacets: string[] = []): RollResult => {
    const n = mod === "neutral" || disadvantageAbsorbed ? 1 : 2;
    const diffRolls = Array.from({ length: n }, () => rollDie(die));
    const supernaturalRolls = Array.from({ length: effectiveSupernaturalDice }, () => rollDie(die));
    const chosenDiffIndex =
      mod === "advantage"
        ? chooseAdvantageDieIndex(diffRolls, potential)
        : mod === "disadvantage" && !disadvantageAbsorbed
        ? chooseDisadvantageDieIndex(diffRolls, potential)
        : 0;
    const chosenDiff = diffRolls[chosenDiffIndex];
    const destinRolls = Array.from({ length: normalizedDestinDiceCount }, () => rollDie(20));
    return {
      diffRolls,
      chosenDiff,
      chosenDiffIndex,
      diffChoiceMode: mod,
      disadvantageAbsorbed,
      supernaturalRolls,
      destinRolls,
      ignoredInjury: rollIgnoredInjury,
      climaxFacets: rollClimaxFacets,
    };
  };

  const buildCandidates = (rollResult: RollResult): ResultCandidate[] => [
    { kind: "diff", value: rollResult.chosenDiff, index: rollResult.chosenDiffIndex },
    ...rollResult.destinRolls.map((value, index) => ({ kind: "destin" as const, value, index })),
    ...rollResult.supernaturalRolls.map((value, index) => ({ kind: "supernatural" as const, value, index })),
  ];

  const chooseResult = (candidates: ResultCandidate[]) => {
    const successfulCandidates = candidates.filter((candidate) => candidate.value <= potential);
    const forcedComplication =
      mandatoryComplication && successfulCandidates.some((candidate) => candidate.value === 1)
        ? successfulCandidates
            .filter((candidate) => candidate.value === 1)
            .sort((a, b) => candidateRank(b.kind) - candidateRank(a.kind))[0] ?? null
        : null;
    return (
      forcedComplication ??
      [...successfulCandidates].sort((a, b) => b.value - a.value || candidateRank(b.kind) - candidateRank(a.kind))[0] ??
      null
    );
  };

  const publishRoll = (next: RollResult, group: RollResult[] = [next]) => {
    if (!roomSession) return;
    const recommended = chooseResult(buildCandidates(next));
    let details = [
      `D${die} : ${next.diffRolls.join(", ")}`,
      next.destinRolls.length ? `Destin : ${next.destinRolls.join(", ")}` : "",
      next.supernaturalRolls.length ? `Surnaturel : ${next.supernaturalRolls.join(", ")}` : "",
      `Potentiel ${potential}`,
      recommended ? `Réussite : ${finalSuccesses(recommended)}${recommended.kind === "supernatural" ? " (+1 surnaturel)" : ""}${recommended.value === 1 ? " · Complication" : ""}` : "Échec",
    ].filter(Boolean).join(" · ");
    if (group.length > 1) {
      const successes = group.filter(item => chooseResult(buildCandidates(item))).length;
      details = `${group.length} figurants · Potentiel ${potential} · ${successes} réussites` + "\n" + group.map((item, index) => {
        const chosen = chooseResult(buildCandidates(item));
        return `Figurant ${index + 1} : D${die} ${item.diffRolls.join("/")} · ${chosen ? `Réussite ${finalSuccesses(chosen)} (${chosen.kind === "destin" ? "Déstin" : chosen.kind === "supernatural" ? "surnaturel" : "dé"})${chosen.value === 1 ? " · Complication" : ""}` : "Échec"}`;
      }).join("\n");
    }
    const name = selection.map(item => item.name).join(" + ") || "Jet de dés";
    const visualResult = describeRoll(next);
    const rollVisual: RollVisual = {
      label: (contextLabel ? contextLabel + ' · ' + name : name).slice(0, 300), potential,
      outcome: visualResult.complication ? 'complication' : visualResult.prowess ? 'prowess' : recommended ? 'success' : 'failure',
      prowess: visualResult.prowess,
      ...(recommended ? { successes: (visualResult.prowess && !visualResult.complication ? visualResult.prowessValue! : recommended.value) + (recommended.kind === 'supernatural' ? 1 : 0) } : {}),
      ...(group.length > 1 ? { groupCount: group.length, groupSuccesses: group.filter(item => chooseResult(buildCandidates(item))).length } : {}),
      dice: visualResult.displayDice.slice(0, 32).map(item => ({ sides: item.sides, value: item.value, kind: item.kind,
        outcome: item.unavailable ? 'discarded' : item.complication ? 'complication' : item.prowess ? 'prowess' : item.value > potential ? 'failure' : item.chosen || (recommended?.kind === item.kind && recommended?.index === item.index) ? 'success' : 'neutral' })),
    };
    const entry = { rollVisual, label: contextLabel ? `${contextLabel} · ${name}` : name, summary: details, id: crypto.randomUUID(), ...(requestId && !requestResolved.current ? { requestId } : {}) };
    pendingLog.current = entry;
    afterRollPaint(() => { void logRoll(entry); });
  };

  async function logRoll(entry: NonNullable<typeof pendingLog.current>) {
    setLogging(true); setLogError("");
    try {
      await roomClient.broadcastRoll(entry.label, entry.summary, { id: entry.id, ...(entry.rollVisual ? { rollVisual: entry.rollVisual } : {}), ...(entry.requestId ? { requestId: entry.requestId } : {}), ...(forcePublic && roomSession?.role !== "mj" ? { public: true } : {}) });
      if (entry.requestId) requestResolved.current = true;
      if (pendingLog.current === entry) pendingLog.current = null;
    } catch { setLogError("Le jet n’a pas été enregistré dans la discussion. Réessaie l’envoi."); }
    finally { setLogging(false); }
  }

  async function changeVisibility(hidden: boolean) {
    setVisibilityBusy(true); setLogError("");
    try { await roomClient.setRollVisibility(hidden); }
    catch { setLogError("Impossible de modifier la visibilité des prochains jets."); }
    finally { setVisibilityBusy(false); }
  }

  const roll = () => {
    if (rollDisabled) return;
    animateRoll();
    const rollIgnoredInjury = ignoredInjury;
    const rollClimaxFacets = climaxAllowed ? selectedFacets : [];
    const results = Array.from({ length: figurantGroup ? figurantCount : 1 }, () => createRollResult(rollIgnoredInjury, rollClimaxFacets));
    const nextResult = results[0];
    setGroupResults(results);
    setResult(nextResult);
    setResultView(true);
    publishRoll(nextResult, results);
    setIgnoredInjury(null);
    setInjuryMenuOpen(false);
    setClimaxSelected(false);
    if (rollClimaxFacets.length > 0) {
      setClimaxSpent(true);
      setClimaxFacets(rollClimaxFacets);
      onClimaxRoll?.();
    }
    if (rollIgnoredInjury) onPullRopeRoll?.(rollIgnoredInjury.id);
  };

  const giveMeans = () => {
    if (giveMeansDisabled) return;
    if (!window.confirm(localizeText("Se donner les moyens ? Le jet sera relance et une case de stress sera cochee."))) return;
    animateRoll();
    const rollIgnoredInjury = result?.ignoredInjury ?? ignoredInjury;
    const rollClimaxFacets = climaxAllowed ? selectedFacets : [];
    const nextResult = createRollResult(rollIgnoredInjury);
    setResult(nextResult);
    setResultView(true);
    publishRoll(nextResult);
    setIgnoredInjury(null);
    setInjuryMenuOpen(false);
    setClimaxSelected(false);
    if (rollClimaxFacets.length > 0) {
      setClimaxSpent(true);
      setClimaxFacets(rollClimaxFacets);
      onClimaxRoll?.();
    }
    if (rollIgnoredInjury) onPullRopeRoll?.(rollIgnoredInjury.id);
    onGiveMeans?.(Boolean(chooseResult(buildCandidates(nextResult))));
  };

  useEffect(() => {
    if (!canPullRope || (ignoredInjury && !injuryPenaltyOptions.some((option) => option.id === ignoredInjury.id))) {
      setIgnoredInjury(null);
      setInjuryMenuOpen(false);
    }
  }, [canPullRope, ignoredInjury, injuryPenaltyOptions]);

  const describeRoll = (result: RollResult | null) => {
  let recommend: ResultCandidate | null = null;
  let displayDice: DisplayDie[] = [];
  let complication = false;
  let prowess = false;
  let prowessValue: number | null = null;
  let prowessAction: ResultCandidate | null = null;
  let prowessDestin: ResultCandidate | null = null;
  if (result) {
    const candidates = buildCandidates(result);
    const successfulCandidates = candidates.filter((candidate) => candidate.value <= potential);
    recommend = chooseResult(candidates);
    complication = recommend?.value === 1;
    const successfulActionValues = successfulCandidates
      .filter((candidate) => candidate.kind === "diff" || candidate.kind === "supernatural")
      .map((candidate) => candidate.value);
    const successfulDestinValues = successfulCandidates
      .filter((candidate) => candidate.kind === "destin")
      .map((candidate) => candidate.value);
    prowess = successfulActionValues.length > 0 && successfulDestinValues.length > 0;
    prowessValue = prowess ? Math.max(...successfulActionValues, ...successfulDestinValues) : null;
    prowessAction = prowess
      ? successfulCandidates
          .filter((candidate) => candidate.kind === "diff" || candidate.kind === "supernatural")
          .sort((a, b) => b.value - a.value || candidateRank(b.kind) - candidateRank(a.kind))[0] ?? null
      : null;
    prowessDestin = prowess
      ? successfulCandidates
          .filter((candidate) => candidate.kind === "destin")
          .sort((a, b) => b.value - a.value)[0] ?? null
      : null;
    displayDice = [
      ...result.diffRolls.map((value, index) => ({
        kind: "diff" as const,
        sides: die,
        value,
        index,
        chosen: index === result.chosenDiffIndex,
        unavailable: result.diffChoiceMode !== "neutral" && index !== result.chosenDiffIndex,
        prowess: prowessAction?.kind === "diff" && prowessAction.index === index,
        complication: complication && recommend?.kind === "diff" && recommend.index === index,
        label: result.diffRolls.length > 1 ? `D${die}${index === result.chosenDiffIndex ? "*" : ""}` : `D${die}`,
      })),
      ...result.supernaturalRolls.map((value, index) => ({
        sides: die,
        kind: "supernatural" as const,
        value,
        index,
        prowess: prowessAction?.kind === "supernatural" && prowessAction.index === index,
        complication: complication && recommend?.kind === "supernatural" && recommend.index === index,
        label: `D${die} · S${index + 1}`,
      })),
      ...result.destinRolls.map((value, index) => ({
        sides: 20 as const,
        kind: "destin" as const,
        value,
        index,
        prowess: prowessDestin?.index === index,
        complication: complication && recommend?.kind === "destin" && recommend.index === index,
        label: result.destinRolls.length > 1 ? `D20 ${index + 1}` : "D20",
      })),
    ];
  }
    return { recommend, displayDice, complication, prowess, prowessValue };
  };
  const { recommend, displayDice, complication, prowess, prowessValue } = describeRoll(result);
  const isGroupResult = figurantGroup && groupResults.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={dialogContent} tabIndex={-1} onOpenAutoFocus={event => {
        if (simple) {
          event.preventDefault();
          dialogContent.current?.focus();
        }
      }} className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-2xl flex-col overflow-hidden bg-paper text-foreground border-2 border-ink p-3 sm:p-5">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Dices size={20} />{localizeText(resultView ? isGroupResult ? "Résultats du groupe" : "Résultat du jet" : "Jet d’action")}</DialogTitle>
          <DialogDescription className="text-left text-sm">{localizeText(resultView ? "Consulte le résultat puis choisis la suite de ton action." : "Choisis tes attributs, la difficulté et lance les dés.")}</DialogDescription>
          {localizeNode(roomSession?.role === "mj" ? <label className="flex items-center gap-2 pt-2 text-sm font-normal">
            <input type="checkbox" checked={!hideRolls} disabled={visibilityBusy || logging || Boolean(pendingLog.current)} onChange={event => void changeVisibility(!event.target.checked)} className="h-4 w-4 accent-current" />{localizeText(" Jet visible par les joueurs ")}</label> : roomSession && <p className="pt-2 text-xs text-muted-foreground">{localizeText("Ce jet sera enregistré dans la discussion de la salle.")}</p>)}
          {localizeNode(logError && <div role="alert" className="pt-2 text-sm text-destructive">{localizeNode(logError)}{localizeNode(pendingLog.current && <button type="button" disabled={logging} onClick={() => { if (pendingLog.current) void logRoll(pendingLog.current); }} className="ml-2 underline">{localizeText("Réessayer l’envoi")}</button>)}</div>)}
        </DialogHeader>

        <div ref={rollBody} className="min-h-0 min-w-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain">
          {!resultView && <>
          <div className="relative">
            <button type="button" onClick={() => setSelectionMenuOpen(true)} aria-label={localizeText(cardPotential ? "Potentiel : voir la valeur de la carte" : "Potentiel : voir les attributs et les malus")} className="flex min-h-32 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-ink/25 bg-background/30 px-14 py-3 text-center hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
              <span className="block text-base font-bold">{localizeText("Potentiel")}</span>
              <b className="font-display text-5xl text-accent">{potential}</b>
              {!cardPotential && <span className={`block text-sm font-bold ${totalPenalty > 0 ? "text-destructive" : "text-muted-foreground"}`}>{localizeText("Malus")} : {totalPenalty > 0 ? "−" : ""}{totalPenalty}</span>}
            </button>

          </div>
          {selectionIncomplete && <p className="text-sm font-bold text-accent">{localizeText("Choisis les attributs du jet en cliquant sur le potentiel.")}</p>}
          {climaxAllowed && <p className="flex items-center gap-1.5 text-sm font-bold text-accent"><Zap size={16} />{localizeText("Climax prêt pour ce jet")}</p>}
          {activeIgnoredInjury && <p className="text-sm text-accent">{localizeText("Tirer sur la corde")} : {localizeText(activeIgnoredInjury.label)} (+{ignoredInjuryBonus})</p>}
          {effectiveSupernaturalDice > 0 && <p className="text-sm text-fuchsia-800 dark:text-fuchsia-300">+{effectiveSupernaturalDice} {localizeText("Surnaturel")}</p>}
          {disadvantageAbsorbed && <p className="text-sm text-fuchsia-800 dark:text-fuchsia-300">{localizeText("Desavantage absorbe par le surnaturel")}</p>}

          {figurantGroup && <fieldset className="rounded-xl border border-ink/20 p-3"><legend className="px-1 text-sm font-bold">{localizeText("Nombre de figurants")}</legend>
            <div className="flex items-center justify-center gap-3"><button type="button" aria-label={localizeText("Retirer un figurant")} disabled={figurantCount <= 1} onClick={() => setFigurantCount(count => Math.max(1, count - 1))} className="h-11 w-11 rounded-lg border border-ink/30 text-xl disabled:opacity-35">−</button>
              <input aria-label={localizeText("Nombre de figurants")} type="number" inputMode="numeric" min={1} max={20} value={figurantCount} onChange={event => setFigurantCount(Math.max(1, Math.min(20, Math.floor(Number(event.target.value) || 1))))} className="h-12 w-20 rounded-lg border-2 border-ink/30 bg-paper text-center text-xl font-bold" />
              <button type="button" aria-label={localizeText("Ajouter un figurant")} disabled={figurantCount >= 20} onClick={() => setFigurantCount(count => Math.min(20, count + 1))} className="h-11 w-11 rounded-lg border border-ink/30 text-xl disabled:opacity-35">+</button></div>
            <p className="mt-2 text-center text-sm text-muted-foreground">{localizeText("Un jet par figurant.")}</p>
          </fieldset>}
          {localizeNode(simple && (
            <div className="border-2 border-ink/30 p-2">
              <label htmlFor="simple-destin-count" className="mb-1 block typewriter text-[9px] uppercase tracking-widest text-foreground/60">{localizeText(" Nombre de dés de Destin ")}</label>
              <input
                id="simple-destin-count"
                type="number"
                inputMode="numeric"
                min={0}
                max={20}
                value={localDestinDiceCount}
                onChange={(event) => setLocalDestinDiceCount(Math.max(0, Math.min(20, Number.parseInt(event.target.value, 10) || 0)))}
                className="h-10 w-24 border-2 border-ink bg-paper px-3 text-center font-display text-lg outline-none focus:border-accent"
              />
            </div>
          ))}

          <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_9rem] sm:gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs"><span className="text-muted-foreground">{localizeText("Difficulté")}</span><b className={`text-sm ${DICE_TONES[die]}`}>{localizeText(DIFFICULTIES[die].name)}</b></div>
              <div className="grid grid-cols-5 gap-0.5 sm:gap-1.5">
                {DICE.map((d) => (
                  <button
                    key={d}
                    type="button"
                    disabled={controlsLocked || (Boolean(requestId) && !requestResolved.current)}
                    onClick={() => setDie(d)}
                    title={`${localizeText(DIFFICULTIES[d].name)} · ${localizeText(DIFFICULTIES[d].description)}`}
                    data-die-choice
                    aria-label={`D${d}`}
                    aria-pressed={die === d}
                    className={`relative flex min-h-24 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border-2 py-2 font-sans text-base transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${DICE_TONES[d]} ${
                      die === d ? "border-current bg-ink/5 ring-2 ring-current ring-offset-2 ring-offset-paper" : "border-transparent hover:border-current"
                    }`}
                  >
                    {die === d && <Check aria-hidden="true" size={13} className="absolute right-1 top-1" />}
                    <DiceModel sides={d} className="!h-8 !w-8 sm:!h-12 sm:!w-12" />
                    <span className="text-sm font-bold leading-5 sm:text-base">D{localizeNode(d)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="typewriter text-[9px] uppercase tracking-widest text-foreground/60 mb-1">{localizeText(" Modificateur ")}</div>
              <div className="grid grid-cols-1 gap-1.5">
                {([
                  { id: "disadvantage", label: "Désavantage", icon: <ThumbsDown size={13} /> },
                  { id: "advantage", label: "Avantage", icon: <Sparkles size={13} /> },
                ] as { id: Modifier; label: string; icon: ReactNode }[]).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={controlsLocked}
                    aria-pressed={mod === m.id}
                    onClick={() => setMod(current => current === m.id ? "neutral" : m.id)}
                    className={`flex min-h-11 items-center justify-center gap-1 rounded-lg border-2 px-1 font-sans text-[11px] font-bold sm:text-sm disabled:cursor-not-allowed disabled:opacity-35 ${
                      mod === m.id ? "border-accent text-accent bg-accent/10" : "border-ink/40 hover:border-accent"
                    }`}
                  >
                    <span className="hidden sm:inline-flex">{localizeNode(m.icon)}</span> {localizeNode(m.label)}
                  </button>
                ))}
              </div>
            </div>

            <p className="col-span-2 text-sm text-muted-foreground">{localizeText(DIFFICULTIES[die].description)}</p>
            <button
              type="button"
              disabled={rollDisabled}
              aria-describedby={rollDisabled && rollDisabledReason ? rollDisabledDescriptionId : undefined}
              onClick={roll}
              className="col-span-2 flex min-h-12 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-bold uppercase tracking-widest text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Dices size={16} /> {localizeNode(figurantGroup && figurantCount > 1 ? `${localizeText("Lancer les jets")} (${figurantCount})` : result ? "Relancer" : "Lancer")}
            </button>
            {rollDisabled && rollDisabledReason && <p id={rollDisabledDescriptionId} aria-live="polite" className="col-span-2 text-sm leading-relaxed text-muted-foreground">{rollDisabledReason}</p>}
          </div>

          </>}
          {localizeNode(resultView && result && (
            <div className="space-y-5" aria-busy={isRolling}>
              {isGroupResult ? <div className="space-y-3">
                <div className="relative rounded-xl border border-ink/20 bg-background/40 p-4 text-center">
                  <div className={isRolling ? "invisible" : ""} aria-hidden={isRolling}><p className="text-sm text-muted-foreground">{groupResults.length} {localizeText("figurants")} · {localizeText("Potentiel")} {potential}</p><h2 className="mt-2 font-display text-3xl">{groupResults.filter(item => describeRoll(item).recommend).length} / {groupResults.length} {localizeText("réussites")}</h2></div>
                  {isRolling && <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">{localizeText("Lancer en cours…")}</span>}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{groupResults.map((item, index) => {
                  const outcome = describeRoll(item);
                  return <RollOutcomeEffect key={index} active={!isRolling} outcome={outcome.complication ? "complication" : outcome.prowess ? "prowess" : outcome.recommend ? "success" : "failure"}><article aria-label={`${localizeText("Figurant")} ${index + 1}`} className="min-w-0 rounded-xl border border-ink/20 p-3">
                    <div className="flex min-h-10 flex-col items-center justify-center gap-1 text-center"><h3 className="text-sm font-bold">{localizeText("Figurant")} {index + 1}</h3><span className={`text-sm font-bold ${isRolling ? "invisible" : outcome.complication ? "text-amber-800 dark:text-amber-300" : outcome.prowess ? "text-blue-800 dark:text-blue-300" : outcome.recommend ? "text-emerald-800 dark:text-emerald-300" : "text-destructive"}`} aria-hidden={isRolling}>{localizeText(outcome.complication && outcome.prowess ? "Prouesse et complication" : outcome.complication ? "Complication" : outcome.prowess ? "Prouesse" : outcome.recommend ? "Réussite" : "Échec")}{outcome.recommend ? ` · ${finalSuccesses(outcome.recommend)}` : ""}</span></div>
                    <ResultDiceLine compact dice={outcome.displayDice} potential={potential} recommend={outcome.recommend} rolling={isRolling} />
                  </article></RollOutcomeEffect>;
                })}</div>
              </div> : <>
              <div className="space-y-3">
                <div className="relative rounded-xl border border-ink/20 bg-background/40 p-4 text-center">
                  <RollOutcomeEffect active={!isRolling} outcome={complication ? "complication" : prowess ? "prowess" : recommend ? "success" : "failure"}><div className={isRolling ? "invisible" : ""} aria-hidden={isRolling}><p className="text-sm text-muted-foreground">{selection.map(item => localizeText(item.name)).join(" + ")} · {localizeText("Potentiel")} {potential}</p><h2 className={`mt-2 font-display text-4xl ${complication ? "text-amber-800 dark:text-amber-300" : prowess ? "text-blue-800 dark:text-blue-300" : recommend ? "text-emerald-800 dark:text-emerald-300" : "text-destructive"}`}>{localizeText(complication && prowess ? "Prouesse et complication" : complication ? "Complication" : prowess ? "Prouesse" : recommend ? "Réussite" : "Échec")}{recommend ? ` · ${(prowess && !complication ? prowessValue! : recommend.value) + (recommend.kind === "supernatural" ? 1 : 0)}` : ""}</h2></div></RollOutcomeEffect>
                  {isRolling && <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">{localizeText("Lancer en cours…")}</span>}
                </div>
                <div className={`flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground ${isRolling ? "invisible" : ""}`} aria-hidden={isRolling}>
                  <span>{localizeText("Resultats")}</span>
                  {result.diffRolls.length > 1 && <span>{localizeText("Difficulte retenue : ")}{result.chosenDiff}</span>}
                  {result.disadvantageAbsorbed && <span>{localizeText("Desavantage absorbe par le surnaturel")}</span>}
                </div>
                <ResultDiceLine dice={displayDice} potential={potential} recommend={recommend} rolling={isRolling} />
                <div className={isRolling ? "invisible" : ""} aria-hidden={isRolling}>
                  <div data-supernatural-bonus-slot className="flex h-10 items-center justify-center">{recommend?.kind === "supernatural" && <p className="text-center text-sm font-bold text-fuchsia-800 dark:text-fuchsia-300">{localizeText("Succès")} : {recommend.value} + 1 {localizeText("Surnaturel")} = {finalSuccesses(recommend)}</p>}</div>
                  <p className="text-center text-sm text-foreground/80">{localizeNode(!recommend ? "Aucun dé ne réussit sous le potentiel." : `Resultat choisi : ${recommendLabel(recommend, die)} (${recommend.value} <= ${potential})`)}</p>
                </div>
              </div>
              </>}
              <div className="grid grid-cols-2 gap-2 border-t border-ink/20 pt-4">
                <button type="button" disabled={isRolling || logging || Boolean(pendingLog.current)} onClick={prepareNewRoll} className="min-h-12 rounded-lg border-2 border-ink/30 px-3 py-2 text-sm font-bold disabled:opacity-40">{localizeText("Nouveau jet")}</button>
                <button type="button" disabled={rollDisabled} aria-describedby={rollDisabled && rollDisabledReason ? rollDisabledDescriptionId : undefined} onClick={roll} className="min-h-12 rounded-lg bg-accent px-3 py-2 text-sm font-bold text-background disabled:opacity-40">{localizeText(isGroupResult ? "Relancer le groupe" : "Relancer")}</button>
              </div>
              {rollDisabled && rollDisabledReason && <p id={rollDisabledDescriptionId} aria-live="polite" className="text-sm leading-relaxed text-muted-foreground">{rollDisabledReason}</p>}
              {localizeNode(!simple && <button
                type="button"
                disabled={giveMeansDisabled}
                onClick={giveMeans}
                className={`flex min-h-12 w-full items-center justify-center gap-1.5 rounded-lg border-2 border-accent px-3 py-2 text-xs font-bold uppercase tracking-widest text-accent hover:bg-accent hover:text-background disabled:cursor-not-allowed disabled:opacity-35 ${
                  !recommend ? "bg-accent/10" : ""
                }`}
              >
                <Sparkles size={16} />{localizeText(" Se donner les moyens ")}</button>)}
            </div>
          ))}
        </div>
        <Dialog open={selectionMenuOpen} onOpenChange={next => { if (next) setSelectionMenuOpen(true); }}>
          <DialogContent showCloseButton={false} onEscapeKeyDown={event => event.preventDefault()} onPointerDownOutside={event => event.preventDefault()} onInteractOutside={event => event.preventDefault()} className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-xl overflow-x-hidden overflow-y-auto border-2 border-ink bg-paper p-4 text-foreground">
            <DialogHeader><DialogTitle>{localizeText(cardPotential ? "Potentiel de la carte" : "Attributs et malus")}</DialogTitle><DialogDescription>{localizeText(cardPotential ? "Le potentiel utilise directement la valeur de la carte." : "Le potentiel additionne les valeurs effectives des attributs sélectionnés.")}</DialogDescription></DialogHeader>
            <div className="grid grid-cols-2 gap-2">
              {displayedSelections.map(item => <button key={selectionKey(item)} type="button" disabled={controlsLocked || !onSelectionChange} aria-label={localizeText(`Modifier ${item.name}`)} onClick={() => { setSelectionMenuAnchor(selectionKey(item)); setAttributeFacet(item.facet); }} className={`min-w-0 rounded-xl border-2 p-3 ${selectionMenuAnchor === selectionKey(item) ? "border-accent bg-accent/5" : "border-ink/20"}`}>
                <RollAttributeDial {...item} selected />
                {!cardPotential && <span className="mt-2 block text-sm">{localizeText("Base")} <b>{item.baseValue}</b></span>}
                {!cardPotential && <span className="block text-sm text-destructive">{localizeText("Malus")} −{item.penalty}</span>}
                {!cardPotential && <span className="block text-sm font-bold">{localizeText("Valeur effective")} {item.value}</span>}
                {(item.supernaturalDice ?? 0) > 0 && <span className="block text-xs text-fuchsia-800 dark:text-fuchsia-300">+{item.supernaturalDice} {localizeText("Surnaturel")}</span>}
              </button>)}
            </div>
            {onSelectionChange && availableSelections.length > 0 && <div className="space-y-3 border-t border-ink/20 pt-3">
              <p className="text-sm font-bold">{localizeText("Choisir un attribut")}</p>
              <div className="flex flex-wrap gap-1" role="group" aria-label={localizeText("Facettes")}>{Array.from(new Set(availableSelections.map(option => option.facet))).map(facet => <button key={facet} type="button" aria-pressed={(attributeFacet ?? availableSelections[0].facet) === facet} onClick={() => setAttributeFacet(facet)} className={`min-h-11 rounded-lg border px-3 text-sm font-bold ${(attributeFacet ?? availableSelections[0].facet) === facet ? "border-accent bg-accent/10 text-accent" : "border-ink/20"}`}>{localizeText(facetNames[facet] ?? facet)}</button>)}</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{availableSelections.filter(option => option.facet === (attributeFacet ?? availableSelections[0].facet)).map(option => <button key={selectionKey(option)} type="button" aria-pressed={selectedKeys.has(selectionKey(option))} disabled={controlsLocked} onClick={() => chooseSelection(option)} className={`min-w-0 rounded-xl border p-2 ${selectedKeys.has(selectionKey(option)) ? "border-accent bg-accent/10" : "border-ink/20 hover:border-accent"}`}>
                <RollAttributeDial {...option} selected={selectedKeys.has(selectionKey(option))} />
                {!cardPotential && <span className="mt-2 block text-xs">{localizeText("Base")} {option.baseValue ?? option.value} · {localizeText("Malus")} −{option.penalty ?? 0}</span>}
                {selectedKeys.has(selectionKey(option)) && <span className="mt-1 flex justify-center text-accent"><Check size={14} aria-label={localizeText("Sélectionné")} /></span>}
              </button>)}</div>
            </div>}
            {!simple && <section className="border-t border-ink/20 pt-3">
            <p className="mb-3 text-sm font-bold">{localizeText("Actions spéciales")}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!criticalLocked || climaxUnavailable || isRolling || logging || Boolean(pendingLog.current)}
                aria-pressed={climaxAllowed}
                onClick={() => { if (criticalLocked && !climaxUnavailable) setClimaxSelected((selected) => !selected); }}
                className={`flex min-h-10 items-center justify-center gap-1.5 border-2 px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  climaxAllowed
                    ? "border-zinc-700 bg-zinc-700 text-white shadow-[2px_2px_0_hsl(var(--ink))]"
                    : "border-ink/40 text-foreground hover:border-zinc-700 hover:text-zinc-700"
                }`}
              >
                <Zap size={15} />{localizeText(" Climax ")}</button>
              <button
                type="button"
                disabled={!canPullRope || controlsLocked}
                onClick={() => setInjuryMenuOpen((open) => !open)}
                className="flex min-h-10 items-center justify-center gap-1.5 border-2 border-ink/40 px-3 py-2 text-xs font-bold uppercase tracking-widest text-foreground hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
              >{localizeText(" Tirer sur la corde ")}</button>
            </div>
            {!criticalLocked && <p className="mt-2 text-sm text-muted-foreground">{localizeText("Climax sera disponible au prochain état critique.")}</p>}
            {criticalLocked && climaxUnavailable && <p className="mt-2 text-sm text-muted-foreground">{localizeText("Climax déjà utilisé. Sors de tous les états critiques pour le réutiliser.")}</p>}
            {localizeNode(!canPullRope && (
              <p className="mt-1 typewriter text-[9px] uppercase tracking-widest text-foreground/45">{localizeText(" Aucun malus de blessure a ignorer ")}</p>
            ))}
            {injuryMenuOpen && canPullRope && (
              <div className="mt-3 border-t border-ink/20 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIgnoredInjury(null);
                    setInjuryMenuOpen(false);
                  }}
                  className={`mb-1 w-full border px-2 py-1 text-left typewriter text-[10px] uppercase tracking-widest ${
                    !ignoredInjury ? "border-accent bg-accent/10 text-accent" : "border-ink/30 hover:border-accent"
                  }`}
                >{localizeText(" Ne rien ignorer ")}</button>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-1">
                  {injuryPenaltyOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      disabled={controlsLocked}
                      onClick={() => {
                        setIgnoredInjury(option);
                        setInjuryMenuOpen(false);
                      }}
                      className={`w-full border px-2 py-1 text-left ${
                        ignoredInjury?.id === option.id ? "border-accent bg-accent/10 text-accent" : "border-ink/30 hover:border-accent"
                      }`}
                    >
                      <span className="block truncate typewriter text-[9px] font-bold uppercase tracking-widest">
                        {localizeNode(option.label)} -{localizeNode(option.penalty)}
                      </span>
                      <span className="block truncate typewriter text-[8px] uppercase tracking-widest text-foreground/60">
                        {localizeNode(option.sequels)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            </section>}
            <button type="button" onClick={() => setSelectionMenuOpen(false)} className="min-h-12 rounded-lg bg-accent px-4 font-bold text-background">{localizeText("Valider")}</button>
          </DialogContent>
        </Dialog>
        {localizeNode(!simple && climaxFacets && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-950/70 px-4 backdrop-blur-sm">
            <div className="w-full max-w-lg border-2 border-zinc-500 bg-zinc-900 p-8 text-center text-zinc-100 shadow-[6px_6px_0_hsl(var(--ink))]">
              <Zap size={58} strokeWidth={1.4} className="mx-auto mb-4 text-zinc-300" />
              <h2 className="font-display text-4xl uppercase tracking-wider text-zinc-100">{localizeText(" Hors d'etat ")}</h2>
              <p className="mt-3 typewriter text-xs uppercase leading-relaxed tracking-[0.24em] text-zinc-300">
                {localizeNode(climaxLine(climaxFacets))}
              </p>
              <button
                type="button"
                onClick={() => setClimaxFacets(null)}
                className="mt-6 border-2 border-zinc-400 px-5 py-2 typewriter text-xs font-bold uppercase tracking-widest text-zinc-100 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
              >{localizeText(" Continuer ")}</button>
            </div>
          </div>
        ))}
      </DialogContent>
    </Dialog>
  );
}

function ResultDiceLine({
  dice,
  potential,
  recommend,
  rolling,
  compact = false,
}: {
  dice: DisplayDie[];
  potential: number;
  recommend: ResultCandidate | null;
  rolling: boolean;
  compact?: boolean;
}) {
  return (
    <div role={rolling ? "status" : undefined} className={`flex max-w-full flex-wrap justify-center gap-3 ${compact ? "py-2" : "py-8"}`}>
      {rolling && <span className="sr-only">{localizeText("Lancer en cours…")}</span>}
      {dice.map((die, index) => {
        const recommended =
          recommend?.kind === die.kind &&
          recommend.value === die.value &&
          recommend.index === die.index;
        const failed = die.value > potential;
        const tone = die.unavailable ? "text-foreground/50 line-through decoration-2" : die.complication ? "text-amber-700 dark:text-amber-300"
          : die.prowess ? "text-blue-700 dark:text-blue-300" : recommended ? "text-emerald-700 dark:text-emerald-300"
          : die.unavailable ? "text-foreground/35 line-through decoration-2"
          : failed ? "text-destructive"
          : die.kind === "supernatural" ? "text-fuchsia-700 dark:text-fuchsia-300"
          : die.kind === "destin" ? "text-sky-700 dark:text-sky-300" : "text-foreground";
        return (
          <div data-result-die key={`${die.kind}-${die.index ?? 0}`} className={`flex shrink-0 flex-col items-center gap-1 text-center ${rolling ? die.kind === "supernatural" ? "text-fuchsia-800 dark:text-fuchsia-300" : DICE_TONES[die.sides] : tone}`}>
            <RollOutcomeEffect active={!rolling} outcome={die.unavailable ? "discarded" : die.complication ? "complication" : die.prowess ? "prowess" : failed ? "failure" : recommended || die.chosen ? "success" : "neutral"}><RollingDie sides={die.sides} index={index} rolling={rolling} compact={compact} className=""><span className={`text-2xl ${rolling ? "invisible" : ""}`} aria-hidden={rolling}>{localizeNode(die.value)}</span></RollingDie></RollOutcomeEffect>
            <span className="whitespace-nowrap font-sans text-sm font-bold leading-5 text-foreground">{localizeNode(die.label)}</span>
            <span className="h-4 text-xs text-muted-foreground">{!rolling && die.unavailable ? localizeText("Écarté") : ""}</span>
          </div>
        );
      })}
    </div>
  );
}
