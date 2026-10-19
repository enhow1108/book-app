import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Spacing } from '@/constants/theme';
import type { Book } from '@/data/types';

const PER_ROW = 3;
const GAP = Spacing.three;

/** Covers standing on wooden shelves, three to a shelf. */
export function WoodShelf({ books, onPress }: { books: Book[]; onPress: (book: Book) => void }) {
  const [width, setWidth] = useState(0);
  const coverWidth = Math.floor((width - GAP * (PER_ROW + 1)) / PER_ROW);
  const rows: Book[][] = [];
  for (let i = 0; i < books.length; i += PER_ROW) rows.push(books.slice(i, i + PER_ROW));

  return (
    <View style={styles.case} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 &&
        rows.map((row, i) => (
          <View key={i}>
            <View style={styles.row}>
              {row.map((book) => (
                <Pressable key={book.id} onPress={() => onPress(book)} style={styles.book}>
                  <BookCover book={book} width={coverWidth} />
                </Pressable>
              ))}
            </View>
            <View style={styles.plank} />
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  case: {
    backgroundColor: '#F3E3CC',
    borderRadius: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.three,
    borderWidth: 6,
    borderColor: '#A8703F',
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: GAP, paddingHorizontal: GAP - 6 },
  book: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 2, height: 2 },
    elevation: 3,
  },
  plank: {
    height: 12,
    backgroundColor: '#B98250',
    borderBottomWidth: 4,
    borderBottomColor: '#8A5A2E',
  },
});
