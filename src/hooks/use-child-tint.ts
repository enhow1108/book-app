import { useColorScheme } from '@/hooks/use-color-scheme';
import { useStore } from '@/data/store';

// Soft page tints, one per child in the order they were added, so it is clear whose books are on screen.
const LIGHT = ['#FFE9DC', '#E2EFFF', '#E3F5E7', '#EFE4FF', '#FFF2D1', '#FFE3EC'];
const DARK = ['#2A1D17', '#16202C', '#16241A', '#221A2C', '#28220F', '#2A1820'];

/** The active child's page background, or undefined to keep the normal one. */
export function useChildTint() {
  const { children, activeChild } = useStore();
  const scheme = useColorScheme();
  const index = children.findIndex((c) => c.id === activeChild?.id);
  if (index < 0) return undefined;
  const palette = scheme === 'dark' ? DARK : LIGHT;
  return palette[index % palette.length];
}
