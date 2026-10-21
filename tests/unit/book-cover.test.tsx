import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { BookCover, coverSources } from '@/components/book-cover';
import { recentBooks } from '@/data/dates';

import { book, log } from './helpers';

const PHOTO = 'data:image/jpeg;base64,AAAA';
const shownCover = () => screen.getByTestId('cover-image').props.source[0].uri as string;

test('the title shows right away, with the cover image laid over it', async () => {
  await render(<BookCover book={{ title: '小熊找朋友', coverUrl: PHOTO }} />);
  expect(screen.getByText('小熊找朋友')).toBeTruthy();
  expect(shownCover()).toBe(PHOTO);
});

test('Taiwanese books are not looked up on Open Library', () => {
  expect(coverSources({ isbn: '978-957-000-000-1' })).toEqual([]);
  expect(coverSources({ isbn: '9789860000001' })).toEqual([]);
  expect(coverSources({ isbn: '9780000000017' })).toEqual([
    'https://covers.openlibrary.org/b/isbn/9780000000017-M.jpg?default=false',
  ]);
});

test('a cover that failed to load is not fetched again, and a photo added later still shows', async () => {
  const isbn = '9780000000024';
  const page = await render(<BookCover book={{ title: 'Frog', isbn }} />);
  expect(shownCover()).toContain(isbn);
  await act(async () => fireEvent(screen.getByTestId('cover-image'), 'error', { nativeEvent: { error: '404' } }));
  expect(screen.queryByTestId('cover-image')).toBeNull();
  expect(coverSources({ isbn })).toEqual([]);

  await page.rerender(<BookCover book={{ title: 'Frog', isbn, coverUrl: PHOTO }} />);
  expect(shownCover()).toBe(PHOTO);
});

test('recently read books come first, then the newest added', () => {
  const books = [
    book('old', 'Old', { addedAt: '2024-01-01T00:00:00Z' }),
    book('new', 'New', { addedAt: '2026-01-01T00:00:00Z' }),
    book('read', 'Read', { addedAt: '2023-01-01T00:00:00Z' }),
    book('readLater', 'Read later', { addedAt: '2023-01-01T00:00:00Z' }),
  ];
  const logs = [log('k1', 'read', '2026-10-01'), log('k1', 'readLater', '2026-10-05'), log('k1', 'read', '2026-09-01')];
  expect(recentBooks(books, logs).map((b) => b.id)).toEqual(['readLater', 'read', 'new', 'old']);
});
