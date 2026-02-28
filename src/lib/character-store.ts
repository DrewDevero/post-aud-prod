const DB_VERSION = 1;
const STORE_NAME = "characters";

export interface SavedCharacter {
  id: string;
  name: string;
  blob: Blob;
  createdAt: number;
}

function open(userId: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(`scene-placer-${userId}`, DB_VERSION);
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

export async function getAllCharacters(
  userId: string,
): Promise<SavedCharacter[]> {
  const db = await open(userId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const results = (req.result as SavedCharacter[]).sort(
        (a, b) => b.createdAt - a.createdAt,
      );
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveCharacter(
  userId: string,
  name: string,
  blob: Blob,
): Promise<SavedCharacter> {
  const db = await open(userId);
  const character: SavedCharacter = {
    id: crypto.randomUUID(),
    name,
    blob,
    createdAt: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(character);
    req.onsuccess = () => resolve(character);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteCharacter(
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

export async function renameCharacter(
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
      const char = getReq.result as SavedCharacter | undefined;
      if (!char) return reject(new Error("Character not found"));
      char.name = name;
      const putReq = store.put(char);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}
