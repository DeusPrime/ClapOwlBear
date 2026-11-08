import { openListDatabase } from "./listDatabase";
import { activeDirectory, DEFAULT_DIRECTORY } from "./directories";
import { validateResource } from "./dataValidation";
import type { ImageEditing } from "./imageEditing";
export type FigurantWeapon = {
  nom: string;
  degats: string;
};

export type Figurant = {
  id: string;
  directoryId: string;
  titre: string;
  description: string;
  special: string;
  citation: string;
  image?: string;
  imageEditing?: ImageEditing;
  potentiel: string;
  armure: string;
  armes: FigurantWeapon[];
  notes: string;
  updatedAt: number;
};

const DB_NAME = "clap-figurants-db";
const STORE_NAME = "figurants";

export const blankFigurant = (): Figurant => ({
  id: crypto.randomUUID(),
  directoryId: activeDirectory(),
  titre: "",
  description: "",
  special: "",
  citation: "",
  potentiel: "3",
  armure: "0",
  armes: [{ nom: "", degats: "" }],
  notes: "",
  updatedAt: Date.now(),
});

export const migrateFigurant = (value: unknown): Figurant => {
  const figurant = validateResource("figurant", value);
  return ({
    ...blankFigurant(),
    ...figurant,
    directoryId: figurant.directoryId ?? DEFAULT_DIRECTORY,
    id: typeof figurant?.id === "string" ? figurant.id : crypto.randomUUID(),
    armes: Array.isArray(figurant?.armes) ? figurant.armes.slice(0, 4) : [{ nom: "", degats: "" }],
    updatedAt: typeof figurant?.updatedAt === "number" ? figurant.updatedAt : Date.now(),
  }) as Figurant;
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

export const loadFigurants = async (): Promise<Figurant[]> => {
  const figurants = await withStore<Figurant[]>("readonly", (store) => store.getAll() as IDBRequest<Figurant[]>);
  return figurants.map(migrateFigurant);
};

export const getFigurant = async (id: string): Promise<Figurant | undefined> => {
  const figurant = await withStore<Figurant | undefined>(
    "readonly",
    (store) => store.get(id) as IDBRequest<Figurant | undefined>,
  );
  return figurant ? migrateFigurant(figurant) : undefined;
};

export const upsertFigurant = async (figurant: Figurant) => {
  figurant = migrateFigurant(figurant);
  figurant.updatedAt = Date.now();
  figurant.armes = figurant.armes.slice(0, 4);
  await withStore<IDBValidKey>("readwrite", (store) => store.put(figurant));
};

export const deleteFigurant = async (id: string) => {
  await withStore<undefined>("readwrite", (store) => store.delete(id) as IDBRequest<undefined>);
};
