import { allRows, diffStates, findSameBook, fromLegacy, isbnKey, titleKey } from '@/data/library';

import { book, child, log, shelved, state } from './helpers';

describe('matching books', () => {
  test('titles match across full-width forms, case, spaces and punctuation', () => {
    expect(titleKey('Frog and Toad, Together!')).toBe(titleKey('ｆｒｏｇ ａｎｄ toad together'));
    expect(titleKey('月亮，晚安')).toBe(titleKey('月亮 晚安'));
  });

  test('ISBNs ignore dashes and spaces', () => {
    expect(isbnKey('978-957-000 000-1')).toBe('9789570000001');
    expect(isbnKey('0-19-853453-x')).toBe('019853453X');
    expect(isbnKey('')).toBeUndefined();
  });

  test('the same ISBN wins over the title; otherwise the title matches, preferring a book without an ISBN', () => {
    const books = [
      book('a', 'Moon', { isbn: '111' }),
      book('b', 'Moon'),
      book('c', 'Other', { isbn: '222' }),
    ];
    expect(findSameBook(books, { title: 'Whatever', isbn: '222' })?.id).toBe('c');
    expect(findSameBook(books, { title: 'moon', isbn: '999' })?.id).toBe('b');
    expect(findSameBook(books, { title: 'Nope' })).toBeUndefined();
  });
});

describe('diffStates (what gets saved and synced)', () => {
  const before = state({
    children: [child('k1')],
    activeChildId: 'k1',
    books: [book('a', 'A'), book('b', 'B')],
    shelf: [shelved('k1', 'a')],
  });

  test('no change is no write', () => {
    expect(diffStates(before, before)).toBeNull();
    expect(diffStates(before, { ...before })).toBeNull();
  });

  test('changed records are put, missing ones removed, untouched ones skipped', () => {
    const after = {
      ...before,
      books: [{ ...before.books[0], title: 'A2' }, book('c', 'C')],
    };
    const changes = diffStates(before, after)!;
    expect(changes.put.books?.map((b) => b.id)).toEqual(['a', 'c']);
    expect(changes.remove.books).toEqual(['b']);
    expect(changes.put.shelf).toBeUndefined();
  });

  test('a new log among thousands is the only write, wherever it lands', () => {
    const logs = Array.from({ length: 5000 }, (_, i) => log('k1', 'a', `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, { id: `l${i}` }));
    const many = { ...before, logs };
    const added = log('k1', 'a', '2026-02-01', { id: 'new' });
    expect(diffStates(many, { ...many, logs: [added, ...logs] })).toEqual({ put: { logs: [added] }, remove: {} });
    expect(diffStates(many, { ...many, logs: [...logs, added] })).toEqual({ put: { logs: [added] }, remove: {} });
    const middle = [...logs.slice(0, 2500), added, ...logs.slice(2500)];
    expect(diffStates(many, { ...many, logs: middle })).toEqual({ put: { logs: [added] }, remove: {} });
  });

  test('a log changed or removed in the middle of a long list is found', () => {
    const logs = Array.from({ length: 1000 }, (_, i) => log('k1', 'a', '2026-01-01', { id: `l${i}` }));
    const many = { ...before, logs };
    const changed = { ...logs[400], times: 3 };
    const after = { ...many, logs: logs.map((l) => (l === logs[400] ? changed : l)).filter((l) => l.id !== 'l600') };
    expect(diffStates(many, after)).toEqual({ put: { logs: [changed] }, remove: { logs: ['l600'] } });
    // Re-sorted lists still diff correctly, just without the shortcut.
    expect(diffStates(many, { ...many, logs: [...logs].reverse() })).toBeNull();
  });

  test('switching child is saved as meta', () => {
    const after = { ...before, children: [...before.children, child('k2')], activeChildId: 'k2' };
    expect(diffStates(before, after)?.meta).toEqual({ activeChildId: 'k2' });
  });

  test('allRows writes everything and marks the move off the old storage', () => {
    const changes = allRows(before);
    expect(changes.put.books).toHaveLength(2);
    expect(changes.meta).toMatchObject({ migrated: '1', activeChildId: 'k1' });
  });
});

describe('fromLegacy (moving off the old one-file storage)', () => {
  test('empty v1 storage stays empty', () => {
    expect(fromLegacy({ books: [], logs: [] }).children).toEqual([]);
  });

  test('v1 data without children gets one child', () => {
    const s = fromLegacy({ books: [book('a', 'A')], logs: [{ id: 'l1', bookId: 'a', date: '2026-01-01' }] });
    expect(s.children).toHaveLength(1);
    expect(s.activeChildId).toBe(s.children[0].id);
    expect(s.logs[0].childId).toBe(s.children[0].id);
    expect(s.shelf).toHaveLength(1);
  });

  test('a book two children both had becomes one family book on both shelves', () => {
    const s = fromLegacy({
      children: [child('k1'), child('k2')],
      activeChildId: 'k1',
      books: [
        { ...book('a1', 'Moon'), childId: 'k1', status: 'done' },
        { ...book('a2', 'moon', { coverUrl: 'http://cover' }), childId: 'k2' },
      ],
      logs: [log('k2', 'a2', '2026-01-02')],
    });
    expect(s.books).toHaveLength(1);
    expect(s.books[0].coverUrl).toBe('http://cover');
    expect(s.shelf.map((e) => e.id).sort()).toEqual(['k1:a1', 'k2:a1']);
    expect(s.logs[0].bookId).toBe('a1');
  });
});
