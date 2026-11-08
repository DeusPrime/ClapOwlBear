import { openListDatabase } from "./listDatabase";
import { activeDirectory, DEFAULT_DIRECTORY } from "./directories";
import { validateResource } from "./dataValidation";
import type { ImageEditing } from "./imageEditing";
export type Power = {
  id: string;
  directoryId: string;
  titre: string;
  description: string;
  special: string;
  limitations: string;
  citation: string;
  image?: string;
  imageEditing?: ImageEditing;
  activation: string;
  attribut: string;
  notes: string;
  updatedAt: number;
};

const DB_NAME = "clap-powers-db";
const STORE_NAME = "powers";

export const blankPower = (): Power => ({
  id: crypto.randomUUID(),
  directoryId: activeDirectory(),
  titre: "",
  description: "",
  special: "",
  limitations: "",
  citation: "",
  activation: "Actif",
  attribut: "Attribut",
  notes: "",
  updatedAt: Date.now(),
});

export const migratePower = (value: unknown): Power => {
  const power = validateResource("power", value);
  return ({
    ...blankPower(),
    ...power,
    directoryId: power.directoryId ?? DEFAULT_DIRECTORY,
    id: typeof power?.id === "string" ? power.id : crypto.randomUUID(),
    activation: typeof power?.activation === "string" ? power.activation : "Actif",
    attribut: typeof power?.attribut === "string" ? power.attribut : typeof power?.discretion === "string" ? power.discretion : "Attribut",
    limitations: typeof power?.limitations === "string" ? power.limitations : "",
    updatedAt: typeof power?.updatedAt === "number" ? power.updatedAt : Date.now(),
  }) as Power;
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

export const loadPowers = async (): Promise<Power[]> => {
  const powers = await withStore<Power[]>("readonly", (store) => store.getAll() as IDBRequest<Power[]>);
  return powers.map(migratePower);
};

export const getPower = async (id: string): Promise<Power | undefined> => {
  const power = await withStore<Power | undefined>(
    "readonly",
    (store) => store.get(id) as IDBRequest<Power | undefined>,
  );
  return power ? migratePower(power) : undefined;
};

export const upsertPower = async (power: Power) => {
  power = migratePower(power);
  power.updatedAt = Date.now();
  await withStore<IDBValidKey>("readwrite", (store) => store.put(power));
};

export const deletePower = async (id: string) => {
  await withStore<undefined>("readwrite", (store) => store.delete(id) as IDBRequest<undefined>);
};
