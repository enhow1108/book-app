import { readFileSync } from 'fs';
import { join } from 'path';

import { EMPTY_STATE, type State } from '@/data/library';
import type { Child, LibraryBook, ReadingLog, ShelfEntry } from '@/data/types';

export const fixture = (name: string) => ({
  name,
  text: readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8'),
});

export const child = (id: string, name = id): Child => ({ id, name, avatar: '🐛' });

export const book = (id: string, title: string, extra: Partial<LibraryBook> = {}): LibraryBook => ({
  id,
  title,
  author: '',
  language: 'en',
  addedAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});

export const shelved = (childId: string, bookId: string, extra: Partial<ShelfEntry> = {}): ShelfEntry => ({
  id: `${childId}:${bookId}`,
  childId,
  bookId,
  addedAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});

let logSeq = 0;
export const log = (childId: string, bookId: string, date: string, extra: Partial<ReadingLog> = {}): ReadingLog => ({
  id: `log-${++logSeq}`,
  childId,
  bookId,
  date,
  ...extra,
});

export const state = (patch: Partial<State> = {}): State => ({ ...EMPTY_STATE, ...patch });

/** Total reads, counting `times`. */
export const reads = (logs: ReadingLog[]) => logs.reduce((n, l) => n + (l.times ?? 1), 0);
