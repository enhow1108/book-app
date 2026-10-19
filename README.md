# 小書蟲（book-app）

給家長記錄孩子閱讀的 App，參考小花生。先做 iOS，之後用同一份程式碼出 Android。

技術：Expo（React Native + TypeScript）、Expo Router。資料目前存在裝置上的資料庫（手機用 SQLite，網頁版用瀏覽器的 IndexedDB），之後接 Supabase 做雲端同步。

## 目前有的功能

- 書架：輸入 ISBN 自動查書名、作者、封面（Google Books，查不到改用 Open Library），也可以手動輸入；標記中文或英文書。
- 打卡：選書、填分鐘數與心得；顯示連續天數、本月讀了幾本、累計分鐘。

## 在 iPhone 上試用（不需要 Mac）

1. iPhone 安裝 App Store 上的 **Expo Go**。
2. 在電腦上執行：
   ```bash
   npm install
   npx expo start
   ```
3. 用 iPhone 相機掃終端機顯示的 QR code。

## 之後

- ISBN 相機掃碼（expo-camera，需要 development build）
- 多個孩子的檔案、Apple 登入、Supabase 同步
- 分齡書單、每日提醒、徽章
