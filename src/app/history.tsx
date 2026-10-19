import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChildSwitcher } from '@/components/child-switcher';
import { Button, Field } from '@/components/form';
import { ImportPanel } from '@/components/import-panel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { readCount } from '@/data/dates';
import { bookStats, groupHistory, PERIODS, type HistoryGroup, type Period } from '@/data/history';
import { titleKey } from '@/data/library';
import { useStore } from '@/data/store';

const PAGE = 20;
const BOOKS_PER_GROUP = 8;

export default function HistoryScreen() {
  const { activeChild, children, library, logs, allLogs } = useStore();
  const [family, setFamily] = useState(false);
  const [view, setView] = useState<'timeline' | 'books'>('timeline');
  const [period, setPeriod] = useState<Period>('month');
  const [shown, setShown] = useState(PAGE);
  const [search, setSearch] = useState('');

  const scopeLogs = family ? allLogs : logs;
  const groups = useMemo(() => groupHistory(scopeLogs, library, period), [scopeLogs, library, period]);
  const stats = useMemo(() => bookStats(scopeLogs), [scopeLogs]);
  const days = useMemo(() => new Set(scopeLogs.map((l) => l.date)).size, [scopeLogs]);
  const first = scopeLogs.reduce((min, l) => (min && min < l.date ? min : l.date), '');

  const query = titleKey(search);
  const ranked = useMemo(() => {
    const byId = new Map(library.map((b) => [b.id, b]));
    return [...stats]
      .flatMap(([id, s]) => {
        const book = byId.get(id);
        return book ? [{ book, ...s }] : [];
      })
      .sort((a, b) => b.times - a.times || b.last.localeCompare(a.last));
  }, [stats, library]);
  const found = query
    ? ranked.filter((r) => titleKey(r.book.title).includes(query) || titleKey(r.book.author).includes(query))
    : ranked;

  const pick = (fn: () => void) => () => {
    fn();
    setShown(PAGE);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="subtitle">閱讀紀錄</ThemedText>
          <ChildSwitcher />
          {children.length > 1 ? (
            <View style={styles.chips}>
              <Button title={`只看${activeChild?.name ?? ''}`} selected={!family} onPress={pick(() => setFamily(false))} />
              <Button title="全家" selected={family} onPress={pick(() => setFamily(true))} />
            </View>
          ) : null}

          {scopeLogs.length > 0 ? (
            <>
              <View style={styles.stats}>
                <Stat value={stats.size} label="本書" />
                <Stat value={readCount(scopeLogs)} label="次閱讀" />
                <Stat value={days} label="天有讀" />
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                從 {first} 開始記錄
              </ThemedText>

              <View style={styles.chips}>
                <Button title="時間軸" selected={view === 'timeline'} onPress={pick(() => setView('timeline'))} />
                <Button title="每本書" selected={view === 'books'} onPress={pick(() => setView('books'))} />
              </View>

              {view === 'timeline' ? (
                <>
                  <View style={styles.chips}>
                    {PERIODS.map((p) => (
                      <Button
                        key={p.value}
                        title={p.label}
                        selected={period === p.value}
                        onPress={pick(() => setPeriod(p.value))}
                      />
                    ))}
                  </View>
                  {groups.slice(0, shown).map((g) => (
                    <GroupCard key={g.key} group={g} />
                  ))}
                  {groups.length > shown ? (
                    <Button title={`再顯示 ${Math.min(PAGE, groups.length - shown)} 段`} onPress={() => setShown(shown + PAGE)} />
                  ) : null}
                </>
              ) : (
                <>
                  <Field placeholder="找書名或作者" value={search} onChangeText={(text) => {
                      setSearch(text);
                      setShown(PAGE);
                    }} />
                  {found.slice(0, shown * 3).map((r, i) => (
                    <ThemedView key={r.book.id} type="backgroundElement" style={styles.bookRow}>
                      <ThemedText type="smallBold" numberOfLines={2}>
                        {query ? '' : `${i + 1}. `}
                        {r.book.title}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {[`${r.times} 次`, r.book.author, r.first === r.last ? r.first : `${r.first} ～ ${r.last}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </ThemedText>
                    </ThemedView>
                  ))}
                  {found.length > shown * 3 ? (
                    <Button title="再顯示更多" onPress={() => setShown(shown + PAGE)} />
                  ) : null}
                </>
              )}
            </>
          ) : (
            <ThemedText themeColor="textSecondary">
              {activeChild ? '還沒有閱讀紀錄。去「打卡」記一次，或從下面匯入以前的紀錄。' : ''}
            </ThemedText>
          )}

          <ImportPanel />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function GroupCard({ group }: { group: HistoryGroup }) {
  const [open, setOpen] = useState(false);
  const books = open ? group.books : group.books.slice(0, BOOKS_PER_GROUP);
  const more = group.books.length - books.length;
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">{group.label}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {[`${group.books.length} 本`, `${group.reads} 次`, group.newBooks ? `新書 ${group.newBooks} 本` : '']
          .filter(Boolean)
          .join(' · ')}
      </ThemedText>
      {books.map(({ book, times, isNew }) => (
        <View key={book.id} style={styles.line}>
          <ThemedText type="small" style={styles.grow} numberOfLines={1}>
            {book.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {[isNew ? '新' : '', times > 1 ? `×${times}` : ''].filter(Boolean).join(' ')}
          </ThemedText>
        </View>
      ))}
      {more > 0 || open ? (
        <Pressable onPress={() => setOpen(!open)}>
          <ThemedText type="link">{open ? '收起' : `還有 ${more} 本`}</ThemedText>
        </Pressable>
      ) : null}
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
  stats: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1, alignItems: 'center', padding: Spacing.two, borderRadius: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  line: { flexDirection: 'row', gap: Spacing.two },
  grow: { flex: 1, minWidth: 0 },
  bookRow: { padding: Spacing.two, borderRadius: Spacing.two, gap: 2 },
});
