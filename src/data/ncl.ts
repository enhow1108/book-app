// Taiwan's National Central Library ISBN center (全國新書資訊網). It has no API: a lookup needs a
// session cookie, a form POST and HTML parsing, and it sends no CORS headers, so this only runs
// on the server (src/app/api/isbn+api.ts).

const BASE = 'https://isbn.ncl.edu.tw/NEW_ISBNNet/';

export type NclBook = { title: string; author: string; publisher: string; date: string; audience: string };

/** Converts an ISBN-10 to ISBN-13; NCL only finds books by the 13-digit form. */
export function toIsbn13(raw: string): string {
  const isbn = raw.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (isbn.length !== 10) return isbn;
  const core = `978${isbn.slice(0, 9)}`;
  const sum = [...core].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return core + ((10 - (sum % 10)) % 10);
}

function sessionCookie(res: Response): string {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const cookies = headers.getSetCookie?.() ?? [res.headers.get('set-cookie') ?? ''];
  return cookies
    .map((c) => c.split(';')[0])
    .filter(Boolean)
    .join('; ');
}

function text(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Reads the first result row of NCL's search results table. */
export function parseNclResults(html: string): NclBook | null {
  const row = html.split(/<tr[\s>]/i).find((r) => /aria-label=["']書名["']/.test(r));
  if (!row) return null;
  const cell = (label: string) => {
    const m = row.match(new RegExp(`<td[^>]*aria-label=["']${label}["'][^>]*>([\\s\\S]*?)</td>`, 'i'));
    return m ? text(m[1]) : '';
  };
  const title = cell('書名');
  if (!title || title === '無資料') return null;
  return { title, author: cell('作者'), publisher: cell('出版者'), date: cell('日期'), audience: cell('適讀對象') };
}

export async function lookupNcl(rawIsbn: string): Promise<NclBook | null> {
  const isbn = toIsbn13(rawIsbn);
  if (!/^\d{13}$/.test(isbn)) return null;

  const home = await fetch(BASE);
  const cookie = sessionCookie(home);
  const body = new URLSearchParams({
    FO_SearchField0: 'ISBN',
    FO_SearchValue0: isbn,
    FB_clicked: 'FB_開始查詢',
    FB_pageSID: 'Simple',
    FO_Match: '2',
    FO_每頁筆數: '10',
    FO_目前頁數: '1',
    FB_ListOri: '',
    // Required: without a sort order NCL answers with a "無資料" placeholder row.
    FO_資料排序: 'PubMonth_Pre DESC',
  });
  const search = await fetch(`${BASE}H30_SearchBooks.php?&Pact=DisplayAll4Simple`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    redirect: 'manual',
  });
  // Results come back on the page the POST redirects to; "not found" redirects with Pmsg=找不到符合資料.
  const location = search.headers.get('location');
  if (location && decodeURIComponent(location).includes('找不到')) return null;
  const page = location
    ? await fetch(new URL(location, `${BASE}H30_SearchBooks.php`), { headers: { Cookie: cookie } })
    : search;
  return parseNclResults(await page.text());
}
