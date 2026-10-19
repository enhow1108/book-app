import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookCover } from '@/components/book-cover';
import { confirmDestructive } from '@/components/dialogs';
import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { readCount, toDayKey } from '@/data/dates';
import { STATUSES } from '@/data/status';
import { useStore } from '@/data/store';

/** Full-screen page for one book: its cover, reading status, read counts and removal. */
export function BookDetail({ bookId, onClose }: { bookId: string; onClose: () => void }) {
  const { books, logs, updateBook, removeBook, changeReadsToday } = useStore();
  const book = books.find((b) => b.id === bookId);
  if (!book) return null;

  const bookLogs = logs.filter((l) => l.bookId === book.id);
  const today = readCount(bookLogs.filter((l) => l.date === toDayKey(new Date())));
  const total = readCount(bookLogs);
  const status = book.status ?? 'reading';

  function onRemove() {
    if (!book) return;
    confirmDestructive(`移除「${book.title}」？`, '這本書的閱讀紀錄也會一起刪除。', '移除', () => {
      onClose();
      removeBook(book.id);
    });
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.top}>
              <Button title="關閉" onPress={onClose} />
            </View>
            <View style={styles.center}>
              <BookCover book={book} width={140} />
              <ThemedText type="subtitle" style={styles.title}>
                {book.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {[book.author, book.language === 'zh' ? '中文' : 'English'].filter(Boolean).join(' · ')}
              </ThemedText>
            </View>

            <View style={styles.row}>
              {STATUSES.map((s) => (
                <Button
                  key={s.value}
                  title={s.label}
                  selected={status === s.value}
                  onPress={() => updateBook(book.id, { status: s.value })}
                />
              ))}
            </View>

            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">今天讀了 {today} 次 · 一共 {total} 次</ThemedText>
              <View style={styles.row}>
                {today > 0 ? <Button title="−" onPress={() => changeReadsToday(book.id, -1)} /> : null}
                <Button title="+1 次" onPress={() => changeReadsToday(book.id, 1)} />
              </View>
            </ThemedView>

            <View style={styles.row}>
              <Button title="移除這本書" onPress={onRemove} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
  top: { flexDirection: 'row', justifyContent: 'flex-end' },
  center: { alignItems: 'center', gap: Spacing.two },
  title: { textAlign: 'center' },
  row: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'center', flexWrap: 'wrap' },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two, alignItems: 'center' },
});
