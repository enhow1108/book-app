import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChildSwitcher } from '@/components/child-switcher';
import { Button, Field } from '@/components/form';
import { IsbnScanner } from '@/components/isbn-scanner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { lookupIsbn } from '@/data/isbn';
import { useStore } from '@/data/store';
import type { BookLanguage } from '@/data/types';

export default function BookshelfScreen() {
  const { activeChild, books, addBook, removeBook } = useStore();
  const [isbn, setIsbn] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [language, setLanguage] = useState<BookLanguage>('zh');
  const [coverUrl, setCoverUrl] = useState<string>();
  const [looking, setLooking] = useState(false);
  const [scanning, setScanning] = useState(false);

  async function onLookup(code = isbn) {
    setLooking(true);
    const found = await lookupIsbn(code);
    setLooking(false);
    if (!found) {
      Alert.alert('查無此書', '可以手動輸入書名與作者。');
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
    addBook({ title: title.trim(), author: author.trim(), language, isbn: isbn || undefined, coverUrl });
    setIsbn('');
    setTitle('');
    setAuthor('');
    setCoverUrl(undefined);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="subtitle">{activeChild ? `${activeChild.name}的書架` : '我的書架'}</ThemedText>
          <ChildSwitcher />

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">加一本書</ThemedText>
            <View style={styles.row}>
              <Field
                style={styles.grow}
                placeholder="ISBN（書背條碼下方的數字）"
                keyboardType="number-pad"
                value={isbn}
                onChangeText={setIsbn}
              />
              <Button title="掃描" onPress={() => setScanning(true)} disabled={looking} />
              <Button title={looking ? '查詢中…' : '查詢'} onPress={() => onLookup()} disabled={!isbn || looking} />
            </View>
            <Field placeholder="書名" value={title} onChangeText={setTitle} />
            <Field placeholder="作者" value={author} onChangeText={setAuthor} />
            <View style={styles.row}>
              <Button title="中文" selected={language === 'zh'} onPress={() => setLanguage('zh')} />
              <Button title="English" selected={language === 'en'} onPress={() => setLanguage('en')} />
            </View>
            <Button title="加入書架" onPress={onAdd} disabled={!title.trim() || !activeChild} />
          </ThemedView>

          {books.length === 0 ? (
            <ThemedText themeColor="textSecondary">書架還是空的，先加一本書吧。</ThemedText>
          ) : (
            books.map((book) => (
              <ThemedView key={book.id} type="backgroundElement" style={styles.bookRow}>
                {book.coverUrl ? (
                  <Image source={book.coverUrl} style={styles.cover} contentFit="cover" />
                ) : (
                  <ThemedView type="backgroundSelected" style={styles.cover} />
                )}
                <View style={styles.grow}>
                  <ThemedText type="smallBold">{book.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {[book.author, book.language === 'zh' ? '中文' : 'English'].filter(Boolean).join(' · ')}
                  </ThemedText>
                </View>
                <Button title="移除" onPress={() => removeBook(book.id)} />
              </ThemedView>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
      {scanning ? <IsbnScanner onScanned={onScanned} onClose={() => setScanning(false)} /> : null}
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
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  grow: { flex: 1 },
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: Spacing.three,
  },
  cover: { width: 48, height: 68, borderRadius: Spacing.one },
});
