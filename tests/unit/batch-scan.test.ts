import { addScan, readyBooks, type ScanItem } from '@/data/batch-scan';

const item = (code: string, status: ScanItem['status'], title: string): ScanItem => ({
  code,
  status,
  book: { title, author: '', language: 'zh', isbn: code },
});

test('a barcode scanned twice is listed once, newest first', () => {
  let list = addScan([], '978-0-00-000001-1');
  list = addScan(list, '9780000000028');
  list = addScan(list, '9780000000011');
  expect(list.map((i) => i.code)).toEqual(['9780000000028', '9780000000011']);
  expect(list[0].status).toBe('looking');
});

test('only books with a title are ready, each once, in the order they were scanned', () => {
  const list = [
    item('4', 'found', '  小熊上學去 '),
    item('3', 'missing', ''),
    item('2', 'looking', ''),
    item('1', 'known', '小熊上學去'),
    item('0', 'found', '月亮晚安'),
  ];
  expect(readyBooks(list).map((b) => [b.isbn, b.title])).toEqual([
    ['0', '月亮晚安'],
    ['1', '小熊上學去'],
  ]);
});
