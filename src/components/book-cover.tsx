import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { Book } from '@/data/types';

const COLORS = ['#E8846B', '#5B9BD5', '#6BBF8A', '#C98BD9', '#E5B84B', '#4FB3B3', '#D96B8F', '#8A8FD9'];

// Taiwan's ISBN prefixes. Open Library has next to no covers for Taiwanese books, and asking it for each of
// thousands of imported books kept the shelf waiting on slow requests that end in "not found".
const TAIWAN_ISBN = /^(978957|978986|978626|957|986)/;

const MISSES_KEY = 'book-app/cover-misses/v1';
/** Cover addresses that had no image, remembered across visits so they aren't fetched again. */
const misses = loadMisses();

function loadMisses(): Set<string> {
  try {
    return new Set(JSON.parse(globalThis.localStorage?.getItem(MISSES_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function rememberMiss(url: string) {
  // Cover photos are data URIs, so only web addresses are worth remembering; offline, a miss means nothing.
  if (!url.startsWith('http') || globalThis.navigator?.onLine === false) return;
  misses.add(url);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      globalThis.localStorage?.setItem(MISSES_KEY, JSON.stringify([...misses]));
    } catch {
      // Storage full or blocked: the misses are still remembered until the page is closed.
    }
  }, 1000);
}

export function coverSources(book: Pick<Book, 'coverUrl' | 'isbn'>): string[] {
  const sources = book.coverUrl ? [book.coverUrl] : [];
  const isbn = book.isbn?.replace(/[^0-9X]/gi, '');
  // Open Library has covers for many books Google Books lacks; default=false makes it 404 instead of a blank image.
  if (isbn && !TAIWAN_ISBN.test(isbn)) sources.push(`https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`);
  return sources.filter((url) => !misses.has(url));
}

function colorFor(title: string) {
  let hash = 0;
  for (const ch of title) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

/** A book's cover, falling back to a colored cover with the title when no image can be found. */
export function BookCover({ book, width = 48 }: { book: Pick<Book, 'title' | 'coverUrl' | 'isbn'>; width?: number }) {
  const [, setMisses] = useState(0);
  const size = { width, height: Math.round(width * 1.45) };
  const source = coverSources(book)[0];

  // The colored cover is drawn first and the image laid over it once it loads,
  // so the shelf is never blank while covers are on their way.
  return (
    <View style={[styles.cover, styles.placeholder, size, { backgroundColor: colorFor(book.title) }]}>
      {/* Tiny covers (e.g. in the calendar) only fit the title's first character. */}
      <Text style={[styles.title, { fontSize: width < 32 ? width * 0.55 : Math.max(10, width / 5) }]} numberOfLines={4}>
        {width < 32 ? Array.from(book.title)[0] : book.title}
      </Text>
      {source ? (
        <Image
          key={source}
          testID="cover-image"
          source={source}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          onError={() => {
            rememberMiss(source);
            setMisses((n) => n + 1);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { borderRadius: Spacing.one },
  placeholder: { padding: Spacing.one, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  title: { color: 'white', fontWeight: '700', textAlign: 'center' },
});
