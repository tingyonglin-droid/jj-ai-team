# Dashboard 資訊架構

## 定位

未來 Dashboard 只彙整本工作區及經授權資料的狀態，不執行發布、社群回覆、投資操作或 App 上線。本階段只定義資訊架構與資料契約。

## 五個分頁

1. **今日總覽**：今日任務、最新摘要、阻礙與待核准事項。
2. **市場風險**：風險分數、趨勢、證據、完整度與歷史。
3. **內容**：Threads、IG、題庫、成效與 App 導流。
4. **App**：產品觀察、功能規格、假設與決策狀態。
5. **成果**：週報、月度復盤、實驗及跨領域成效。

## 共同欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | string | 不隨標題改變的唯一識別碼 |
| `title` | string | 人類可讀名稱 |
| `status` | enum | `draft`、`pending_approval`、`approved`、`returned`、`blocked` |
| `owner_role` | string | `roles/` 中的英文識別碼 |
| `as_of` | datetime | 資料代表時間，含時區 |
| `updated_at` | datetime | 最後更新時間，含時區 |
| `source_refs` | array | 文件路徑或外部來源定位 |
| `data_completeness` | integer/null | 0–100；不適用時為 null |
| `approval` | object | 決策者、時間、結果與紀錄路徑 |
| `warnings` | array | 缺漏、過期、衝突與限制 |

## 狀態規則

資料缺失顯示缺失項與影響；超過各頁定義的新鮮度顯示「過期」；來源衝突顯示雙方與暫不確定；沒有核准紀錄不得顯示為已發布或已上線。所有時間使用 ISO 8601 並保留時區。

## 資料來源映射

| 分頁 | 主要來源 |
|---|---|
| 今日總覽 | 工作流狀態、最新成果、`records/decisions/` |
| 市場風險 | `records/market-risk/` |
| 內容 | Notion 授權資料、內容模板成果、`records/reviews/` |
| App | App 規格成果、`knowledge/app-product.md`、決策紀錄 |
| 成果 | `records/reviews/`、決策紀錄與已核准成果索引 |
