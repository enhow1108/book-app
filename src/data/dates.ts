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
