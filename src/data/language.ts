import type { BookLanguage } from './types';

export const LANGUAGES: { value: BookLanguage; label: string }[] = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
];

export const languageLabel = (language: BookLanguage) =>
  LANGUAGES.find((l) => l.value === language)?.label ?? language;

/** Kana means Japanese; other CJK characters mean Chinese; anything else counts as English. */
export function guessLanguage(text: string): BookLanguage {
  if (/[぀-ヿ]/.test(text)) return 'ja';
  if (/[㐀-鿿]/.test(text)) return 'zh';
  return 'en';
}

/** Turns a language code from a book database (zh-TW, ja, en-US, ...) into ours, guessing from the title when unsure. */
export function fromLanguageCode(code: string | undefined, title: string): BookLanguage {
  const c = code?.toLowerCase() ?? '';
  if (c.startsWith('ja') || c === 'jpn') return 'ja';
  if (c.startsWith('zh') || c === 'chi' || c === 'zho') return 'zh';
  if (c.startsWith('en') || c === 'eng') return 'en';
  return guessLanguage(title);
}
