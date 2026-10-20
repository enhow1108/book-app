import { expect, test, type Page } from '@playwright/test';
import { join } from 'path';

// Walks through the main things a parent does on the web build, in a fresh browser with no saved data.
// Nothing outside the app's own server is reached: book lookups, covers and Firebase are cut off,
// so the test doesn't depend on (or write to) any outside service.

const errors: string[] = [];

test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.route((url) => url.hostname !== 'localhost', (route) => route.abort());
});

test.afterEach(() => {
  expect(errors, 'the page threw errors').toEqual([]);
});

// Screens visited earlier stay in the page, hidden, so only visible matches count.
const shown = (page: Page, text: string | RegExp) => page.getByText(text, { exact: true }).filter({ visible: true });
const button = (page: Page, title: string) => shown(page, title).first();
const tab = (page: Page, name: string) => page.getByRole('link', { name, exact: true }).click();

async function addChild(page: Page, name: string) {
  await page.goto('children');
  await page.getByPlaceholder('名字或暱稱').fill(name);
  await button(page, '新增').click();
  await expect(shown(page, new RegExp(`^${name}`)).first()).toBeVisible();
}

test('add a child, a book and a read; it is all still there after a reload', async ({ page }) => {
  await page.goto('');
  await expect(shown(page, '全家的書架').first()).toBeVisible();
  await expect(shown(page, '還沒有孩子的檔案。').first()).toBeVisible();

  await addChild(page, '小明');

  await tab(page, '書架');
  await button(page, '＋ 加一本書').click();
  // A made-up ISBN: lookups are cut off, so it ends in manual entry.
  await page.getByPlaceholder('ISBN 條碼數字').fill('9786660000000');
  await button(page, '查詢').click();
  await expect(shown(page, /查不到這本書/).first()).toBeVisible();
  await page.getByPlaceholder('書名').fill('測試的書');
  await page.getByPlaceholder('作者').fill('測試作者');
  await button(page, '加入書架').click();
  await expect(shown(page, '測試的書').first()).toBeVisible();

  await tab(page, '打卡');
  await expect(shown(page, '全家最近讀的書').first()).toBeVisible();
  await button(page, '媽媽唸').click();
  await button(page, '媽媽唸 +1').click();
  await button(page, '媽媽唸 +1').click();
  await expect(shown(page, '今天 2 次 · 共 2 次').first()).toBeVisible();
  await button(page, '−').click();
  await expect(shown(page, '今天 1 次 · 共 1 次').first()).toBeVisible();

  await tab(page, '紀錄');
  await expect(shown(page, '測試的書').first()).toBeVisible();

  await page.reload();
  await tab(page, '打卡');
  await expect(shown(page, '今天 1 次 · 共 1 次').first()).toBeVisible();
});

test('import a CSV, then undo it', async ({ page }) => {
  await page.goto('history');
  const chooser = page.waitForEvent('filechooser');
  await button(page, '匯入 CSV').click();
  await (await chooser).setFiles(join(__dirname, '..', 'fixtures', 'sample-import.csv'));
  await expect(shown(page, '會加入 6 次閱讀（2026-10-13 ～ 2026-10-15）').first()).toBeVisible();
  await expect(shown(page, /^會新增孩子：/).first()).toBeVisible();
  await button(page, '確認匯入').click();
  await expect(shown(page, 'sample-import.csv').first()).toBeVisible();
  await expect(shown(page, /匯入 · 5 筆紀錄 · 4 本新書/).first()).toBeVisible();

  await tab(page, '書架');
  await expect(shown(page, 'Frog and Toad, Together').first()).toBeVisible();

  // Importing the same file again finds nothing new.
  await tab(page, '紀錄');
  const again = page.waitForEvent('filechooser');
  await button(page, '匯入 CSV').click();
  await (await again).setFiles(join(__dirname, '..', 'fixtures', 'sample-import.csv'));
  await expect(shown(page, '沒有新的閱讀紀錄可以加入。').first()).toBeVisible();
  await button(page, '取消').click();

  await button(page, '復原').click();
  await expect(shown(page, /匯入 · 5 筆紀錄/)).toHaveCount(0);
  await tab(page, '書架');
  await expect(shown(page, 'Frog and Toad, Together')).toHaveCount(0);
});

test('a full backup restores into a fresh browser', async ({ page, browser }) => {
  await addChild(page, '小美');
  await page.goto('history');
  const download = page.waitForEvent('download');
  await button(page, '匯出備份檔').click();
  const file = await (await download).path();

  const fresh = await browser.newPage();
  await fresh.route((url) => url.hostname !== 'localhost', (route) => route.abort());
  fresh.on('dialog', (d) => d.accept());
  await fresh.goto('history');
  const chooser = fresh.waitForEvent('filechooser');
  await button(fresh, '從備份還原').click();
  await (await chooser).setFiles(file);
  await button(fresh, '確認還原').click();
  await fresh.goto('children');
  await expect(shown(fresh, /^小美/).first()).toBeVisible();
});

test('every tab opens, also straight from its address', async ({ page }) => {
  for (const path of ['', 'checkin', 'history', 'children']) {
    await page.goto(path);
    await expect(page.getByRole('link', { name: '孩子', exact: true })).toBeVisible();
  }
});
