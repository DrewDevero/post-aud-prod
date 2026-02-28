const DB_VERSION = 1;
const STORE_NAME = "outfits";

export interface SavedOutfit {
  id: string;
  name: string;
  blob: Blob;
  createdAt: number;
}

function open(userId: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(`scene-placer-outfits-${userId}`, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllOutfits(userId: string): Promise<SavedOutfit[]> {
  const db = await open(userId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const results = (req.result as SavedOutfit[]).sort(
        (a, b) => b.createdAt - a.createdAt,
      );
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveOutfit(
  userId: string,
  name: string,
  blob: Blob,
): Promise<SavedOutfit> {
  const db = await open(userId);
  const outfit: SavedOutfit = {
    id: crypto.randomUUID(),
    name,
    blob,
    createdAt: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(outfit);
    req.onsuccess = () => resolve(outfit);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteOutfit(
  userId: string,
  id: string,
): Promise<void> {
  const db = await open(userId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function renameOutfit(
  userId: string,
  id: string,
  name: string,
): Promise<void> {
  const db = await open(userId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const outfit = getReq.result as SavedOutfit | undefined;
      if (!outfit) return reject(new Error("Outfit not found"));
      outfit.name = name;
      const putReq = store.put(outfit);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}
