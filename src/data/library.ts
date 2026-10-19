import type { Changes, Row, Table } from './database-types';
import type { BookStatus, Child, ImportRecord, LibraryBook, ReadingLog, ShelfEntry } from './types';
import { AVATARS } from './children';

export type State = {
  children: Child[];
  activeChildId?: string;
  books: LibraryBook[];
  shelf: ShelfEntry[];
  logs: ReadingLog[];
  imports: ImportRecord[];
};

export const EMPTY_STATE: State = { children: [], books: [], shelf: [], logs: [], imports: [] };

export function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const shelfId = (childId: string, bookId: string) => `${childId}:${bookId}`;

/** Compares titles loosely: full-width and half-width forms, case, spaces and punctuation don't matter. */
export function titleKey(title: string): string {
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

export const isbnKey = (isbn?: string) => isbn?.replace(/[^0-9xX]/g, '').toUpperCase() || undefined;

/** Looks up books by ISBN and title; for matching thousands of imported books against the library. */
export function bookFinder(books: LibraryBook[]) {
  const byIsbn = new Map<string, LibraryBook>();
  const byTitle = new Map<string, LibraryBook[]>();
  const add = (b: LibraryBook) => {
    const isbn = isbnKey(b.isbn);
    if (isbn && !byIsbn.has(isbn)) byIsbn.set(isbn, b);
    const key = titleKey(b.title);
    byTitle.set(key, [...(byTitle.get(key) ?? []), b]);
  };
  books.forEach(add);
  /** The same book: same ISBN, or, when either has no ISBN, the same title. */
  const find = (book: { title: string; isbn?: string }): LibraryBook | undefined => {
    const isbn = isbnKey(book.isbn);
    const same = isbn ? byIsbn.get(isbn) : undefined;
    if (same) return same;
    const key = titleKey(book.title);
    return key ? byTitle.get(key)?.find((b) => !isbn || !b.isbn) : undefined;
  };
  return { find, add };
}

export const findSameBook = (books: LibraryBook[], book: { title: string; isbn?: string }) =>
  bookFinder(books).find(book);

const KEY_OF: Record<Table, keyof State> = {
  children: 'children',
  books: 'books',
  shelf: 'shelf',
  logs: 'logs',
  imports: 'imports',
};

/**
 * What changed between two states. Updates replace records rather than mutating them,
 * so a record whose object is unchanged needs no write.
 */
export function diffStates(before: State, after: State): Changes | null {
  const changes: Changes = { put: {}, remove: {} };
  let any = false;
  for (const table of Object.keys(KEY_OF) as Table[]) {
    const a = before[KEY_OF[table]] as Row[];
    const b = after[KEY_OF[table]] as Row[];
    if (a === b) continue;
    const old = new Map(a.map((r) => [r.id, r]));
    const put = b.filter((r) => old.get(r.id) !== r);
    const keep = new Set(b.map((r) => r.id));
    const remove = a.filter((r) => !keep.has(r.id)).map((r) => r.id);
    if (put.length) changes.put[table] = put;
    if (remove.length) changes.remove[table] = remove;
    any ||= put.length > 0 || remove.length > 0;
  }
  if (before.activeChildId !== after.activeChildId) {
    changes.meta = { activeChildId: after.activeChildId ?? '' };
    any = true;
  }
  return any ? changes : null;
}

/** Everything in a state as one set of writes, for the first save after moving off the old storage. */
export function allRows(state: State): Changes {
  return {
    put: { children: state.children, books: state.books, shelf: state.shelf, logs: state.logs, imports: state.imports },
    remove: {},
    meta: { activeChildId: state.activeChildId ?? '', migrated: '1' },
  };
}

type LegacyBook = Omit<LibraryBook, 'importId'> & { childId?: string; status?: BookStatus };
type LegacyLog = Omit<ReadingLog, 'childId' | 'importId'> & { childId?: string };
export type LegacyState = { children?: Child[]; activeChildId?: string; books: LegacyBook[]; logs: LegacyLog[] };

/**
 * Converts the old single-file storage (each child with their own copy of a book; v1 had no children at all)
 * into the shared family library. A book two children both had becomes one book on both shelves.
 */
export function fromLegacy(old: LegacyState): State {
  let children = old.children ?? [];
  let activeChildId = old.activeChildId;
  if (!old.children) {
    if (old.books.length === 0 && old.logs.length === 0) return EMPTY_STATE;
    const id = newId();
    children = [{ id, name: '小書蟲', avatar: AVATARS[0] }];
    activeChildId = id;
  }
  const fallbackChild = children[0]?.id ?? '';
  const books: LibraryBook[] = [];
  const shelf: ShelfEntry[] = [];
  const bookIdOf = new Map<string, string>();
  for (const { childId = fallbackChild, status, ...book } of old.books) {
    const same = findSameBook(books, book);
    const library = same ?? book;
    if (!same) books.push(library);
    else if (!same.coverUrl && book.coverUrl) Object.assign(same, { coverUrl: book.coverUrl });
    bookIdOf.set(book.id, library.id);
    const id = shelfId(childId, library.id);
    if (!shelf.some((s) => s.id === id)) shelf.push({ id, childId, bookId: library.id, status, addedAt: book.addedAt });
  }
  const logs = old.logs.map((l) => ({ ...l, childId: l.childId ?? fallbackChild, bookId: bookIdOf.get(l.bookId) ?? l.bookId }));
  return { children, activeChildId, books, shelf, logs, imports: [] };
}
