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

// Changes are saved to the browser's database a moment after they show; reloading the page right away
// can lose them on a slow machine. So once the app is open, move between screens with the tabs.
async function addChild(page: Page, name: string) {
  if (page.url() === 'about:blank') await page.goto('children');
  else await tab(page, '孩子');
  await page.getByPlaceholder('名字或暱稱').fill(name);
  await button(page, '新增').click();
  await expect(shown(page, new RegExp(`^${name}`)).first()).toBeVisible();
}

test('add a child, a book and a read; it is all still there after a reload', async ({ page }) => {
  await page.goto('');
  await expect(shown(page, '今日打卡').first()).toBeVisible();
  await expect(shown(page, '還沒有孩子的檔案。').first()).toBeVisible();

  await addChild(page, '小明');

  await tab(page, '書架');
  await button(page, '＋ 加一本書').click();
  // A made-up ISBN: lookups are cut off, so it ends in manual entry.
  await page.getByPlaceholder('ISBN 或條碼數字').fill('9786660000000');
  await button(page, '查詢').click();
  await expect(shown(page, /查不到這本書/).first()).toBeVisible();
  await page.getByPlaceholder('書名').fill('測試的書');
  await page.getByPlaceholder('作者').fill('測試作者');
  await button(page, '加入書架').click();
  await expect(shown(page, '測試的書').first()).toBeVisible();

  await tab(page, '打卡');
  await expect(shown(page, '小明最近讀的書').first()).toBeVisible();
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
  await tab(page, '紀錄');
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
  await tab(fresh, '孩子');
  await expect(shown(fresh, /^小美/).first()).toBeVisible();
});

test('every tab opens, also straight from its address', async ({ page }) => {
  for (const path of ['', 'shelf', 'history', 'children']) {
    await page.goto(path);
    await expect(page.getByRole('link', { name: '孩子', exact: true })).toBeVisible();
  }
});

test('scan check-in: a new book is logged for the chosen child and joins the family shelf', async ({ page }) => {
  await addChild(page, '小明');
  await addChild(page, '小美');
  await tab(page, '打卡');
  await expect(shown(page, '掃描打卡').first()).toBeVisible();
  // A made-up ISBN: lookups are cut off, so the title is typed in.
  await page.getByPlaceholder('ISBN 或條碼數字').first().fill('9786660000000');
  await button(page, '查詢').click();
  await expect(shown(page, /查不到這本書/).first()).toBeVisible();
  await page.getByPlaceholder('書名').first().fill('掃描的書');
  await button(page, '🐛 小美').click();
  await button(page, '一起看').click();
  await button(page, '＋').click();
  await button(page, '＋').click();
  await button(page, '打卡').click();
  await expect(shown(page, '已幫小美記上「掃描的書」一起看 3 次，也加進全家書架了。').first()).toBeVisible();
  await expect(shown(page, '今天 3 次 · 共 3 次').first()).toBeVisible();

  await tab(page, '書架');
  await expect(shown(page, '掃描的書').first()).toBeVisible();
});

test('a Japanese magazine barcode (no ISBN) is checked in by hand, and found again the next time', async ({ page }) => {
  await addChild(page, '小明');
  await tab(page, '打卡');
  // A made-up 491 magazine code with a valid check digit.
  await page.getByPlaceholder('ISBN 或條碼數字').first().fill('4910123450650');
  await button(page, '查詢').click();
  await expect(shown(page, /這是雜誌或商品條碼/).first()).toBeVisible();
  await page.getByPlaceholder('書名').first().fill('くまのえほん');
  await button(page, '打卡').click();
  await expect(shown(page, /已幫小明記上「くまのえほん」/).first()).toBeVisible();

  await page.getByPlaceholder('ISBN 或條碼數字').first().fill('4910123450650');
  await button(page, '查詢').click();
  await expect(shown(page, '已在全家書架上').first()).toBeVisible();
  await expect(shown(page, 'くまのえほん').first()).toBeVisible();
});

test('check-in without a barcode: typing the title of a book on the shelf logs it, not a second copy', async ({ page }) => {
  await addChild(page, '小明');
  await tab(page, '打卡');
  await button(page, '沒有條碼，自己輸入書名').click();
  await page.getByPlaceholder('書名').first().fill('手寫的書');
  await button(page, '打卡').click();
  await expect(shown(page, '已幫小明記上「手寫的書」自己看 1 次，也加進全家書架了。').first()).toBeVisible();

  await button(page, '沒有條碼，自己輸入書名').click();
  await page.getByPlaceholder('書名').first().fill('手寫的書');
  await button(page, '打卡').click();
  await expect(shown(page, '已幫小明記上「手寫的書」自己看 1 次。').first()).toBeVisible();
  await expect(shown(page, '今天 2 次 · 共 2 次').first()).toBeVisible();
});

test('check in for yesterday, then fix and delete the record', async ({ page }) => {
  await addChild(page, '小明');
  await addChild(page, '小美');
  await tab(page, '打卡');
  await button(page, '‹ 前一天').click();
  await expect(shown(page, '昨天').first()).toBeVisible();
  await button(page, '沒有條碼，自己輸入書名').click();
  await page.getByPlaceholder('書名').first().fill('昨天的書');
  await button(page, '打卡').click();
  await expect(shown(page, '已幫小明記上昨天「昨天的書」自己看 1 次，也加進全家書架了。').first()).toBeVisible();
  await expect(shown(page, '這天 1 次 · 共 1 次').first()).toBeVisible();

  await page.getByText(/點一下修改/).filter({ visible: true }).first().click();
  await expect(shown(page, '修改打卡紀錄').first()).toBeVisible();
  await button(page, '🐛 小美').click();
  await button(page, '＋').click();
  await button(page, '儲存').click();
  // The read now belongs to 小美, with the count fixed to 2.
  await shown(page, '小美').first().click();
  await expect(shown(page, '自己看 · 2 次').first()).toBeVisible();

  await page.getByText(/點一下修改/).filter({ visible: true }).first().click();
  await button(page, '刪除這筆').click();
  await expect(page.getByText(/點一下修改/).filter({ visible: true })).toHaveCount(0);
});

test('a child can be given their own page colour', async ({ page }) => {
  await addChild(page, '小明');
  await button(page, '編輯').click();
  await page.getByLabel('紫色').click();
  await button(page, '儲存').click();
  // Switch tabs in the page: a reload right after saving could race the database write.
  await tab(page, '打卡');
  await expect(shown(page, '今日打卡').first()).toBeVisible();
  const backgrounds = await page.evaluate(() =>
    [...document.querySelectorAll('div')].map((d) => getComputedStyle(d).backgroundColor),
  );
  expect(backgrounds).toContain('rgb(220, 207, 255)');
});

test('check-in lists only the picked child\'s books, and the day\'s records follow the date control', async ({ page }) => {
  await addChild(page, '小明');
  await addChild(page, '小美');
  await tab(page, '打卡');
  await button(page, '沒有條碼，自己輸入書名').click();
  await page.getByPlaceholder('書名').first().fill('哥哥的書');
  await button(page, '打卡').click();
  await expect(shown(page, '小明最近讀的書').first()).toBeVisible();
  await expect(shown(page, '今天的紀錄').first()).toBeVisible();
  await expect(shown(page, '點一下修改')).toHaveCount(1);

  // 小美 hasn't read it, so it isn't in her list even though it's on the family shelf.
  await shown(page, '小美').first().click();
  await expect(shown(page, '小美這天還沒有紀錄。可以用上面的「‹ 前一天」「後一天 ›」看別天。').first()).toBeVisible();
  await expect(shown(page, '哥哥的書')).toHaveCount(0);

  await shown(page, '小明').first().click();
  await button(page, '‹ 前一天').click();
  await expect(shown(page, '昨天的紀錄').first()).toBeVisible();
  await expect(shown(page, '點一下修改')).toHaveCount(0);
});
