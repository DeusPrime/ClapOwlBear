import { openListDatabase } from "./listDatabase";
import { activeDirectory, DEFAULT_DIRECTORY } from "./directories";
import { validateResource } from "./dataValidation";
import type { ImageEditing } from "./imageEditing";
import type { FigurantWeapon } from "./figurants";

export type Vehicle = {
  id: string;
  directoryId: string;
  titre: string;
  description: string;
  special: string;
  citation: string;
  image?: string;
  imageEditing?: ImageEditing;
  coque: string;
  maniabilite: string;
  vitesse: string;
  blindage: VehicleSides;
  armes: FigurantWeapon[];
  notes: string;
  updatedAt: number;
};

export type VehicleSides = {
  avant: string;
  gauche: string;
  droit: string;
  arriere: string;
};

const DB_NAME = "clap-vehicles-db";
const STORE_NAME = "vehicles";

export const blankVehicle = (): Vehicle => ({
  id: crypto.randomUUID(),
  directoryId: activeDirectory(),
  titre: "",
  description: "",
  special: "",
  citation: "",
  coque: "10",
  maniabilite: "3",
  vitesse: "2",
  blindage: { avant: "0", gauche: "0", droit: "0", arriere: "0" },
  armes: [{ nom: "", degats: "" }],
  notes: "",
  updatedAt: Date.now(),
});

const migrateSides = (value: any): VehicleSides => ({
  avant: typeof value?.avant === "string" ? value.avant : "0",
  gauche: typeof value?.gauche === "string" ? value.gauche : "0",
  droit: typeof value?.droit === "string" ? value.droit : "0",
  arriere: typeof value?.arriere === "string" ? value.arriere : "0",
});

export const migrateVehicle = (value: unknown): Vehicle => {
  const vehicle = validateResource("vehicle", value);
  return ({
    ...blankVehicle(),
    ...vehicle,
    directoryId: vehicle.directoryId ?? DEFAULT_DIRECTORY,
    id: typeof vehicle?.id === "string" ? vehicle.id : crypto.randomUUID(),
    coque: typeof vehicle?.coque === "string" ? vehicle.coque : "10",
    maniabilite: typeof vehicle?.maniabilite === "string" ? vehicle.maniabilite : vehicle?.potentiel ?? "3",
    vitesse: typeof vehicle?.vitesse === "string" ? vehicle.vitesse : "2",
    blindage: migrateSides(vehicle?.blindage),
    armes: Array.isArray(vehicle?.armes) ? vehicle.armes.slice(0, 4) : [{ nom: "", degats: "" }],
    updatedAt: typeof vehicle?.updatedAt === "number" ? vehicle.updatedAt : Date.now(),
  }) as Vehicle;
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

export const loadVehicles = async (): Promise<Vehicle[]> => {
  const vehicles = await withStore<Vehicle[]>("readonly", (store) => store.getAll() as IDBRequest<Vehicle[]>);
  return vehicles.map(migrateVehicle);
};

export const getVehicle = async (id: string): Promise<Vehicle | undefined> => {
  const vehicle = await withStore<Vehicle | undefined>(
    "readonly",
    (store) => store.get(id) as IDBRequest<Vehicle | undefined>,
  );
  return vehicle ? migrateVehicle(vehicle) : undefined;
};

export const upsertVehicle = async (vehicle: Vehicle) => {
  vehicle = migrateVehicle(vehicle);
  vehicle.updatedAt = Date.now();
  vehicle.armes = vehicle.armes.slice(0, 4);
  await withStore<IDBValidKey>("readwrite", (store) => store.put(vehicle));
};

export const deleteVehicle = async (id: string) => {
  await withStore<undefined>("readwrite", (store) => store.delete(id) as IDBRequest<undefined>);
};
