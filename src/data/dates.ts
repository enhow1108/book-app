import type { ReadingLog } from './types';

export function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Consecutive days with at least one log, ending today (or yesterday, so a streak survives until bedtime). */
export function currentStreak(logs: ReadingLog[], today = new Date()): number {
  const days = new Set(logs.map((l) => l.date));
  const cursor = new Date(today);
  if (!days.has(toDayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(toDayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function booksThisMonth(logs: ReadingLog[], today = new Date()): number {
  const prefix = toDayKey(today).slice(0, 7);
  return new Set(logs.filter((l) => l.date.startsWith(prefix)).map((l) => l.bookId)).size;
}

export function readCount(logs: ReadingLog[]): number {
  return logs.reduce((sum, l) => sum + (l.times ?? 1), 0);
}

/**
 * Orders ISO dates and day keys newest first. Plain comparison, since localeCompare is many times slower
 * and these sorts run over thousands of books and logs.
 */
export const newestFirst = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);

/** Books ordered by when they were last read, most recent first; never-read books go last, newest added first. */
export function recentBooks<B extends { id: string; addedAt: string }>(books: B[], logs: ReadingLog[]): B[] {
  const lastRead = new Map<string, string>();
  for (const l of logs) if ((lastRead.get(l.bookId) ?? '') < l.date) lastRead.set(l.bookId, l.date);
  // One sort key per book, worked out once rather than in each of the tens of thousands of comparisons.
  const keyed = books.map((book) => ({ book, key: `${lastRead.get(book.id) ?? ''}\u0000${book.addedAt}` }));
  return keyed.sort((a, b) => newestFirst(a.key, b.key)).map((k) => k.book);
}
