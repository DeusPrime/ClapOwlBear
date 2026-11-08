import { openListDatabase } from "./listDatabase";
import { activeDirectory, DEFAULT_DIRECTORY } from "./directories";
import { characterInputSchema, parseData } from "./dataValidation";
import type { ImageEditing } from "./imageEditing";
// Character data model + IndexedDB CRUD

export type Facet = "corps" | "esprit" | "ame";

export const FACET_SKILLS: Record<Facet, string[]> = {
  corps: ["Force", "Endurance", "Mobilité", "Perception", "Adresse"],
  esprit: ["Savoir", "Sang-froid", "Précision", "Logique", "Discrétion"],
  ame: ["Charisme", "Courage", "Influence", "Instinct", "Empathie"],
};

export const FACET_LABELS: Record<Facet, string> = {
  corps: "Corps",
  esprit: "Esprit",
  ame: "Âme",
};

export const INJURY_LOCATIONS = [
  "Tête",
  "Supérieure Gauche",
  "Supérieure Droite",
  "Centrale",
  "Inférieure Gauche",
  "Inférieure Droite",
];

export const INJURY_LEVELS = [
  "Anodine",
  "Mineure",
  "Légère",
  "Modérée",
  "Sévère",
  "Grave",
  "Critique",
];

export const STRESS_LEVELS = [
  "Inquiet",
  "Tendu",
  "Préoccupé",
  "Stressé",
  "Anxieux",
  "Paniqué",
  "Horrifié",
];

export const GRIEF_LEVELS = [
  "Contrarié",
  "Perturbé",
  "Bouleversé",
  "Triste",
  "Déprimé",
  "Accablé",
  "Désespéré",
];

// Capacity maps: how many hearts / brains / eyes each cell carries.
// 0 = cell exists but does not count, n = clicking the cell counts as n in the total.
export const INJURY_CAPACITY: Record<string, number[]> = {
  "Tête":                [0, 0, 0, 1, 1, 2, 2],
  "Supérieure Gauche":   [0, 0, 0, 0, 1, 1, 1],
  "Supérieure Droite":   [0, 0, 0, 0, 1, 1, 1],
  "Centrale":            [0, 0, 0, 1, 1, 1, 2],
  "Inférieure Gauche":   [0, 0, 0, 0, 1, 1, 1],
  "Inférieure Droite":   [0, 0, 0, 0, 1, 1, 1],
};

export const STRESS_CAPACITY = [0, 0, 0, 1, 1, 2, 2];
export const GRIEF_CAPACITY = [0, 0, 0, 1, 1, 2, 2];

export type Arme = { nom: string; degats: string; proprietes: string };
export type Armure = { nom: string; poids: string; protection: string; proprietes: string };
export type AutreAccessoire = { nom: string; proprietes: string; quantite?: number };
export type CardCheckColors = {
  injuries: Record<string, string[]>;
  stress: string[];
  griefs: string[];
};

export type LinkedResourceType = "key-role" | "figurant" | "profile" | "power" | "vehicle";
export type LinkedResource = { type: LinkedResourceType; id: string };

export type Character = {
  id: string;
  directoryId: string;
  nom: string;
  age: string;
  taille: string;
  poids: string;
  concept: string;
  replique: string;
  portrait?: string; // dataURL
  portraitEditing?: ImageEditing;
  facets: Record<Facet, { core: number; skills: Record<string, number>; supernatural: Record<string, number> }>;
  traits: string;
  specialite: string;
  armes: Arme[];
  armures: Armure[];
  autresAccessoires: AutreAccessoire[];
  injuries: Record<string, boolean[]>; // location -> 7 levels
  stress: boolean[];
  griefs: boolean[];
  cardInk: string;
  cardCheckColors: CardCheckColors;
  criticalStates: {
    agony: Record<string, boolean>;
    mentalBreak: boolean;
    emotionalBreak: boolean;
  };
  pointsRecits: number;
  destinDiceCount: number;
  supernaturalEnabled: boolean;
  mandatoryComplication: boolean;
  climaxUsed: boolean;
  linkedResources: LinkedResource[];
  lore: string;
  notes: string;
  updatedAt: number;
};

const STORAGE_KEY = "clap-characters";
const MIGRATION_KEY = "clap-characters-indexeddb-migrated";
const DB_NAME = "clap-character-db";
const STORE_NAME = "characters";

export const blankCharacter = (): Character => ({
  id: crypto.randomUUID(),
  directoryId: activeDirectory(),
  nom: "",
  age: "",
  taille: "",
  poids: "",
  concept: "",
  replique: "",
  facets: {
    corps: {
      core: 0,
      skills: Object.fromEntries(FACET_SKILLS.corps.map((s) => [s, 0])),
      supernatural: Object.fromEntries(FACET_SKILLS.corps.map((s) => [s, 0])),
    },
    esprit: {
      core: 0,
      skills: Object.fromEntries(FACET_SKILLS.esprit.map((s) => [s, 0])),
      supernatural: Object.fromEntries(FACET_SKILLS.esprit.map((s) => [s, 0])),
    },
    ame: {
      core: 0,
      skills: Object.fromEntries(FACET_SKILLS.ame.map((s) => [s, 0])),
      supernatural: Object.fromEntries(FACET_SKILLS.ame.map((s) => [s, 0])),
    },
  },
  traits: "",
  specialite: "",
  armes: [],
  armures: [],
  autresAccessoires: [],
  injuries: Object.fromEntries(INJURY_LOCATIONS.map((l) => [l, Array(7).fill(false)])),
  stress: Array(7).fill(false),
  griefs: Array(7).fill(false),
  cardInk: "#3a1307",
  cardCheckColors: {
    injuries: Object.fromEntries(INJURY_LOCATIONS.map((l) => [l, Array(7).fill("")])),
    stress: Array(7).fill(""),
    griefs: Array(7).fill(""),
  },
  criticalStates: {
    agony: Object.fromEntries(INJURY_LOCATIONS.map((l) => [l, false])),
    mentalBreak: false,
    emotionalBreak: false,
  },
  pointsRecits: 0,
  destinDiceCount: 1,
  supernaturalEnabled: false,
  mandatoryComplication: false,
  climaxUsed: false,
  linkedResources: [],
  lore: "",
  notes: "",
  updatedAt: Date.now(),
});

/** A spent Climax is rearmed only after every explicit and derived critical state clears. */
export const characterCriticalReasons = (character: Character): string[] => {
  const total = (checks: boolean[], capacity: number[]) => checks.reduce((sum, checked, index) => sum + (checked ? capacity[index] ?? 0 : 0), 0);
  const penalties: Record<Facet, number> = {
    corps: INJURY_LOCATIONS.reduce((sum, location) => sum + total(character.injuries[location] ?? [], INJURY_CAPACITY[location] ?? []), 0),
    esprit: total(character.stress, STRESS_CAPACITY),
    ame: total(character.griefs, GRIEF_CAPACITY),
  };
  const critical: Record<Facet, boolean> = {
    corps: Object.values(character.criticalStates.agony).some(Boolean),
    esprit: character.criticalStates.mentalBreak || character.stress.lastIndexOf(true) + 1 >= STRESS_LEVELS.length,
    ame: character.criticalStates.emotionalBreak || character.griefs.lastIndexOf(true) + 1 >= GRIEF_LEVELS.length,
  };
  const labels: Record<Facet, string> = { corps: "Agonie", esprit: "Délire", ame: "Désespoir" };
  return (Object.keys(FACET_SKILLS) as Facet[])
    .filter(facet => critical[facet] || FACET_SKILLS[facet].every(skill => (character.facets[facet].skills[skill] ?? 0) - penalties[facet] <= 0))
    .map(facet => labels[facet]);
};
export const characterHasCriticalState = (character: Character): boolean => characterCriticalReasons(character).length > 0;

export const migrateCharacter = (value: unknown): Character => {
  const c = parseData(characterInputSchema, value) as Character & { accessoires?: Arme[]; protections?: Armure[] };
  const migrated = { ...blankCharacter(), ...c, directoryId: c.directoryId ?? DEFAULT_DIRECTORY } as Character;
  if (!Array.isArray(c.armes) && Array.isArray(c.accessoires)) {
    migrated.armes = c.accessoires;
  }
  if (!Array.isArray(c.armures) && Array.isArray(c.protections)) {
    migrated.armures = c.protections;
  }
  if (!Array.isArray(migrated.autresAccessoires)) {
    migrated.autresAccessoires = [];
  }
  if (!Array.isArray(migrated.armes)) migrated.armes = [];
  if (!Array.isArray(migrated.armures)) migrated.armures = [];
  if (typeof migrated.cardInk !== "string" || !/^#[0-9a-fA-F]{6}$/.test(migrated.cardInk)) {
    migrated.cardInk = "#3a1307";
  }
  migrated.cardCheckColors = {
    injuries: Object.fromEntries(
      INJURY_LOCATIONS.map((l) => [
        l,
        Array.from({ length: 7 }, (_, i) => c.cardCheckColors?.injuries?.[l]?.[i] ?? ""),
      ]),
    ),
    stress: Array.from({ length: 7 }, (_, i) => c.cardCheckColors?.stress?.[i] ?? ""),
    griefs: Array.from({ length: 7 }, (_, i) => c.cardCheckColors?.griefs?.[i] ?? ""),
  };
  migrated.criticalStates = {
    agony: {
      ...Object.fromEntries(INJURY_LOCATIONS.map((l) => [l, false])),
      ...(c.criticalStates?.agony ?? {}),
    },
    mentalBreak: Boolean(c.criticalStates?.mentalBreak),
    emotionalBreak: Boolean(c.criticalStates?.emotionalBreak),
  };
  if (typeof migrated.lore !== "string") migrated.lore = "";
  if (typeof migrated.notes !== "string") migrated.notes = "";
  if (typeof migrated.destinDiceCount !== "number" || !Number.isFinite(migrated.destinDiceCount)) {
    migrated.destinDiceCount = 1;
  } else {
    migrated.destinDiceCount = Math.max(0, Math.floor(migrated.destinDiceCount));
  }
  migrated.supernaturalEnabled = Boolean(c.supernaturalEnabled);
  migrated.mandatoryComplication = Boolean(c.mandatoryComplication);
  migrated.linkedResources = Array.isArray(c.linkedResources)
    ? c.linkedResources.filter(
        (resource: any) =>
          resource &&
          typeof resource.id === "string" &&
          ["key-role", "figurant", "profile", "power", "vehicle"].includes(resource.type),
      )
    : [];
  migrated.facets = Object.fromEntries(
    (Object.keys(FACET_SKILLS) as Facet[]).map((facet) => {
      const current: Partial<Character["facets"][Facet]> = migrated.facets?.[facet] ?? {};
      return [
        facet,
        {
          core: typeof current.core === "number" ? current.core : 0,
          skills: {
            ...Object.fromEntries(FACET_SKILLS[facet].map((skill) => [skill, 0])),
            ...(current.skills ?? {}),
          },
          supernatural: {
            ...Object.fromEntries(FACET_SKILLS[facet].map((skill) => [skill, 0])),
            ...(current.supernatural ?? {}),
          },
        },
      ];
    }),
  ) as Character["facets"];
  migrated.climaxUsed = Boolean(c.climaxUsed) && characterHasCriticalState(migrated);
  return parseData(characterInputSchema, migrated) as Character;
};

const readLocalStorageCharacters = (): Character[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map(migrateCharacter);
  } catch {
    return [];
  }
};

const openCharactersDb = () => openListDatabase(DB_NAME, STORE_NAME);

const withStore = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) => {
  const db = await openCharactersDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const request = run(tx.objectStore(STORE_NAME));

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
};

const migrateLocalStorageToIndexedDb = async () => {
  if (localStorage.getItem(MIGRATION_KEY) === "true") return;

  const chars = readLocalStorageCharacters();
  if (chars.length > 0) {
    const db = await openCharactersDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      chars.forEach((c) => store.put(c));

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    });
  }

  localStorage.setItem(MIGRATION_KEY, "true");
};

const readDirectoryCharacters = async (directoryId: string): Promise<Character[]> => {
  const db = await openCharactersDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('directoryId');
    const records = index.getAll(directoryId);
    const legacy: Character[] = [];
    if (directoryId === DEFAULT_DIRECTORY) {
      // Locate old unindexed records using only IDs, without reading portraits
      // and other large fields from every other project.
      const allKeys = store.getAllKeys();
      const indexedKeys = index.getAllKeys();
      let completed = 0;
      const findLegacy = () => {
        if (++completed !== 2) return;
        const indexed = new Set(indexedKeys.result);
        for (const key of allKeys.result) {
          if (indexed.has(key)) continue;
          const request = store.get(key);
          request.onsuccess = () => { if (request.result) legacy.push(request.result); };
        }
      };
      allKeys.onsuccess = findLegacy;
      indexedKeys.onsuccess = findLegacy;
    }
    tx.oncomplete = () => { db.close(); resolve([...records.result, ...legacy]); };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
  });
};

export const loadCharacters = async (directoryId?: string): Promise<Character[]> => {
  await migrateLocalStorageToIndexedDb();
  const chars = directoryId
    ? await readDirectoryCharacters(directoryId)
    : await withStore<Character[]>("readonly", (store) => store.getAll() as IDBRequest<Character[]>);
  return chars.map(migrateCharacter);
};

export const saveCharacters = async (chars: Character[]) => {
  chars = chars.map(migrateCharacter);
  await migrateLocalStorageToIndexedDb();
  const db = await openCharactersDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    chars.forEach((c) => store.put(c));

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
};

export const upsertCharacter = async (c: Character) => {
  c = migrateCharacter(c);
  c.updatedAt = Date.now();
  await migrateLocalStorageToIndexedDb();
  await withStore<IDBValidKey>("readwrite", (store) => store.put(c));
  window.dispatchEvent(new CustomEvent('clap-character-saved', { detail: c }));
};

export const deleteCharacter = async (id: string) => {
  await migrateLocalStorageToIndexedDb();
  await withStore<undefined>("readwrite", (store) => store.delete(id) as IDBRequest<undefined>);
};

export const getCharacter = async (id: string) => {
  await migrateLocalStorageToIndexedDb();
  const character = await withStore<Character | undefined>(
    "readonly",
    (store) => store.get(id) as IDBRequest<Character | undefined>,
  );
  return character ? migrateCharacter(character) : undefined;
};
