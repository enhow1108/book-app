export type BookLanguage = 'zh' | 'en';

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
  addedAt: string;
};

export type ReadingLog = {
  id: string;
  childId: string;
  bookId: string;
  minutes: number;
  note?: string;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
};
