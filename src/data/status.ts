import type { BookStatus, ReadingMode } from './types';

export const STATUSES: { value: BookStatus; label: string }[] = [
  { value: 'reading', label: '在讀' },
  { value: 'done', label: '讀完了' },
  { value: 'want', label: '想讀' },
];

export const READING_MODES: { value: ReadingMode; label: string }[] = [
  { value: 'self', label: '自己看' },
  { value: 'mom', label: '媽媽唸' },
  { value: 'together', label: '一起看' },
];

export const modeLabel = (mode?: ReadingMode) => READING_MODES.find((m) => m.value === mode)?.label;
