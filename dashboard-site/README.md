# JJ AI Team Dashboard

私人 AI 團隊控制台。此網站以 ChatGPT 身分與伺服器端允許 Email 保護，呈現工作區中可追溯的今日工作、AI 員工與待核准成果；它不會自行發布內容或執行未核准動作。

## 日常更新

1. 完成工作，並將成果及其來源紀錄存入工作區的既定位置。
2. 執行資料更新或重新部署：本機可執行 `npm run data:generate`，完整驗證與建立則執行 `npm test` 或 `npm run build`。
3. 開啟控制台，確認頁尾的「資料更新時間」及畫面呈現的來源路徑均為預期最新資料。
4. 不得將真實允許 Email 寫入版本控制檔案；僅在執行環境設定 `ALLOWED_USER_EMAIL`，版本庫中的 `.env.example` 必須保持空值範例。

## 成果來源 manifest

`data/artifact-sources.json` 是 Dashboard 成果類型的權威映射，定義中文類型、主責角色、保存位置、必要欄位與必要章節：

- 晨報：`records/daily-briefs/`
- Threads：`records/content/threads/`
- IG：`records/content/instagram/`
- 市場風險報告：`records/market-risk/`
- 風險方法：`records/market-risk-methods/`
- App 規格：`records/app-specs/`

沒有真實成果時畫面顯示空狀態，不建立 sample。同一 identity 的 `vNN` 只採用最新有效版本；過期、缺欄位、壞格式或來源衝突會保留來源並顯示警告或阻擋。

Dashboard 的「更新時間」不使用檔案系統 mtime：優先使用來源內明示的產製、更新或紀錄日期，否則使用該檔案最後一次 Git commit 時間。若來源尚未納入 Git，只退回檔名中已有的日期；連日期都沒有時會明示「來源未提供更新時間」，不臆造時分秒精度。

待核准成果的 `recordDate`（畫面顯示「紀錄日期」）是從來源文件中的資料代表日期或檔名日期取得，用於追溯紀錄；它不表示內容已生效。只有決策紀錄中明確記載的「生效日」才保留為該決策的原始中繼資料。

## 本機驗證

需使用 Node.js `>=22.13.0`。

```bash
npm test
ALLOWED_USER_EMAIL=test-owner@example.com npm run build
```

`npm test` 會驗證帳號允許規則、資料快照、五個受保護路由表面、響應式與鍵盤規則，然後重建資料快照並驗證受保護頁面的伺服器輸出。`npm run build` 也會在建立前重新產生快照。網站使用者的實際 Email 僅由執行環境提供，請勿提交 `.env` 檔案。
