import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookCover } from '@/components/book-cover';
import { ChildSwitcher } from '@/components/child-switcher';
import { Button, Field } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { booksThisMonth, currentStreak, readCount, recentBooks, toDayKey } from '@/data/dates';
import { useStore } from '@/data/store';

export default function CheckinScreen() {
  const { books, logs, addLog, changeReadsToday } = useStore();
  const [bookId, setBookId] = useState<string>();
  const [search, setSearch] = useState('');
  const [minutes, setMinutes] = useState('15');
  const [note, setNote] = useState('');

  const minutesValue = Number.parseInt(minutes, 10);
  // The picked book may belong to another child after switching profiles.
  const canSave = books.some((b) => b.id === bookId) && minutesValue > 0;
  const today = toDayKey(new Date());
  const query = search.trim().toLowerCase();
  const recent = recentBooks(books, logs).filter(
    (b) => !query || b.title.toLowerCase().includes(query) || b.author.toLowerCase().includes(query)
  );
  const readsOf = (id: string, day?: string) =>
    readCount(logs.filter((l) => l.bookId === id && (!day || l.date === day)));
  const titleOf = (id: string) => books.find((b) => b.id === id)?.title ?? '已移除的書';

  function onSave() {
    if (!bookId) return;
    addLog({ bookId, times: 1, minutes: minutesValue, note: note.trim() || undefined, date: toDayKey(new Date()) });
    setNote('');
  }

  return (
    <ThemedView style={styles.container}>
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
              <ThemedText type="smallBold">最近讀的書</ThemedText>
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
                    </View>
                    {todayReads > 0 ? <Button title="−" onPress={() => changeReadsToday(book.id, -1)} /> : null}
                    <Button title="+1 次" onPress={() => changeReadsToday(book.id, 1)} />
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
            <ThemedText type="smallBold">記錄閱讀時間和心得</ThemedText>
            {books.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                先到「書架」加一本書。
              </ThemedText>
            ) : (
              <View style={styles.chips}>
                {books.map((b) => (
                  <Button key={b.id} title={b.title} selected={b.id === bookId} onPress={() => setBookId(b.id)} />
                ))}
              </View>
            )}
            <Field placeholder="讀了幾分鐘" keyboardType="number-pad" value={minutes} onChangeText={setMinutes} />
            <Field placeholder="一句心得（可不填）" value={note} onChangeText={setNote} />
            <Button title="打卡" onPress={onSave} disabled={!canSave} />
          </ThemedView>

          {logs.slice(0, 20).map((log) => (
            <ThemedView key={log.id} type="backgroundElement" style={styles.logRow}>
              <ThemedText type="smallBold">{titleOf(log.bookId)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {[log.date, `${log.times ?? 1} 次`, log.minutes ? `${log.minutes} 分鐘` : '', log.note ?? '']
                  .filter(Boolean)
                  .join(' · ')}
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
  grow: { flex: 1 },
  logRow: { padding: Spacing.three, borderRadius: Spacing.three },
});
