import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookCover } from '@/components/book-cover';
import { ChildSwitcher } from '@/components/child-switcher';
import { Button, Field } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { booksThisMonth, currentStreak, readCount, recentBooks, toDayKey } from '@/data/dates';
import { bookStats } from '@/data/history';
import { modeLabel, READING_MODES } from '@/data/status';
import { useStore } from '@/data/store';
import { useChildTint } from '@/hooks/use-child-tint';
import type { ReadingMode } from '@/data/types';

export default function CheckinScreen() {
  const tint = useChildTint();
  const { activeChild, children, books, logs, allLogs, addLog, changeReadsToday } = useStore();
  const [bookId, setBookId] = useState<string>();
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<ReadingMode>('self');
  const [note, setNote] = useState('');

  // The picked book may belong to another child after switching profiles.
  const canSave = books.some((b) => b.id === bookId) && note.trim().length > 0;
  const today = toDayKey(new Date());
  const query = search.trim().toLowerCase();
  // Ordered by the whole family's reading, so a book a sibling read today is right at the top to add.
  const ordered = useMemo(() => recentBooks(books, allLogs), [books, allLogs]);
  const matching = ordered.filter(
    (b) => !query || b.title.toLowerCase().includes(query) || b.author.toLowerCase().includes(query),
  );
  // Only the most recent few, since an imported library can hold thousands of books.
  const recent = matching.slice(0, query ? 20 : 10);
  const noteChoices = matching.slice(0, 12);
  const picked = books.find((b) => b.id === bookId);
  if (picked && !noteChoices.includes(picked)) noteChoices.unshift(picked);
  const totals = useMemo(() => bookStats(logs), [logs]);
  const todays = useMemo(() => bookStats(logs.filter((l) => l.date === today)), [logs, today]);
  const readsOf = (id: string, day?: string) => (day ? todays : totals).get(id)?.times ?? 0;
  const siblingsToday = useMemo(() => {
    const names = new Map(children.filter((c) => c.id !== activeChild?.id).map((c) => [c.id, c.name]));
    const byBook = new Map<string, Map<string, number>>();
    for (const l of allLogs) {
      const name = l.date === today ? names.get(l.childId) : undefined;
      if (!name) continue;
      const counts = byBook.get(l.bookId) ?? new Map<string, number>();
      counts.set(name, (counts.get(name) ?? 0) + (l.times ?? 1));
      byBook.set(l.bookId, counts);
    }
    return byBook;
  }, [allLogs, children, activeChild?.id, today]);
  const siblingsLine = (id: string) =>
    [...(siblingsToday.get(id) ?? [])].map(([name, times]) => `${name}今天 ${times} 次`).join(' · ');
  const titles = useMemo(() => new Map(books.map((b) => [b.id, b.title])), [books]);
  const titleOf = (id: string) => titles.get(id) ?? '已移除的書';

  function onSave() {
    if (!bookId) return;
    addLog({ bookId, times: 1, mode, note: note.trim(), date: toDayKey(new Date()) });
    setNote('');
  }

  return (
    <ThemedView style={[styles.container, tint && { backgroundColor: tint }]}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="subtitle">今日打卡</ThemedText>
          <ChildSwitcher />

          <View style={styles.stats}>
            <Stat label="連續天數" value={currentStreak(logs)} />
            <Stat label="本月讀了" value={booksThisMonth(logs)} unit="本" />
            <Stat label="累計" value={readCount(logs)} unit="次" />
          </View>

          {books.length > 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">今天怎麼讀？</ThemedText>
              <View style={styles.chips}>
                {READING_MODES.map((m) => (
                  <Button key={m.value} title={m.label} selected={mode === m.value} onPress={() => setMode(m.value)} />
                ))}
              </View>
            </ThemedView>
          ) : null}

          {books.length > 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">全家最近讀的書</ThemedText>
              {books.length > 5 ? <Field placeholder="找書名或作者" value={search} onChangeText={setSearch} /> : null}
              {recent.map((book) => {
                const todayReads = readsOf(book.id, today);
                const allReads = readsOf(book.id);
                return (
                  <View key={book.id} style={styles.recentRow}>
                    <BookCover book={book} width={40} />
                    <View style={styles.grow}>
                      <ThemedText type="smallBold" numberOfLines={2}>
                        {book.title}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {allReads ? `今天 ${todayReads} 次 · 共 ${allReads} 次` : '還沒讀過'}
                      </ThemedText>
                      {siblingsLine(book.id) ? (
                        <ThemedText type="small" themeColor="textSecondary">
                          {siblingsLine(book.id)}
                        </ThemedText>
                      ) : null}
                    </View>
                    {todayReads > 0 ? <Button title="−" onPress={() => changeReadsToday(book.id, -1, mode)} /> : null}
                    <Button title={`${modeLabel(mode)} +1`} onPress={() => changeReadsToday(book.id, 1, mode)} />
                  </View>
                );
              })}
              {recent.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  找不到符合的書。
                </ThemedText>
              ) : null}
            </ThemedView>
          ) : null}

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">寫一句心得</ThemedText>
            {books.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                先到「書架」加一本書。
              </ThemedText>
            ) : (
              <View style={styles.chips}>
                {noteChoices.map((b) => (
                  <Button key={b.id} title={b.title} selected={b.id === bookId} onPress={() => setBookId(b.id)} />
                ))}
              </View>
            )}
            <Field placeholder="今天讀完的心得" value={note} onChangeText={setNote} />
            <Button title="打卡" onPress={onSave} disabled={!canSave} />
          </ThemedView>

          {logs.slice(0, 20).map((log) => (
            <ThemedView key={log.id} type="backgroundElement" style={styles.logRow}>
              <ThemedText type="smallBold">{titleOf(log.bookId)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {[log.date, modeLabel(log.mode), `${log.times ?? 1} 次`, log.note ?? ''].filter(Boolean).join(' · ')}
              </ThemedText>
            </ThemedView>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Stat({ label, value, unit = '天' }: { label: string; value: number; unit?: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.stat}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="subtitle">{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {unit}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  stats: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1, alignItems: 'center', padding: Spacing.three, borderRadius: Spacing.three },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  grow: { flex: 1, minWidth: 0 },
  logRow: { padding: Spacing.three, borderRadius: Spacing.three },
});
