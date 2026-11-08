import { openListDatabase } from "./listDatabase";
import { activeDirectory, DEFAULT_DIRECTORY } from "./directories";
import { validateResource } from "./dataValidation";
import type { ImageEditing } from "./imageEditing";
export type Profile = {
  id: string;
  directoryId: string;
  titre: string;
  description: string;
  special: string;
  citation: string;
  image?: string;
  imageEditing?: ImageEditing;
  facetteForteLabel: string;
  facetteNeutreLabel: string;
  facetteFaibleLabel: string;
  facetteForte: string;
  facetteNeutre: string;
  facetteFaible: string;
  traitPlus: string;
  traitMoins: string;
  notes: string;
  updatedAt: number;
};

const DB_NAME = "clap-profiles-db";
const STORE_NAME = "profiles";

export const blankProfile = (): Profile => ({
  id: crypto.randomUUID(),
  directoryId: activeDirectory(),
  titre: "",
  description: "",
  special: "",
  citation: "",
  facetteForteLabel: "Forte",
  facetteNeutreLabel: "Neutre",
  facetteFaibleLabel: "Faible",
  facetteForte: "6",
  facetteNeutre: "6",
  facetteFaible: "6",
  traitPlus: "1",
  traitMoins: "1",
  notes: "",
  updatedAt: Date.now(),
});

export const migrateProfile = (value: unknown): Profile => {
  const profile = validateResource("profile", value);
  return ({
    ...blankProfile(),
    ...profile,
    directoryId: profile.directoryId ?? DEFAULT_DIRECTORY,
    id: typeof profile?.id === "string" ? profile.id : crypto.randomUUID(),
    updatedAt: typeof profile?.updatedAt === "number" ? profile.updatedAt : Date.now(),
  }) as Profile;
};

const openDb = () => openListDatabase(DB_NAME, STORE_NAME);

const withStore = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) => {
  const db = await openDb();
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

export const loadProfiles = async (): Promise<Profile[]> => {
  const profiles = await withStore<Profile[]>("readonly", (store) => store.getAll() as IDBRequest<Profile[]>);
  return profiles.map(migrateProfile);
};

export const getProfile = async (id: string): Promise<Profile | undefined> => {
  const profile = await withStore<Profile | undefined>(
    "readonly",
    (store) => store.get(id) as IDBRequest<Profile | undefined>,
  );
  return profile ? migrateProfile(profile) : undefined;
};

export const upsertProfile = async (profile: Profile) => {
  profile = migrateProfile(profile);
  profile.updatedAt = Date.now();
  await withStore<IDBValidKey>("readwrite", (store) => store.put(profile));
};

export const deleteProfile = async (id: string) => {
  await withStore<undefined>("readwrite", (store) => store.delete(id) as IDBRequest<undefined>);
};
