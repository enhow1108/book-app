import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { loadSaved, saveChanges } from './database';
import type { Changes } from './database-types';
import { toDayKey } from './dates';
import type { ImportPlan } from './importer';
import {
  allRows,
  diffStates,
  EMPTY_STATE,
  findSameBook,
  fromLegacy,
  newId,
  shelfId,
  type LegacyState,
  type State,
} from './library';
import type { Book, BookStatus, Child, ImportRecord, LibraryBook, ReadingLog, ReadingMode } from './types';

// Where everything was kept before the database: one JSON string per version.
const LEGACY_KEY = 'book-app/state/v2';
const LEGACY_KEY_V1 = 'book-app/state/v1';

type Store = {
  loaded: boolean;
  children: Child[];
  activeChild?: Child;
  /** The whole family's books, each with the active child's status; and the active child's logs. */
  books: Book[];
  logs: ReadingLog[];
  /** The whole family's library and logs, for the history page. */
  library: LibraryBook[];
  allLogs: ReadingLog[];
  imports: ImportRecord[];
  /** The full state, for planning an import against what is already saved. */
  state: State;
  addChild: (child: Omit<Child, 'id'>) => void;
  updateChild: (id: string, patch: Partial<Omit<Child, 'id'>>) => void;
  removeChild: (id: string) => void;
  setActiveChild: (id: string) => void;
  addBook: (book: Omit<Book, 'id' | 'addedAt' | 'childId'>) => void;
  updateBook: (id: string, patch: Partial<Omit<Book, 'id' | 'childId'>>) => void;
  /** Takes the book off the active child's shelf, with that child's logs of it. */
  removeBook: (id: string) => void;
  addLog: (log: Omit<ReadingLog, 'id' | 'childId'>) => void;
  /** Adds (or with -1 removes) one read of a book today, done in the given way, for the active child. */
  changeReadsToday: (bookId: string, delta: 1 | -1, mode: ReadingMode) => void;
  applyImport: (plan: ImportPlan) => void;
  undoImport: (id: string) => void;
};

const StoreContext = createContext<Store | null>(null);

async function loadLegacy(): Promise<State | null> {
  const raw = (await AsyncStorage.getItem(LEGACY_KEY)) ?? (await AsyncStorage.getItem(LEGACY_KEY_V1));
  return raw ? fromLegacy(JSON.parse(raw) as LegacyState) : null;
}

/** Loads the saved state, moving it out of the old storage the first time. The old copy is left in place. */
async function loadState(): Promise<{ state: State; firstSave?: Changes }> {
  const { tables, meta } = await loadSaved();
  if (meta.migrated !== '1') {
    const legacy = await loadLegacy();
    const state = legacy ?? EMPTY_STATE;
    return { state, firstSave: allRows(state) };
  }
  return {
    state: {
      children: tables.children as Child[],
      activeChildId: meta.activeChildId || undefined,
      books: tables.books as LibraryBook[],
      shelf: tables.shelf as State['shelf'],
      // Newest first, like the in-memory order new logs are added in.
      logs: (tables.logs as ReadingLog[]).sort((a, b) => b.date.localeCompare(a.date)),
      imports: (tables.imports as ImportRecord[]).sort((a, b) => b.at.localeCompare(a.at)),
    },
  };
}

/** Removes the given books from the family library if no shelf holds them any more. */
function dropUnshelved(s: State, bookIds: Iterable<string>): State {
  const used = new Set(s.shelf.map((e) => e.bookId));
  const drop = new Set([...bookIds].filter((id) => !used.has(id)));
  return drop.size ? { ...s, books: s.books.filter((b) => !drop.has(b.id)) } : s;
}

/** Puts a family book on a child's own shelf, e.g. the first time they read it. */
function onShelf(s: State, childId: string, bookId: string, status?: BookStatus): State {
  const id = shelfId(childId, bookId);
  if (s.shelf.some((e) => e.id === id)) return s;
  return { ...s, shelf: [{ id, childId, bookId, status, addedAt: new Date().toISOString() }, ...s.shelf] };
}

/** Keeps child profiles, the family library, bookshelves and reading logs in a database on the device. */
export function StoreProvider({ children: content }: { children: ReactNode }) {
  const [state, setState] = useState<State>(EMPTY_STATE);
  const [loaded, setLoaded] = useState(false);
  const saved = useRef<State>(EMPTY_STATE);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const enqueue = (changes: Changes) => {
    queue.current = queue.current.then(() => saveChanges(changes)).catch((e) => console.error('Saving failed', e));
  };

  useEffect(() => {
    loadState()
      .then(({ state: s, firstSave }) => {
        saved.current = s;
        setState(s);
        if (firstSave) enqueue(firstSave);
      })
      .catch((e) => console.error('Loading failed', e))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded || state === saved.current) return;
    const changes = diffStates(saved.current, state);
    saved.current = state;
    if (changes) enqueue(changes);
  }, [state, loaded]);

  const activeChild = state.children.find((c) => c.id === state.activeChildId);
  const activeId = activeChild?.id;

  // The bookshelf is shared: every child sees every family book, so a book scanned for one is ready for the others.
  const books = useMemo(() => {
    if (!activeId) return [];
    const entries = new Map(state.shelf.filter((e) => e.childId === activeId).map((e) => [e.bookId, e]));
    return state.books.map((book): Book => {
      const e = entries.get(book.id);
      return e
        ? { ...book, childId: activeId, status: e.status, addedAt: e.addedAt, shelved: true }
        : { ...book, childId: activeId, shelved: false };
    });
  }, [state.books, state.shelf, activeId]);
  const logs = useMemo(() => state.logs.filter((l) => l.childId === activeId), [state.logs, activeId]);

  const store: Store = {
    loaded,
    children: state.children,
    activeChild,
    books,
    logs,
    library: state.books,
    allLogs: state.logs,
    imports: state.imports,
    state,
    addChild: (child) =>
      setState((s) => {
        const id = newId();
        return { ...s, children: [...s.children, { ...child, id }], activeChildId: s.activeChildId ?? id };
      }),
    updateChild: (id, patch) =>
      setState((s) => ({ ...s, children: s.children.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
    removeChild: (id) =>
      setState((s) => {
        const children = s.children.filter((c) => c.id !== id);
        // The child's books stay on the family shelf for their siblings.
        return {
          ...s,
          children,
          activeChildId: s.activeChildId === id ? children[0]?.id : s.activeChildId,
          shelf: s.shelf.filter((e) => e.childId !== id),
          logs: s.logs.filter((l) => l.childId !== id),
        };
      }),
    setActiveChild: (id) => setState((s) => ({ ...s, activeChildId: id })),
    addBook: ({ status, ...book }) =>
      setState((s) => {
        const childId = s.activeChildId;
        if (!childId) return s;
        const addedAt = new Date().toISOString();
        // A book a sibling already has is shared rather than added twice.
        const same = findSameBook(s.books, book);
        const library: LibraryBook = same
          ? { ...same, coverUrl: same.coverUrl ?? book.coverUrl, author: same.author || book.author }
          : { ...book, id: newId(), addedAt };
        const id = shelfId(childId, library.id);
        if (s.shelf.some((e) => e.id === id)) return s;
        return {
          ...s,
          books: same ? s.books.map((b) => (b.id === same.id ? library : b)) : [library, ...s.books],
          shelf: [{ id, childId, bookId: library.id, status, addedAt }, ...s.shelf],
        };
      }),
    updateBook: (id, { status, addedAt: _addedAt, ...patch }) =>
      setState((s) => {
        const childId = s.activeChildId;
        const next = { ...s };
        if (Object.keys(patch).length) next.books = s.books.map((b) => (b.id === id ? { ...b, ...patch } : b));
        if (status && childId) {
          const shelved = onShelf(next, childId, id, status);
          next.shelf = shelved.shelf.map((e) => (e.id === shelfId(childId, id) ? { ...e, status } : e));
        }
        return next;
      }),
    removeBook: (id) =>
      setState((s) => {
        const childId = s.activeChildId;
        if (!childId) return s;
        return dropUnshelved(
          {
            ...s,
            shelf: s.shelf.filter((e) => e.id !== shelfId(childId, id)),
            logs: s.logs.filter((l) => !(l.bookId === id && l.childId === childId)),
          },
          [id],
        );
      }),
    addLog: (log) =>
      setState((s) =>
        s.activeChildId
          ? onShelf(
              { ...s, logs: [{ ...log, id: newId(), childId: s.activeChildId }, ...s.logs] },
              s.activeChildId,
              log.bookId,
            )
          : s,
      ),
    changeReadsToday: (bookId, delta, mode) =>
      setState((s) => {
        const childId = s.activeChildId;
        if (!childId) return s;
        const date = toDayKey(new Date());
        // Quick reads of a book on a given day, done the same way, share one log without a note.
        const quickToday = s.logs.filter(
          (l) =>
            l.childId === childId && l.bookId === bookId && l.date === date && !l.minutes && !l.note && !l.importId,
        );
        // Undoing falls back to any of today's quick reads, in case the mode was switched since.
        const quick = quickToday.find((l) => l.mode === mode) ?? (delta < 0 ? quickToday[0] : undefined);
        if (!quick) {
          if (delta < 0) return s;
          return onShelf(
            { ...s, logs: [{ id: newId(), childId, bookId, date, times: 1, mode }, ...s.logs] },
            childId,
            bookId,
          );
        }
        const times = (quick.times ?? 1) + delta;
        return {
          ...s,
          logs:
            times > 0
              ? s.logs.map((l) => (l.id === quick.id ? { ...l, times } : l))
              : s.logs.filter((l) => l.id !== quick.id),
        };
      }),
    applyImport: (plan) =>
      setState((s) => {
        const updated = new Map(plan.updatedBooks.map((b) => [b.id, b]));
        const shelfIds = new Set(s.shelf.map((e) => e.id));
        return {
          ...s,
          children: [...s.children, ...plan.children],
          activeChildId: s.activeChildId ?? plan.children[0]?.id,
          books: [...plan.books, ...s.books.map((b) => updated.get(b.id) ?? b)],
          shelf: [...plan.shelf.filter((e) => !shelfIds.has(e.id)), ...s.shelf],
          logs: [...plan.logs, ...s.logs].sort((a, b) => b.date.localeCompare(a.date)),
          // An import that only filled in book details has nothing to undo.
          imports: plan.logs.length || plan.books.length ? [plan.record, ...s.imports] : s.imports,
        };
      }),
    undoImport: (id) =>
      setState((s) => {
        const logs = s.logs.filter((l) => l.importId !== id);
        // Imported shelf entries stay if the child has since read the book in the app.
        const stillRead = new Set(logs.map((l) => shelfId(l.childId, l.bookId)));
        return dropUnshelved(
          {
            ...s,
            logs,
            shelf: s.shelf.filter((e) => e.importId !== id || stillRead.has(e.id)),
            imports: s.imports.filter((r) => r.id !== id),
          },
          s.books.filter((b) => b.importId === id).map((b) => b.id),
        );
      }),
  };

  return <StoreContext.Provider value={store}>{content}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
