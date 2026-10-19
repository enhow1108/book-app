import { AVATARS } from './children';
import { parseCsv, toCsv } from './csv';
import { bookFinder, isbnKey, newId, shelfId, titleKey, type State } from './library';
import { modeLabel } from './status';
import type { BookLanguage, Child, ImportRecord, LibraryBook, ReadingLog, ReadingMode, ShelfEntry } from './types';

type Field =
  | 'date'
  | 'child'
  | 'title'
  | 'times'
  | 'author'
  | 'isbn'
  | 'publisher'
  | 'published'
  | 'publisherPublished'
  | 'mode'
  | 'language'
  | 'level'
  | 'note';

/** Column names the importer understands, in English or Chinese. Other columns are ignored. */
const ALIASES: Record<Field, string[]> = {
  date: ['date', '日期'],
  child: ['child', '孩子', '打卡對象', '打卡对象'],
  title: ['title', '書名', '书名'],
  times: ['times', '次數', '次数'],
  author: ['author', '作者'],
  isbn: ['isbn'],
  publisher: ['publisher', '出版社'],
  published: ['published', '出版年月', '出版日期'],
  publisherPublished: ['publisher_published', '出版社/出版年月'],
  mode: ['mode', '閱讀方式', '阅读方式'],
  language: ['language', '語言', '语言'],
  level: ['level', '級別', '级别', '花生級別', '花生级别'],
  note: ['note', '備註', '备注', '心得'],
};

const MODES: Record<string, ReadingMode> = {
  self: 'self',
  自己看: 'self',
  mom: 'mom',
  parent: 'mom',
  媽媽唸: 'mom',
  媽媽念: 'mom',
  妈妈念: 'mom',
  爸媽唸: 'mom',
  together: 'together',
  一起看: 'together',
};

export type ImportProblem = { file: string; line?: number; message: string };

export type ImportPlan = {
  record: ImportRecord;
  children: Child[];
  books: LibraryBook[];
  /** Existing books that gained details (author, publisher…) from the file. */
  updatedBooks: LibraryBook[];
  shelf: ShelfEntry[];
  logs: ReadingLog[];
  summary: {
    rows: number;
    /** Reads (counting 次數) that will be added. */
    reads: number;
    /** Reads already in the app, or repeated across files, that are skipped. */
    duplicateReads: number;
    newBooks: number;
    matchedBooks: number;
    newChildNames: string[];
    perChild: { name: string; reads: number }[];
    firstDate?: string;
    lastDate?: string;
  };
  problems: ImportProblem[];
};

export type ImportFile = { name: string; text: string };

/** Accepts 2024-03-05, 2024/3/5 or 2024.3.5. */
function parseDate(raw: string): string | undefined {
  const m = raw.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parsePublished(raw: string): string | undefined {
  const m = raw.trim().match(/^(\d{4})(?:[-/.](\d{1,2}))?(?:[-/.](\d{1,2}))?/);
  if (!m) return undefined;
  return [m[1], m[2]?.padStart(2, '0'), m[3]?.padStart(2, '0')].filter(Boolean).join('-');
}

/** Splits 小花生's "出版社/出版年月" cell, such as "Candlewick/2001-01" or "九童國際文化/2005/05/05". */
function splitPublisher(raw: string): { publisher?: string; published?: string } {
  const m = raw.trim().match(/^(.*?)\/(\d{4}.*)$/);
  if (!m) return { publisher: raw.trim() || undefined };
  return { publisher: m[1].trim() || undefined, published: parsePublished(m[2]) };
}

const guessLanguage = (title: string): BookLanguage => (/[㐀-鿿]/.test(title) ? 'zh' : 'en');

function parseLanguage(raw: string, title: string): BookLanguage {
  const v = raw.trim().toLowerCase();
  if (['zh', '中文', 'chinese'].includes(v)) return 'zh';
  if (['en', '英文', 'english'].includes(v)) return 'en';
  return guessLanguage(title);
}

type BookInfo = {
  title: string;
  author?: string;
  isbn?: string;
  publisher?: string;
  publishedAt?: string;
  level?: string;
  language: BookLanguage;
};

type Read = { childName: string; date: string; bookKey: string; mode?: ReadingMode; times: number; notes: string[] };

const bookKeyOf = (info: { title: string; isbn?: string }) => isbnKey(info.isbn) ?? `t:${titleKey(info.title)}`;

function mergeInfo(a: BookInfo | undefined, b: BookInfo): BookInfo {
  if (!a) return b;
  return {
    ...a,
    author: a.author || b.author,
    isbn: a.isbn || b.isbn,
    publisher: a.publisher || b.publisher,
    publishedAt: a.publishedAt || b.publishedAt,
    level: a.level || b.level,
  };
}

/** Reads one file's rows into reads keyed by child, day, book and reading mode. */
function readFile(file: ImportFile, books: Map<string, BookInfo>, problems: ImportProblem[], fallbackChild?: string) {
  const reads = new Map<string, Read>();
  const [header, ...rows] = parseCsv(file.text);
  if (!header) {
    problems.push({ file: file.name, message: '檔案是空的。' });
    return { reads, rows: 0 };
  }
  const names = header.map((h) => h.trim().toLowerCase());
  const col = {} as Record<Field, number>;
  for (const field of Object.keys(ALIASES) as Field[]) {
    col[field] = names.findIndex((n) => ALIASES[field].includes(n));
  }
  if (col.date < 0 || col.title < 0) {
    problems.push({
      file: file.name,
      message:
        col.title >= 0
          ? '沒有「日期」欄。這可能是彙總表（例如「書籍閱讀次數」），請改用每次閱讀一列的明細檔。'
          : '找不到「日期」和「書名」欄，請確認第一列是欄位名稱。',
    });
    return { reads, rows: 0 };
  }
  if (col.child < 0 && !fallbackChild) {
    problems.push({ file: file.name, message: '沒有「孩子」欄，也還沒有選孩子。' });
    return { reads, rows: 0 };
  }

  let count = 0;
  rows.forEach((cells, i) => {
    const line = i + 2;
    const cell = (f: Field) => (col[f] >= 0 ? (cells[col[f]] ?? '').trim() : '');
    const title = cell('title');
    const date = parseDate(cell('date'));
    if (!title || !date) {
      problems.push({ file: file.name, line, message: !title ? '沒有書名' : `日期看不懂：「${cell('date')}」` });
      return;
    }
    const timesRaw = cell('times');
    const times = timesRaw ? Number.parseInt(timesRaw, 10) : 1;
    if (!(times > 0)) {
      problems.push({ file: file.name, line, message: `次數看不懂：「${timesRaw}」` });
      return;
    }
    const modeRaw = cell('mode');
    const mode = modeRaw ? MODES[modeRaw.toLowerCase()] : undefined;
    if (modeRaw && !mode) {
      problems.push({ file: file.name, line, message: `閱讀方式看不懂：「${modeRaw}」，這列會當成未記錄。` });
    }
    const split = splitPublisher(cell('publisherPublished'));
    const info: BookInfo = {
      title,
      author: cell('author') || undefined,
      isbn: isbnKey(cell('isbn')),
      publisher: cell('publisher') || split.publisher,
      publishedAt: parsePublished(cell('published')) ?? split.published,
      level: cell('level') || undefined,
      language: parseLanguage(cell('language'), title),
    };
    const bookKey = bookKeyOf(info);
    books.set(bookKey, mergeInfo(books.get(bookKey), info));

    const childNames = (cell('child') || fallbackChild || '')
      .split(/[+＋、]/)
      .map((n) => n.trim())
      .filter(Boolean);
    const note = cell('note');
    for (const childName of childNames) {
      const key = [childName, date, bookKey, mode ?? ''].join('|');
      const read = reads.get(key) ?? { childName, date, bookKey, mode, times: 0, notes: [] };
      read.times += times;
      if (note && !read.notes.includes(note)) read.notes.push(note);
      reads.set(key, read);
    }
    count++;
  });
  return { reads, rows: count };
}

/**
 * Works out what importing the files would add, without changing anything.
 * A read that appears in several files (for example a joint read in each child's export) counts once:
 * for each child, day, book and reading mode the largest count among the files is used, and reads
 * already in the app are subtracted, so importing the same file twice adds nothing the second time.
 */
export function planImport(files: ImportFile[], state: State): ImportPlan {
  const problems: ImportProblem[] = [];
  const bookInfo = new Map<string, BookInfo>();
  const activeName = state.children.find((c) => c.id === state.activeChildId)?.name;
  const merged = new Map<string, Read>();
  let rows = 0;
  let totalInFiles = 0;
  for (const file of files) {
    const result = readFile(file, bookInfo, problems, activeName);
    rows += result.rows;
    for (const [key, read] of result.reads) {
      totalInFiles += read.times;
      const prev = merged.get(key);
      if (!prev || read.times > prev.times) merged.set(key, { ...read, notes: [...(prev?.notes ?? []), ...read.notes] });
      else for (const n of read.notes) if (!prev.notes.includes(n)) prev.notes.push(n);
    }
  }

  const importId = newId();
  const at = new Date().toISOString();

  // Children: matched by name, otherwise added.
  const children: Child[] = [];
  const childIdOf = new Map(state.children.map((c) => [c.name.trim(), c.id]));
  for (const read of merged.values()) {
    if (childIdOf.has(read.childName)) continue;
    const id = newId();
    childIdOf.set(read.childName, id);
    children.push({ id, name: read.childName, avatar: AVATARS[(state.children.length + children.length) % AVATARS.length] });
  }

  // Books: matched by ISBN or title, otherwise added. Matched books gain any details they were missing.
  const books: LibraryBook[] = [];
  const updated = new Map<string, LibraryBook>();
  const bookIdOf = new Map<string, string>();
  let matchedBooks = 0;
  const usedKeys = new Set([...merged.values()].map((r) => r.bookKey));
  const finder = bookFinder(state.books);
  const isNew = new Set<string>();
  for (const key of usedKeys) {
    const info = bookInfo.get(key)!;
    const existing = finder.find(info);
    if (existing) {
      if (!isNew.has(existing.id)) matchedBooks++;
      bookIdOf.set(key, existing.id);
      const filled: LibraryBook = {
        ...existing,
        author: existing.author || info.author || '',
        isbn: existing.isbn ?? info.isbn,
        publisher: existing.publisher ?? info.publisher,
        publishedAt: existing.publishedAt ?? info.publishedAt,
        level: existing.level ?? info.level,
      };
      const changed = (['author', 'isbn', 'publisher', 'publishedAt', 'level'] as const).some(
        (k) => filled[k] !== existing[k]
      );
      if (changed && !isNew.has(existing.id)) updated.set(existing.id, filled);
      continue;
    }
    const book: LibraryBook = {
      id: newId(),
      title: info.title,
      author: info.author ?? '',
      language: info.language,
      isbn: info.isbn,
      publisher: info.publisher,
      publishedAt: info.publishedAt,
      level: info.level,
      addedAt: at,
      importId,
    };
    books.push(book);
    finder.add(book);
    isNew.add(book.id);
    bookIdOf.set(key, book.id);
  }

  // Reads already in the app, per child, day, book and mode.
  const existingTimes = new Map<string, number>();
  for (const l of state.logs) {
    const key = [l.childId, l.date, l.bookId, l.mode ?? ''].join('|');
    existingTimes.set(key, (existingTimes.get(key) ?? 0) + (l.times ?? 1));
  }

  const logs: ReadingLog[] = [];
  const shelf = new Map<string, ShelfEntry>();
  const onShelf = new Set(state.shelf.map((e) => e.id));
  const perChild = new Map<string, number>();
  let reads = 0;
  for (const read of merged.values()) {
    const childId = childIdOf.get(read.childName)!;
    const bookId = bookIdOf.get(read.bookKey)!;
    const key = [childId, read.date, bookId, read.mode ?? ''].join('|');
    const times = read.times - (existingTimes.get(key) ?? 0);
    if (times <= 0) continue;
    logs.push({
      id: newId(),
      childId,
      bookId,
      date: read.date,
      times,
      mode: read.mode,
      note: read.notes.join('；') || undefined,
      importId,
    });
    reads += times;
    perChild.set(read.childName, (perChild.get(read.childName) ?? 0) + times);
    const sid = shelfId(childId, bookId);
    if (!onShelf.has(sid) && !shelf.has(sid)) {
      shelf.set(sid, { id: sid, childId, bookId, status: 'done', addedAt: at, importId });
    }
  }
  logs.sort((a, b) => b.date.localeCompare(a.date));

  const dates = logs.map((l) => l.date);
  const loggedBooks = new Set(logs.map((l) => l.bookId));
  const newBooks = books.filter((b) => loggedBooks.has(b.id));
  return {
    record: { id: importId, at, fileNames: files.map((f) => f.name), books: newBooks.length, logs: logs.length },
    children: children.filter((c) => perChild.has(c.name)),
    books: newBooks,
    updatedBooks: [...updated.values()],
    shelf: [...shelf.values()],
    logs,
    summary: {
      rows,
      reads,
      duplicateReads: totalInFiles - reads,
      newBooks: newBooks.length,
      matchedBooks,
      newChildNames: children.filter((c) => perChild.has(c.name)).map((c) => c.name),
      perChild: [...perChild].map(([name, n]) => ({ name, reads: n })),
      firstDate: dates.length ? dates[dates.length - 1] : undefined,
      lastDate: dates[0],
    },
    problems,
  };
}

const EXPORT_HEADER = ['日期', '孩子', '書名', '次數', '閱讀方式', '作者', 'ISBN', '出版社', '出版年月', '語言', '級別', '備註'];

/** All reading logs as CSV, in the same format the importer reads. */
export function exportCsv(state: State): string {
  const books = new Map(state.books.map((b) => [b.id, b]));
  const names = new Map(state.children.map((c) => [c.id, c.name]));
  const rows = [...state.logs]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((l) => {
      const b = books.get(l.bookId);
      return [
        l.date,
        names.get(l.childId) ?? '',
        b?.title ?? '',
        String(l.times ?? 1),
        modeLabel(l.mode) ?? '',
        b?.author ?? '',
        b?.isbn ?? '',
        b?.publisher ?? '',
        b?.publishedAt ?? '',
        b?.language ?? '',
        b?.level ?? '',
        l.note ?? '',
      ];
    });
  return toCsv([EXPORT_HEADER, ...rows]);
}
