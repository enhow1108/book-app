import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { booksThisMonth, currentStreak, toDayKey } from '@/data/dates';
import { useStore } from '@/data/store';

export default function CheckinScreen() {
  const { books, logs: allLogs, children, activeChild, setActiveChild, addLog } = useStore();
  const [bookId, setBookId] = useState<string>();
  const [minutes, setMinutes] = useState('15');
  const [note, setNote] = useState('');

  const logs = allLogs.filter((l) => l.childId === activeChild?.id);
  const minutesValue = Number.parseInt(minutes, 10);
  const canSave = !!activeChild && !!bookId && minutesValue > 0;
  const totalMinutes = logs.reduce((sum, l) => sum + l.minutes, 0);
  const titleOf = (id: string) => books.find((b) => b.id === id)?.title ?? '已移除的書';

  function onSave() {
    if (!bookId) return;
    addLog({ bookId, minutes: minutesValue, note: note.trim() || undefined, date: toDayKey(new Date()) });
    setNote('');
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="subtitle">今日打卡</ThemedText>

          {children.length === 0 ? (
            <ThemedText themeColor="textSecondary">先到「孩子」分頁加一個孩子。</ThemedText>
          ) : (
            <View style={styles.chips}>
              {children.map((c) => (
                <Button
                  key={c.id}
                  title={`${c.avatar} ${c.name}`}
                  selected={c.id === activeChild?.id}
                  onPress={() => setActiveChild(c.id)}
                />
              ))}
            </View>
          )}

          <View style={styles.stats}>
            <Stat label="連續天數" value={currentStreak(logs)} />
            <Stat label="本月讀了" value={booksThisMonth(logs)} unit="本" />
            <Stat label="累計" value={totalMinutes} unit="分鐘" />
          </View>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">今天讀了哪本？</ThemedText>
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
                {log.date} · {log.minutes} 分鐘{log.note ? ` · ${log.note}` : ''}
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
  logRow: { padding: Spacing.three, borderRadius: Spacing.three },
});
