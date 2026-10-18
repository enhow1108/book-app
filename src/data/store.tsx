import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { migrateV1, type State } from './children';
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
  };

  return <StoreContext.Provider value={store}>{content}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
