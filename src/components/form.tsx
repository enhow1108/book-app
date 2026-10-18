import { Pressable, StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Field(props: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      {...props}
      style={[styles.field, { color: theme.text, backgroundColor: theme.backgroundElement }, props.style]}
    />
  );
}

export function Button({
  title,
  onPress,
  disabled,
  selected,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={selected ? 'backgroundSelected' : 'backgroundElement'}
        style={[styles.button, disabled && styles.disabled]}>
        <ThemedText type="smallBold" themeColor={selected ? 'text' : 'textSecondary'}>
          {title}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    fontSize: 16,
  },
  button: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
});
