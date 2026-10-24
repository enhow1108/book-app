import { isbnKey, titleKey } from './library';
import type { NewBook } from './store';

/** One barcode in a pile of books scanned in a row, and what its lookup found. */
export type ScanItem = {
  code: string;
  /** looking: lookup running; known: on the family shelf already; found: looked up; missing: needs a title typed in. */
  status: 'looking' | 'known' | 'found' | 'missing';
  book: NewBook;
};

/** Adds a scanned or typed barcode to the top of the list, unless it is already in it. */
export function addScan(items: ScanItem[], raw: string): ScanItem[] {
  const code = isbnKey(raw);
  if (!code || items.some((i) => i.code === code)) return items;
  return [{ code, status: 'looking', book: { title: '', author: '', language: 'zh', isbn: code } }, ...items];
}

/** The books ready to add: each with a title, the same book (by barcode or title) only once. */
export function readyBooks(items: ScanItem[]): NewBook[] {
  const seen = new Set<string>();
  const out: NewBook[] = [];
  // The list shows the newest scan first; add them in the order they were scanned.
  for (const { status, book } of [...items].reverse()) {
    const title = book.title.trim();
    if (status === 'looking' || !title) continue;
    const key = `t:${titleKey(title)}`;
    const isbn = book.isbn ? `i:${book.isbn}` : undefined;
    if (seen.has(key) || (isbn && seen.has(isbn))) continue;
    seen.add(key);
    if (isbn) seen.add(isbn);
    out.push({ ...book, title, author: book.author.trim() });
  }
  return out;
}
