import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useStore } from '@/data/store';

/** Row of child avatars at the top of a screen; tapping one makes it the active child. */
export function ChildSwitcher() {
  const { children, activeChild, setActiveChild } = useStore();

  if (children.length === 0) {
    return (
      <ThemedView type="backgroundElement" style={styles.empty}>
        <ThemedText type="small">還沒有孩子的檔案。</ThemedText>
        <Link href="/children">
          <ThemedText type="link">先新增一位孩子 →</ThemedText>
        </Link>
      </ThemedView>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {children.map((child) => {
        const selected = child.id === activeChild?.id;
        return (
          <Pressable key={child.id} onPress={() => setActiveChild(child.id)}>
            <ThemedView type={selected ? 'backgroundSelected' : 'backgroundElement'} style={styles.chip}>
              <ThemedText>{child.avatar}</ThemedText>
              <ThemedText type="smallBold" themeColor={selected ? 'text' : 'textSecondary'}>
                {child.name}
              </ThemedText>
            </ThemedView>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  empty: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
});
