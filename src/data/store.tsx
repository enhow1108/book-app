import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { migrateV1, type State } from './children';
import { toDayKey } from './dates';
import type { Book, Child, ReadingLog } from './types';

const STORAGE_KEY = 'book-app/state/v2';
const STORAGE_KEY_V1 = 'book-app/state/v1';

type Store = {
  loaded: boolean;
  children: Child[];
  activeChild?: Child;
  /** Books and logs of the active child only. */
  books: Book[];
  logs: ReadingLog[];
  addChild: (child: Omit<Child, 'id'>) => void;
  updateChild: (id: string, patch: Partial<Omit<Child, 'id'>>) => void;
  removeChild: (id: string) => void;
  setActiveChild: (id: string) => void;
  addBook: (book: Omit<Book, 'id' | 'addedAt' | 'childId'>) => void;
  removeBook: (id: string) => void;
  addLog: (log: Omit<ReadingLog, 'id' | 'childId'>) => void;
  /** Adds (or with -1 removes) one read of a book today for the active child. */
  changeReadsToday: (bookId: string, delta: 1 | -1) => void;
};

const StoreContext = createContext<Store | null>(null);

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function loadState(): Promise<State | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);
  const rawV1 = await AsyncStorage.getItem(STORAGE_KEY_V1);
  return rawV1 ? migrateV1(JSON.parse(rawV1), newId()) : null;
}

/** Keeps child profiles, bookshelves and reading logs on the device. Cloud sync (Supabase) comes later. */
export function StoreProvider({ children: content }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ children: [], books: [], logs: [] });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadState()
      .then((s) => s && setState(s))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, loaded]);

  const activeChild = state.children.find((c) => c.id === state.activeChildId);
  const activeId = activeChild?.id;

  const store: Store = {
    loaded,
    children: state.children,
    activeChild,
    books: state.books.filter((b) => b.childId === activeId),
    logs: state.logs.filter((l) => l.childId === activeId),
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
        return {
          children,
          activeChildId: s.activeChildId === id ? children[0]?.id : s.activeChildId,
          books: s.books.filter((b) => b.childId !== id),
          logs: s.logs.filter((l) => l.childId !== id),
        };
      }),
    setActiveChild: (id) => setState((s) => ({ ...s, activeChildId: id })),
    addBook: (book) =>
      setState((s) =>
        s.activeChildId
          ? {
              ...s,
              books: [
                { ...book, id: newId(), childId: s.activeChildId, addedAt: new Date().toISOString() },
                ...s.books,
              ],
            }
          : s
      ),
    removeBook: (id) =>
      setState((s) => ({
        ...s,
        books: s.books.filter((b) => b.id !== id),
        logs: s.logs.filter((l) => l.bookId !== id),
      })),
    addLog: (log) =>
      setState((s) =>
        s.activeChildId ? { ...s, logs: [{ ...log, id: newId(), childId: s.activeChildId }, ...s.logs] } : s
      ),
    changeReadsToday: (bookId, delta) =>
      setState((s) => {
        const childId = s.activeChildId;
        if (!childId) return s;
        const date = toDayKey(new Date());
        // Quick reads for a book on a given day share one log without minutes or a note.
        const quick = s.logs.find(
          (l) => l.childId === childId && l.bookId === bookId && l.date === date && !l.minutes && !l.note
        );
        if (!quick) {
          if (delta < 0) return s;
          return { ...s, logs: [{ id: newId(), childId, bookId, date, times: 1 }, ...s.logs] };
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
  };

  return <StoreContext.Provider value={store}>{content}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
