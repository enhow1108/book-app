export type BookLanguage = 'zh' | 'en' | 'ja';

/** Where a book is in the child's reading; books saved before statuses existed count as reading. */
export type BookStatus = 'want' | 'reading' | 'done';

/** Who did the reading. */
export type ReadingMode = 'self' | 'mom' | 'together';

/** A child profile under the parent's account. Kept minimal on purpose: no photos, no birthdays. */
export type Child = {
  id: string;
  name: string;
  age?: number;
  /** One of AVATARS. */
  avatar: string;
  /** Key of the page colour picked for this child, one of CHILD_COLORS; unset means one by their order. */
  color?: string;
};

/** A book in the family library, shared by all children. */
export type LibraryBook = {
  id: string;
  title: string;
  author: string;
  language: BookLanguage;
  isbn?: string;
  /** A web address, or a cover photo stored as a JPEG data URI. */
  coverUrl?: string;
  publisher?: string;
  /** YYYY, YYYY-MM or YYYY-MM-DD. */
  publishedAt?: string;
  /** A reading level from another app, such as 小花生's 花生級別, kept as written. */
  level?: string;
  /** When Google Books was last asked for a cover and had none, so it isn't asked again every time. */
  coverCheckedAt?: string;
  addedAt: string;
  /** Set when the book came from an import, so undoing the import can remove it. */
  importId?: string;
};

/** A book on one child's bookshelf. */
export type ShelfEntry = {
  /** `${childId}:${bookId}` */
  id: string;
  childId: string;
  bookId: string;
  status?: BookStatus;
  addedAt: string;
  importId?: string;
};

/** A library book as it sits on the active child's shelf. */
/** A family book as seen by one child; `shelved` is false for a book only a sibling has read so far. */
export type Book = LibraryBook & { childId: string; status?: BookStatus; shelved?: boolean };

export type ReadingLog = {
  id: string;
  childId: string;
  bookId: string;
  /** How many times the book was read; older logs without it count as once. */
  times?: number;
  mode?: ReadingMode;
  /** No longer recorded; kept so older logs still load. */
  minutes?: number;
  note?: string;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  importId?: string;
};

/** One run of the importer, kept so it can be undone. */
export type ImportRecord = {
  id: string;
  at: string;
  fileNames: string[];
  books: number;
  logs: number;
};
