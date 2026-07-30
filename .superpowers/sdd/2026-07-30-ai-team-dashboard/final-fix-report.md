# AI Team Dashboard 最終審查修正報告

## 結果

- 狀態：全部修正完成，等待 re-review。
- 基準 commit：`83548c382e048ac708e74472df61c7a83da98c20`
- 修正 commit：`2b2764331358a27a0f884f7e9f5a1cd2512208f3`
- 發布：未發布；未修改 `jj-invest-public`。

## Findings 處理

### Important 1：成果狀態與工作狀態分層

- 新增 `ArtifactStatus`，保留 `rawStatus`，再映射為 `WorkStatus`。
- 覆蓋「草稿、待核准、已核准、退回修訂、已核准並執行」；決策紀錄依完整的決策者、決定與生效日建模為已完成，同時保留其原文未有狀態欄的事實。
- 員工以最新有效工作紀錄決定狀態；現有 Threads 復盤及生效決策現在會正確反映總司令與社群經營員工作。

### Important 2：台北日期、過期與來源失敗

- Dashboard date 改以 `Asia/Taipei` 計算，含 UTC 跨日界測試。
- 依 manifest 驗證標題、狀態、資料代表時間與必要章節；缺欄位、壞格式、重複衝突欄位均建模為可追溯 blocker。
- 舊摘要只作為「最後有效紀錄」並顯示過期警告，不列入當日已完成工作。

### Important 3：完整追溯欄位

- task、employee、brief、market risk、approval 均含 `source`、`asOf`、`updatedAt`、`dependencies`。
- approval 另含 `createdAt`；員工有任務時的時間與來源來自該任務紀錄，而非 `ROLE.md`。
- 今日工作、摘要、員工與核准中心均於畫面呈現追溯欄位。

### Important 4：正式成果類型與版本 identity

- 新增 `data/artifact-sources.json` 作為權威 manifest，正式定義晨報、Threads、IG、市場風險報告、風險方法、App 規格的中文類型、中文 owner、保存位置與必要欄位。
- 同一 identity 依 `vNN` 只保留最新有效版本；已測試 v02 已核准會取代 v01 待核准。
- 核准中心固定顯示所有支援類型；沒有真實資料的類型顯示空狀態，沒有 sample。

### Important 5：非 allowlisted 應用層拒絕

- allowlist mismatch 改用框架原生 `forbidden()`，由 `app/forbidden.tsx` 呈現固定且可理解的拒絕頁。
- 快照仍在授權通過後才 dynamic import。
- 正式 worker 測試已斷言三路由的 HTTP 403、拒絕文字，且回應不含晨報內容、員工摘要或來源路徑。

### Important 6：TypeScript release gate

- 新增 `typecheck: tsc --noEmit`，並納入 `npm test` 標準 gate。
- 移除 D1/Drizzle 程式、migration、POST 寫入範例、套件、lockfile 節點、hosting/local binding 空殼與未使用 starter assets。
- Worker 介面改用專案實際需要的最小型別；strict typecheck 已綠燈。

### Minor 1：唯讀邊界可稽核性

- 與 Important 6 同步完全移除 D1 starter、寫入 route、Drizzle 相依、migration 複製邏輯與未使用 public assets。
- release contract 會驗證上述檔案不存在、套件與 lockfile 不含 Drizzle、hosting 不含 D1。

## TDD RED / GREEN

| 範圍 | RED | GREEN |
|---|---|---|
| 資料產生器 | 新增 6 組行為測試後 `0/6 passed`；分別因 UTC 日期、狀態被丟棄、內部 type/owner、無 stale/malformed/conflict、員工狀態錯誤而失敗 | `6/6 passed` |
| 畫面追溯與類型空狀態 | 新增 3 組呈現斷言後 `0/3 passed` | `3/3 passed`，並納入完整 17 項單元／契約測試 |
| 非 allowlisted worker | 正式 worker 測試 `2/4 passed`，拒絕分支為 server render rejection | `4/4 passed`，三路由皆為 403 與固定拒絕 UI |
| TypeScript | `tsc --noEmit` 因 Cloudflare/D1 型別與新 schema 缺口失敗 | `tsc --noEmit` exit 0 |
| D1/Drizzle release boundary | release contract 先因套件、檔案、lockfile 與 D1 metadata 失敗 | release contract `4/4 passed` |

## 完整驗證

- 真實快照更新：`node --import tsx scripts/generate-dashboard-data.mts ..` — exit 0。
- TypeScript：`tsc --noEmit` — exit 0。
- 單元／契約：Node test runner — `17/17 passed`。
- Lint：ESLint — exit 0，無警告或錯誤。
- Production build：Vinext build — exit 0，只有 `/`、`/employees`、`/approvals` 三條 dynamic routes。
- 正式 worker HTML：`4/4 passed`；allowlisted 三路由為 200，non-allowlisted 三路由為 403。
- Client/server 私有資料掃描：client bundle 無晨報內容與來源路徑；protected snapshot 只在 server bundle；build 產物無 allowlist 測試值。
- Secret/path 掃描：無 secret pattern、非範例 Email 或絕對本機路徑。
- 唯讀／D1 掃描：應用層無 POST/PUT/PATCH/DELETE handler 或 data mutation API；production 來源無 D1/Drizzle 殘留。
- Workspace validation：`sh scripts/validation/validate-workspace.sh` — `ALL CHECKS PASSED`。

`npm test` 的 package script 已把 data generation、typecheck、17 項單元／契約、production build 與 4 項 worker 測試串成單一 gate。本機任務 shell 只提供 workspace Node，未提供 npm shim，因此以同一 package script 所對應的完整命令逐一重跑；無省略 gate。

## 變更檔案

- 資料契約與產生器：`dashboard-site/lib/dashboard-types.ts`、`dashboard-site/data/artifact-sources.json`、`dashboard-site/scripts/generate-dashboard-data.mts`、對應測試與真實 `data/dashboard.json`。
- 呈現與拒絕 UI：`dashboard-site/app/dashboard-components.tsx`、`app/globals.css`、`app/authorization.ts`、`app/forbidden.tsx`、對應 route/worker tests。
- Release gate：`dashboard-site/package.json`、`package-lock.json`、`worker/index.ts`、`vite.config.ts`、`build/sites-vite-plugin.ts`、`.openai/hosting.json`、`.gitignore`、`tests/release-contract.test.mjs`。
- 文件：`dashboard-site/README.md`。
- 刪除：`dashboard-site/db/`、`drizzle.config.ts`、`drizzle/`、`examples/d1/`、`public/file.svg`、`public/globe.svg`、`public/window.svg`。

## 自我審查

- 已逐項重對 final review 的 6 個 Important 與 1 個 Minor，每項均有測試或產物掃描證據。
- 已確認沒有 sample 成果、沒有自動發布／投資／App 上線／外部寫入，也沒有私有資料進入 client bundle。
- 已確認真實快照顯示現有晨報、復盤與決策；無真實資料的 IG、Threads 草稿、風險方法與 App 規格顯示空狀態。

## 疑慮與限制

- 沒有可安全使用的 non-allowlisted 真人帳號；目前以正式 worker 對三路由的 403、拒絕文字、無私有內容及授權先於快照的契約測試覆蓋。
- 外部 npm CLI 下載未獲安全核准；`package-lock.json` 以本機機械式同步 root dependencies 並移除 Drizzle 套件節點，已通過 JSON 解析、無 Drizzle 契約、typecheck、build 與全部測試。
- 尚未發布；re-review 通過後由控制端決定發布與真人帳號回歸範圍。
