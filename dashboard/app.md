# App 資料契約

## 用途

回答正在研究哪些產品問題、規格處於哪個階段、哪些假設需驗證、哪些決策等待使用者。

## 必要資料

| 欄位 | 型別 | 來源 | 更新頻率 |
|---|---|---|---|
| `observations` | array | 每週產品觀察 | 每週 |
| `feature_specs` | array | App 規格成果 | 文件更新時 |
| `user_evidence` | array | 規格引用資料 | 取得時 |
| `assumptions` | array | 規格假設 | 文件更新時 |
| `success_metrics` | array | 功能規格 | 文件更新時 |
| `dependencies`、`risks` | array | 功能規格 | 文件更新時 |
| `decisions` | array | `records/decisions/` | 決策後 |

沒有使用者證據時清楚標示探索假設。任何項目都不得顯示「已實作」或「已上線」，除非未來由外部專案提供經核准的真實狀態；本專案本身不能產生該狀態。
