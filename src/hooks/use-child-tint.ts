import { useColorScheme } from '@/hooks/use-color-scheme';
import { useStore } from '@/data/store';

// Page tints, one per child in the order they were added, so it is clear whose books are on screen.
// Neighbours alternate warm and cool so siblings never get look-alike colours.
const LIGHT = ['#FFD9C2', '#C9E2FF', '#FFE9A3', '#C8EDD3', '#FFCFE0', '#DCCFFF'];
const DARK = ['#3A2418', '#162A42', '#3A3010', '#163222', '#3A1626', '#261C42'];

/** The active child's page background, or undefined to keep the normal one. */
export function useChildTint() {
  const { children, activeChild } = useStore();
  const scheme = useColorScheme();
  const index = children.findIndex((c) => c.id === activeChild?.id);
  if (index < 0) return undefined;
  const palette = scheme === 'dark' ? DARK : LIGHT;
  return palette[index % palette.length];
}
