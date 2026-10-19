import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { confirmDestructive } from '@/components/dialogs';
import { Button, Field } from '@/components/form';
import { SyncPanel } from '@/components/sync-panel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { AVATARS, parseAge } from '@/data/children';
import { useStore } from '@/data/store';
import type { Child } from '@/data/types';

export default function ChildrenScreen() {
  const { children, activeChild, addChild, updateChild, removeChild, setActiveChild } = useStore();
  const [editingId, setEditingId] = useState<string>();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);

  function resetForm() {
    setEditingId(undefined);
    setName('');
    setAge('');
    setAvatar(AVATARS[0]);
  }

  function onEdit(child: Child) {
    setEditingId(child.id);
    setName(child.name);
    setAge(child.age ? String(child.age) : '');
    setAvatar(child.avatar);
  }

  function onSave() {
    const child = { name: name.trim(), age: parseAge(age), avatar };
    if (editingId) updateChild(editingId, child);
    else addChild(child);
    resetForm();
  }

  function onRemove(child: Child) {
    confirmDestructive(`刪除「${child.name}」？`, '這位孩子的書架和打卡紀錄都會一起刪除。', '刪除', () => {
      removeChild(child.id);
      if (editingId === child.id) resetForm();
    });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="subtitle">孩子</ThemedText>
          <SyncPanel />

          {children.map((child) => (
            <ThemedView key={child.id} type="backgroundElement" style={styles.childRow}>
              <Pressable style={styles.childInfo} onPress={() => setActiveChild(child.id)}>
                <ThemedText style={styles.avatar}>{child.avatar}</ThemedText>
                <View>
                  <ThemedText type="smallBold">
                    {child.name}
                    {child.id === activeChild?.id ? '（目前）' : ''}
                  </ThemedText>
                  {child.age ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {child.age} 歲
                    </ThemedText>
                  ) : null}
                </View>
              </Pressable>
              <Button title="編輯" onPress={() => onEdit(child)} />
              <Button title="刪除" onPress={() => onRemove(child)} />
            </ThemedView>
          ))}

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">{editingId ? '編輯孩子' : '新增孩子'}</ThemedText>
            <Field placeholder="名字或暱稱" value={name} onChangeText={setName} />
            <Field placeholder="年齡（可不填）" keyboardType="number-pad" value={age} onChangeText={setAge} />
            <View style={styles.avatars}>
              {AVATARS.map((a) => (
                <Button key={a} title={a} selected={a === avatar} onPress={() => setAvatar(a)} />
              ))}
            </View>
            <View style={styles.actions}>
              {editingId ? <Button title="取消" onPress={resetForm} /> : null}
              <Button title={editingId ? '儲存' : '新增'} onPress={onSave} disabled={!name.trim()} />
            </View>
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
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Spacing.three,
  },
  childInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  avatar: { fontSize: 28, lineHeight: 36 },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
});
