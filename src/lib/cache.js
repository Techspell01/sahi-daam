// A tiny IndexedDB key-value store for the cache of everyone's prices, which
// outgrows localStorage's ~5 MB once there are tens of thousands of reports.
// If IndexedDB isn't available (private mode, tests), nothing is cached and the
// app simply fetches again.
const STORE = 'kv';
let opening;

function open() {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('sahidaam', 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return opening;
}

export async function getItem(key) {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function setItem(key, value) {
  try {
    const db = await open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* full or unavailable: keep it in memory */ }
}
