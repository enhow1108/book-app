import { backupJson, planRestore } from '@/data/backup';
import { currentStreak, readCount, recentBooks, toDayKey } from '@/data/dates';
import { bookStats, groupHistory } from '@/data/history';

import { book, child, log, shelved, state } from './helpers';

const full = state({
  children: [child('k1'), child('k2')],
  activeChildId: 'k2',
  books: [book('a', 'A', { coverUrl: 'data:image/jpeg;base64,xyz' }), book('b', 'B')],
  shelf: [shelved('k1', 'a', { status: 'done' }), shelved('k2', 'b', { status: 'want' })],
  logs: [log('k1', 'a', '2026-10-02', { times: 2, mode: 'mom' }), log('k1', 'a', '2026-10-01')],
  imports: [{ id: 'i1', at: '2026-10-01T00:00:00Z', fileNames: ['x.csv'], books: 1, logs: 1 }],
});

describe('full backup', () => {
  test('restoring into an empty app brings back everything, cover photos and statuses included', () => {
    const plan = planRestore(backupJson(full), state());
    expect(plan.added).toEqual({ children: 2, books: 2, shelf: 2, logs: 2, imports: 1 });
    const restored = plan.apply(state());
    const { activeChildId: _a, ...want } = full;
    const { activeChildId, ...got } = restored;
    expect(got).toEqual(want);
    expect(activeChildId).toBe('k1');
  });

  test('restoring only adds: nothing already in the app is changed or removed', () => {
    const newer = {
      ...full,
      books: [{ ...full.books[0], title: 'A renamed' }],
      logs: [log('k2', 'b', '2026-10-05')],
    };
    const plan = planRestore(backupJson(full), newer);
    expect(plan.added.books).toBe(1);
    const restored = plan.apply(newer);
    expect(restored.books.find((b) => b.id === 'a')?.title).toBe('A renamed');
    expect(restored.logs).toHaveLength(3);
    expect(restored.logs.map((l) => l.date)).toEqual(['2026-10-05', '2026-10-02', '2026-10-01']);
    // Restoring the same file again adds nothing.
    expect(Object.values(planRestore(backupJson(full), restored).added).every((n) => n === 0)).toBe(true);
  });

  test('other files are refused with a message', () => {
    expect(() => planRestore('not json', state())).toThrow('這不是小書蟲的備份檔');
    expect(() => planRestore('{"a":1}', state())).toThrow('這不是小書蟲的備份檔');
    const future = JSON.parse(backupJson(full));
    future.version = 99;
    expect(() => planRestore(JSON.stringify(future), state())).toThrow('新版');
    const broken = JSON.parse(backupJson(full));
    broken.data.logs = [{}];
    expect(() => planRestore(JSON.stringify(broken), state())).toThrow('不完整');
  });
});

describe('history and stats', () => {
  test('per-book reads with first and last day', () => {
    expect(bookStats(full.logs).get('a')).toEqual({ times: 3, first: '2026-10-01', last: '2026-10-02' });
    expect(readCount(full.logs)).toBe(3);
  });

  test('weeks run Monday to Sunday; a book is new in the period of its first read', () => {
    // 2026-10-18 is a Sunday, 2026-10-19 a Monday.
    const logs = [log('k1', 'a', '2026-10-12'), log('k1', 'a', '2026-10-18'), log('k1', 'b', '2026-10-19', { times: 2 })];
    const weeks = groupHistory(logs, full.books, 'week');
    expect(weeks.map((w) => [w.label, w.reads, w.newBooks])).toEqual([
      ['2026 10.19～10.25', 2, 1],
      ['2026 10.12～10.18', 2, 1],
    ]);
    const months = groupHistory(logs, full.books, 'month');
    expect(months).toHaveLength(1);
    expect(months[0].books.map((b) => [b.book.id, b.times])).toEqual([
      ['a', 2],
      ['b', 2],
    ]);
  });

  test('a streak survives until bedtime and breaks on a missed day', () => {
    const today = new Date(2026, 9, 20);
    const day = (d: number) => toDayKey(new Date(2026, 9, d));
    expect(currentStreak([log('k1', 'a', day(19)), log('k1', 'a', day(18))], today)).toBe(2);
    expect(currentStreak([log('k1', 'a', day(20)), log('k1', 'a', day(19))], today)).toBe(2);
    expect(currentStreak([log('k1', 'a', day(20)), log('k1', 'a', day(18))], today)).toBe(1);
    expect(currentStreak([log('k1', 'a', day(17))], today)).toBe(0);
  });

  test('recent books: last read first, then never-read ones newest added first', () => {
    const books = [
      book('old', 'Old', { addedAt: '2026-01-01' }),
      book('new', 'New', { addedAt: '2026-05-01' }),
      book('read', 'Read', { addedAt: '2025-01-01' }),
    ];
    expect(recentBooks(books, [log('k1', 'read', '2026-10-01')]).map((b) => b.id)).toEqual(['read', 'new', 'old']);
  });
});
