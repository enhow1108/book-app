import { TABLES, type Changes, type Row, type Saved, type Table } from './database-types';

// SQLite on the web needs cross-origin isolation headers, which GitHub Pages can't send,
// so the web build keeps the same tables in the browser's own database (IndexedDB) instead.
const NAME = 'book-app';
const VERSION = 1;
let opened: Promise<IDBDatabase> | undefined;

function db() {
  opened ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(NAME, VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const t of [...TABLES, 'meta']) {
        if (!database.objectStoreNames.contains(t)) database.createObjectStore(t, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return opened;
}

function done(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function all<T>(store: IDBObjectStore) {
  return new Promise<T[]>((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

export async function loadSaved(): Promise<Saved> {
  const database = await db();
  const tx = database.transaction([...TABLES, 'meta'], 'readonly');
  const tables = {} as Record<Table, Row[]>;
  const [meta, ...rows] = await Promise.all([
    all<{ id: string; value: string }>(tx.objectStore('meta')),
    ...TABLES.map((t) => all<Row>(tx.objectStore(t))),
  ]);
  TABLES.forEach((t, i) => (tables[t] = rows[i]));
  return { tables, meta: Object.fromEntries(meta.map((m) => [m.id, m.value])) };
}

export async function saveChanges(changes: Changes): Promise<void> {
  const database = await db();
  const tx = database.transaction([...TABLES, 'meta'], 'readwrite');
  for (const t of TABLES) {
    const store = tx.objectStore(t);
    for (const row of changes.put[t] ?? []) store.put(row);
    for (const id of changes.remove[t] ?? []) store.delete(id);
  }
  for (const [id, value] of Object.entries(changes.meta ?? {})) tx.objectStore('meta').put({ id, value });
  await done(tx);
}
