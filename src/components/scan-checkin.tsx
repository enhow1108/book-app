import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Button, Field } from '@/components/form';
import { dayLabel } from '@/components/day-picker';
import { IsbnScanner } from '@/components/isbn-scanner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { isBookBarcode, isIsbn13, isJapaneseProductCode } from '@/data/barcode';
import { pickCoverPhoto } from '@/data/cover-photo';
import { toDayKey } from '@/data/dates';
import { findGoogleCover, lookupIsbn } from '@/data/isbn';
import { LANGUAGES } from '@/data/language';
import { isbnKey } from '@/data/library';
import { modeLabel, READING_MODES } from '@/data/status';
import { useStore, type NewBook } from '@/data/store';
import type { ReadingMode } from '@/data/types';

const MAX_TIMES = 20;

/**
 * Scan a book's barcode and log it in one go: pick which child read it, how, and how many times.
 * A book the family doesn't have yet joins the family shelf on the way.
 */
export function ScanCheckin({ date }: { date?: string }) {
  const { children, activeChild, library, checkIn } = useStore();
  const [isbn, setIsbn] = useState('');
  const [book, setBook] = useState<NewBook>();
  const [notFound, setNotFound] = useState<false | 'isbn' | 'other' | 'typed'>(false);
  const [looking, setLooking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [childId, setChildId] = useState<string>();
  const [mode, setMode] = useState<ReadingMode>('self');
  const [times, setTimes] = useState(1);
  const [done, setDone] = useState<string>();

  const who = children.find((c) => c.id === childId) ?? activeChild;
  const known = book && library.find((b) => (b.isbn && b.isbn === book.isbn) || b.title === book.title);

  async function onLookup(code = isbn) {
    const clean = isbnKey(code);
    if (!clean) return;
    setDone(undefined);
    setNotFound(false);
    // A book already on the family shelf needs no lookup.
    const own = library.find((b) => isbnKey(b.isbn) === clean);
    if (own) {
      setBook(own);
      return;
    }
    setLooking(true);
    const found = await lookupIsbn(clean).catch(() => null);
    setLooking(false);
    if (!found) {
      const other = isBookBarcode(clean) && !isIsbn13(clean);
      setNotFound(other ? 'other' : 'isbn');
      setBook({ title: '', author: '', language: isJapaneseProductCode(clean) ? 'ja' : 'zh', isbn: clean });
      return;
    }
    setBook({
      title: found.title,
      author: found.author,
      language: found.language,
      isbn: clean,
      coverUrl: found.coverUrl,
    });
    // Taiwan's library gives no covers, and Google's ISBN search often misses, so try Google by title too.
    if (!found.coverUrl) {
      const cover = await findGoogleCover({ title: found.title }).catch(() => null);
      if (cover && cover !== 'quota')
        setBook((b) => (b && b.isbn === clean && !b.coverUrl ? { ...b, coverUrl: cover } : b));
    }
  }

  async function onPhoto(from: 'camera' | 'library') {
    const photo = await pickCoverPhoto(from);
    if (photo) setBook((b) => (b ? { ...b, coverUrl: photo } : b));
  }

  /** For a book with no barcode to scan: type its title (a book the family has is matched by title). */
  function onType() {
    setDone(undefined);
    setIsbn('');
    setNotFound('typed');
    setBook({ title: '', author: '', language: 'zh' });
  }

  function onScanned(code: string) {
    setScanning(false);
    setIsbn(code);
    onLookup(code);
  }

  function onCheckIn() {
    if (!book || !who || !book.title.trim()) return;
    checkIn({
      book: { ...book, title: book.title.trim(), author: book.author.trim() },
      childId: who.id,
      mode,
      times,
      date,
    });
    setDone(
      `已幫${who.name}記上${date && date !== toDayKey(new Date()) ? dayLabel(date) : ''}「${book.title.trim()}」${modeLabel(mode)} ${times} 次${known ? '' : '，也加進全家書架了'}。`,
    );
    setBook(undefined);
    setIsbn('');
    setTimes(1);
    setNotFound(false);
  }

  if (children.length === 0) return null;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">掃描打卡</ThemedText>
      <View style={styles.row}>
        <Field
          style={styles.grow}
          placeholder="ISBN 或條碼數字"
          keyboardType="number-pad"
          value={isbn}
          onChangeText={setIsbn}
        />
        <Button title="掃描" onPress={() => setScanning(true)} disabled={looking} />
        <Button title={looking ? '查詢中…' : '查詢'} onPress={() => onLookup()} disabled={!isbn || looking} />
      </View>
      {notFound !== 'typed' ? (
        <View style={styles.row}>
          <Button title="沒有條碼，自己輸入書名" onPress={onType} />
        </View>
      ) : null}
      {done && !book ? (
        <ThemedText type="small" themeColor="textSecondary">
          {done}
        </ThemedText>
      ) : null}

      {book ? (
        <>
          {notFound ? (
            <ThemedText type="small" themeColor="textSecondary">
              {notFound === 'typed'
                ? '輸入書名。書架上已經有的書會直接記上，新書會加進全家書架。'
                : notFound === 'other'
                ? '這是雜誌或商品條碼，不是 ISBN，查不到書名。請輸入書名，打卡後會加進全家書架，下次掃同一本就會直接帶出來。'
                : '查不到這本書，請輸入書名，打卡後會加進全家書架。'}
            </ThemedText>
          ) : null}
          <View style={styles.row}>
            <BookCover key={book.coverUrl ?? ''} book={{ ...book, title: book.title || '封面' }} width={56} />
            <View style={[styles.grow, styles.fields]}>
              {notFound ? (
                <>
                  <Field placeholder="書名" value={book.title} onChangeText={(title) => setBook({ ...book, title })} />
                  <Field
                    placeholder="作者"
                    value={book.author}
                    onChangeText={(author) => setBook({ ...book, author })}
                  />
                  <View style={styles.row}>
                    <Button title="拍封面" onPress={() => onPhoto('camera')} />
                    <Button title="選照片" onPress={() => onPhoto('library')} />
                  </View>
                  <View style={styles.chips}>
                    {LANGUAGES.map((l) => (
                      <Button
                        key={l.value}
                        title={l.label}
                        selected={book.language === l.value}
                        onPress={() => setBook({ ...book, language: l.value })}
                      />
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <ThemedText type="smallBold" numberOfLines={2}>
                    {book.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {known ? '已在全家書架上' : '新書，打卡後加進全家書架'}
                  </ThemedText>
                </>
              )}
            </View>
          </View>

          <ThemedText type="small" themeColor="textSecondary">
            誰讀的？
          </ThemedText>
          <View style={styles.chips}>
            {children.map((c) => (
              <Button
                key={c.id}
                title={`${c.avatar} ${c.name}`}
                selected={c.id === who?.id}
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
            <Button title="＋" onPress={() => setTimes(Math.min(MAX_TIMES, times + 1))} disabled={times >= MAX_TIMES} />
          </View>
          <View style={styles.row}>
            <Button title="打卡" onPress={onCheckIn} disabled={!book.title.trim() || !who} />
            <Button title="取消" onPress={() => setBook(undefined)} />
          </View>
        </>
      ) : null}
      {scanning ? <IsbnScanner onScanned={onScanned} onClose={() => setScanning(false)} /> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  grow: { flex: 1, minWidth: 0 },
  fields: { gap: Spacing.two },
});
