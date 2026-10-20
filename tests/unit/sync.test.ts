import type { LibraryBook } from '@/data/types';
import type { Op } from '@/sync/cloud';
import { batches, merge } from '@/sync/sync-provider';

import { book, state } from './helpers';

// Keep Firebase out of unit tests; only the batch size limit is needed.
jest.mock('@/sync/cloud', () => ({ MAX_OP_BYTES: 400, cloudConfigured: false }));

describe('sending changes in batches', () => {
  const s = state({ books: Array.from({ length: 10 }, (_, i) => book(`b${i}`, `Book number ${i}`)) });

  test('each batch fits in one cloud document and nothing is lost', () => {
    const keys = s.books.map((b) => `books/${b.id}`);
    const out = batches(s, [...keys, 'logs/gone']);
    expect(out.length).toBeGreaterThan(1);
    for (const changes of out) expect(JSON.stringify(changes).length).toBeLessThan(400 + 200);
    expect(out.flatMap((c) => c.put.books ?? []).map((b) => b.id)).toEqual(s.books.map((b) => b.id));
    // A record that is no longer there is sent as a removal.
    expect(out.flatMap((c) => c.remove.logs ?? [])).toEqual(['gone']);
  });
});

describe('receiving changes', () => {
  const op = (id: string, changes: Op['changes']): Op => ({ id, at: id, device: 'other', changes });

  test('later batches win, and records with unsent local changes are left alone', () => {
    const ops = [
      op('1', { put: { books: [book('a', 'old'), book('b', 'B')] }, remove: {} }),
      op('2', { put: { books: [book('a', 'new')] }, remove: { logs: ['l1'] } }),
      op('3', { put: { books: [book('mine', 'theirs')] }, remove: {} }),
    ];
    const changes = merge(ops, new Map([['books/mine', 1]]))!;
    expect(changes.put.books?.map((b) => [b.id, (b as LibraryBook).title])).toEqual([
      ['a', 'new'],
      ['b', 'B'],
    ]);
    expect(changes.remove.logs).toEqual(['l1']);
  });

  test('a removal after a put removes', () => {
    const ops = [op('1', { put: { books: [book('a', 'A')] }, remove: {} }), op('2', { put: {}, remove: { books: ['a'] } })];
    expect(merge(ops, new Map())).toEqual({ put: {}, remove: { books: ['a'] } });
  });

  test('nothing new is nothing to apply', () => {
    expect(merge([op('1', { put: { books: [book('a', 'A')] }, remove: {} })], new Map([['books/a', 1]]))).toBeNull();
  });
});
