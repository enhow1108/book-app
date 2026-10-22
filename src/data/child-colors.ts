/**
 * Page colours a child can have, so it is clear whose books are on screen.
 * The first six are given out in turn, alternating warm and cool, until a parent picks one.
 */
export const CHILD_COLORS = [
  { key: 'orange', label: '橘', light: '#FFD9C2', dark: '#3A2418' },
  { key: 'blue', label: '藍', light: '#C9E2FF', dark: '#162A42' },
  { key: 'yellow', label: '黃', light: '#FFE9A3', dark: '#3A3010' },
  { key: 'green', label: '綠', light: '#C8EDD3', dark: '#163222' },
  { key: 'pink', label: '粉', light: '#FFCFE0', dark: '#3A1626' },
  { key: 'purple', label: '紫', light: '#DCCFFF', dark: '#261C42' },
  { key: 'teal', label: '青', light: '#BDEDEA', dark: '#123433' },
  { key: 'red', label: '紅', light: '#FFC7C2', dark: '#3D1A17' },
  { key: 'sand', label: '米', light: '#EADBC6', dark: '#2F2719' },
  { key: 'gray', label: '灰', light: '#D9DCE3', dark: '#24272D' },
] as const;

const DEFAULT_ORDER = 6;

/** The colour a child shows: the one picked for them, else one by their place among the children. */
export function childColor(children: { id: string; color?: string }[], childId: string) {
  const index = children.findIndex((c) => c.id === childId);
  if (index < 0) return undefined;
  return CHILD_COLORS.find((c) => c.key === children[index].color) ?? CHILD_COLORS[index % DEFAULT_ORDER];
}
