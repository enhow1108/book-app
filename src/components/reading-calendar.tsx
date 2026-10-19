import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { toDayKey } from '@/data/dates';
import { modeLabel } from '@/data/status';
import type { LibraryBook, ReadingLog, ReadingMode } from '@/data/types';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MAX_STACK = 3;

type DayBook = { book: LibraryBook; times: number; modes: ReadingMode[] };

/** Each day's books, most read first. */
function booksByDay(logs: ReadingLog[], library: LibraryBook[]): Map<string, DayBook[]> {
  const byId = new Map(library.map((b) => [b.id, b]));
  const days = new Map<string, Map<string, DayBook>>();
  for (const l of logs) {
    const book = byId.get(l.bookId);
    if (!book) continue;
    let day = days.get(l.date);
    if (!day) days.set(l.date, (day = new Map()));
    const entry = day.get(book.id) ?? { book, times: 0, modes: [] };
    entry.times += l.times ?? 1;
    if (l.mode && !entry.modes.includes(l.mode)) entry.modes.push(l.mode);
    day.set(book.id, entry);
  }
  return new Map([...days].map(([date, books]) => [date, [...books.values()].sort((a, b) => b.times - a.times)]));
}

/** A month of reading: each day shows the covers of what was read, stacked; tap a day to list them. */
export function ReadingCalendar({
  logs,
  library,
  onOpenBook,
}: {
  logs: ReadingLog[];
  library: LibraryBook[];
  onOpenBook: (bookId: string) => void;
}) {
  const today = toDayKey(new Date());
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selected, setSelected] = useState<string | undefined>(today);
  const [width, setWidth] = useState(0);

  const days = useMemo(() => booksByDay(logs, library), [logs, library]);

  const first = new Date(month.year, month.month, 1);
  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array<null>(first.getDay()).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toDayKey(new Date(month.year, month.month, i + 1))),
  ];
  while (cells.length % 7) cells.push(null);

  const monthDays = cells.filter((d): d is string => !!d && days.has(d));
  const monthBooks = new Set(monthDays.flatMap((d) => days.get(d)!.map((b) => b.book.id))).size;
  const monthReads = monthDays.reduce((sum, d) => sum + days.get(d)!.reduce((s, b) => s + b.times, 0), 0);

  const cellWidth = Math.floor(width / 7);
  const coverWidth = Math.max(16, Math.floor(cellWidth * 0.5));

  function shift(delta: number) {
    setMonth(({ year, month: m }) => {
      const d = new Date(year, m + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
    setSelected(undefined);
  }

  const dayBooks = selected ? (days.get(selected) ?? []) : [];
  const selectedDate = selected ? new Date(`${selected}T00:00:00`) : undefined;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Button title="‹" onPress={() => shift(-1)} />
        <ThemedText type="smallBold">
          {month.year} 年 {month.month + 1} 月
        </ThemedText>
        <Button title="›" onPress={() => shift(1)} />
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {monthDays.length ? `讀了 ${monthDays.length} 天 · ${monthBooks} 本 · ${monthReads} 次` : '這個月還沒有紀錄'}
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.grid} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {WEEKDAYS.map((w) => (
          <View key={w} style={[styles.weekday, { width: cellWidth }]}>
            <ThemedText type="small" themeColor="textSecondary">
              {w}
            </ThemedText>
          </View>
        ))}
        {width > 0 &&
          cells.map((day, i) => {
            const books = day ? (days.get(day) ?? []) : [];
            const stack = books.slice(0, MAX_STACK);
            return (
              <Pressable
                key={day ?? `blank${i}`}
                disabled={!day}
                onPress={() => day && setSelected(day)}
                style={[styles.cell, { width: cellWidth, height: cellWidth * 1.35 }]}>
                {day ? (
                  <ThemedView
                    type={day === selected ? 'backgroundSelected' : undefined}
                    style={[styles.cellInner, day === today && styles.today]}>
                    <ThemedText type="small" themeColor={books.length ? 'text' : 'textSecondary'}>
                      {Number(day.slice(8))}
                    </ThemedText>
                    {/* Several books on one day overlap like a small pile. */}
                    <View style={[styles.stack, { height: coverWidth * 1.45 }]}>
                      {stack.map(({ book }, j) => (
                        <View
                          key={book.id}
                          style={[
                            styles.stacked,
                            {
                              left: j * (coverWidth * 0.35),
                              top: j * 2,
                              zIndex: MAX_STACK - j,
                            },
                          ]}>
                          <BookCover book={book} width={coverWidth} />
                        </View>
                      ))}
                      {books.length > MAX_STACK ? (
                        <View style={styles.more}>
                          <ThemedText type="small" style={styles.moreText}>
                            +{books.length - MAX_STACK}
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>
                  </ThemedView>
                ) : null}
              </Pressable>
            );
          })}
      </ThemedView>

      {selected && selectedDate ? (
        <ThemedView type="backgroundElement" style={styles.dayCard}>
          <ThemedText type="smallBold">
            {selectedDate.getMonth() + 1} 月 {selectedDate.getDate()} 日（
            {WEEKDAYS[selectedDate.getDay()]}）{dayBooks.length ? ` 讀了 ${dayBooks.length} 本` : ''}
          </ThemedText>
          {dayBooks.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              這天沒有閱讀紀錄。
            </ThemedText>
          ) : (
            dayBooks.map(({ book, times, modes }) => (
              <Pressable key={book.id} onPress={() => onOpenBook(book.id)} style={styles.dayRow}>
                <BookCover book={book} width={36} />
                <View style={styles.grow}>
                  <ThemedText type="smallBold" numberOfLines={2}>
                    {book.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {[`${times} 次`, ...modes.map((m) => modeLabel(m))].filter(Boolean).join(' · ')}
                  </ThemedText>
                </View>
              </Pressable>
            ))
          )}
        </ThemedView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  center: { textAlign: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
  },
  weekday: { alignItems: 'center', paddingBottom: Spacing.one },
  cell: { padding: 2 },
  cellInner: {
    flex: 1,
    borderRadius: Spacing.two,
    alignItems: 'center',
    paddingTop: 2,
    overflow: 'hidden',
  },
  today: { borderWidth: 1.5, borderColor: '#E8846B' },
  stack: { width: '100%', alignItems: 'center' },
  stacked: {
    position: 'absolute',
    marginLeft: '12%',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 2,
    shadowOffset: { width: 1, height: 1 },
    elevation: 2,
  },
  more: {
    position: 'absolute',
    right: 2,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    paddingHorizontal: 4,
    zIndex: 10,
  },
  moreText: { color: 'white', fontSize: 10, lineHeight: 14 },
  dayCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  grow: { flex: 1, minWidth: 0 },
});
