import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DayPicker } from '@/components/day-picker';
import { confirmDestructive } from '@/components/dialogs';
import { Button, Field } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { READING_MODES } from '@/data/status';
import { useStore } from '@/data/store';
import type { ReadingLog } from '@/data/types';

const MAX_TIMES = 50;

/** Full-screen form to fix one check-in: its date, who read, how, how many times and the note; or delete it. */
export function LogEditor({ log, onClose }: { log: ReadingLog; onClose: () => void }) {
  const { children, library, updateLog, removeLog } = useStore();
  const [date, setDate] = useState(log.date);
  const [childId, setChildId] = useState(log.childId);
  const [mode, setMode] = useState(log.mode);
  const [times, setTimes] = useState(log.times ?? 1);
  const [note, setNote] = useState(log.note ?? '');
  const title = library.find((b) => b.id === log.bookId)?.title ?? '已移除的書';

  function onSave() {
    updateLog(log.id, { date, childId, mode, times, note: note.trim() || undefined });
    onClose();
  }

  function onDelete() {
    confirmDestructive(`刪除這筆「${title}」的紀錄？`, '刪除後不能復原。', '刪除', () => {
      removeLog(log.id);
      onClose();
    });
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.content}>
            <ThemedText type="subtitle">修改打卡紀錄</ThemedText>
            <ThemedText type="smallBold">{title}</ThemedText>

            <ThemedText type="small" themeColor="textSecondary">
              日期
            </ThemedText>
            <DayPicker day={date} onChange={setDate} />

            <ThemedText type="small" themeColor="textSecondary">
              誰讀的？
            </ThemedText>
            <View style={styles.chips}>
              {children.map((c) => (
                <Button
                  key={c.id}
                  title={`${c.avatar} ${c.name}`}
                  selected={c.id === childId}
                  onPress={() => setChildId(c.id)}
                />
              ))}
            </View>

            <View style={styles.chips}>
              {READING_MODES.map((m) => (
                <Button key={m.value} title={m.label} selected={mode === m.value} onPress={() => setMode(m.value)} />
              ))}
            </View>

            <View style={styles.row}>
              <Button title="−" onPress={() => setTimes(Math.max(1, times - 1))} disabled={times <= 1} />
              <ThemedText type="smallBold">{times} 次</ThemedText>
              <Button
                title="＋"
                onPress={() => setTimes(Math.min(MAX_TIMES, times + 1))}
                disabled={times >= MAX_TIMES}
              />
            </View>

            <Field placeholder="心得（可不填）" value={note} onChangeText={setNote} />

            <View style={styles.row}>
              <Button title="儲存" onPress={onSave} />
              <Button title="取消" onPress={onClose} />
              <View style={styles.grow} />
              <Button title="刪除這筆" onPress={onDelete} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  content: { padding: Spacing.four, gap: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  grow: { flex: 1 },
});
