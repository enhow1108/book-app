import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import type { Book, ReadingLog } from './types';

const STORAGE_KEY = 'book-app/state/v1';

type State = { books: Book[]; logs: ReadingLog[] };

type Store = State & {
  loaded: boolean;
  addBook: (book: Omit<Book, 'id' | 'addedAt'>) => void;
  removeBook: (id: string) => void;
  addLog: (log: Omit<ReadingLog, 'id'>) => void;
};

const StoreContext = createContext<Store | null>(null);

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Keeps the bookshelf and reading logs on the device. Cloud sync (Supabase) comes later. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ books: [], logs: [] });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => raw && setState(JSON.parse(raw)))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, loaded]);

  const store: Store = {
    ...state,
    loaded,
    addBook: (book) =>
      setState((s) => ({
        ...s,
        books: [{ ...book, id: newId(), addedAt: new Date().toISOString() }, ...s.books],
      })),
    removeBook: (id) =>
      setState((s) => ({
        books: s.books.filter((b) => b.id !== id),
        logs: s.logs.filter((l) => l.bookId !== id),
      })),
    addLog: (log) => setState((s) => ({ ...s, logs: [{ ...log, id: newId() }, ...s.logs] })),
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
