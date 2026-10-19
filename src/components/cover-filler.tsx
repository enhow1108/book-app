import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { findGoogleCover, GOOGLE_BOOKS_KEY } from '@/data/isbn';
import { useStore } from '@/data/store';
import { Spacing } from '@/constants/theme';

/** Books asked about at once; Google Books allows a few requests per second. */
const PARALLEL = 4;

/** Looks up covers on Google Books for library books that have an ISBN but no cover. */
export function CoverFiller() {
  const { library, updateBook } = useStore();
  const [progress, setProgress] = useState<{ done: number; found: number; total: number; quota?: boolean }>();
  const running = useRef(false);
  const missing = library.filter((b) => b.isbn && !b.coverUrl && !b.coverCheckedAt);

  if (!GOOGLE_BOOKS_KEY || (missing.length === 0 && !progress)) return null;

  async function onStart() {
    if (running.current) return;
    running.current = true;
    const queue = [...missing];
    const state = { done: 0, found: 0, total: queue.length, quota: false };
    setProgress({ ...state });
    const worker = async () => {
      while (queue.length && !state.quota) {
        const book = queue.shift()!;
        try {
          const cover = await findGoogleCover(book.isbn!);
          if (cover === 'quota') {
            state.quota = true;
            break;
          }
          if (cover) {
            updateBook(book.id, { coverUrl: cover });
            state.found++;
          } else updateBook(book.id, { coverCheckedAt: new Date().toISOString() });
        } catch {
          // Offline or a network hiccup: leave the book to try again next time.
        }
        state.done++;
        setProgress({ ...state });
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    setProgress({ ...state });
    running.current = false;
  }

  const busy = progress && !progress.quota && progress.done < progress.total;
  return (
    <View style={styles.box}>
      <ThemedText type="small" themeColor="textSecondary">
        {progress
          ? `已查 ${progress.done} / ${progress.total} 本，找到 ${progress.found} 張封面。` +
            (progress.quota ? '今天 Google 的查詢次數用完了，明天再按一次會接著查。' : '')
          : `有 ${missing.length} 本書有 ISBN 但還沒有封面，可以到 Google Books 找找看。`}
      </ThemedText>
      {!busy ? <Button title="找封面" onPress={onStart} disabled={missing.length === 0} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: Spacing.two, alignItems: 'flex-start' },
});
