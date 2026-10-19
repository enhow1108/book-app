import type { BookStatus } from './types';

export const STATUSES: { value: BookStatus; label: string }[] = [
  { value: 'reading', label: '在讀' },
  { value: 'done', label: '讀完了' },
  { value: 'want', label: '想讀' },
];
