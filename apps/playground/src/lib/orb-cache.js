const DB_NAME = "orbit360-orb-cache";
const DB_VERSION = 1;
const STORE = "orbs";

let dbPromise;

function openDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "url" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
  }
  return dbPromise;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedOrb(url) {
  const db = await openDb();
  if (!db) return null;
  try {
    const tx = db.transaction(STORE, "readonly");
    const record = await requestResult(tx.objectStore(STORE).get(url));
    return record?.blob instanceof Blob ? record.blob : null;
  } catch {
    return null;
  }
}

export async function putCachedOrb(url, blob) {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({
      url,
      blob,
      size: blob.size,
      cachedAt: Date.now(),
    });
    await new Promise((resolve) => {
      tx.oncomplete = resolve;
      tx.onerror = resolve;
      tx.onabort = resolve;
    });
  } catch {
    // 隐私模式 / 配额不足时静默降级为普通网络缓存。
  }
}
