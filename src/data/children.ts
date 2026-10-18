import type { Book, Child, ReadingLog } from './types';

/** Built-in avatars, so kids never need to upload a photo. */
export const AVATARS = ['🐛', '🦊', '🐼', '🐰', '🐯', '🐨', '🦄', '🐳', '🦖', '🐧'];

export type State = {
  children: Child[];
  activeChildId?: string;
  books: Book[];
  logs: ReadingLog[];
};

type StateV1 = { books: Omit<Book, 'childId'>[]; logs: Omit<ReadingLog, 'childId'>[] };

/** Moves a v1 (single-child) bookshelf onto a default child profile so nothing is lost. */
export function migrateV1(v1: StateV1, childId: string): State {
  if (v1.books.length === 0 && v1.logs.length === 0) return { children: [], books: [], logs: [] };
  return {
    children: [{ id: childId, name: '小書蟲', avatar: AVATARS[0] }],
    activeChildId: childId,
    books: v1.books.map((b) => ({ ...b, childId })),
    logs: v1.logs.map((l) => ({ ...l, childId })),
  };
}

/** Parses an age field; blank or nonsense means "not given". */
export function parseAge(raw: string): number | undefined {
  const age = Number.parseInt(raw, 10);
  return age > 0 && age < 19 ? age : undefined;
}
