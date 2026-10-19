import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Button, Field } from '@/components/form';
import { IsbnScanner } from '@/components/isbn-scanner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { pickCoverPhoto } from '@/data/cover-photo';
import { lookupIsbn } from '@/data/isbn';
import { STATUSES } from '@/data/status';
import { useStore } from '@/data/store';
import type { BookLanguage, BookStatus } from '@/data/types';

/** Add a book by scanning or typing its ISBN, or by entering the title by hand. */
export function AddBookForm({ onClose }: { onClose: () => void }) {
  const { activeChild, addBook } = useStore();
  const [isbn, setIsbn] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [language, setLanguage] = useState<BookLanguage>('zh');
  const [status, setStatus] = useState<BookStatus>('reading');
  const [coverUrl, setCoverUrl] = useState<string>();
  const [looking, setLooking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [notFound, setNotFound] = useState(false);

  async function onLookup(code = isbn) {
    setLooking(true);
    setNotFound(false);
    const found = await lookupIsbn(code);
    setLooking(false);
    if (!found) {
      // Switch to typing it in: the ISBN stays, and the parent fills in the rest and can photograph the cover.
      // Clear anything left from an earlier lookup so it isn't mistaken for this book.
      setTitle('');
      setAuthor('');
      setCoverUrl(undefined);
      setNotFound(true);
      return;
    }
    setTitle(found.title);
    setAuthor(found.author);
    setLanguage(found.language);
    setCoverUrl(found.coverUrl);
  }

  function onScanned(code: string) {
    setScanning(false);
    setIsbn(code);
    onLookup(code);
  }

  function onAdd() {
    addBook({ title: title.trim(), author: author.trim(), language, status, isbn: isbn || undefined, coverUrl });
    setIsbn('');
    setTitle('');
    setAuthor('');
    setLanguage('zh');
    setCoverUrl(undefined);
    setNotFound(false);
  }

  async function onPhoto(from: 'camera' | 'library') {
    const photo = await pickCoverPhoto(from);
    if (photo) setCoverUrl(photo);
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.header}>
        <ThemedText type="smallBold">加一本書</ThemedText>
        <Button title="收起" onPress={onClose} />
      </View>
      <View style={styles.row}>
        <Field
          style={styles.grow}
          placeholder="ISBN 條碼數字"
          keyboardType="number-pad"
          value={isbn}
          onChangeText={setIsbn}
        />
        <Button title="掃描" onPress={() => setScanning(true)} disabled={looking} />
        <Button title={looking ? '查詢中…' : '查詢'} onPress={() => onLookup()} disabled={!isbn || looking} />
      </View>
      {notFound ? (
        <ThemedText type="small" themeColor="textSecondary">
          查不到這本書，請自己輸入書名和作者，也可以拍一張封面照片。
        </ThemedText>
      ) : null}
      <View style={styles.row}>
        <BookCover key={coverUrl ?? ''} book={{ title: title || '封面', coverUrl, isbn }} width={64} />
        <View style={[styles.grow, styles.fields]}>
          <Field placeholder="書名" value={title} onChangeText={setTitle} />
          <Field placeholder="作者" value={author} onChangeText={setAuthor} />
          <View style={styles.row}>
            <Button title="拍封面" onPress={() => onPhoto('camera')} />
            <Button title="選照片" onPress={() => onPhoto('library')} />
          </View>
        </View>
      </View>
      <View style={styles.row}>
        <Button title="中文" selected={language === 'zh'} onPress={() => setLanguage('zh')} />
        <Button title="English" selected={language === 'en'} onPress={() => setLanguage('en')} />
      </View>
      <View style={styles.row}>
        {STATUSES.map((s) => (
          <Button key={s.value} title={s.label} selected={status === s.value} onPress={() => setStatus(s.value)} />
        ))}
      </View>
      <Button title="加入書架" onPress={onAdd} disabled={!title.trim() || !activeChild} />
      {scanning ? <IsbnScanner onScanned={onScanned} onClose={() => setScanning(false)} /> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  fields: { gap: Spacing.two },
});
