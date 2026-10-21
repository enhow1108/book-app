import { isBookBarcode, isIsbn13, validEan13 } from '@/data/barcode';
import { cleanOpenBdAuthor, lookupIsbn } from '@/data/isbn';
import { fromLanguageCode, guessLanguage } from '@/data/language';

/** Adds the EAN-13 check digit to 12 made-up digits. */
const ean = (twelve: string) => {
  const sum = [...twelve].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return twelve + ((10 - (sum % 10)) % 10);
};

describe('book barcodes', () => {
  const isbn = ean('978400000001');
  const magazine = ean('491012345065');

  test('check digits are verified', () => {
    expect(validEan13(isbn)).toBe(true);
    expect(validEan13(isbn.slice(0, 12) + ((Number(isbn[12]) + 1) % 10))).toBe(false);
    expect(validEan13('12345')).toBe(false);
  });

  test('ISBNs and Japanese magazine codes count as books', () => {
    expect(isIsbn13(isbn)).toBe(true);
    expect(isBookBarcode(isbn)).toBe(true);
    expect(isIsbn13(magazine)).toBe(false);
    expect(isBookBarcode(magazine)).toBe(true);
  });

  test("Japan's price bar under the ISBN and in-store stickers are skipped", () => {
    expect(isBookBarcode(ean('192000000000'))).toBe(false);
    expect(isBookBarcode(ean('200000000000'))).toBe(false);
  });
});

describe('Japanese books', () => {
  test('kana means Japanese, other CJK Chinese, the rest English', () => {
    expect(guessLanguage('おふねにのって')).toBe('ja');
    expect(guessLanguage('月亮，晚安')).toBe('zh');
    expect(guessLanguage('Frog and Toad')).toBe('en');
    expect(fromLanguageCode('ja', '')).toBe('ja');
    expect(fromLanguageCode('zh-TW', '')).toBe('zh');
    expect(fromLanguageCode(undefined, 'くまのこ')).toBe('ja');
  });

  test('openBD author names are tidied', () => {
    expect(cleanOpenBdAuthor('山田,花子 田中,一郎')).toBe('山田花子、田中一郎');
    expect(cleanOpenBdAuthor('やまだはなこ／ぶん')).toBe('やまだはなこ');
  });
});

describe('lookupIsbn', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  test('a magazine code is not looked up anywhere', async () => {
    global.fetch = jest.fn();
    expect(await lookupIsbn(ean('491012345065'))).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('a 978-4 ISBN asks openBD first', async () => {
    const isbn = ean('978400000001');
    global.fetch = jest.fn(async () => ({
      json: async () => [{ summary: { title: 'くまのぼうけん', author: '山田,花子', cover: 'https://example.com/c.jpg' } }],
    })) as unknown as typeof fetch;
    expect(await lookupIsbn(isbn)).toEqual({
      title: 'くまのぼうけん',
      author: '山田花子',
      language: 'ja',
      coverUrl: 'https://example.com/c.jpg',
    });
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('api.openbd.jp');
  });
});
