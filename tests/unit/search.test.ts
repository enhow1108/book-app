import { byTitle, matchBooks, searchKey } from '@/data/search';

test('search ignores case, spaces, punctuation and full-width letters', () => {
  const title = searchKey('Project X: Alien Adventures: Brown: The Moon Winder');
  expect(title.includes(searchKey('project x'))).toBe(true);
  expect(title.includes(searchKey('projectx'))).toBe(true);
  expect(title.includes(searchKey('ＰＲＯＪＥＣＴ Ｘ'))).toBe(true);
  expect(searchKey('小熊 學校').includes(searchKey('小熊學校'))).toBe(true);
});

test('title order keeps numbers in order', () => {
  const books = [{ title: 'Level 10' }, { title: 'level 2' }, { title: 'Apple' }];
  expect([...books].sort(byTitle).map((b) => b.title)).toEqual(['Apple', 'level 2', 'Level 10']);
});

test('matchBooks finds family books from a single character, titles that start with it first', () => {
  const books = [
    { title: '冬天的寒冬用品店', author: '' },
    { title: '寒冬用品店', author: '福澤由美子' },
    { title: 'I Am a Leaf', author: 'Jean Marzollo' },
  ];
  expect(matchBooks(books, '寒').map((b) => b.title)).toEqual(['寒冬用品店', '冬天的寒冬用品店']);
  expect(matchBooks(books, 'marzollo').map((b) => b.title)).toEqual(['I Am a Leaf']);
  expect(matchBooks(books, '  ')).toEqual([]);
});
