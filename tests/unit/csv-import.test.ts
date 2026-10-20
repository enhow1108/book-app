import { parseCsv, toCsv } from '@/data/csv';
import { exportCsv, planImport, type ImportPlan } from '@/data/importer';
import type { State } from '@/data/library';

import { book, child, fixture, reads, state } from './helpers';

/** What the store's applyImport does, minus React. */
function applied(s: State, plan: ImportPlan): State {
  const updated = new Map(plan.updatedBooks.map((b) => [b.id, b]));
  return {
    ...s,
    children: [...s.children, ...plan.children],
    activeChildId: s.activeChildId ?? plan.children[0]?.id,
    books: [...plan.books, ...s.books.map((b) => updated.get(b.id) ?? b)],
    shelf: [...plan.shelf, ...s.shelf],
    logs: [...plan.logs, ...s.logs],
    imports: [plan.record, ...s.imports],
  };
}

describe('CSV', () => {
  test('quoted cells keep commas, quotes and line breaks, and survive a round trip', () => {
    const rows = [
      ['書名', '備註'],
      ['Frog, Toad', 'said "hi"\nthen slept'],
    ];
    const text = toCsv(rows);
    expect(text.startsWith('﻿')).toBe(true);
    expect(parseCsv(text)).toEqual(rows);
  });

  test('blank lines are skipped, CRLF and a final line without a newline work', () => {
    expect(parseCsv('a,b\r\n\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('planImport', () => {
  test('the sample file: children, books, joint reads, modes and notes', () => {
    const plan = planImport([fixture('sample-import.csv')], state());
    expect(plan.problems).toEqual([]);
    expect(plan.children.map((c) => c.name).sort()).toEqual(['小明', '小美']);
    expect(plan.books).toHaveLength(4);
    // 小明+小美 is one row but a read for each child.
    expect(plan.summary.reads).toBe(6);
    expect(plan.summary.perChild).toEqual(
      expect.arrayContaining([
        { name: '小美', reads: 4 },
        { name: '小明', reads: 2 },
      ]),
    );
    const frog = plan.books.find((b) => b.title === 'Frog and Toad, Together')!;
    expect(frog).toMatchObject({ author: 'Arnold Lobel', level: '2,4', publishedAt: '1972-03', language: 'en' });
    const frogLog = plan.logs.find((l) => l.bookId === frog.id)!;
    expect(frogLog).toMatchObject({ times: 2, mode: 'together', date: '2026-10-15' });
    expect(plan.logs.find((l) => l.note === '說了"晚安"三次')).toBeDefined();
    expect(plan.shelf.every((e) => e.status === 'done')).toBe(true);
    expect(plan.summary.firstDate).toBe('2026-10-13');
    expect(plan.summary.lastDate).toBe('2026-10-15');
  });

  test("小花生's export: its column names, 出版社/出版年月 split, repeated rows add up", () => {
    const plan = planImport([fixture('xiaohuasheng-export.csv')], state());
    expect(plan.problems).toEqual([]);
    expect(plan.books).toHaveLength(3);
    expect(plan.summary.reads).toBe(8);
    const ducks = plan.books.find((b) => b.title === 'Ten Little Ducks')!;
    expect(ducks).toMatchObject({ isbn: '9780000000017', publisher: 'Test Books', publishedAt: '1995-12', level: '2,5' });
    expect(plan.books.find((b) => b.title === '小熊去散步')).toMatchObject({
      language: 'zh',
      publisher: '九童測試',
      publishedAt: '2005-05-05',
    });
    expect(plan.logs.filter((l) => l.bookId === ducks.id).map((l) => l.times).sort()).toEqual([2, 3]);
  });

  test('importing the same file twice adds nothing the second time', () => {
    const file = fixture('sample-import.csv');
    const once = applied(state(), planImport([file], state()));
    const again = planImport([file], once);
    expect(again.logs).toEqual([]);
    expect(again.books).toEqual([]);
    expect(again.children).toEqual([]);
    expect(again.summary.duplicateReads).toBe(6);
  });

  test('a read in two files (each child’s export) counts once', () => {
    const file = fixture('sample-import.csv');
    const plan = planImport([file, { ...file, name: 'copy.csv' }], state());
    expect(plan.summary.reads).toBe(6);
  });

  test('matches books already in the app and fills in missing details instead of adding them', () => {
    const s = state({
      children: [child('k1', '小明')],
      activeChildId: 'k1',
      books: [book('moon', '月亮 晚安', { language: 'zh' })],
    });
    const plan = planImport([fixture('sample-import.csv')], s);
    expect(plan.books.find((b) => b.title === '月亮晚安')).toBeUndefined();
    expect(plan.updatedBooks).toEqual([expect.objectContaining({ id: 'moon', isbn: '9789570000001' })]);
    expect(plan.summary.filledIsbn).toBe(1);
    expect(plan.children.map((c) => c.name)).toEqual(['小美']);
  });

  test('bad rows are reported and skipped; a summary table is explained', () => {
    const plan = planImport(
      [{ name: 'bad.csv', text: 'date,child,title,times\nyesterday,小明,A,1\n2026-01-01,小明,,1\n2026-01-01,小明,B,zero\n2026-01-01,小明,C,1' }],
      state(),
    );
    expect(plan.problems.map((p) => p.line)).toEqual([2, 3, 4]);
    expect(plan.summary.reads).toBe(1);

    const summary = planImport([{ name: 'totals.csv', text: '書名,次數\nA,3' }], state());
    expect(summary.problems[0].message).toContain('彙總表');
    expect(summary.logs).toEqual([]);
  });

  test('without a child column the active child is used', () => {
    const s = state({ children: [child('k1', '小明')], activeChildId: 'k1' });
    const plan = planImport([{ name: 'x.csv', text: 'date,title\n2026-01-01,A' }], s);
    expect(plan.logs).toEqual([expect.objectContaining({ childId: 'k1' })]);
  });
});

describe('exportCsv', () => {
  test('an export imports back into an empty app with the same reads, and into the same app as nothing new', () => {
    const original = applied(state(), planImport([fixture('sample-import.csv')], state()));
    const csv = exportCsv(original);

    const fresh = planImport([{ name: 'export.csv', text: csv }], state());
    expect(fresh.problems).toEqual([]);
    expect(reads(fresh.logs)).toBe(reads(original.logs));
    expect(fresh.books.map((b) => b.title).sort()).toEqual(original.books.map((b) => b.title).sort());
    expect(new Set(fresh.logs.map((l) => l.mode))).toEqual(new Set(original.logs.map((l) => l.mode)));

    expect(planImport([{ name: 'export.csv', text: csv }], original).logs).toEqual([]);
  });
});
