import { newestFirst } from './dates';
import type { State } from './library';

/** Marks a file as this app's full backup, so a random JSON file isn't taken for one. */
const FORMAT = 'xiaoshuchong-backup';
const VERSION = 1;

type Backup = {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  data: Omit<State, 'activeChildId'>;
};

const LISTS = ['children', 'books', 'shelf', 'logs', 'imports'] as const;

/** Everything the app keeps, including cover photos, shelf statuses and avatars, as one JSON file. */
export function backupJson(state: State): string {
  const { activeChildId: _active, ...data } = state;
  const backup: Backup = { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), data };
  return JSON.stringify(backup);
}

export type RestorePlan = {
  exportedAt: string;
  /** The rows that aren't in the app yet, per list. */
  added: Record<(typeof LISTS)[number], number>;
  apply: (s: State) => State;
};

/**
 * Reads a backup file. Restoring only adds back what the app doesn't have (by record id):
 * nothing already in the app is changed or deleted, so a backup can't undo newer reading.
 */
export function planRestore(text: string, state: State): RestorePlan {
  let backup: Backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error('這不是小書蟲的備份檔。');
  }
  if (backup?.format !== FORMAT || !backup.data) throw new Error('這不是小書蟲的備份檔。');
  if (backup.version > VERSION) throw new Error('這個備份檔是新版 App 做的，請先更新 App。');
  for (const list of LISTS) {
    if (!Array.isArray(backup.data[list]) || backup.data[list].some((r) => typeof r?.id !== 'string')) {
      throw new Error('備份檔內容不完整。');
    }
  }
  const missing = <T extends { id: string }>(have: T[], incoming: T[]) => {
    const ids = new Set(have.map((r) => r.id));
    return incoming.filter((r) => !ids.has(r.id));
  };
  const add = {
    children: missing(state.children, backup.data.children),
    books: missing(state.books, backup.data.books),
    shelf: missing(state.shelf, backup.data.shelf),
    logs: missing(state.logs, backup.data.logs),
    imports: missing(state.imports, backup.data.imports),
  };
  return {
    exportedAt: backup.exportedAt,
    added: {
      children: add.children.length,
      books: add.books.length,
      shelf: add.shelf.length,
      logs: add.logs.length,
      imports: add.imports.length,
    },
    // Rows are looked up again against the state at the time of applying, in case it changed since the preview.
    apply: (s) => {
      const children = [...s.children, ...missing(s.children, add.children)];
      return {
        ...s,
        children,
        activeChildId: s.activeChildId ?? children[0]?.id,
        books: [...missing(s.books, add.books), ...s.books],
        shelf: [...missing(s.shelf, add.shelf), ...s.shelf],
        logs: [...missing(s.logs, add.logs), ...s.logs].sort((a, b) => newestFirst(a.date, b.date)),
        imports: [...missing(s.imports, add.imports), ...s.imports].sort((a, b) => newestFirst(a.at, b.at)),
      };
    },
  };
}
