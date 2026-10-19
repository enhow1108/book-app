import type { BookLanguage } from './types';

export type IsbnResult = {
  title: string;
  author: string;
  language: BookLanguage;
  coverUrl?: string;
};

/** Our server (src/app/api/isbn+api.ts) that looks up Taiwanese books; unset until it is deployed. */
const ISBN_API_URL = process.env.EXPO_PUBLIC_ISBN_API_URL;

/** A Google Books API key. Without one, lookups share Google's anonymous daily quota, which often runs out. */
export const GOOGLE_BOOKS_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_KEY;

const googleBooksUrl = (isbn: string) =>
  `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}${GOOGLE_BOOKS_KEY ? `&key=${GOOGLE_BOOKS_KEY}` : ''}`;

const googleCover = (info: { imageLinks?: { thumbnail?: string } } | undefined) =>
  info?.imageLinks?.thumbnail?.replace('http://', 'https://').replace('&edge=curl', '');

/**
 * Finds a cover on Google Books for a book that has none. Returns null when Google has no cover,
 * and 'quota' when the daily limit is used up, so a batch can stop and try again another day.
 */
export async function findGoogleCover(isbn: string): Promise<string | null | 'quota'> {
  const res = await fetch(googleBooksUrl(isbn));
  if (res.status === 429 || res.status === 403) return 'quota';
  if (!res.ok) return null;
  const json = await res.json();
  return googleCover(json.items?.[0]?.volumeInfo) ?? null;
}

/**
 * Looks up a book by ISBN on Google Books, then Open Library, then Taiwan's National Central Library.
 * Returns null when none of them knows it.
 */
export async function lookupIsbn(rawIsbn: string): Promise<IsbnResult | null> {
  const isbn = rawIsbn.replace(/[^0-9Xx]/g, '');
  if (!isbn) return null;
  return (await fromGoogleBooks(isbn)) ?? (await fromOpenLibrary(isbn)) ?? (await fromTaiwan(isbn));
}

async function fromTaiwan(isbn: string): Promise<IsbnResult | null> {
  if (!ISBN_API_URL) return null;
  try {
    const res = await fetch(`${ISBN_API_URL}/api/isbn?isbn=${isbn}`);
    const book = await res.json();
    if (!book?.title) return null;
    return { title: book.title, author: book.author, language: 'zh' };
  } catch {
    return null;
  }
}

async function fromGoogleBooks(isbn: string): Promise<IsbnResult | null> {
  try {
    const res = await fetch(googleBooksUrl(isbn));
    const json = await res.json();
    const info = json.items?.[0]?.volumeInfo;
    if (!info?.title) return null;
    return {
      title: info.title,
      author: (info.authors ?? []).join('、'),
      language: info.language?.startsWith('zh') ? 'zh' : 'en',
      coverUrl: googleCover(info),
    };
  } catch {
    return null;
  }
}

async function fromOpenLibrary(isbn: string): Promise<IsbnResult | null> {
  try {
    const res = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
    );
    const json = await res.json();
    const info = json[`ISBN:${isbn}`];
    if (!info?.title) return null;
    return {
      title: info.title,
      author: (info.authors ?? []).map((a: { name: string }) => a.name).join('、'),
      language: /[一-鿿]/.test(info.title) ? 'zh' : 'en',
      coverUrl: info.cover?.medium,
    };
  } catch {
    return null;
  }
}
