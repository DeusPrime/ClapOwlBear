import type { ComponentType } from 'react';
import useScrollList from "@/hooks/use-scroll-list";
import { ListLoading } from "@/components/ListLoading";
import PlayingCardsIcon from "@/components/PlayingCardsIcon";
import PageTour from "@/components/PageTour";
import { localizeText, localizeNode } from '@/i18n/localize';
import { reportExportProgress, withExportProgress } from "@/lib/exportProgress";
import AppHeader from "@/components/AppHeader";
import { renderResourceCardsPdf } from "@/lib/resourceCardsPdf";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import JSZip from "jszip";
import { Archive, Check, ChevronDown, Crown, Download, FileText, Plus, Search, Trash2, Upload, X } from "lucide-react";
import InteractiveResourceCard from "@/components/InteractiveResourceCard";
import RoleTabs from "@/components/RoleTabs";
import FigurantIcon from "@/components/FigurantIcon";
import PowerIcon from "@/components/PowerIcon";
import ProfileIcon from "@/components/ProfileIcon";
import VehicleIcon from "@/components/VehicleIcon";
import { downloadBlob } from "@/lib/characterPng";
import { loadCharacters, upsertCharacter, type Character } from "@/lib/characters";
import { deleteFigurant, loadFigurants, upsertFigurant, type Figurant } from "@/lib/figurants";
import { deleteKeyRole, loadKeyRoles, upsertKeyRole, type KeyRole } from "@/lib/keyRoles";
import { deletePower, loadPowers, upsertPower, type Power } from "@/lib/powers";
import { deleteProfile, loadProfiles, upsertProfile, type Profile } from "@/lib/profiles";
import { deleteVehicle, loadVehicles, upsertVehicle, type Vehicle } from "@/lib/vehicles";
import { exportFigurantPng, importFigurantPng } from "@/lib/figurantPng";
import { exportKeyRolePng, importKeyRolePng } from "@/lib/keyRolePng";
import { exportPowerPng, importPowerPng } from "@/lib/powerPng";
import { exportProfilePng, importProfilePng } from "@/lib/profilePng";
import { exportVehiclePng, importVehiclePng } from "@/lib/vehiclePng";
import { resourceContentId } from "@/lib/resourceBundle";
import ExportLoader from "@/components/ExportLoader";
import ResourceCardPreview from "@/components/ResourceCardPreview";
import { activeDirectory, DIRECTORY_BACK_CHANGED, moveToDirectory, selectDirectory } from "@/lib/directories";
import { preloadResourceBacks } from "@/lib/resourceBackPreload";
import BulkDirectoryButton from "@/components/BulkDirectoryButton";

type ResourceType = "key-role" | "figurant" | "profile" | "power" | "vehicle";

type ResourceItem =
  | { type: "key-role"; label: string; href: string; item: KeyRole }
  | { type: "figurant"; label: string; href: string; item: Figurant }
  | { type: "profile"; label: string; href: string; item: Profile }
  | { type: "power"; label: string; href: string; item: Power }
  | { type: "vehicle"; label: string; href: string; item: Vehicle };

const typeMeta: Record<ResourceType, { label: string; plural: string; icon: typeof Crown | ComponentType<{size?:number;className?:string}>; create: string; emptyName: string }> = {
  "key-role": { label: "Role cle", plural: "Roles cles", icon: Crown, create: "/key-roles/new", emptyName: "role-cle" },
  figurant: { label: "Figurant", plural: "Figurants", icon: FigurantIcon, create: "/figurants/new", emptyName: "figurant" },
  profile: { label: "Profil", plural: "Profils", icon: ProfileIcon, create: "/profils/new", emptyName: "profil" },
  power: { label: "Pouvoir", plural: "Pouvoirs", icon: PowerIcon, create: "/pouvoirs/new", emptyName: "pouvoir" },
  vehicle: { label: "Vehicule", plural: "Vehicules", icon: VehicleIcon, create: "/vehicules/new", emptyName: "vehicule" },
};

const resourceTypeOrder: ResourceType[] = ["key-role", "figurant", "power", "vehicle", "profile"];

const safeFileName = (name: string, fallback: string) =>
  (name.trim() || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || fallback;

const resourceTitle = (resource: ResourceItem) => resource.item.titre || localizeText("Sans nom");

const resourceDescription = (resource: ResourceItem) => resource.item.description || "";

const resourceKey = (resource: ResourceItem) => `${resource.type}:${resource.item.id}`;

const uniqueFileName = (baseName: string, extension: string, usedNames: Set<string>) => {
  let filename = `${baseName}.${extension}`;
  let index = 2;
  while (usedNames.has(filename)) {
    filename = `${baseName}_${index}.${extension}`;
    index += 1;
  }
  usedNames.add(filename);
  return filename;
};

const ResourcesList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [flippedIds, setFlippedIds] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState<"png" | "pdf" | "delete" | "directory" | null>(null);
  const [singleExportBusy, setSingleExportBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [directoryId, setDirectoryId] = useState(activeDirectory);
  useEffect(() => {
    const preload = () => { void preloadResourceBacks(directoryId); };
    preload();
    window.addEventListener(DIRECTORY_BACK_CHANGED, preload);
    return () => window.removeEventListener(DIRECTORY_BACK_CHANGED, preload);
  }, [directoryId]);
  const changeDirectory = (id: string) => { selectDirectory(id); setDirectoryId(id); setSelectedIds(new Set()); };
  const [selectedTypes, setSelectedTypes] = useState<Set<ResourceType>>(() => new Set());
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const dragDepth = useRef(0);

  const selectedResources = resources.filter((resource) => selectedIds.has(resourceKey(resource)));
  const selectionMode = selectedIds.size > 0;
  const selectedTypeCount = selectedTypes.size;
  const filterLabel =
    selectedTypeCount === 0
      ? "Tous les types"
      : selectedTypeCount === 1
        ? typeMeta[[...selectedTypes][0]].plural
        : `${selectedTypeCount} types`;

  const refresh = async () => {
    setLoading(true);
    try {
    const [roles, figurants, profiles, powers, vehicles] = await Promise.all([
      loadKeyRoles(),
      loadFigurants(),
      loadProfiles(),
      loadPowers(),
      loadVehicles(),
    ]);

    const merged: ResourceItem[] = [
      ...roles.map((item): ResourceItem => ({ type: "key-role", label: typeMeta["key-role"].label, href: `/key-roles/${item.id}`, item })),
      ...figurants.map((item): ResourceItem => ({ type: "figurant", label: typeMeta.figurant.label, href: `/figurants/${item.id}`, item })),
      ...profiles.map((item): ResourceItem => ({ type: "profile", label: typeMeta.profile.label, href: `/profils/${item.id}`, item })),
      ...powers.map((item): ResourceItem => ({ type: "power", label: typeMeta.power.label, href: `/pouvoirs/${item.id}`, item })),
      ...vehicles.map((item): ResourceItem => ({ type: "vehicle", label: typeMeta.vehicle.label, href: `/vehicules/${item.id}`, item })),
    ];

    merged.sort((a, b) => resourceTitle(a).localeCompare(resourceTitle(b), "fr", { sensitivity: "base" }));
    setResources(merged);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return resources.filter((resource) => {
      if (resource.item.directoryId !== directoryId) return false;
      if (selectedTypes.size > 0 && !selectedTypes.has(resource.type)) return false;
      if (!needle) return true;
      return `${resourceTitle(resource)} ${resourceDescription(resource)} ${resource.label}`.toLowerCase().includes(needle);
    });
  }, [query, resources, selectedTypes, directoryId]);

  const list = useScrollList(filtered, `${directoryId}:${query}:${[...selectedTypes].sort().join(",")}`);
  const allFilteredSelected = filtered.length > 0 && filtered.every(resource => selectedIds.has(resourceKey(resource)));

  const toggleFilterType = (type: ResourceType) => {
    setSelectedTypes((cur) => {
      const next = new Set(cur);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const renderResourcePng = async (resource: ResourceItem) =>
      resource.type === "key-role"
        ? await exportKeyRolePng(resource.item)
        : resource.type === "figurant"
          ? await exportFigurantPng(resource.item)
          : resource.type === "profile"
            ? await exportProfilePng(resource.item)
            : resource.type === "power"
              ? await exportPowerPng(resource.item)
              : await exportVehiclePng(resource.item);

  const exportResource = async (resource: ResourceItem) => {
    return withExportProgress(async () => {
      setSingleExportBusy(true);
      try {
        const blob = await renderResourcePng(resource);
        downloadBlob(blob, `${safeFileName(resourceTitle(resource), typeMeta[resource.type].emptyName)}.png`);
      } finally {
        setSingleExportBusy(false);
      }
    });
  };

  const removeResource = async (resource: ResourceItem) => {
    if (resource.type === "key-role") await deleteKeyRole(resource.item.id);
    if (resource.type === "figurant") await deleteFigurant(resource.item.id);
    if (resource.type === "profile") await deleteProfile(resource.item.id);
    if (resource.type === "power") await deletePower(resource.item.id);
    if (resource.type === "vehicle") await deleteVehicle(resource.item.id);
  };

  const charactersLinkedTo = (characters: Character[], keys: Set<string>) =>
    characters.filter((character) =>
      character.linkedResources.some((linked) => keys.has(`${linked.type}:${linked.id}`)),
    );

  const unlinkResourcesFromCharacters = async (characters: Character[], keys: Set<string>) => {
    const changed = characters
      .map((character) => ({
        character,
        linkedResources: character.linkedResources.filter((linked) => !keys.has(`${linked.type}:${linked.id}`)),
      }))
      .filter(({ character, linkedResources }) => linkedResources.length !== character.linkedResources.length);

    await Promise.all(
      changed.map(({ character, linkedResources }) =>
        upsertCharacter({ ...character, linkedResources, updatedAt: Date.now() }),
      ),
    );
  };

  const deleteResource = async (resource: ResourceItem) => {
    const key = resourceKey(resource);
    const characters = await loadCharacters();
    const linkedCharacters = charactersLinkedTo(characters, new Set([key]));
    const linkedList = linkedCharacters.length > 0
      ? `\n\nCette carte est liée à :\n${linkedCharacters.map((character) => `• ${character.nom || "Héros sans nom"}`).join("\n")}\n\nLe lien sera retiré de chacun de ces héros.`
      : "";
    if (!confirm(localizeText(`Supprimer "${resourceTitle(resource)}" ?${linkedList}`))) return;
    await unlinkResourcesFromCharacters(characters, new Set([key]));
    await removeResource(resource);
    setSelectedIds((cur) => {
      const next = new Set(cur);
      next.delete(resourceKey(resource));
      return next;
    });
    await refresh();
  };

  const toggleSelected = (key: string) => {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());
  const directorySelection = async (directoryId: string) => {
    // Validate every selected fiche before writing any of them.
    const changed = moveToDirectory(selectedResources.map(resource => resource.item), directoryId);
    setBulkBusy("directory");
    try {
      for (let index = 0; index < selectedResources.length; index++) {
        const resource = selectedResources[index]; const item = changed[index];
        if (resource.type === "key-role") await upsertKeyRole(item as KeyRole);
        else if (resource.type === "figurant") await upsertFigurant(item as Figurant);
        else if (resource.type === "profile") await upsertProfile(item as Profile);
        else if (resource.type === "power") await upsertPower(item as Power);
        else await upsertVehicle(item as Vehicle);
      }
      await refresh();
      clearSelection();
    } finally { setBulkBusy(null); }
  };

  const handleTileClick = (resource: ResourceItem) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    if (selectionMode) {
      toggleSelected(resourceKey(resource));
      return;
    }
    navigate(resource.href, { state: { resourceOrigin: "global" } });
  };

  const startLongPress = (key: string) => {
    longPressTriggered.current = false;
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      toggleSelected(key);
    }, 520);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const exportSelectionZip = async (items = selectedResources, filename = "clap_ressources_png.zip") => {
    return withExportProgress(async () => {
      if (items.length === 0 || bulkBusy !== null) return;
      setBulkBusy("png");
      try {
        const zip = new JSZip();
        const usedNames = new Set<string>();
        for (const [exportIndex, resource] of items.entries()) {
          reportExportProgress(10 + exportIndex / items.length * 65, `PNG ${exportIndex + 1}/${items.length}`);
          const baseName = safeFileName(
            `${typeMeta[resource.type].emptyName}_${resourceTitle(resource)}`,
            typeMeta[resource.type].emptyName,
          );
          const blob = await renderResourcePng(resource);
          zip.file(uniqueFileName(baseName, "png", usedNames), blob);
        }
        const blob = await zip.generateAsync({ type: "blob" }, metadata => reportExportProgress(75 + metadata.percent * .25));
        downloadBlob(blob, filename);
      } finally {
        setBulkBusy(null);
      }
    });
  };

  const exportSelectionPdf = async () => {
    return withExportProgress(async () => {
      if (selectedResources.length === 0) return;
      setBulkBusy("pdf");
      try {
        const cards = selectedResources.map(resource => ({ ...resource, titre: resource.item.titre, resourceType: resource.type, directoryId: resource.item.directoryId }));
        const blob = await renderResourceCardsPdf<(typeof cards)[number]>(cards, card => renderResourcePng(card));
        downloadBlob(blob, "clap_ressources_a4.pdf");
      } finally {
        setBulkBusy(null);
      }
    });
  };

  const deleteSelection = async (items = selectedResources, scope = "") => {
    if (items.length === 0 || bulkBusy !== null) return;
    const keys = new Set(items.map(resourceKey));
    const characters = await loadCharacters();
    const linkedCharacters = charactersLinkedTo(characters, keys);
    const linkedList = linkedCharacters.length > 0
      ? `\n\nCes cartes sont liées à :\n${linkedCharacters.map((character) => `• ${character.nom || "Héros sans nom"}`).join("\n")}\n\nLes liens seront retirés de chacun de ces héros.`
      : "";
    if (!confirm(localizeText(`Supprimer ${items.length} carte${items.length > 1 ? "s" : ""}${scope ? ` (${scope})` : ""} ?\n\nLes fiches seront supprimées définitivement, dans ce projet.${linkedList}`))) return;
    setBulkBusy("delete");
    try {
      await unlinkResourcesFromCharacters(characters, keys);
      await Promise.all(items.map((resource) => removeResource(resource)));
      setSelectedIds(current => new Set([...current].filter(key => !keys.has(key))));
      await refresh();
    } finally {
      setBulkBusy(null);
    }
  };

  const importResourcePng = async (file: File) => {
    const keyRole = await importKeyRolePng(file);
    if (keyRole) {
      keyRole.directoryId = directoryId;
      keyRole.id = await resourceContentId("key-role", keyRole);
      await upsertKeyRole(keyRole);
      return true;
    }

    const figurant = await importFigurantPng(file);
    if (figurant) {
      figurant.directoryId = directoryId;
      figurant.id = await resourceContentId("figurant", figurant);
      await upsertFigurant(figurant);
      return true;
    }

    const profile = await importProfilePng(file);
    if (profile) {
      profile.directoryId = directoryId;
      profile.id = await resourceContentId("profile", profile);
      await upsertProfile(profile);
      return true;
    }

    const power = await importPowerPng(file);
    if (power) {
      power.directoryId = directoryId;
      power.id = await resourceContentId("power", power);
      await upsertPower(power);
      return true;
    }

    const vehicle = await importVehiclePng(file);
    if (vehicle) {
      vehicle.directoryId = directoryId;
      vehicle.id = await resourceContentId("vehicle", vehicle);
      await upsertVehicle(vehicle);
      return true;
    }

    return false;
  };

  const importDroppedFiles = async (files: FileList | File[]) => {
    const pngFiles = Array.from(files).filter((file) => file.type === "image/png" || file.name.toLowerCase().endsWith(".png"));
    if (pngFiles.length === 0) return;
    setImportBusy(true);
    try {
      let imported = 0;
      for (const file of pngFiles) {
        if (await importResourcePng(file)) imported += 1;
      }
      if (imported > 0) await refresh();
      if (imported === 0) alert(localizeText("Aucune carte Clap & Role lisible dans ces PNG."));
      else if (imported < pngFiles.length) alert(localizeText(`${imported}/${pngFiles.length} carte${imported > 1 ? "s" : ""} importee${imported > 1 ? "s" : ""}. Certains PNG ne contiennent pas de carte ressource lisible.`));
    } finally {
      setImportBusy(false);
    }
  };

  const handleDragEnter = (event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  };

  const handleDragOver = (event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    if (event.dataTransfer.files) await importDroppedFiles(event.dataTransfer.files);
  };

  return (
    <div className="min-h-screen bg-background text-foreground" onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      <ExportLoader visible={singleExportBusy || bulkBusy === "png" || bulkBusy === "pdf"} label={localizeText(bulkBusy === "pdf" ? "Export PDF A4" : "Export PNG")} />
      {localizeNode((dragActive || importBusy) && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/75 p-4 backdrop-blur-sm">
          <div
            className={`flex min-h-64 w-full max-w-xl flex-col items-center justify-center gap-4 border-2 border-dashed px-6 py-10 text-center shadow-[6px_6px_0_hsl(var(--ink))] ${
              dragActive ? "border-accent bg-paper" : "border-ink bg-paper"
            }`}
          >
            <Upload size={42} strokeWidth={2.5} className="text-accent" />
            <div>
              <p className="font-display text-3xl leading-none">{localizeNode(importBusy ? "Import en cours" : "Deposer les PNG")}</p>
              <p className="mt-2 typewriter text-sm text-foreground/65">
                {localizeNode(importBusy ? "Detection du type de carte..." : "Roles cles, figurants, profils, pouvoirs ou vehicules sont reconnus automatiquement.")}
              </p>
            </div>
          </div>
        </div>
      ))}
      <AppHeader title={localizeText("Cartes")} directoryId={directoryId} onDirectoryChange={changeDirectory} />
      <input
        ref={fileInput}
        type="file"
        accept="image/png,.png"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) void importDroppedFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <main className="container pt-24 pb-28 sm:pt-8 sm:pb-12">

        <RoleTabs />
        <PageTour page="resources" />
        <header className="mb-8 border-b-2 border-ink pb-5">
          <p className="typewriter text-xs uppercase tracking-widest text-accent">{localizeText("Tout pour donner vie à ton univers")}</p>
          <h1 className="mt-2 hidden items-center gap-3 font-display text-4xl uppercase sm:flex sm:text-5xl"><PlayingCardsIcon size={32} className="shrink-0" />{localizeText("Mes cartes")}</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">{localizeText("Retrouve les cartes de ce projet ou ajoute des rôles clés, figurants, profils, pouvoirs et véhicules.")}</p>
        </header>

        <div className="mb-6 grid gap-4">

          {selectionMode && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-2 border-ink bg-paper-dark/70 px-4 py-3 shadow-[4px_4px_0_hsl(var(--ink))]">
              <div className="flex items-center gap-2 typewriter text-sm font-bold uppercase tracking-widest">
                <Check size={16} />
                {localizeNode(selectedIds.size)}{localizeText(" selectionne")}{localizeNode(selectedIds.size > 1 ? "s" : "")}
              </div>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                <button type="button" disabled={!filtered.length || bulkBusy !== null} onClick={() => setSelectedIds(allFilteredSelected ? new Set() : new Set(filtered.map(resourceKey)))} className="flex min-h-10 items-center gap-2 border-2 border-ink px-3 py-2 typewriter text-xs hover:bg-ink hover:text-background disabled:opacity-50">{localizeNode(allFilteredSelected ? <X size={14} /> : <Check size={14} />)}{localizeNode(allFilteredSelected ? "Tout désélectionner" : "Tout sélectionner")}</button>
                <BulkDirectoryButton count={selectedResources.length} disabled={bulkBusy !== null} onApply={directorySelection} />
                <button
                  type="button"
                  disabled={bulkBusy !== null}
                  onClick={() => void exportSelectionZip()}
                  className="flex min-h-10 items-center justify-center gap-1.5 border-2 border-ink px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-ink hover:text-background disabled:opacity-50"
                >
                  <Archive size={14} />{localizeText(" ZIP PNG ")}</button>
                <button
                  type="button"
                  disabled={bulkBusy !== null}
                  onClick={() => void exportSelectionPdf()}
                  className="flex min-h-10 items-center justify-center gap-1.5 border-2 border-ink px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-ink hover:text-background disabled:opacity-50"
                >
                  <FileText size={14} />{localizeText(" PDF A4 ")}</button>
                <button
                  type="button"
                  disabled={bulkBusy !== null}
                  onClick={() => void deleteSelection()}
                  className="flex min-h-10 items-center justify-center gap-1.5 border-2 border-destructive px-3 py-2 text-xs font-bold uppercase tracking-widest text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
                >
                  <Trash2 size={14} />{localizeText(" Supprimer ")}</button>
                <button
                  type="button"
                  disabled={bulkBusy !== null}
                  onClick={clearSelection}
                  className="flex min-h-10 items-center justify-center gap-1.5 border-2 border-transparent px-3 py-2 text-xs font-bold uppercase tracking-widest hover:text-accent disabled:opacity-50"
                  aria-label={localizeText("Annuler la selection")}
                >
                  <X size={14} />{localizeText(" Annuler ")}</button>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/45" />
              <input
                data-tour="search" value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={localizeText("Rechercher une carte")}
                className="h-12 w-full border-2 border-ink bg-paper pl-10 pr-3 typewriter text-sm outline-none focus:border-accent"
              />
            </div>

          <div className="relative shrink-0">
            <button
              type="button"
              data-tour="filter" onClick={() => setFilterMenuOpen((open) => !open)}
              aria-expanded={filterMenuOpen}
              aria-label={localizeText(`Filtrer : ${filterLabel}`)}
              className="flex h-12 w-full items-center justify-between gap-2 border-2 border-ink bg-paper px-3 typewriter text-xs font-bold uppercase tracking-widest hover:border-accent"
            >
              <span>{localizeText("Filtrer")}{selectedTypeCount > 0 && ` (${selectedTypeCount})`}</span>
              <ChevronDown size={16} className={`transition-transform ${filterMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {filterMenuOpen && (
              <>
              <button type="button" aria-label={localizeText("Fermer les filtres")} onClick={() => setFilterMenuOpen(false)} className="fixed inset-0 z-30 bg-black/45 sm:hidden" />
              <div className="fixed inset-x-4 top-1/2 z-40 max-h-[calc(100dvh-2rem)] -translate-y-1/2 overflow-y-auto overscroll-contain sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-[60dvh] sm:w-72 sm:translate-y-0 border-2 border-ink bg-paper p-2 shadow-[4px_4px_0_hsl(var(--ink))]">
                <button
                  type="button"
                  onClick={() => setSelectedTypes(new Set())}
                  className={`mb-1 flex min-h-10 w-full items-center justify-between px-3 text-left typewriter text-xs font-bold uppercase tracking-widest hover:bg-ink hover:text-background ${
                    selectedTypeCount === 0 ? "bg-accent text-background" : ""
                  }`}
                >{localizeText(" Tous les types ")}{localizeNode(selectedTypeCount === 0 && <Check size={15} />)}
                </button>

                {resourceTypeOrder.map((type) => {
                  const checked = selectedTypes.has(type);
                  const Icon = typeMeta[type].icon;
                  return (
                    <label
                      key={type}
                      className="grid min-h-10 cursor-pointer grid-cols-[1rem_1.25rem_1fr] items-center gap-3 px-3 typewriter text-xs font-bold uppercase tracking-widest hover:bg-ink hover:text-background"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFilterType(type)}
                        className="h-4 w-4 justify-self-center accent-[hsl(var(--accent))]"
                      />
                      <Icon size={15} className="justify-self-center self-center" />
                      <span className="translate-y-px leading-none">{localizeNode(typeMeta[type].plural)}</span>
                    </label>
                  );
                })}
              </div>
              </>
            )}
          </div>

            <div className="relative hidden shrink-0 sm:block">
              <button
                type="button"
                data-tour="create" onClick={() => setCreateMenuOpen((open) => !open)}
                aria-expanded={createMenuOpen}
                className="flex h-12 items-center justify-center gap-2 border-2 border-ink bg-accent px-5 text-xs font-bold uppercase tracking-widest text-background shadow-[3px_3px_0_hsl(var(--ink))] hover:opacity-90"
              >
                <Plus size={18} strokeWidth={3} />{localizeText(" Ajouter ")}</button>
              {createMenuOpen && (
                <div className="absolute right-0 top-full z-30 mt-2 grid w-56 gap-2 border-2 border-ink bg-paper p-2 shadow-[4px_4px_0_hsl(var(--ink))]">
                  {resourceTypeOrder.map((type) => {
                    const Icon = typeMeta[type].icon;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setCreateMenuOpen(false);
                          navigate(typeMeta[type].create);
                        }}
                        className="flex min-h-10 items-center gap-2 border-2 border-ink/25 px-3 text-left text-xs font-bold uppercase tracking-widest hover:border-ink hover:bg-ink hover:text-background"
                      >
                        <Icon size={15} /> {localizeNode(typeMeta[type].label)}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setCreateMenuOpen(false);
                      fileInput.current?.click();
                    }}
                    className="flex min-h-10 items-center gap-2 border-2 border-ink/25 px-3 text-left text-xs font-bold uppercase tracking-widest hover:border-ink hover:bg-ink hover:text-background"
                  >
                    <Upload size={15} />{localizeText(" À partir d'un fichier ")}</button>
                </div>
              )}
            </div>
          </div>



        </div>

        <p className="mb-4 typewriter text-xs text-muted-foreground">{localizeText("Clique pour ouvrir la fiche. Glisse à gauche ou à droite pour retourner la carte. Appui long pour sélectionner.")}</p>
        <ListLoading loading={loading} />
        <div style={{ scrollMarginTop: 80 }} ref={list.gridRef} aria-busy={loading || list.pending} className="grid justify-center gap-x-2 gap-y-4 min-[390px]:gap-x-[14px] sm:gap-y-6 [grid-template-columns:repeat(2,auto)] lg:[grid-template-columns:repeat(3,auto)]">
          {list.items.map((resource) => {
            const key = resourceKey(resource);
            const selected = selectedIds.has(key);
            return (
              <article data-tour="card" key={key} className={`relative flex w-fit flex-col overflow-visible transition-transform ${selectionMode ? "tile-wiggle" : ""} ${selected ? "ring-4 ring-accent" : ""}`}>
                <button
                  type="button"
                  onClick={() => handleTileClick(resource)}
                  onPointerDown={() => startLongPress(key)}
                  onPointerUp={cancelLongPress}
                  onPointerCancel={cancelLongPress}
                  onPointerLeave={cancelLongPress}
                  className="relative block overflow-visible bg-transparent text-left"
                  aria-pressed={selectionMode ? selected : undefined}
                  aria-label={localizeText(selectionMode ? `Sélectionner ${resourceTitle(resource)}` : `Ouvrir ${resourceTitle(resource)}`)}
                >
                  <InteractiveResourceCard type={resource.type} directoryId={resource.item.directoryId} flipped={flippedIds.has(key)} disabled={selectionMode} onGestureMove={cancelLongPress} onFlip={() => setFlippedIds(current => {
                    const next = new Set(current);
                    if (next.has(key)) next.delete(key); else next.add(key);
                    return next;
                  })}>
                    <ResourceCardPreview resource={resource} />
                  </InteractiveResourceCard>
                  {localizeNode(selectionMode && (
                    <span
                      className={`absolute right-14 top-2 flex h-9 w-9 items-center justify-center border-2 border-ink bg-paper text-foreground shadow-[2px_2px_0_hsl(var(--ink))] sm:right-14 sm:top-3 ${
                        selected ? "bg-accent text-background" : ""
                      }`}
                      aria-hidden="true"
                    >
                      {localizeNode(selected && <Check size={18} strokeWidth={3} />)}
                    </span>
                  ))}
                </button>

                <div className="mt-2 flex items-center justify-end gap-1.5">
                  <button type="button" onClick={() => void deleteResource(resource)} aria-label={localizeText("Supprimer")} title={localizeText("Supprimer")} className="flex h-9 w-9 items-center justify-center rounded-md border border-ink/20 bg-black/65 text-white shadow-[2px_2px_0_rgba(0,0,0,0.28)] transition-colors hover:border-destructive hover:bg-destructive hover:text-destructive-foreground">
                    <Trash2 size={15} />
                  </button>
                  <button type="button" onClick={() => void exportResource(resource)} aria-label={localizeText("Exporter PNG")} title={localizeText("Exporter PNG")} className="flex h-9 w-9 items-center justify-center rounded-md border border-ink/20 bg-black/65 text-white shadow-[2px_2px_0_rgba(0,0,0,0.28)] transition-colors hover:bg-paper hover:text-foreground">
                    <Download size={15} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div ref={list.endRef} className="min-h-1"><ListLoading loading={list.pending} /></div>
        {localizeNode(!loading && filtered.length === 0 && (
          <div className="mt-8 border-2 border-dashed border-ink/30 p-4 typewriter text-sm text-foreground/65">{localizeText(" Aucune carte ne correspond a ces filtres. ")}</div>
        ))}
      </main>

      <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end sm:hidden">
        {createMenuOpen && (
          <div className="mb-2 grid w-56 gap-2 border-2 border-ink bg-paper p-2 shadow-[4px_4px_0_hsl(var(--ink))]">
            {resourceTypeOrder.map((type) => {
              const Icon = typeMeta[type].icon;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setCreateMenuOpen(false);
                    navigate(typeMeta[type].create);
                  }}
                  className="flex min-h-10 items-center gap-2 border-2 border-ink/25 px-3 text-left text-xs font-bold uppercase tracking-widest hover:border-ink hover:bg-ink hover:text-background"
                >
                  <Icon size={15} /> {localizeNode(typeMeta[type].label)}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setCreateMenuOpen(false);
                fileInput.current?.click();
              }}
              className="flex min-h-10 items-center gap-2 border-2 border-ink/25 px-3 text-left text-xs font-bold uppercase tracking-widest hover:border-ink hover:bg-ink hover:text-background"
            >
              <Upload size={15} />{localizeText(" À partir d'un fichier ")}</button>
          </div>
        )}
        <button
          type="button"
          data-tour="create" onClick={() => setCreateMenuOpen((open) => !open)}
          aria-expanded={createMenuOpen}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-ink bg-accent text-background shadow-[4px_4px_0_hsl(var(--ink))] transition-transform hover:-translate-y-0.5"
        >
          <Plus
            size={28}
            strokeWidth={3}
            className={`transition-transform duration-200 ${createMenuOpen ? "rotate-45" : "rotate-0"}`}
          />
        </button>
      </div>
    </div>
  );
};

export default ResourcesList;
