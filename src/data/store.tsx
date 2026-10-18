import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { AVATARS, type Book, type Child, type ReadingLog } from './types';

const STORAGE_KEY = 'book-app/state/v2';
const LEGACY_STORAGE_KEY = 'book-app/state/v1';

type State = { books: Book[]; children: Child[]; activeChildId?: string; logs: ReadingLog[] };

type Store = State & {
  loaded: boolean;
  activeChild?: Child;
  addBook: (book: Omit<Book, 'id' | 'addedAt'>) => void;
  removeBook: (id: string) => void;
  addChild: (child: Omit<Child, 'id'>) => void;
  removeChild: (id: string) => void;
  setActiveChild: (id: string) => void;
  /** Logs for the active child; does nothing when no child is selected. */
  addLog: (log: Omit<ReadingLog, 'id' | 'childId'>) => void;
};

const StoreContext = createContext<Store | null>(null);

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** v1 had no children; its logs move to a placeholder child the parent can rename. */
function migrateV1(raw: string): State {
  const v1: { books: Book[]; logs: Omit<ReadingLog, 'childId'>[] } = JSON.parse(raw);
  if (v1.logs.length === 0) return { books: v1.books, children: [], logs: [] };
  const child: Child = { id: newId(), name: '孩子', birthYear: new Date().getFullYear() - 6, avatar: AVATARS[0] };
  return {
    books: v1.books,
    children: [child],
    activeChildId: child.id,
    logs: v1.logs.map((l) => ({ ...l, childId: child.id })),
  };
}

async function loadState(): Promise<State | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);
  const legacy = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  return legacy ? migrateV1(legacy) : null;
}

/** Keeps the bookshelf, child profiles and reading logs on the device. Cloud sync (Supabase) comes later. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ books: [], children: [], logs: [] });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadState()
      .then((saved) => saved && setState(saved))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, loaded]);

  const store: Store = {
    ...state,
    loaded,
    activeChild: state.children.find((c) => c.id === state.activeChildId),
    addBook: (book) =>
      setState((s) => ({
        ...s,
        books: [{ ...book, id: newId(), addedAt: new Date().toISOString() }, ...s.books],
      })),
    removeBook: (id) =>
      setState((s) => ({
        ...s,
        books: s.books.filter((b) => b.id !== id),
        logs: s.logs.filter((l) => l.bookId !== id),
      })),
    addChild: (child) =>
      setState((s) => {
        const created = { ...child, id: newId() };
        return { ...s, children: [...s.children, created], activeChildId: s.activeChildId ?? created.id };
      }),
    removeChild: (id) =>
      setState((s) => {
        const remaining = s.children.filter((c) => c.id !== id);
        return {
          ...s,
          children: remaining,
          activeChildId: s.activeChildId === id ? remaining[0]?.id : s.activeChildId,
          logs: s.logs.filter((l) => l.childId !== id),
        };
      }),
    setActiveChild: (id) => setState((s) => ({ ...s, activeChildId: id })),
    addLog: (log) =>
      setState((s) =>
        s.activeChildId
          ? { ...s, logs: [{ ...log, id: newId(), childId: s.activeChildId }, ...s.logs] }
          : s
      ),
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
