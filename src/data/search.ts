/** Search text with case, spaces, punctuation and full-width letters ignored, so "projectx" finds "Project X:". */
export function searchKey(text: string) {
  return text.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

// One collator for the whole sort: much faster than localeCompare on thousands of titles.
const titles = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** A to Z by title, numbers in order (Level 2 before Level 10), so a series sits together. */
export const byTitle = (a: { title: string }, b: { title: string }) => titles.compare(a.title, b.title);

/** Books whose title or author contains the text, titles that start with it first; for picking a book as you type. */
export function matchBooks<B extends { title: string; author: string }>(books: B[], text: string, limit = 8): B[] {
  const key = searchKey(text);
  if (!key) return [];
  const starts: B[] = [];
  const contains: B[] = [];
  for (const b of books) {
    const title = searchKey(b.title);
    if (title.startsWith(key)) starts.push(b);
    else if (title.includes(key) || searchKey(b.author).includes(key)) contains.push(b);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
