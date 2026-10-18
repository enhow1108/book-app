export type BookLanguage = 'zh' | 'en';

export type Book = {
  id: string;
  title: string;
  author: string;
  language: BookLanguage;
  isbn?: string;
  coverUrl?: string;
  addedAt: string;
};

/** A child profile under the parent. Kept minimal on purpose: no photos, only a birth year. */
export type Child = {
  id: string;
  name: string;
  birthYear: number;
  avatar: string;
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

export const AVATARS = ['🐻', '🐰', '🦊', '🐼', '🐯', '🐨', '🐸', '🦁'];
