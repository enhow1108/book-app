/** Search text with case, spaces, punctuation and full-width letters ignored, so "projectx" finds "Project X:". */
export function searchKey(text: string) {
  return text.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

// One collator for the whole sort: much faster than localeCompare on thousands of titles.
const titles = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** A to Z by title, numbers in order (Level 2 before Level 10), so a series sits together. */
export const byTitle = (a: { title: string }, b: { title: string }) => titles.compare(a.title, b.title);
