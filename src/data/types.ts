export type BookLanguage = 'zh' | 'en';

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
};

export type Book = {
  id: string;
  childId: string;
  title: string;
  author: string;
  language: BookLanguage;
  isbn?: string;
  coverUrl?: string;
  status?: BookStatus;
  addedAt: string;
};

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
};
