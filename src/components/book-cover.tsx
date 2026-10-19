import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { Book } from '@/data/types';

const COLORS = ['#E8846B', '#5B9BD5', '#6BBF8A', '#C98BD9', '#E5B84B', '#4FB3B3', '#D96B8F', '#8A8FD9'];

function coverSources(book: Pick<Book, 'coverUrl' | 'isbn'>): string[] {
  const sources = book.coverUrl ? [book.coverUrl] : [];
  // Open Library has covers for many books Google Books lacks; default=false makes it 404 instead of a blank image.
  if (book.isbn) sources.push(`https://covers.openlibrary.org/b/isbn/${book.isbn}-M.jpg?default=false`);
  return sources;
}

function colorFor(title: string) {
  let hash = 0;
  for (const ch of title) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

/** A book's cover, falling back to a colored cover with the title when no image can be found. */
export function BookCover({ book, width = 48 }: { book: Pick<Book, 'title' | 'coverUrl' | 'isbn'>; width?: number }) {
  const sources = coverSources(book);
  const [failed, setFailed] = useState(0);
  const size = { width, height: Math.round(width * 1.45) };
  const source = sources[failed];

  if (source) {
    return (
      <Image
        source={source}
        style={[styles.cover, size]}
        contentFit="cover"
        onError={() => setFailed((n) => n + 1)}
      />
    );
  }
  return (
    <View style={[styles.cover, styles.placeholder, size, { backgroundColor: colorFor(book.title) }]}>
      {/* Tiny covers (e.g. in the calendar) only fit the title's first character. */}
      <Text style={[styles.title, { fontSize: width < 32 ? width * 0.55 : Math.max(10, width / 5) }]} numberOfLines={4}>
        {width < 32 ? Array.from(book.title)[0] : book.title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { borderRadius: Spacing.one },
  placeholder: { padding: Spacing.one, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  title: { color: 'white', fontWeight: '700', textAlign: 'center' },
});
