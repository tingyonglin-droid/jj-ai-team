# Dashboard 社群成果更新與防漏設計

## 問題與根因

`records/content/threads/2026-08-03-index-up-risk-not-down-v01.md` 已符合 Dashboard 的 Threads 成果契約，但 `dashboard-site/data/dashboard.json` 仍是草稿提交前產生的靜態快照，因此正式私人 Dashboard 看不到新的待核准卡片，社群經營員也仍顯示 2026-07-30 的舊工作。

唯讀重建已確認現有資料產生器不需修改：新快照會把該草稿加入待核准中心，並把社群經營員更新為「待核准／等待人工核准」。

## 立即修正

1. 重新產生 `dashboard-site/data/dashboard.json`。
2. 驗證 Threads 草稿同時出現在 `approvals`、`tasks`，且 `social-operator` 的 `currentTask`、`progress`、`source` 與草稿一致。
3. 執行 Dashboard 完整測試、正式 build 與工作區驗證。
4. 檢查正式封包保留既有 Sites project ID、D1 binding 與 migrations，不改變 owner-only 存取或允許名單。
5. 保存並部署既有私人 Sites 專案；部署成功後確認未授權請求不洩漏內容，授權畫面能看到 Threads 待核准項目及社群經營員進度。

## 防漏規則

在 `workflows/daily-threads.md` 的交付步驟明確加入：Threads 成果保存後，必須重新產生 Dashboard 快照、驗證待核准項目及社群經營員進度，再部署既有私人 Dashboard；任一步驟失敗時標示受阻，不宣稱已交付到 Dashboard。

本次只補強既有工作流，不新增排程、外部發布或自動核准。若日後要讓所有社群成果自動觸發部署，須另行設計與核准。

## 核准與安全邊界

- Threads 草稿維持「待核准」，部署不等於核准或發布。
- 不修改或部署 `jj-invest-public`。
- 不建立第二個 Site，不公開私人 Dashboard，不改動核准同步憑證狀態。
- 不在程式碼、快照、提交或回覆中揭露 Email、token、project ID 或其他祕密。

## 驗收

- 新快照含一筆來源為 `records/content/threads/2026-08-03-index-up-risk-not-down-v01.md` 的 Threads 待核准項目。
- 社群經營員目前工作為該 Threads 草稿，狀態為「待核准」，進度為「等待人工核准」。
- Dashboard 完整測試、正式 build 與 `sh scripts/validation/validate-workspace.sh` 全部通過。
- 私人部署成功，存取權限維持不變，授權使用者可在 Dashboard 完成逐版本核准。
