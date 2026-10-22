import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookCover } from '@/components/book-cover';
import { confirmDestructive } from '@/components/dialogs';
import { LogEditor } from '@/components/log-editor';
import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { pickCoverPhoto } from '@/data/cover-photo';
import { newestFirst, readCount, toDayKey } from '@/data/dates';
import { languageLabel } from '@/data/language';
import { modeLabel, READING_MODES, STATUSES } from '@/data/status';
import { useStore } from '@/data/store';
import type { ReadingMode } from '@/data/types';

const HISTORY_ROWS = 10;
const WEEKDAYS = '日一二三四五六';

/** 2026-10-19 → 10/19, or with the year and weekday when the list may span years. */
function shortDate(day: string, full = false) {
  const d = new Date(`${day}T00:00:00`);
  const md = `${d.getMonth() + 1}/${d.getDate()}`;
  return full ? `${d.getFullYear()}/${md}（${WEEKDAYS[d.getDay()]}）` : md;
}

/** Full-screen page for one book: its cover, reading status, read counts and removal. */
export function BookDetail({ bookId, onClose }: { bookId: string; onClose: () => void }) {
  const { activeChild, children, books, logs, allLogs, state, updateBook, removeBook, changeReadsToday } = useStore();
  const [mode, setMode] = useState<ReadingMode>('self');
  const [showAll, setShowAll] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string>();
  const book = books.find((b) => b.id === bookId);
  if (!book) return null;

  const bookLogs = logs.filter((l) => l.bookId === book.id);
  const today = readCount(bookLogs.filter((l) => l.date === toDayKey(new Date())));
  const total = readCount(bookLogs);
  const byMode = READING_MODES.map((m) => ({
    ...m,
    count: readCount(bookLogs.filter((l) => l.mode === m.value)),
  })).filter((m) => m.count > 0);
  const status = book.shelved ? (book.status ?? 'reading') : undefined;
  // The shelf is shared, so show how every child has got on with this book.
  const familyLogs = allLogs.filter((l) => l.bookId === book.id).sort((a, b) => newestFirst(a.date, b.date));
  const nameOf = new Map(children.map((c) => [c.id, c.name]));
  const family = children.map((c) => {
    const own = familyLogs.filter((l) => l.childId === c.id);
    return { id: c.id, name: c.name, reads: readCount(own), last: own[0]?.date };
  });
  const shownLogs = showAll ? familyLogs : familyLogs.slice(0, HISTORY_ROWS);
  const siblingsHaveIt = state.shelf.some((e) => e.bookId === book.id && e.childId !== activeChild?.id);

  async function onPhoto(from: 'camera' | 'library') {
    const photo = await pickCoverPhoto(from);
    if (photo) updateBook(bookId, { coverUrl: photo });
  }

  function onRemove() {
    if (!book) return;
    const detail = siblingsHaveIt
      ? `${activeChild?.name ?? ''}這本書的閱讀紀錄會刪除，書仍留在全家書架上。`
      : '這本書的閱讀紀錄也會一起刪除。';
    confirmDestructive(`移除「${book.title}」？`, detail, '移除', () => {
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
              <BookCover key={book.coverUrl ?? ''} book={book} width={140} />
              <View style={styles.row}>
                <Button title="拍封面" onPress={() => onPhoto('camera')} />
                <Button title="換照片" onPress={() => onPhoto('library')} />
              </View>
              <ThemedText type="subtitle" style={styles.title}>
                {book.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {[book.author, languageLabel(book.language)].filter(Boolean).join(' · ')}
              </ThemedText>
              {family.length > 1
                ? family.map((f) => (
                    <ThemedText key={f.id} type="small" themeColor="textSecondary">
                      {f.reads ? `${f.name}讀過 ${f.reads} 次，最近一次 ${shortDate(f.last!)}` : `${f.name}還沒讀`}
                    </ThemedText>
                  ))
                : null}
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
              <ThemedText type="smallBold">
                今天讀了 {today} 次 · 一共 {total} 次
              </ThemedText>
              {byMode.length ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {byMode.map((m) => `${m.label} ${m.count} 次`).join(' · ')}
                </ThemedText>
              ) : null}
              <View style={styles.row}>
                {READING_MODES.map((m) => (
                  <Button key={m.value} title={m.label} selected={mode === m.value} onPress={() => setMode(m.value)} />
                ))}
              </View>
              <View style={styles.row}>
                {today > 0 ? <Button title="−" onPress={() => changeReadsToday(book.id, -1, mode)} /> : null}
                <Button title="+1 次" onPress={() => changeReadsToday(book.id, 1, mode)} />
              </View>
            </ThemedView>

            {familyLogs.length ? (
              <ThemedView type="backgroundElement" style={[styles.card, styles.history]}>
                <ThemedText type="smallBold">閱讀紀錄</ThemedText>
                {shownLogs.map((l) => (
                  <Pressable key={l.id} style={styles.historyRow} onPress={() => setEditingLogId(l.id)}>
                    <ThemedText type="small" style={styles.historyDate}>
                      {shortDate(l.date, true)}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.grow}>
                      {[nameOf.get(l.childId), modeLabel(l.mode), `${l.times ?? 1} 次`, l.note]
                        .filter(Boolean)
                        .join(' · ')}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      修改
                    </ThemedText>
                  </Pressable>
                ))}
                {familyLogs.length > HISTORY_ROWS ? (
                  <Button
                    title={showAll ? '收起' : `顯示全部 ${familyLogs.length} 筆`}
                    onPress={() => setShowAll(!showAll)}
                  />
                ) : null}
              </ThemedView>
            ) : null}

            {book.shelved ? (
              <View style={styles.row}>
                <Button title="移除這本書" onPress={onRemove} />
              </View>
            ) : null}
            {editingLogId && familyLogs.some((l) => l.id === editingLogId) ? (
              <LogEditor
                key={editingLogId}
                log={familyLogs.find((l) => l.id === editingLogId)!}
                onClose={() => setEditingLogId(undefined)}
              />
            ) : null}
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
  history: { alignItems: 'stretch' },
  historyRow: { flexDirection: 'row', gap: Spacing.two },
  historyDate: { minWidth: 120 },
  grow: { flex: 1 },
});
