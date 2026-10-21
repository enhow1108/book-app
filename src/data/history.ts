import { newestFirst } from './dates';
import type { LibraryBook, ReadingLog } from './types';

export type Period = 'day' | 'week' | 'month' | 'year';

export const PERIODS: { value: Period; label: string }[] = [
  { value: 'day', label: '日' },
  { value: 'week', label: '週' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
];

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function parseDay(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Groups a day into its period: weeks run Monday to Sunday. */
function periodOf(day: string, period: Period): { key: string; label: string } {
  const [y, m] = day.split('-');
  if (period === 'year') return { key: y, label: `${y} 年` };
  if (period === 'month') return { key: `${y}-${m}`, label: `${y} 年 ${Number(m)} 月` };
  const date = parseDay(day);
  if (period === 'day') {
    return { key: day, label: `${y} 年 ${Number(m)} 月 ${date.getDate()} 日（${WEEKDAYS[date.getDay()]}）` };
  }
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const md = (d: Date) => `${d.getMonth() + 1}.${d.getDate()}`;
  return { key: `w${monday.getFullYear()}-${md(monday)}`, label: `${monday.getFullYear()} ${md(monday)}～${md(sunday)}` };
}

export type BookStats = { times: number; first: string; last: string };

/** Total reads and first and last reading day of each book. */
export function bookStats(logs: ReadingLog[]): Map<string, BookStats> {
  const stats = new Map<string, BookStats>();
  for (const l of logs) {
    const s = stats.get(l.bookId);
    const times = l.times ?? 1;
    if (!s) stats.set(l.bookId, { times, first: l.date, last: l.date });
    else {
      s.times += times;
      if (l.date < s.first) s.first = l.date;
      if (l.date > s.last) s.last = l.date;
    }
  }
  return stats;
}

export type HistoryGroup = {
  key: string;
  label: string;
  reads: number;
  /** Books read in the period, most read first. */
  books: { book: LibraryBook; times: number; isNew: boolean }[];
  newBooks: number;
};

/** Reading logs grouped by day, week, month or year, newest first. A book is new in the period of its first read. */
export function groupHistory(logs: ReadingLog[], library: LibraryBook[], period: Period): HistoryGroup[] {
  const byId = new Map(library.map((b) => [b.id, b]));
  const stats = bookStats(logs);
  const groups = new Map<string, { label: string; reads: number; times: Map<string, number>; first: string }>();
  for (const l of logs) {
    const { key, label } = periodOf(l.date, period);
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { label, reads: 0, times: new Map(), first: l.date }));
    if (l.date < g.first) g.first = l.date;
    const times = l.times ?? 1;
    g.reads += times;
    g.times.set(l.bookId, (g.times.get(l.bookId) ?? 0) + times);
  }
  return [...groups]
    .sort((a, b) => newestFirst(a[1].first, b[1].first))
    .map(([key, g]) => {
      const books = [...g.times]
        .flatMap(([id, times]) => {
          const book = byId.get(id);
          const first = stats.get(id)?.first ?? '';
          return book ? [{ book, times, isNew: periodOf(first, period).key === key }] : [];
        })
        .sort((a, b) => b.times - a.times || a.book.title.localeCompare(b.book.title));
      return { key, label: g.label, reads: g.reads, books, newBooks: books.filter((b) => b.isNew).length };
    });
}
