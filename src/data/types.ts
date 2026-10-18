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

export type ReadingLog = {
  id: string;
  bookId: string;
  minutes: number;
  note?: string;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
};
