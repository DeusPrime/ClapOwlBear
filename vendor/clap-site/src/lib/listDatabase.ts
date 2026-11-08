const INITIALIZATION_STORE = "list-initialization";

export function openListDatabase(databaseName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 3);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath: "id" });
      const store = request.transaction!.objectStore(storeName);
      if (!store.indexNames.contains('directoryId')) store.createIndex('directoryId', 'directoryId');
      if (!db.objectStoreNames.contains(INITIALIZATION_STORE)) db.createObjectStore(INITIALIZATION_STORE);
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}
