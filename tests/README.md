# 回歸測試

每次推到 GitHub，GitHub Actions 都會自動跑一遍（`.github/workflows/test-and-deploy.yml`）。
推到 `main` 時，全部通過才會更新網頁版 https://enhow1108.github.io/book-app/ ；有任何一項失敗，網頁版維持上一版。

## 推之前在本機跑

```bash
npm run check
```

依序跑下面四步，約一分鐘：

| 指令 | 內容 |
| --- | --- |
| `npm run typecheck` | TypeScript 型別檢查（App 和測試） |
| `npm test` | 邏輯測試（`tests/unit/`）：書庫比對、資料差異（存檔與同步用）、CSV 匯入匯出、重複匯入、復原匯入、完整備份與還原、紀錄統計、連續天數、打卡 +1/−1、雲端同步的分批與合併 |
| `npm run build:pages` | 做出和 GitHub Pages 一樣的網頁版到 `dist/` |
| `npm run test:e2e` | 用 Chromium（iPhone 尺寸）實際操作網頁版（`tests/e2e/`）：新增孩子、手動加書、打卡、重新整理後資料還在、匯入 CSV 再復原、備份後在新的瀏覽器還原、每個分頁都打得開 |

網頁冒煙測試會擋掉所有對外連線（查書、封面、Firebase），不會寫進真的家庭資料。
測試資料是假的（`tests/fixtures/`），不要放真實的孩子閱讀紀錄進來，這個 repo 是公開的。

新功能或修 bug 時，順手在 `tests/unit/` 或 `tests/e2e/smoke.spec.ts` 加一個會抓到這個問題的測試。

## 只能在手機上手動檢查的

自動測試跑不到原生 App，每個功能做完後在 iPhone 的 Expo Go 上看一次：

- [ ] App 打得開，四個分頁都能切換
- [ ] 掃描 ISBN 條碼（相機權限、對焦）
- [ ] 拍封面 / 選照片
- [ ] 打卡 +1，關掉 App 再打開，資料還在（手機版用 SQLite，網頁版用 IndexedDB，兩邊不同）
- [ ] 匯入 CSV、下載備份檔（手機的檔案選擇和分享面板）
- [ ] 家庭共用：Email 登入後，另一台裝置看得到剛打的卡
- [ ] 之後才有的：通知提醒、Google / Facebook / Apple 登入、商店版本（需要 development build）
