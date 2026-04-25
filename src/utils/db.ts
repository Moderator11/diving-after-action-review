/**
 * IndexedDB layer for DAAR.
 *
 * DB: "daar_db" v2
 * Stores:
 *   "sessions"  { id (autoIncrement), filename, savedAt (ms), diveCount, buffer }
 *   "metadata"  { sessionId (keyPath), memos, favorites }
 *
 * v1 → v2 upgrade: old "kv" store is dropped.
 */

const DB_NAME    = 'daar_db';
const DB_VERSION = 2;

// ── Public types ──────────────────────────────────────────

export interface StoredSession {
  id?:       number;          // IDB autoIncrement key
  filename:  string;
  savedAt:   number;          // Date.getTime() ms
  diveCount: number;
  buffer:    ArrayBuffer;
}

export interface SessionMetadata {
  sessionId: number;
  memos:     Record<number, string>;  // diveIdx → text
  favorites: number[];                // diveIdx list
}

// ── Open DB ───────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db         = req.result;
      const oldVersion = (e as IDBVersionChangeEvent).oldVersion;

      // Remove legacy v1 "kv" store
      if (oldVersion >= 1 && db.objectStoreNames.contains('kv')) {
        db.deleteObjectStore('kv');
      }
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'sessionId' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── Generic helpers ───────────────────────────────────────

function storeGet<T>(db: IDBDatabase, store: string, key: IDBValidKey): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror   = () => reject(req.error);
  });
}

function storeGetAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror   = () => reject(req.error);
  });
}

// ── Sessions ──────────────────────────────────────────────

/** Save a new FIT session. Returns the generated id. */
export async function saveSession(s: Omit<StoredSession, 'id'>): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('sessions', 'readwrite');
    const req = tx.objectStore('sessions').add(s);
    req.onsuccess = () => resolve(req.result as number);
    tx.onerror    = () => reject(tx.error);
  });
}

/** All sessions, newest-first. */
export async function getAllSessions(): Promise<StoredSession[]> {
  const db   = await openDB();
  const rows = await storeGetAll<StoredSession>(db, 'sessions');
  return rows.sort((a, b) => b.savedAt - a.savedAt);
}

/** Single session by id. */
export async function getSession(id: number): Promise<StoredSession | null> {
  const db = await openDB();
  return storeGet<StoredSession>(db, 'sessions', id);
}

/** Delete a session and its metadata atomically. */
export async function deleteSession(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['sessions', 'metadata'], 'readwrite');
    tx.objectStore('sessions').delete(id);
    tx.objectStore('metadata').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

// ── Metadata ──────────────────────────────────────────────

/** Load metadata for a session (returns empty default if none). */
export async function getMetadata(sessionId: number): Promise<SessionMetadata> {
  const db  = await openDB();
  const row = await storeGet<SessionMetadata>(db, 'metadata', sessionId);
  return row ?? { sessionId, memos: {}, favorites: [] };
}

/** Persist metadata (creates or replaces). */
export async function saveMetadata(meta: SessionMetadata): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('metadata', 'readwrite');
    tx.objectStore('metadata').put(meta);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

// ── Export / Import ───────────────────────────────────────

function bufToBase64(buf: ArrayBuffer): string {
  const bytes  = new Uint8Array(buf);
  let   binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** Serialise everything to a JSON string. */
export async function exportAllData(): Promise<string> {
  const sessions = await getAllSessions();
  const metas    = await Promise.all(sessions.map((s) => getMetadata(s.id!)));

  const payload = {
    exportedAt: new Date().toISOString(),
    appVersion: '1.0',
    sessions: sessions.map((s, i) => ({
      filename:  s.filename,
      savedAt:   new Date(s.savedAt).toISOString(),
      diveCount: s.diveCount,
      fitData:   bufToBase64(s.buffer),
      memos:     metas[i].memos,
      favorites: metas[i].favorites,
    })),
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Import sessions from a previously exported JSON string.
 * Duplicates are always added as new entries (same filename is fine).
 * Returns the number of sessions successfully imported.
 */
export async function importAllData(jsonStr: string): Promise<number> {
  let parsed: { sessions?: unknown[] };
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('JSON 파싱 실패: 올바른 파일인지 확인하세요.');
  }

  if (!Array.isArray(parsed.sessions) || parsed.sessions.length === 0) {
    throw new Error('세션 데이터를 찾을 수 없습니다.');
  }

  let count = 0;
  for (const raw of parsed.sessions) {
    const s = raw as Record<string, unknown>;
    if (typeof s.fitData !== 'string') continue;          // skip malformed entries
    try {
      const buffer = base64ToBuf(s.fitData as string);
      const id     = await saveSession({
        filename:  String(s.filename  ?? 'unknown.fit'),
        savedAt:   s.savedAt ? new Date(s.savedAt as string).getTime() : Date.now(),
        diveCount: Number(s.diveCount ?? 0),
        buffer,
      });
      await saveMetadata({
        sessionId: id,
        memos:     (s.memos as Record<number, string>) ?? {},
        favorites: (s.favorites as number[]) ?? [],
      });
      count++;
    } catch { /* skip corrupt entry */ }
  }

  if (count === 0) throw new Error('가져올 수 있는 세션이 없습니다.');
  return count;
}
