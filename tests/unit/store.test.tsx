import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { Changes, Row, Table } from '@/data/database-types';
import { planImport } from '@/data/importer';
import { planRestore, backupJson } from '@/data/backup';
import { toDayKey } from '@/data/dates';
import { StoreProvider, useStore } from '@/data/store';

import { book, child, fixture, reads, shelved, state } from './helpers';

// The device database, in memory: what the store loads at startup and every write it makes.
const mockDb = {
  tables: {} as Record<Table, Map<string, Row>>,
  meta: {} as Record<string, string>,
  writes: [] as Changes[],
};
jest.mock('@/data/database', () => ({
  loadSaved: async () => ({
    tables: Object.fromEntries(Object.entries(mockDb.tables).map(([t, rows]) => [t, [...rows.values()]])),
    meta: { ...mockDb.meta },
  }),
  saveChanges: async (changes: Changes) => {
    mockDb.writes.push(changes);
    for (const [t, rows] of Object.entries(changes.put)) for (const r of rows!) mockDb.tables[t as Table].set(r.id, r);
    for (const [t, ids] of Object.entries(changes.remove)) for (const id of ids!) mockDb.tables[t as Table].delete(id);
    Object.assign(mockDb.meta, changes.meta);
  },
}));

function resetDb(seed = state()) {
  mockDb.tables = {
    children: new Map(seed.children.map((r) => [r.id, r])),
    books: new Map(seed.books.map((r) => [r.id, r])),
    shelf: new Map(seed.shelf.map((r) => [r.id, r])),
    logs: new Map(seed.logs.map((r) => [r.id, r])),
    imports: new Map(seed.imports.map((r) => [r.id, r])),
  };
  mockDb.meta = { migrated: '1', activeChildId: seed.activeChildId ?? '' };
  mockDb.writes = [];
}

const wrapper = ({ children }: { children: ReactNode }) => <StoreProvider>{children}</StoreProvider>;

async function openStore(seed = state()) {
  resetDb(seed);
  const hook = await renderHook(() => useStore(), { wrapper });
  await waitFor(() => expect(hook.result.current.loaded).toBe(true));
  return hook;
}

/** Lets queued database writes finish. */
const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));

const twoKids = state({ children: [child('k1', '小明'), child('k2', '小美')], activeChildId: 'k1' });

test('a child added to an empty app becomes the active child and is saved', async () => {
  const { result } = await openStore();
  await act(() => result.current.addChild({ name: '小明', avatar: '🐛' }));
  expect(result.current.activeChild?.name).toBe('小明');
  await flush();
  expect([...mockDb.tables.children.values()]).toHaveLength(1);
  expect(mockDb.meta.activeChildId).toBe(result.current.activeChild?.id);
});

test('a book a sibling already has is shared, not added twice', async () => {
  const { result } = await openStore(twoKids);
  await act(() =>
    result.current.addBook({ title: 'Moon', author: '', language: 'en', isbn: '111', status: 'reading' }),
  );
  await act(() => result.current.setActiveChild('k2'));
  expect(result.current.books[0]).toMatchObject({ title: 'Moon', shelved: false });
  await act(() => result.current.addBook({ title: 'moon!', author: 'X', language: 'en', isbn: '111', status: 'want' }));
  expect(result.current.library).toHaveLength(1);
  expect(result.current.library[0].author).toBe('X');
  expect(result.current.state.shelf.map((e) => e.id).sort()).toEqual([
    `k1:${result.current.library[0].id}`,
    `k2:${result.current.library[0].id}`,
  ]);
});

test('+1 / −1 reads today share one log per reading mode', async () => {
  const seed = { ...twoKids, books: [book('a', 'A')] };
  const { result } = await openStore(seed);
  await act(() => result.current.changeReadsToday('a', 1, 'mom'));
  await act(() => result.current.changeReadsToday('a', 1, 'mom'));
  await act(() => result.current.changeReadsToday('a', 1, 'self'));
  expect(result.current.logs).toHaveLength(2);
  expect(reads(result.current.logs)).toBe(3);
  expect(result.current.logs.every((l) => l.date === toDayKey(new Date()))).toBe(true);
  // Reading puts the book on the child's shelf.
  expect(result.current.books[0].shelved).toBe(true);
  await act(() => result.current.changeReadsToday('a', -1, 'self'));
  await act(() => result.current.changeReadsToday('a', -1, 'self'));
  await act(() => result.current.changeReadsToday('a', -1, 'self'));
  expect(reads(result.current.logs)).toBe(0);
  await act(() => result.current.changeReadsToday('a', -1, 'mom'));
  expect(result.current.logs).toEqual([]);
});

test('a scanned book is checked in for the chosen child, joining the family shelf only once', async () => {
  const { result } = await openStore(twoKids);
  const scanned = { title: 'Moon', author: '', language: 'en' as const, isbn: '111' };
  await act(() => result.current.checkIn({ book: scanned, childId: 'k2', mode: 'mom', times: 3 }));
  expect(result.current.activeChild?.id).toBe('k2');
  expect(result.current.library).toHaveLength(1);
  expect(result.current.logs).toMatchObject([{ childId: 'k2', mode: 'mom', times: 3, date: toDayKey(new Date()) }]);
  expect(result.current.books[0].shelved).toBe(true);

  // The same book scanned again for the other child is read again, not added twice.
  await act(() => result.current.checkIn({ book: scanned, childId: 'k1', mode: 'self', times: 1 }));
  await act(() => result.current.checkIn({ book: scanned, childId: 'k1', mode: 'self', times: 2 }));
  expect(result.current.library).toHaveLength(1);
  expect(result.current.logs).toMatchObject([{ childId: 'k1', mode: 'self', times: 3 }]);
  expect(reads(result.current.allLogs)).toBe(6);
});

test('reads can be logged on a past day, then corrected or deleted', async () => {
  const seed = { ...twoKids, books: [book('a', 'A')] };
  const { result } = await openStore(seed);
  await act(() => result.current.changeReadsToday('a', 1, 'mom', '2026-10-01'));
  await act(() => result.current.changeReadsToday('a', 1, 'mom', '2026-10-01'));
  await act(() =>
    result.current.checkIn({ book: { title: 'B', author: '', language: 'zh' }, childId: 'k1', mode: 'self', times: 1, date: '2026-10-02' }),
  );
  expect(result.current.logs.map((l) => [l.date, l.times]).sort()).toEqual([
    ['2026-10-01', 2],
    ['2026-10-02', 1],
  ]);

  // Moving a read to the other child also puts the book on that child's shelf.
  const log = result.current.logs.find((l) => l.bookId === 'a')!;
  await act(() => result.current.updateLog(log.id, { childId: 'k2', mode: 'together', times: 3, date: '2026-09-30' }));
  expect(result.current.allLogs.find((l) => l.id === log.id)).toMatchObject({
    childId: 'k2',
    mode: 'together',
    times: 3,
    date: '2026-09-30',
  });
  expect(result.current.state.shelf.some((e) => e.id === 'k2:a')).toBe(true);
  // A count below one is refused rather than saved.
  await act(() => result.current.updateLog(log.id, { times: 0 }));
  expect(result.current.allLogs.find((l) => l.id === log.id)?.times).toBe(3);

  await act(() => result.current.removeLog(log.id));
  expect(result.current.allLogs.some((l) => l.id === log.id)).toBe(false);
  await flush();
  expect(mockDb.tables.logs.has(log.id)).toBe(false);
});

test('removing a book takes it off one shelf; the family keeps it while a sibling has it', async () => {
  const seed = {
    ...twoKids,
    books: [book('a', 'A'), book('b', 'B')],
    shelf: [shelved('k1', 'a'), shelved('k2', 'a'), shelved('k1', 'b')],
  };
  const { result } = await openStore(seed);
  await act(() => result.current.removeBook('a'));
  await act(() => result.current.removeBook('b'));
  expect(result.current.library.map((b) => b.id)).toEqual(['a']);
  expect(result.current.state.shelf.map((e) => e.id)).toEqual(['k2:a']);
  await flush();
  expect(mockDb.tables.books.has('b')).toBe(false);
});

test('an import can be undone, keeping books the child has read in the app since', async () => {
  const { result } = await openStore();
  await act(() => result.current.applyImport(planImport([fixture('sample-import.csv')], result.current.state)));
  expect(result.current.children).toHaveLength(2);
  expect(reads(result.current.allLogs)).toBe(6);
  const id = result.current.imports[0].id;

  const kid = result.current.children.find((c) => c.name === '小明')!;
  const moon = result.current.library.find((b) => b.title === '月亮晚安')!;
  await act(() => result.current.setActiveChild(kid.id));
  await act(() => result.current.changeReadsToday(moon.id, 1, 'self'));

  await act(() => result.current.undoImport(id));
  expect(result.current.imports).toEqual([]);
  expect(reads(result.current.allLogs)).toBe(1);
  expect(result.current.library.map((b) => b.title)).toEqual(['月亮晚安']);
  await flush();
  expect(mockDb.tables.logs.size).toBe(1);
  expect(mockDb.tables.books.size).toBe(1);
});

test('restoring a backup adds what is missing and is saved', async () => {
  const backup = backupJson({ ...twoKids, books: [book('a', 'A')], shelf: [shelved('k1', 'a')] });
  const { result } = await openStore();
  await act(() => result.current.restoreBackup(planRestore(backup, result.current.state)));
  expect(result.current.children).toHaveLength(2);
  await flush();
  expect(mockDb.tables.shelf.has('k1:a')).toBe(true);
});

test('saved data loads back after a restart', async () => {
  const first = await openStore(twoKids);
  await act(() => first.result.current.addBook({ title: 'Kept', author: '', language: 'zh' }));
  await flush();
  await first.unmount();
  const tables = mockDb.tables;
  const meta = mockDb.meta;
  const second = await renderHook(() => useStore(), { wrapper });
  mockDb.tables = tables;
  mockDb.meta = meta;
  await waitFor(() => expect(second.result.current.loaded).toBe(true));
  expect(second.result.current.books.map((b) => b.title)).toEqual(['Kept']);
});

describe('what cloud sync sees', () => {
  test('local changes are reported; changes that came from the cloud are not sent back', async () => {
    const { result } = await openStore(twoKids);
    const sent: Changes[] = [];
    await act(() => result.current.onLocalChanges((c) => sent.push(c)));

    await act(() => result.current.addBook({ title: 'Mine', author: '', language: 'en' }));
    expect(sent).toHaveLength(1);
    expect(sent[0].put.books?.[0]).toMatchObject({ title: 'Mine' });

    await act(() =>
      result.current.applyRemote({
        put: { books: [book('r', 'Theirs')], shelf: [shelved('k2', 'r')] },
        remove: { children: ['k1'] },
      }),
    );
    expect(result.current.library.map((b) => b.title).sort()).toEqual(['Mine', 'Theirs']);
    // The removed active child is replaced by the one left.
    expect(result.current.activeChild?.id).toBe('k2');
    expect(sent).toHaveLength(1);
    await flush();
    // ...but they are saved on the device.
    expect(mockDb.tables.books.has('r')).toBe(true);
    expect(mockDb.tables.children.has('k1')).toBe(false);
  });

  test('saving sync settings is kept but redraws nothing', async () => {
    const { result } = await openStore(twoKids);
    const before = result.current;
    await act(() => result.current.saveSyncMeta({ 'sync.outbox': '[]', 'sync.lastSeen': 'x' }));
    // The same store object: screens reading it don't redraw after every sync bookkeeping write.
    expect(result.current).toBe(before);
    expect(result.current.syncMeta['sync.lastSeen']).toBe('x');
    await flush();
    expect(mockDb.meta['sync.lastSeen']).toBe('x');
  });
});
