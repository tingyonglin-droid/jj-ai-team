# 內容資料契約

## 用途

回答今天有哪些待核准草稿、哪些題材有效、下個實驗是什麼，以及內容是否帶來 App 導流。

## 必要資料

| 欄位 | 型別 | 來源 | 更新頻率 |
|---|---|---|---|
| `drafts` | array | Threads、IG 模板成果 | 草稿更新時 |
| `topic_backlog` | array | Notion 題庫 | 授權同步後 |
| `performance_metrics` | array | Notion／平台資料 | 每日 |
| `analysis_dimensions` | object | 成效分析 | 每日 |
| `weekly_pillars` | object | IG 規劃 | 每週 |
| `experiments` | array | 週報 | 每週 |
| `app_referrals` | object/null | 可用導流資料 | 每日或每週 |

未連線 Notion 時顯示「資料未取得」而非零成效；不同觀察窗不可直接比較；所有草稿顯示核准狀態。此頁不得發布或回覆社群訊息。
