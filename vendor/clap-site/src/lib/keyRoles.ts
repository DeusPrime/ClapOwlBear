import { openListDatabase } from "./listDatabase";
import { activeDirectory, DEFAULT_DIRECTORY } from "./directories";
import { validateResource } from "./dataValidation";
import type { ImageEditing } from "./imageEditing";
export type KeyRoleWeapon = {
  nom: string;
  degats: string;
};

export type KeyRole = {
  id: string;
  directoryId: string;
  titre: string;
  description: string;
  special: string;
  citation: string;
  image?: string;
  imageEditing?: ImageEditing;
  pv: string;
  corps: string;
  esprit: string;
  ame: string;
  armure: string;
  armes: KeyRoleWeapon[];
  notes: string;
  updatedAt: number;
};

const DB_NAME = "clap-key-roles-db";
const STORE_NAME = "keyRoles";

export const blankKeyRole = (): KeyRole => ({
  id: crypto.randomUUID(),
  directoryId: activeDirectory(),
  titre: "",
  description: "",
  special: "",
  citation: "",
  pv: "10",
  corps: "4",
  esprit: "4",
  ame: "4",
  armure: "0",
  armes: [{ nom: "", degats: "" }],
  notes: "",
  updatedAt: Date.now(),
});

export const migrateKeyRole = (value: unknown): KeyRole => {
  const role = validateResource("key-role", value);
  return ({
    ...blankKeyRole(),
    ...role,
    directoryId: role.directoryId ?? DEFAULT_DIRECTORY,
    id: typeof role?.id === "string" ? role.id : crypto.randomUUID(),
    armes: Array.isArray(role?.armes) ? role.armes : [{ nom: "", degats: "" }],
    updatedAt: typeof role?.updatedAt === "number" ? role.updatedAt : Date.now(),
  }) as KeyRole;
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

export const loadKeyRoles = async (): Promise<KeyRole[]> => {
  const roles = await withStore<KeyRole[]>("readonly", (store) => store.getAll() as IDBRequest<KeyRole[]>);
  return roles.map(migrateKeyRole);
};

export const getKeyRole = async (id: string): Promise<KeyRole | undefined> => {
  const role = await withStore<KeyRole | undefined>(
    "readonly",
    (store) => store.get(id) as IDBRequest<KeyRole | undefined>,
  );
  return role ? migrateKeyRole(role) : undefined;
};

export const upsertKeyRole = async (role: KeyRole) => {
  role = migrateKeyRole(role);
  role.updatedAt = Date.now();
  await withStore<IDBValidKey>("readwrite", (store) => store.put(role));
};

export const deleteKeyRole = async (id: string) => {
  await withStore<undefined>("readwrite", (store) => store.delete(id) as IDBRequest<undefined>);
};
