import { isIsbn13 } from './barcode';
import { fromLanguageCode, guessLanguage } from './language';
import { titleKey } from './library';
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

type GoogleVolume = { title?: string; imageLinks?: { thumbnail?: string } };

/**
 * Finds a cover on Google Books for a book that has none: by ISBN first, then by exact title, since
 * Google's ISBN search often finds nothing even for books it has. Returns null when Google has no cover,
 * and 'quota' when the daily limit is used up, so a batch can stop and try again another day.
 */
export async function findGoogleCover(book: { isbn?: string; title: string }): Promise<string | null | 'quota'> {
  const search = async (q: string): Promise<GoogleVolume[] | 'quota'> => {
    const key = GOOGLE_BOOKS_KEY ? `&key=${GOOGLE_BOOKS_KEY}` : '';
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5${key}`);
    if (res.status === 429 || res.status === 403) return 'quota';
    if (!res.ok) return [];
    const json = await res.json();
    return (json.items ?? []).map((i: { volumeInfo: GoogleVolume }) => i.volumeInfo);
  };
  if (book.isbn) {
    const found = await search(`isbn:${book.isbn}`);
    if (found === 'quota') return found;
    const cover = found.map(googleCover).find(Boolean);
    if (cover) return cover;
  }
  const found = await search(`intitle:${book.title}`);
  if (found === 'quota') return found;
  const same = found.find((v) => v.title && titleKey(v.title) === titleKey(book.title) && googleCover(v));
  return same ? googleCover(same)! : null;
}

/** Japanese ISBNs: 978-4 (and 10-digit ones starting with 4). */
const isJapanese = (isbn: string) => isbn.startsWith('9784') || (isbn.length === 10 && isbn.startsWith('4'));

/**
 * Looks up a book by ISBN on Google Books, then Open Library, then Taiwan's National Central Library;
 * Japanese ISBNs go to openBD first. Returns null when none of them knows it, and right away for
 * barcodes that are not ISBNs (such as Japanese magazine codes), which no book database lists.
 */
export async function lookupIsbn(rawIsbn: string): Promise<IsbnResult | null> {
  const isbn = rawIsbn.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (!isIsbn13(isbn) && !/^\d{9}[\dX]$/.test(isbn)) return null;
  if (isJapanese(isbn)) {
    const found = await fromOpenBd(isbn);
    if (found) return found;
  }
  return (await fromGoogleBooks(isbn)) ?? (await fromOpenLibrary(isbn)) ?? (await fromTaiwan(isbn));
}

/** "中川,李枝子 大村,百合子" or "なかがわりえこ／ぶん" into "中川李枝子、大村百合子". */
export const cleanOpenBdAuthor = (raw: string) =>
  raw
    .split(/\s+/)
    .map((name) => name.replace(/[／/].*$/, '').replace(/,/g, ''))
    .filter(Boolean)
    .join('、');

/** openBD: a free Japanese book database with good coverage of 978-4 ISBNs, often with covers. */
async function fromOpenBd(isbn: string): Promise<IsbnResult | null> {
  try {
    const res = await fetch(`https://api.openbd.jp/v1/get?isbn=${isbn}`);
    const json = await res.json();
    const info = json?.[0]?.summary;
    if (!info?.title) return null;
    return {
      title: info.title,
      author: cleanOpenBdAuthor(info.author ?? ''),
      language: 'ja',
      coverUrl: info.cover || undefined,
    };
  } catch {
    return null;
  }
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
      language: fromLanguageCode(info.language, info.title),
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
      language: guessLanguage(info.title),
      coverUrl: info.cover?.medium,
    };
  } catch {
    return null;
  }
}
