# Dashboard 日期語意修正報告

## 範圍

- 基準：`ca40e468592b21f0bc31f868b014d954aa2b2be2`
- 僅修正待核准成果的日期語意；未發布內容、未修改外部專案，也未寫入任何真實帳號或機密資料。

## 變更

- 將待核准快照欄位由 `effectiveDate` 改為 `recordDate`。
- 以「紀錄日期」呈現從來源檔名或資料代表日期得出的可追溯日期；保留 `asOf` 作為資料代表時間。
- `createdAt` 維持 `null`，不把檔名日期偽稱建立時間或生效日期。
- 文件明定：只有決策紀錄中明確記載的「生效日」才屬該決策的原始中繼資料，通用待核准成果不使用此語意。

## TDD 證據

先更新回歸測試，使其要求 `recordDate`、要求待核准 UI 顯示「紀錄日期」，並拒絕「生效日期」。實作前執行相關測試，9 項中 2 項依預期失敗：快照沒有 `recordDate`，UI 仍顯示「生效日期」。完成最小修正並重新產生 JSON 後，同一組 9 項測試全部通過。

## 驗證結果

- TypeScript 型別檢查：通過。
- 核心測試：18/18 通過。
- Lint：通過。
- 正式 Vinext build：通過。
- 產出 Worker 的受保護頁面驗收：4/4 通過。
- 修改範圍的機密／Email 掃描與 diff whitespace 檢查：通過。
- `sh scripts/validation/validate-workspace.sh`：通過（`ALL CHECKS PASSED`）。
