import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { toDayKey } from '@/data/dates';

const WEEKDAYS = '日一二三四五六';

/** Moves a day key (YYYY-MM-DD) by whole days. */
export function shiftDay(day: string, delta: number) {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return toDayKey(d);
}

/** 今天, 昨天, 前天, or the date with its weekday. */
export function dayLabel(day: string) {
  const today = toDayKey(new Date());
  if (day === today) return '今天';
  if (day === shiftDay(today, -1)) return '昨天';
  if (day === shiftDay(today, -2)) return '前天';
  const d = new Date(`${day}T00:00:00`);
  const year = d.getFullYear() === new Date().getFullYear() ? '' : `${d.getFullYear()} 年 `;
  return `${year}${d.getMonth() + 1} 月 ${d.getDate()} 日（${WEEKDAYS[d.getDay()]}）`;
}

/** Steps a date back and forth a day at a time; it never goes past today. */
export function DayPicker({ day, onChange }: { day: string; onChange: (day: string) => void }) {
  const today = toDayKey(new Date());
  return (
    <View style={styles.row}>
      <Button title="‹ 前一天" onPress={() => onChange(shiftDay(day, -1))} />
      <ThemedText type="smallBold" style={styles.label}>
        {dayLabel(day)}
      </ThemedText>
      <Button title="後一天 ›" onPress={() => onChange(shiftDay(day, 1))} disabled={day >= today} />
      {day !== today ? <Button title="回到今天" onPress={() => onChange(today)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  label: { minWidth: 72, textAlign: 'center' },
});
