import { CHILD_COLORS, childColor } from '@/data/child-colors';

const kids = [{ id: 'a' }, { id: 'b' }, { id: 'c', color: 'teal' }, { id: 'd', color: 'no-such-colour' }];

test('a child shows the colour picked for them, else one by their place', () => {
  expect(childColor(kids, 'a')?.key).toBe('orange');
  expect(childColor(kids, 'b')?.key).toBe('blue');
  expect(childColor(kids, 'c')?.key).toBe('teal');
  // An unknown key (e.g. from a newer app version) falls back to the default for that place.
  expect(childColor(kids, 'd')?.key).toBe('green');
  expect(childColor(kids, 'nobody')).toBeUndefined();
});

test('the colours are all different', () => {
  expect(new Set(CHILD_COLORS.map((c) => c.light)).size).toBe(CHILD_COLORS.length);
  expect(new Set(CHILD_COLORS.map((c) => c.dark)).size).toBe(CHILD_COLORS.length);
});
