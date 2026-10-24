import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddBookForm } from '@/components/add-book-form';
import { BookCover } from '@/components/book-cover';
import { BookDetail } from '@/components/book-detail';
import { Button, Field } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ReadingCalendar } from '@/components/reading-calendar';
import { WoodShelf } from '@/components/wood-shelf';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { newestFirst, readCount, recentBooks } from '@/data/dates';
import { bookStats } from '@/data/history';
import { useStore } from '@/data/store';

/** Books drawn at a time; imported libraries can hold thousands. */
const PAGE = 60;

// The shelf is the whole family's: one list for everyone, sorted and filtered by everyone's reading.
type Filter = 'all' | 'read' | 'unread';

type ShelfView = 'shelf' | 'list' | 'calendar';
const VIEWS: { value: ShelfView; label: string }[] = [
  { value: 'shelf', label: '書架' },
  { value: 'list', label: '清單' },
  { value: 'calendar', label: '月曆' },
];

type Sort = 'recent' | 'added' | 'most';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'recent', label: '最近讀的' },
  { value: 'added', label: '最新加入' },
  { value: 'most', label: '讀最多次' },
];

export default function BookshelfScreen() {
  const { children, books, allLogs, library } = useStore();
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [view, setView] = useState<ShelfView>('shelf');
  const [search, setSearch] = useState('');
  const [openBookId, setOpenBookId] = useState<string>();
  const [limit, setLimit] = useState(PAGE);

  const stats = useMemo(() => bookStats(allLogs), [allLogs]);
  const query = search.trim().toLowerCase();

  // Sorting and counting thousands of books is kept out of renders that don't change them.
  const sorted = useMemo(
    () =>
      sort === 'recent'
        ? recentBooks(books, allLogs)
        : sort === 'added'
          ? [...books].sort((a, b) => newestFirst(a.addedAt, b.addedAt))
          : [...books].sort((a, b) => (stats.get(b.id)?.times ?? 0) - (stats.get(a.id)?.times ?? 0)),
    [sort, books, allLogs, stats],
  );
  const shown = useMemo(
    () =>
      sorted.filter(
        (b) =>
          (filter === 'all' || (filter === 'read') === stats.has(b.id)) &&
          (!query || b.title.toLowerCase().includes(query) || b.author.toLowerCase().includes(query)),
      ),
    [sorted, filter, query, stats],
  );
  const readBooks = useMemo(() => books.filter((b) => stats.has(b.id)).length, [books, stats]);
  // Who read each book, for the list view: 心譯 3 次 · 心瀚 1 次.
  const readers = useMemo(() => {
    const names = new Map(children.map((c) => [c.id, c.name]));
    const byBook = new Map<string, Map<string, number>>();
    for (const l of allLogs) {
      const name = names.get(l.childId);
      if (!name) continue;
      const counts = byBook.get(l.bookId) ?? new Map<string, number>();
      counts.set(name, (counts.get(name) ?? 0) + (l.times ?? 1));
      byBook.set(l.bookId, counts);
    }
    return byBook;
  }, [allLogs, children]);
  const readersOf = (id: string) =>
    [...(readers.get(id) ?? [])].map(([name, times]) => `${name} ${times} 次`).join(' · ') || '還沒有人讀過';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <ThemedText type="subtitle">全家的書架</ThemedText>
            {!adding ? <Button title="＋ 加一本書" onPress={() => setAdding(true)} /> : null}
          </View>

          {adding ? <AddBookForm onClose={() => setAdding(false)} /> : null}

          {books.length > 0 ? (
            <View style={styles.stats}>
              <Stat value={books.length} label="本書" />
              <Stat value={readBooks} label="本讀過" />
              <Stat value={readCount(allLogs)} label="次閱讀" />
            </View>
          ) : null}

          {books.length === 0 ? (
            <ThemedText themeColor="textSecondary">
              書架還是空的，按「＋ 加一本書」開始吧。
            </ThemedText>
          ) : (
            <>
              <View style={styles.chips}>
                {VIEWS.map((v) => (
                  <Button key={v.value} title={v.label} selected={view === v.value} onPress={() => setView(v.value)} />
                ))}
              </View>
              {view === 'calendar' ? (
                <ReadingCalendar logs={allLogs} library={library} onOpenBook={setOpenBookId} />
              ) : (
                <>
                  <View style={styles.chips}>
                    <Button
                      title={`全部 ${books.length}`}
                      selected={filter === 'all'}
                      onPress={() => setFilter('all')}
                    />
                    <Button
                      title={`讀過 ${readBooks}`}
                      selected={filter === 'read'}
                      onPress={() => setFilter('read')}
                    />
                    <Button
                      title={`還沒讀 ${books.length - readBooks}`}
                      selected={filter === 'unread'}
                      onPress={() => setFilter('unread')}
                    />
                  </View>
                  <View style={styles.toolbar}>
                    <View style={styles.chips}>
                      {SORTS.map((s) => (
                        <Button
                          key={s.value}
                          title={s.label}
                          selected={sort === s.value}
                          onPress={() => setSort(s.value)}
                        />
                      ))}
                    </View>
                  </View>
                  {books.length > 5 ? (
                    <Field placeholder="找書名或作者" value={search} onChangeText={setSearch} />
                  ) : null}

                  {shown.length === 0 ? (
                    <ThemedText themeColor="textSecondary">這裡還沒有書。</ThemedText>
                  ) : view === 'shelf' ? (
                    <WoodShelf books={shown.slice(0, limit)} onPress={(b) => setOpenBookId(b.id)} />
                  ) : (
                    shown.slice(0, limit).map((book) => (
                      <Pressable key={book.id} onPress={() => setOpenBookId(book.id)}>
                        <ThemedView type="backgroundElement" style={styles.bookRow}>
                          <BookCover book={book} />
                          <View style={styles.grow}>
                            <ThemedText type="smallBold" numberOfLines={2}>
                              {book.title}
                            </ThemedText>
                            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                              {[book.author, readersOf(book.id)].filter(Boolean).join(' · ')}
                            </ThemedText>
                          </View>
                        </ThemedView>
                      </Pressable>
                    ))
                  )}
                  {shown.length > limit ? (
                    <Button
                      title={`再顯示 ${Math.min(PAGE, shown.length - limit)} 本`}
                      onPress={() => setLimit(limit + PAGE)}
                    />
                  ) : null}
                </>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
      {openBookId ? <BookDetail bookId={openBookId} onClose={() => setOpenBookId(undefined)} /> : null}
    </ThemedView>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.stat}>
      <ThemedText type="subtitle">{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  stats: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1, alignItems: 'center', padding: Spacing.two, borderRadius: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.two },
  grow: { flex: 1, minWidth: 0 },
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: Spacing.three,
  },
});
