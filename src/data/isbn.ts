import type { BookLanguage } from './types';

export type IsbnResult = {
  title: string;
  author: string;
  language: BookLanguage;
  coverUrl?: string;
};

/** Looks up a book by ISBN on Google Books, falling back to Open Library. Returns null when neither knows it. */
export async function lookupIsbn(rawIsbn: string): Promise<IsbnResult | null> {
  const isbn = rawIsbn.replace(/[^0-9Xx]/g, '');
  if (!isbn) return null;
  return (await fromGoogleBooks(isbn)) ?? (await fromOpenLibrary(isbn));
}

async function fromGoogleBooks(isbn: string): Promise<IsbnResult | null> {
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const json = await res.json();
    const info = json.items?.[0]?.volumeInfo;
    if (!info?.title) return null;
    return {
      title: info.title,
      author: (info.authors ?? []).join('、'),
      language: info.language?.startsWith('zh') ? 'zh' : 'en',
      coverUrl: info.imageLinks?.thumbnail?.replace('http://', 'https://'),
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
