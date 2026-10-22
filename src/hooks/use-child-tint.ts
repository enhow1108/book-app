import { childColor } from '@/data/child-colors';
import { useStore } from '@/data/store';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** The active child's page background, or undefined to keep the normal one. */
export function useChildTint() {
  const { children, activeChild } = useStore();
  const scheme = useColorScheme();
  const color = activeChild ? childColor(children, activeChild.id) : undefined;
  return color && (scheme === 'dark' ? color.dark : color.light);
}
