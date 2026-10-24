import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { toDayKey } from '@/data/dates';
import { useTheme } from '@/hooks/use-theme';

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

/** Steps a date back and forth a day at a time, or picks it from a month calendar; it never goes past today. */
export function DayPicker({ day, onChange }: { day: string; onChange: (day: string) => void }) {
  const today = toDayKey(new Date());
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.picker}>
      <View style={styles.row}>
        <Button title="‹ 前一天" onPress={() => onChange(shiftDay(day, -1))} />
        <Pressable onPress={() => setOpen(!open)} accessibilityRole="button">
          <ThemedText type="smallBold" style={styles.label}>
            {dayLabel(day)}
          </ThemedText>
        </Pressable>
        <Button title="後一天 ›" onPress={() => onChange(shiftDay(day, 1))} disabled={day >= today} />
        <Button title="📅 選日期" selected={open} onPress={() => setOpen(!open)} />
        {day !== today ? <Button title="回到今天" onPress={() => onChange(today)} /> : null}
      </View>
      {open ? (
        <MonthPicker
          day={day}
          onPick={(picked) => {
            onChange(picked);
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

/** A month of days to tap, with month and year steps; days after today can't be picked. */
function MonthPicker({ day, onPick }: { day: string; onPick: (day: string) => void }) {
  const theme = useTheme();
  const today = toDayKey(new Date());
  const [month, setMonth] = useState(() => day.slice(0, 7));
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  const cells: (string | undefined)[] = [
    ...Array<undefined>(first.getDay()).fill(undefined),
    ...Array.from({ length: days }, (_, i) => toDayKey(new Date(y, m - 1, i + 1))),
  ];
  const step = (months: number) => setMonth(toDayKey(new Date(y, m - 1 + months, 1)).slice(0, 7));
  const canGoOn = (months: number) => toDayKey(new Date(y, m - 1 + months, 1)) <= today;
  return (
    <View style={styles.month}>
      <View style={styles.row}>
        <Button title="«" onPress={() => step(-12)} />
        <Button title="‹" onPress={() => step(-1)} />
        <ThemedText type="smallBold" style={styles.monthLabel}>
          {y} 年 {m} 月
        </ThemedText>
        <Button title="›" onPress={() => step(1)} disabled={!canGoOn(1)} />
        <Button title="»" onPress={() => step(12)} disabled={!canGoOn(12)} />
      </View>
      <View style={styles.grid}>
        {[...WEEKDAYS].map((w) => (
          <ThemedText key={w} type="small" themeColor="textSecondary" style={styles.cell}>
            {w}
          </ThemedText>
        ))}
        {cells.map((d, i) =>
          d ? (
            <Pressable
              key={d}
              disabled={d > today}
              onPress={() => onPick(d)}
              accessibilityRole="button"
              accessibilityLabel={`選 ${Number(d.slice(5, 7))} 月 ${Number(d.slice(8))} 日`}
              style={[
                styles.cell,
                styles.dayCell,
                d === day && { backgroundColor: theme.backgroundSelected },
                d > today && styles.future,
              ]}>
              <ThemedText type={d === day || d === today ? 'smallBold' : 'small'}>{Number(d.slice(8))}</ThemedText>
            </Pressable>
          ) : (
            <View key={`blank-${i}`} style={styles.cell} />
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  month: { gap: Spacing.two, width: '100%', maxWidth: 360 },
  monthLabel: { minWidth: 96, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingVertical: Spacing.one },
  dayCell: { borderRadius: Spacing.two },
  future: { opacity: 0.3 },
  label: { minWidth: 72, textAlign: 'center' },
});
