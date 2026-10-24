import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Button, Field } from '@/components/form';
import { IsbnScanner } from '@/components/isbn-scanner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { isJapaneseProductCode } from '@/data/barcode';
import { addScan, readyBooks, type ScanItem } from '@/data/batch-scan';
import { findGoogleCover, lookupIsbn } from '@/data/isbn';
import { findSameBook, isbnKey } from '@/data/library';
import { modeLabel, READING_MODES } from '@/data/status';
import { useStore } from '@/data/store';
import type { ReadingMode } from '@/data/types';

const STATUS_TEXT: Record<ScanItem['status'], string> = {
  looking: '查詢中…',
  known: '已在全家書架上',
  found: '新書',
  missing: '查不到，請輸入書名',
};

/**
 * Scan a pile of books one after another with the camera left open, then add them all to the family shelf
 * in one go, and if wanted check them all in for one child too.
 */
export function BatchScan({ onClose, date }: { onClose: () => void; date?: string }) {
  const { children, library, addBooks } = useStore();
  const [items, setItems] = useState<ScanItem[]>([]);
  const [typed, setTyped] = useState('');
  const [scanning, setScanning] = useState(false);
  const [childId, setChildId] = useState<string>();
  const [mode, setMode] = useState<ReadingMode>('self');
  const [done, setDone] = useState<string>();

  const update = (code: string, patch: (item: ScanItem) => ScanItem) =>
    setItems((list) => list.map((i) => (i.code === code ? patch(i) : i)));

  async function lookUp(code: string) {
    const own = library.find((b) => isbnKey(b.isbn) === code);
    if (own) {
      const { title, author, language, coverUrl } = own;
      return update(code, (i) => ({ ...i, status: 'known', book: { ...i.book, title, author, language, coverUrl } }));
    }
    const found = await lookupIsbn(code).catch(() => null);
    if (!found) {
      return update(code, (i) => ({
        ...i,
        status: 'missing',
        book: { ...i.book, language: isJapaneseProductCode(code) ? 'ja' : i.book.language },
      }));
    }
    update(code, (i) => ({ ...i, status: 'found', book: { ...i.book, ...found } }));
    // Taiwan's library gives no covers, and Google's ISBN search often misses, so try Google by title too.
    if (!found.coverUrl) {
      const cover = await findGoogleCover({ title: found.title }).catch(() => null);
      if (cover && cover !== 'quota') update(code, (i) => ({ ...i, book: { ...i.book, coverUrl: i.book.coverUrl ?? cover } }));
    }
  }

  function onCode(raw: string) {
    const code = isbnKey(raw);
    if (!code || items.some((i) => i.code === code)) return;
    setDone(undefined);
    setItems((list) => addScan(list, code));
    lookUp(code);
  }

  function onAdd() {
    const books = readyBooks(items);
    const child = children.find((c) => c.id === childId);
    addBooks(books, child ? { childId: child.id, mode, date } : undefined);
    const had = books.filter((b) => findSameBook(library, b)).length;
    const skipped = items.length - books.length;
    setDone(
      [
        child
          ? `已幫${child.name}記上 ${books.length} 本${modeLabel(mode)}，新書也加進全家書架了。`
          : `已把 ${books.length} 本加進全家書架${had ? `（${had} 本本來就有）` : ''}。`,
        skipped ? `${skipped} 本沒有書名或重複，沒有加入。` : '',
      ].join(''),
    );
    setItems([]);
  }

  const ready = readyBooks(items).length;
  const looking = items.some((i) => i.status === 'looking');
  const child = children.find((c) => c.id === childId);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.header}>
        <ThemedText type="smallBold">一次掃很多本</ThemedText>
        <Button title="收起" onPress={onClose} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        相機會一直開著，一本接一本掃條碼；掃完再一次加進全家書架，也可以順便幫一個孩子打卡。
      </ThemedText>
      <View style={styles.row}>
        <Button title="開始掃描" onPress={() => setScanning(true)} />
        <Field
          style={styles.grow}
          placeholder="條碼數字"
          keyboardType="number-pad"
          value={typed}
          onChangeText={setTyped}
          onSubmitEditing={() => {
            onCode(typed);
            setTyped('');
          }}
        />
        <Button
          title="加入清單"
          onPress={() => {
            onCode(typed);
            setTyped('');
          }}
          disabled={!isbnKey(typed)}
        />
      </View>
      {done && !items.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          {done}
        </ThemedText>
      ) : null}

      {items.length ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            已掃 {items.length} 本
          </ThemedText>
          {items.map((item) => (
            <View key={item.code} style={styles.row}>
              <BookCover
                key={item.book.coverUrl ?? ''}
                book={{ ...item.book, title: item.book.title || '封面' }}
                width={40}
              />
              <View style={[styles.grow, styles.fields]}>
                {item.status === 'missing' ? (
                  <Field
                    placeholder="書名"
                    value={item.book.title}
                    onChangeText={(title) => update(item.code, (i) => ({ ...i, book: { ...i.book, title } }))}
                  />
                ) : (
                  <ThemedText type="smallBold" numberOfLines={2}>
                    {item.book.title || item.code}
                  </ThemedText>
                )}
                <ThemedText type="small" themeColor="textSecondary">
                  {item.status === 'missing' ? `${STATUS_TEXT.missing}（條碼 ${item.code}）` : STATUS_TEXT[item.status]}
                </ThemedText>
              </View>
              <Button title="✕" onPress={() => setItems((list) => list.filter((i) => i.code !== item.code))} />
            </View>
          ))}

          <ThemedText type="small" themeColor="textSecondary">
            要順便打卡嗎？
          </ThemedText>
          <View style={styles.chips}>
            <Button title="只加進書架" selected={!child} onPress={() => setChildId(undefined)} />
            {children.map((c) => (
              <Button
                key={c.id}
                title={`${c.avatar} ${c.name}`}
                selected={c.id === child?.id}
                onPress={() => setChildId(c.id)}
              />
            ))}
          </View>
          {child ? (
            <View style={styles.chips}>
              {READING_MODES.map((m) => (
                <Button key={m.value} title={m.label} selected={mode === m.value} onPress={() => setMode(m.value)} />
              ))}
            </View>
          ) : null}
          <View style={styles.row}>
            <Button
              title={child ? `幫${child.name}打卡 ${ready} 本` : `加入全家書架（${ready} 本）`}
              onPress={onAdd}
              disabled={!ready || looking}
            />
            <Button title="清空" onPress={() => setItems([])} />
          </View>
        </>
      ) : null}

      {scanning ? (
        <IsbnScanner continuous onScanned={onCode} onClose={() => setScanning(false)}>
          <ThemedText type="smallBold">已掃 {items.length} 本</ThemedText>
          {items.slice(0, 4).map((item) => (
            <ThemedText key={item.code} type="small" themeColor="textSecondary" numberOfLines={1}>
              {item.book.title || item.code} · {STATUS_TEXT[item.status]}
            </ThemedText>
          ))}
        </IsbnScanner>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  grow: { flex: 1, minWidth: 0 },
  fields: { gap: Spacing.one },
});
