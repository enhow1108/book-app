import {
  defaultTabsSlotRender,
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Freeze } from 'react-freeze';
import { Pressable, View, StyleSheet, type PressableProps } from 'react-native';

import { MaxContentWidth, Spacing } from '@/constants/theme';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} renderFn={frozenWhenHidden} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="checkin" href="/" asChild>
            <TabButton>打卡</TabButton>
          </TabTrigger>
          <TabTrigger name="shelf" href="/shelf" asChild>
            <TabButton>書架</TabButton>
          </TabTrigger>
          <TabTrigger name="history" href="/history" asChild>
            <TabButton>紀錄</TabButton>
          </TabTrigger>
          <TabTrigger name="children" href="/children" asChild>
            <TabButton>孩子</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

// Tabs already visited stay mounted. Without this every hidden tab redraws on each tap, re-sorting the
// family's thousands of books and logs; frozen, a tab catches up only when it's shown again.
const frozenWhenHidden: typeof defaultTabsSlotRender = (descriptor, options) =>
  defaultTabsSlotRender(
    { ...descriptor, render: () => <Freeze freeze={!options.isFocused}>{descriptor.render()}</Freeze> },
    options,
  );

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...(props as PressableProps)} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}>
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        <ThemedText type="smallBold" style={styles.brandText}>
          小書蟲
        </ThemedText>

        {props.children}

      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Docked at the bottom like a phone app's tab bar, so it never covers a screen's header.
  tabListContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brandText: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
});
