/**
 * IndexedDB storage for voice memos
 * Persists audio data locally across sessions
 */

const DB_NAME = "lifeos-voicememos";
const DB_VERSION = 2; // Bumped for transcription fields
const STORE_NAME = "memos";

export interface StoredVoiceMemo {
  id: string;
  name: string;
  audioBlob: Blob;
  mimeType: string;
  extension: string; // File extension (e.g., "webm", "m4a")
  duration: number;
  createdAt: number;
  // Transcription fields
  transcript?: string;
  transcriptLanguage?: string;
  transcribedAt?: number;
  // Sync status
  syncedToConvex?: boolean;
  convexMemoId?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("Failed to open IndexedDB:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
  });

  return dbPromise;
}

export async function saveMemo(memo: StoredVoiceMemo): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(memo);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getMemos(): Promise<StoredVoiceMemo[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("createdAt");
    const request = index.openCursor(null, "prev"); // Descending order

    const memos: StoredVoiceMemo[] = [];

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        memos.push(cursor.value);
        cursor.continue();
      } else {
        resolve(memos);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

export async function deleteMemo(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearAllMemos(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function updateMemo(
  id: string,
  updates: Partial<Omit<StoredVoiceMemo, "id">>
): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const memo = getRequest.result;
      if (!memo) {
        reject(new Error("Memo not found"));
        return;
      }

      const updatedMemo = { ...memo, ...updates };
      const putRequest = store.put(updatedMemo);

      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function getMemo(id: string): Promise<StoredVoiceMemo | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get memos for a specific date (YYYY-MM-DD format)
 * Filters memos where createdAt timestamp falls within the given day
 */
export async function getMemosForDate(dateStr: string): Promise<StoredVoiceMemo[]> {
  const allMemos = await getMemos();

  // Parse date string and get day boundaries
  const [year, month, day] = dateStr.split("-").map(Number);
  const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
  const dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999).getTime();

  return allMemos.filter((memo) => memo.createdAt >= dayStart && memo.createdAt <= dayEnd);
}
