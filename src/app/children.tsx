import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useStore } from '@/data/store';
import { AVATARS, type Child } from '@/data/types';

const thisYear = new Date().getFullYear();

export default function ChildrenScreen() {
  const { children, activeChildId, addChild, removeChild, setActiveChild } = useStore();
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);

  const year = Number.parseInt(birthYear, 10);
  const yearValid = year >= thisYear - 18 && year <= thisYear;
  const canAdd = !!name.trim() && yearValid;

  function onAdd() {
    addChild({ name: name.trim(), birthYear: year, avatar });
    setName('');
    setBirthYear('');
  }

  function confirmRemove(child: Child) {
    Alert.alert(`刪除 ${child.name}？`, '這個孩子的打卡紀錄也會一起刪除。', [
      { text: '取消', style: 'cancel' },
      { text: '刪除', style: 'destructive', onPress: () => removeChild(child.id) },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="subtitle">孩子</ThemedText>

          {children.length === 0 ? (
            <ThemedText themeColor="textSecondary">先加一個孩子，才能開始打卡。</ThemedText>
          ) : (
            children.map((child) => {
              const active = child.id === activeChildId;
              return (
                <Pressable key={child.id} onPress={() => setActiveChild(child.id)}>
                  <ThemedView type={active ? 'backgroundSelected' : 'backgroundElement'} style={styles.childRow}>
                    <ThemedText style={styles.avatar}>{child.avatar}</ThemedText>
                    <View style={styles.grow}>
                      <ThemedText type="smallBold">{child.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {thisYear - child.birthYear} 歲{active ? ' · 目前打卡對象' : ''}
                      </ThemedText>
                    </View>
                    <Button title="刪除" onPress={() => confirmRemove(child)} />
                  </ThemedView>
                </Pressable>
              );
            })
          )}

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">新增孩子</ThemedText>
            <Field placeholder="名字或暱稱" value={name} onChangeText={setName} />
            <Field
              placeholder={`出生年份，例如 ${thisYear - 6}`}
              keyboardType="number-pad"
              maxLength={4}
              value={birthYear}
              onChangeText={setBirthYear}
            />
            <View style={styles.avatars}>
              {AVATARS.map((a) => (
                <Button key={a} title={a} selected={a === avatar} onPress={() => setAvatar(a)} />
              ))}
            </View>
            <Button title="新增" onPress={onAdd} disabled={!canAdd} />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
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
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  avatar: { fontSize: 32, lineHeight: 40 },
  grow: { flex: 1 },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
