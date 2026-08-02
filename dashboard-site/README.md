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

Dashboard 的「更新時間」不使用檔案系統 mtime：優先使用來源內明示的產製、更新或紀錄日期，否則使用該檔案最後一次 Git commit 時間。若來源尚未納入 Git，只退回檔名中已有的日期；連日期都沒有時會明示「來源未提供更新時間」，不臆造時分秒精度。使用 Git 來源產生快照時必須保留完整歷史；淺層複本會停止產生，避免把邊界提交誤認為舊檔案的更新時間。

待核准成果的 `recordDate`（畫面顯示「紀錄日期」）是從來源文件中的資料代表日期或檔名日期取得，用於追溯紀錄；它不表示內容已生效。只有決策紀錄中明確記載的「生效日」才保留為該決策的原始中繼資料。

## 本機驗證

需使用 Node.js `>=22.13.0`。

```bash
npm test
ALLOWED_USER_EMAIL=test-owner@example.com npm run build
```

`npm test` 會驗證帳號允許規則、資料快照、五個受保護路由表面、響應式與鍵盤規則，然後重建資料快照並驗證受保護頁面的伺服器輸出。`npm run build` 也會在建立前重新產生快照。網站使用者的實際 Email 僅由執行環境提供，請勿提交 `.env` 檔案。

## 逐版本核准與 D1

晨報、市場風險報告與 Threads 草稿可在首頁或待核准中心進行兩段式核准。第一次按鍵只顯示確認內容，第二次才把成果路徑、版本、SHA-256、核准者與時間寫入 Sites D1；相同版本重複送出會取得同一事件，新版不繼承舊版核准。核准 Threads 只代表文字版本通過內部審閱，不會發布內容或授權互動；其他核准同樣只適用於指定版本，不會核准未來版本或執行投資行動。

正式封包的 `.openai/hosting.json` 必須宣告 `"d1": "DB"`，且 `drizzle/` migrations 必須隨版本一併保存與部署。部署後至少驗證：未授權請求不洩漏內容、待核准成果仍可讀、確認前不寫入、相同版本冪等，以及資料庫無法讀取時畫面顯示明確阻擋而不把核准誤判為成功。

## 核准 outbox 同步

站內 D1 核准與 Git 決策紀錄採 fail-closed outbox。只有同時設定 `DASHBOARD_SITE_URL`、`SITES_BYPASS_TOKEN`、`APPROVAL_SYNC_SECRET` 時，`npm run approvals:sync -- fetch` 才會讀取事件、驗證允許路徑／版本／SHA-256，並以 exclusive create 建立決策紀錄；相對應 commit 存在後才可執行 `npm run approvals:sync -- acknowledge`。本機 manifest 位於被 Git 忽略的 `.approval-sync/`。

目前同步憑證尚未獲得建立授權，因此 outbox 同步應保持停用。這不影響站內核准按鍵保存 D1 事件；畫面會將尚未回寫 Git 的狀態顯示為提醒。不得為了消除提醒自行產生或重用服務憑證。

## 私人部署

只更新 `.openai/hosting.json` 中既有的私人 Sites 專案，不建立第二個 Site，也不得改變 owner-only 存取或把允許 Email 寫入版本控制。正式部署順序為：產生 Dashboard 快照、完整測試、正式 build、檢查 `dist/.openai/hosting.json` 與 migrations、保存精確 source commit，再部署該保存版本並執行授權與頁面冒煙測試。
