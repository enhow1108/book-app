import * as SQLite from 'expo-sqlite';

import { TABLES, type Changes, type Row, type Saved, type Table } from './database-types';

// Each record is kept as a JSON document keyed by id; the app loads everything at startup and filters in memory.
// Cover photos are JPEG data URIs inside the book's document, so they live in the database too.
let opened: Promise<SQLite.SQLiteDatabase> | undefined;

function db() {
  opened ??= (async () => {
    const database = await SQLite.openDatabaseAsync('book-app.db');
    await database.execAsync(
      [
        'PRAGMA journal_mode = WAL;',
        'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);',
        ...TABLES.map((t) => `CREATE TABLE IF NOT EXISTS ${t} (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL);`),
      ].join('\n')
    );
    return database;
  })();
  return opened;
}

export async function loadSaved(): Promise<Saved> {
  const database = await db();
  const tables = {} as Record<Table, Row[]>;
  for (const t of TABLES) {
    const rows = await database.getAllAsync<{ data: string }>(`SELECT data FROM ${t}`);
    tables[t] = rows.map((r) => JSON.parse(r.data));
  }
  const metaRows = await database.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM meta');
  return { tables, meta: Object.fromEntries(metaRows.map((r) => [r.key, r.value])) };
}

export async function saveChanges(changes: Changes): Promise<void> {
  const database = await db();
  await database.withTransactionAsync(async () => {
    for (const t of TABLES) {
      const put = changes.put[t] ?? [];
      const remove = changes.remove[t] ?? [];
      if (put.length) {
        const statement = await database.prepareAsync(`INSERT OR REPLACE INTO ${t} (id, data) VALUES (?, ?)`);
        try {
          for (const row of put) await statement.executeAsync(row.id, JSON.stringify(row));
        } finally {
          await statement.finalizeAsync();
        }
      }
      if (remove.length) {
        const statement = await database.prepareAsync(`DELETE FROM ${t} WHERE id = ?`);
        try {
          for (const id of remove) await statement.executeAsync(id);
        } finally {
          await statement.finalizeAsync();
        }
      }
    }
    for (const [key, value] of Object.entries(changes.meta ?? {})) {
      await database.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, value);
    }
  });
}
