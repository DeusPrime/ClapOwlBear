import { reportSaveError } from "@/lib/saveError";
import PageTour from "@/components/PageTour";
import { resourceTourSteps } from '@/lib/resourceTour';
import { getLanguage } from '@/i18n/localize';
import { localizeText, localizeNode } from '@/i18n/localize';
import { withExportProgress } from "@/lib/exportProgress";
import { useBackNavigation } from '@/hooks/use-back-navigation';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { renderResourceCardsPdf } from "@/lib/resourceCardsPdf";
import InteractiveResourceCard from "@/components/InteractiveResourceCard";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ReactNode, useEffect, useState } from "react";
import { ArrowLeft, Dices, Download, Link2, Link2Off, MoreVertical, Pencil, Trash2 } from "lucide-react";
import ExportLoader from "@/components/ExportLoader";
import KeyRoleCard from "@/components/KeyRoleCard";
import FigurantCard from "@/components/FigurantCard";
import ProfileCard from "@/components/ProfileCard";
import PowerCard from "@/components/PowerCard";
import VehicleCard from "@/components/VehicleCard";
import { downloadBlob } from "@/lib/characterPng";
import { deleteKeyRole, getKeyRole, type KeyRole } from "@/lib/keyRoles";
import { deleteFigurant, getFigurant, type Figurant } from "@/lib/figurants";
import { deleteProfile, getProfile, type Profile } from "@/lib/profiles";
import { deletePower, getPower, type Power } from "@/lib/powers";
import { deleteVehicle, getVehicle, type Vehicle } from "@/lib/vehicles";
import { characterHasCriticalState, characterCriticalReasons, FACET_SKILLS, GRIEF_CAPACITY, INJURY_CAPACITY, INJURY_LOCATIONS, STRESS_CAPACITY, getCharacter, loadCharacters, upsertCharacter, type Character, type Facet } from "@/lib/characters";
import { exportKeyRolePng } from "@/lib/keyRolePng";
import { exportFigurantPng } from "@/lib/figurantPng";
import { exportProfilePng } from "@/lib/profilePng";
import { exportPowerPng } from "@/lib/powerPng";
import { exportVehiclePng } from "@/lib/vehiclePng";
import RollDialog, { type RollSelection } from "@/components/RollDialog";

type ResourceKind = "key-role" | "figurant" | "profile" | "power" | "vehicle";

type ResourceMap = {
  "key-role": KeyRole;
  figurant: Figurant;
  profile: Profile;
  power: Power;
  vehicle: Vehicle;
};

type DetailConfig<K extends ResourceKind> = {
  fallbackTitle: string;
  editPath: (id: string) => string;
  get: (id: string) => Promise<ResourceMap[K] | undefined>;
  exportPng: (item: ResourceMap[K]) => Promise<Blob>;
  renderCard: (item: ResourceMap[K]) => ReactNode;
  remove: (id: string) => Promise<void>;
};

const safeFileName = (name: string, fallback = "carte") =>
  (name || fallback)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_") || fallback;

const config: { [K in ResourceKind]: DetailConfig<K> } = {
  "key-role": {
    fallbackTitle: "Role cle",
    editPath: (id) => `/key-roles/${id}/edit`,
    get: getKeyRole,
    exportPng: exportKeyRolePng,
    renderCard: (item) => <KeyRoleCard role={item} scale={0.74} />,
    remove: deleteKeyRole,
  },
  figurant: {
    fallbackTitle: "Figurant",
    editPath: (id) => `/figurants/${id}/edit`,
    get: getFigurant,
    exportPng: exportFigurantPng,
    renderCard: (item) => <FigurantCard figurant={item} scale={0.74} />,
    remove: deleteFigurant,
  },
  profile: {
    fallbackTitle: "Profil",
    editPath: (id) => `/profils/${id}/edit`,
    get: getProfile,
    exportPng: exportProfilePng,
    renderCard: (item) => <ProfileCard profile={item} scale={0.74} />,
    remove: deleteProfile,
  },
  power: {
    fallbackTitle: "Pouvoir",
    editPath: (id) => `/pouvoirs/${id}/edit`,
    get: getPower,
    exportPng: exportPowerPng,
    renderCard: (item) => <PowerCard power={item} scale={0.74} />,
    remove: deletePower,
  },
  vehicle: {
    fallbackTitle: "Vehicule",
    editPath: (id) => `/vehicules/${id}/edit`,
    get: getVehicle,
    exportPng: exportVehiclePng,
    renderCard: (item) => <VehicleCard vehicle={item} scale={0.74} />,
    remove: deleteVehicle,
  },
};

const ResourceDetail = ({ kind }: { kind: ResourceKind }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [item, setItem] = useState<ResourceMap[ResourceKind] | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [linkedToOriginCharacter, setLinkedToOriginCharacter] = useState(false);
  const [originCharacter, setOriginCharacter] = useState<Character | null>(null);
  const [exporting, setExporting] = useState<"png" | "pdf" | null>(null);
  const [rollSelection, setRollSelection] = useState<RollSelection[]>([]);
  const [rollOpen, setRollOpen] = useState(false);
  const [powerRoll, setPowerRoll] = useState(false);
  const [vehicleRoll, setVehicleRoll] = useState(false);
  const detail = config[kind] as DetailConfig<ResourceKind>;
  const navigationState = location.state as { resourceOrigin?: "global" | "character"; characterId?: string } | null;
  const originCharacterId = navigationState?.resourceOrigin === "character" ? navigationState.characterId : undefined;
  const backTarget = originCharacterId ? `/characters/${originCharacterId}?tab=resources` : "/ressources";
  const goBack = useBackNavigation(backTarget);

  const openSimpleRoll = (name: string, facet: string, rawValue: string) => {
    setPowerRoll(false);
    setVehicleRoll(false);
    const value = Number.parseInt(rawValue, 10);
    setRollSelection([{ facet, name, value: Number.isFinite(value) ? value : 0 }]);
    setRollOpen(true);
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = async () => {
      const found = await detail.get(id);
      if (cancelled) return;
      if (!found) {
        navigate("/ressources");
        return;
      }
      setItem(found);
      if (originCharacterId) {
        const character = await getCharacter(originCharacterId);
        if (!cancelled) {
          setLinkedToOriginCharacter(
            Boolean(character?.linkedResources.some((resource) => resource.type === kind && resource.id === id)),
          );
          setOriginCharacter(character ?? null);
        }
      }
      document.title = `${found.titre || detail.fallbackTitle} — Clap & Role`;
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [detail, id, kind, navigate, originCharacterId]);

  const handleExport = async () => {
    return withExportProgress(async () => {
      if (!item) return;
      setExporting("png");
      try {
        const blob = await detail.exportPng(item);
        downloadBlob(blob, `${safeFileName(item.titre, detail.fallbackTitle)}.png`);
      } finally {
        setExporting(null);
      }
    });
  };

  const handleExportPdf = async () => {
    return withExportProgress(async () => {
      if (!item) return;
      setExporting("pdf");
      try {
        const blob = await renderResourceCardsPdf([item], resource => detail.exportPng(resource), true, kind);
        downloadBlob(blob, `${safeFileName(item.titre, detail.fallbackTitle)}_A4.pdf`);
      } finally {
        setExporting(null);
      }
    });
  };

  const handleDelete = async () => {
    if (!item || !id) return;
    const characters = await loadCharacters();
    const linkedCharacters = characters.filter((character) =>
      character.linkedResources.some((resource) => resource.type === kind && resource.id === id),
    );
    const linkedList = linkedCharacters.length > 0
      ? `\n\nCette carte est liée à :\n${linkedCharacters.map((character) => `• ${character.nom || "Héros sans nom"}`).join("\n")}\n\nLe lien sera retiré de chacun de ces héros.`
      : "";
    if (!confirm(localizeText(`Supprimer "${item.titre || detail.fallbackTitle}" ?${linkedList}`))) return;
    await Promise.all(linkedCharacters.map((character) => upsertCharacter({
      ...character,
      linkedResources: character.linkedResources.filter((resource) => resource.type !== kind || resource.id !== id),
      updatedAt: Date.now(),
    })));
    await detail.remove(id);
    navigate("/ressources", { replace: true });
  };

  const handleToggleLink = async () => {
    if (!originCharacterId || !id) return;
    const character = await getCharacter(originCharacterId);
    if (!character) return;
    const isLinked = character.linkedResources.some((resource) => resource.type === kind && resource.id === id);
    character.linkedResources = isLinked
      ? character.linkedResources.filter((resource) => resource.type !== kind || resource.id !== id)
      : [...character.linkedResources, { type: kind, id }];
    await upsertCharacter({ ...character, updatedAt: Date.now() });
    setLinkedToOriginCharacter(!isLinked);
  };

  if (!item || !id) return null;

  const heroRollOptions: RollSelection[] = originCharacter
    ? (Object.keys(FACET_SKILLS) as Facet[]).flatMap((facet) => {
        const injuryPenalty = INJURY_LOCATIONS.reduce((sum, location) => {
          const checked = originCharacter.injuries[location] ?? [];
          return sum + checked.reduce((total, active, index) => total + (active ? INJURY_CAPACITY[location]?.[index] ?? 0 : 0), 0);
        }, 0);
        const stressPenalty = originCharacter.stress.reduce((sum, active, index) => sum + (active ? STRESS_CAPACITY[index] ?? 0 : 0), 0);
        const griefPenalty = originCharacter.griefs.reduce((sum, active, index) => sum + (active ? GRIEF_CAPACITY[index] ?? 0 : 0), 0);
        const penalty = facet === "corps" ? injuryPenalty : facet === "esprit" ? stressPenalty : griefPenalty;
        return FACET_SKILLS[facet].map((name) => {
          const baseValue = originCharacter.facets[facet].skills[name] ?? 0;
          return {
            facet,
            name,
            baseValue,
            penalty,
            value: baseValue >= 0 ? Math.max(baseValue - penalty, 0) : baseValue,
            supernaturalDice: originCharacter.supernaturalEnabled ? originCharacter.facets[facet].supernatural[name] ?? 0 : 0,
          };
        });
      })
    : [];

  const openPowerRoll = () => {
    if (kind !== "power" || !originCharacter) return;
    const power = item as Power;
    const forcedAttribute = heroRollOptions.find((option) => option.name === power.attribut);
    if (!forcedAttribute) {
      alert(localizeText("L’attribut associé à ce pouvoir n’existe pas sur ce héros."));
      return;
    }
    setPowerRoll(true);
    setVehicleRoll(false);
    setRollSelection([forcedAttribute]);
    setRollOpen(true);
  };

  const openVehicleRoll = (stat: "maniabilite" | "vitesse") => {
    if (kind !== "vehicle" || !originCharacter) return;
    const vehicle = item as Vehicle;
    const label = stat === "maniabilite" ? "Maniabilité" : "Vitesse";
    setPowerRoll(false);
    setVehicleRoll(true);
    setRollSelection([{ facet: "vehicle", name: label, value: Number.parseInt(vehicle[stat], 10) || 0 }]);
    setRollOpen(true);
  };

  return (
    <div className="min-h-screen bg-paper text-foreground">
      <ExportLoader visible={exporting !== null} label={localizeText(exporting === "pdf" ? "Export PDF A4" : "Export PNG")} />
      <header className="sticky top-0 z-10 border-b border-ink bg-paper/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-4">
          <button type="button" aria-label={localizeText("Retour")} onClick={goBack} className="flex h-9 w-9 items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest hover:text-accent md:w-auto">
            <ArrowLeft size={16} />
            <span className="hidden md:inline">{localizeText("Retour")}</span>
          </button>
          <h1 className="truncate font-display text-xl tracking-wider md:text-2xl">{item.titre || localizeText("Sans nom")}</h1>
          <div className="flex shrink-0 items-center gap-2">
            <span data-mobile-help className="empty:hidden shrink-0 sm:hidden" /><span aria-hidden="true" className="hidden w-10 shrink-0 sm:block" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" data-tour="detail-actions" aria-label={localizeText("Actions de la carte")} className="flex h-11 w-11 items-center justify-center rounded-md transition-colors hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"><MoreVertical size={22} /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="w-64 max-w-[calc(100vw-2rem)] border-2 border-ink bg-paper p-2 text-foreground shadow-[4px_4px_0_hsl(var(--ink))]">
                <DropdownMenuLabel className="px-3 py-2 typewriter text-xs uppercase tracking-widest text-foreground/60">{localizeText("Actions de la carte")}</DropdownMenuLabel>
                <DropdownMenuItem asChild className="min-h-12 cursor-pointer gap-3 px-3">
                  <Link to={detail.editPath(id)} state={navigationState}><Pencil size={18} />{localizeText("Modifier la carte")}</Link>
                </DropdownMenuItem>
                {localizeNode(originCharacterId && <DropdownMenuItem onSelect={() => { void handleToggleLink(); }} className="min-h-12 cursor-pointer gap-3 px-3">
                  {localizeNode(linkedToOriginCharacter ? <Link2Off size={18} /> : <Link2 size={18} />)}
                  {localizeNode(linkedToOriginCharacter ? "Délier du héros" : "Lier au héros")}
                </DropdownMenuItem>)}
                <DropdownMenuSeparator className="bg-ink/15" />
                <DropdownMenuLabel className="px-3 py-2 typewriter text-xs uppercase tracking-widest text-foreground/60">{localizeText("Exporter")}</DropdownMenuLabel>
                <DropdownMenuItem disabled={exporting !== null} onSelect={() => { void handleExport(); }} className="min-h-12 cursor-pointer gap-3 px-3"><Download size={18} />{localizeText("Exporter en PNG")}</DropdownMenuItem>
                <DropdownMenuItem disabled={exporting !== null} onSelect={() => { void handleExportPdf(); }} className="min-h-12 cursor-pointer gap-3 px-3"><Download size={18} />{localizeText("Exporter en PDF A4")}</DropdownMenuItem>
                {localizeNode(!originCharacterId && <>
                  <DropdownMenuSeparator className="bg-ink/15" />
                  <DropdownMenuItem onSelect={() => { void handleDelete(); }} className="min-h-12 cursor-pointer gap-3 px-3 text-destructive focus:bg-destructive/10 focus:text-destructive"><Trash2 size={18} />{localizeText("Supprimer la carte")}</DropdownMenuItem>
                </>)}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container flex min-h-[calc(100vh-4rem)] items-start justify-center overflow-x-hidden px-2 py-4 sm:px-8 sm:py-8">
        <div className="resource-detail-layout grid w-full min-w-0 gap-3 sm:w-fit">
          <PageTour key={kind} page="resource-detail" tutorialId={`resource-detail-v2:${kind}:${originCharacter ? 'hero' : 'library'}`} customSteps={resourceTourSteps(kind, !!originCharacter && (kind !== 'power' || (item as Power).activation.trim().toLowerCase() === 'actif'), getLanguage() === 'en')} onStart={() => setFlipped(false)} />
          <div data-tour="detail-card" className="resource-detail-card mx-auto w-fit max-w-full">
            <InteractiveResourceCard key={`${kind}:${id}`} type={kind} directoryId={item.directoryId} flipped={flipped} onFlip={() => setFlipped(value => !value)}>
            {localizeNode(kind === "figurant" ? (
              <FigurantCard
                figurant={item as Figurant}
                scale={0.74}
                onPotentialRoll={() => openSimpleRoll("Potentiel", "potentiel", (item as Figurant).potentiel)}
              />
            ) : kind === "key-role" ? (
              <KeyRoleCard
                role={item as KeyRole}
                scale={0.74}
                onFacetRoll={(facet) => openSimpleRoll(facet[0].toUpperCase() + facet.slice(1), facet, (item as KeyRole)[facet])}
              />
            ) : kind === "power" ? (
              <PowerCard
                power={item as Power}
                scale={0.74}
                onAttributeRoll={originCharacter && (item as Power).activation.trim().toLowerCase() === "actif" ? openPowerRoll : undefined}
              />
            ) : kind === "vehicle" ? (
              <VehicleCard
                vehicle={item as Vehicle}
                scale={0.74}
                onStatRoll={originCharacter ? openVehicleRoll : undefined}
              />
            ) : detail.renderCard(item))}
            </InteractiveResourceCard>
          </div>
          {localizeNode(kind === "power" && originCharacter && (item as Power).activation.trim().toLowerCase() === "actif" && (
            <button type="button" onClick={openPowerRoll} className="flex min-h-11 w-full items-center justify-center gap-2 bg-accent px-4 py-2 text-xs font-bold uppercase tracking-widest text-background shadow-[3px_3px_0_hsl(var(--ink))] hover:opacity-90">
              <Dices size={16} /> <span className="sm:hidden">{localizeText("Utiliser")}</span><span className="hidden sm:inline">{localizeText("Utiliser ce pouvoir")}</span>
            </button>
          ))}
          {localizeNode(kind === "vehicle" && originCharacter && (
            <button type="button" onClick={() => openVehicleRoll("maniabilite")} className="flex min-h-11 w-full items-center justify-center gap-2 bg-accent px-4 py-2 text-xs font-bold uppercase tracking-widest text-background shadow-[3px_3px_0_hsl(var(--ink))] hover:opacity-90">
              <Dices size={16} /> <span className="sm:hidden">{localizeText("Utiliser")}</span><span className="hidden sm:inline">{localizeText("Utiliser ce véhicule")}</span>
            </button>
          ))}
        </div>
      </main>
      <RollDialog key={originCharacter?.id ?? id}
        forcePublic={new URLSearchParams(location.search).get("roomPublicRoll") === "1"}
        contextLabel={item.titre || detail.fallbackTitle}
        open={rollOpen}
        onOpenChange={setRollOpen}
        selection={rollSelection}
        selectionOptions={vehicleRoll ? [
          { facet: "vehicle", name: "Maniabilité", value: Number.parseInt((item as Vehicle).maniabilite, 10) || 0 },
          { facet: "vehicle", name: "Vitesse", value: Number.parseInt((item as Vehicle).vitesse, 10) || 0 },
          ...heroRollOptions,
        ] : powerRoll ? heroRollOptions : kind === "key-role" ? (["corps", "esprit", "ame"] as const).map((facet) => ({
          facet,
          name: facet[0].toUpperCase() + facet.slice(1),
          value: Number.parseInt((item as KeyRole)[facet], 10) || 0,
        })) : []}
        onSelectionChange={powerRoll || vehicleRoll || kind === "key-role" ? setRollSelection : undefined}
        destinDiceCount={powerRoll || vehicleRoll ? originCharacter?.destinDiceCount ?? 1 : kind === "figurant" ? 0 : 1}
        mandatoryComplication={powerRoll || vehicleRoll ? originCharacter?.mandatoryComplication ?? false : false}
        lockedSelectionKeys={(powerRoll || vehicleRoll) && rollSelection[0] ? [`${rollSelection[0].facet}::${rollSelection[0].name}`] : []}
        requiredSelectionCount={powerRoll || vehicleRoll ? 2 : 1}
        lockedSelectionCanChange={vehicleRoll}
        climaxUsed={(powerRoll || vehicleRoll) && originCharacter?.climaxUsed}
        criticalLocked={(powerRoll || vehicleRoll) && !!originCharacter && characterHasCriticalState(originCharacter)}
        criticalLockReasons={(powerRoll || vehicleRoll) && originCharacter ? characterCriticalReasons(originCharacter) : []}
        onClimaxRoll={() => {
          if (!originCharacter || originCharacter.climaxUsed || (!powerRoll && !vehicleRoll)) return;
          const next: Character = { ...originCharacter, climaxUsed: true, updatedAt: Date.now(), criticalStates: { agony: Object.fromEntries(INJURY_LOCATIONS.map(location => [location, true])), mentalBreak: true, emotionalBreak: true } };
          setOriginCharacter(next);
          void upsertCharacter(next).catch(reportSaveError);
        }}
        figurantGroup={kind === "figurant"}
        cardPotential={!powerRoll && !vehicleRoll}
        simple={!powerRoll && !vehicleRoll}
      />
    </div>
  );
};

export default ResourceDetail;
