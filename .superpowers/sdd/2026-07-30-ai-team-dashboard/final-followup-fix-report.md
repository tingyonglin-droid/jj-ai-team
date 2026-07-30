# AI Team Dashboard 最終 Follow-up 修正報告

## 結果

- 狀態：DONE，兩項核准範圍均已修正；未發布。
- 基準 commit：`6aebc6b4e2136dd61bf96a2b051dd77caa5fea54`。
- 修正 commit：本報告與修正同一提交，以該提交的 `git rev-parse HEAD` 為準。
- 未修改 `jj-invest-public`，未寫入真實 Email、secret 或外部資料。

## 1. Approval 日期證據

- `createdAt` 改為 `string | null`；來源沒有精確建立時間時保留 `null`，不再將 `YYYY-MM-DD` 拼成虛構的台北午夜。
- 新增 `effectiveDate: string | null` 保存來源可證明的 date-only 日期。
- 產生器、型別、真實快照與 UI 同步更新。現有晨報顯示「生效日期：2026-07-30」；若未來連 date-only 證據也沒有，UI 顯示「建立時間未記載」。
- 頁面測試明確拒絕舊字串 `建立時間：2026-07-30T00:00:00+08:00`。

## 2. Lockfile 孤兒依賴

- 使用 Node.js 官方發行包內的 npm 11.9.0 執行 `npm install --package-lock-only --ignore-scripts`，由 npm 正式重整 lockfile。
- 已移除無上游引用的 `@esbuild-kit/esm-loader`、`@esbuild-kit/core-utils`、其 esbuild 0.18.20 與平台套件樹。
- 新增通用 release contract：從 root 的 dependency／devDependency／optionalDependency／peerDependency 出發，依 Node 套件解析階層遍歷 lockfile，要求每個 package 節點都可到達；不再只掃描特定套件名稱。

## TDD RED / GREEN

| 範圍 | RED | GREEN |
|---|---|---|
| date-only approval | 產生器仍回傳虛構午夜；route HTML 仍顯示「建立時間」 | `createdAt === null`、`effectiveDate === "2026-07-30"`，route 顯示「生效日期」 |
| lockfile closure | 精確列出 25 個 `@esbuild-kit` 孤兒節點，沒有誤列合法依賴 | closure release contract 通過，孤兒清單為空 |
| 相關回歸 | 14 項相關測試中 3 項如預期失敗 | 14/14 passed；typecheck exit 0 |

## 官方 npm ci 證據

- 本機原本只有 Node 執行檔，沒有 npm CLI；因此下載相同版本的 Node.js v24.14.0 官方 darwin-arm64 發行包至暫存目錄。
- 官方 `SHASUMS256.txt` 與本機檔案 SHA-256 均為 `a1a54f46a750d2523d628d924aab61758a51c9dad3e0238beb14141be9615dd3`。
- 在新的暫存目錄只複製 `package.json`、`package-lock.json`。
- 沙箱內第一次嘗試因 npm registry DNS `ENOTFOUND` 失敗；依規則請求網路權限。
- 未停用 lifecycle scripts 的非沙箱安裝因安全審查拒絕，沒有繞過。改用獲准的官方 `npm ci --ignore-scripts --no-audit --no-fund`；結果為 `added 499 packages in 8s`。
- 這證明 lockfile 可在乾淨目錄完整解析、下載與解包。套件 lifecycle scripts 沒有在非沙箱環境執行；正式 build 與 worker 測試另在既有受控依賴環境完成。

## 完整驗證

- `npm test`：exit 0。
  - data generation：exit 0。
  - `tsc --noEmit`：exit 0。
  - 單元／契約測試：18/18 passed。
  - production build：exit 0；只有 `/`、`/approvals`、`/employees` 三條 dynamic routes。
  - worker HTML：4/4 passed；allowlisted 與 non-allowlisted 三路由行為均通過。
- `npm run lint`：exit 0，無錯誤。
- client bundle 掃描：無晨報內容標記、私有來源路徑、測試 Email 或 allowlist 名稱；protected snapshot 只存在 server bundle。
- Dashboard diff 掃描：無 token／access key／private key pattern、無 Email、無絕對本機路徑。
- `sh scripts/validation/validate-workspace.test.sh`：exit 0。
- `sh scripts/validation/validate-workspace.sh`：`ALL CHECKS PASSED`。
- `git diff --check`：無 whitespace error。

## 疑慮與限制

- 安全審查不允許在非沙箱網路環境執行第三方 lifecycle scripts；因此乾淨安裝證據使用 `--ignore-scripts`。依賴閉包、下載與解包已證明，完整 production build 則在受控工作樹通過。
- 本次沒有發布、沒有外部寫入，也沒有更動核准流程或 Dashboard 其餘功能。
