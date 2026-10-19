/** The kinds of records kept on the device, one table (or object store) each. */
export const TABLES = ['children', 'books', 'shelf', 'logs', 'imports'] as const;
export type Table = (typeof TABLES)[number];

export type Row = { id: string };

/** Everything saved on the device, as loaded at startup. */
export type Saved = { tables: Record<Table, Row[]>; meta: Record<string, string> };

/** Rows to write and ids to delete, applied together. */
export type Changes = {
  put: Partial<Record<Table, Row[]>>;
  remove: Partial<Record<Table, string[]>>;
  meta?: Record<string, string>;
};
