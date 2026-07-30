# 市場風險資料契約

## 用途

回答目前風險多高、正在上升或下降、原因與反證是什麼、資料是否足夠可信。

## 必要資料

| 欄位 | 型別 | 來源 | 更新頻率 |
|---|---|---|---|
| `score` | integer | 風險紀錄 | 平日與事件版 |
| `state`、`trend` | enum | 風險紀錄 | 同上 |
| `risk_types` | array | 風險紀錄 | 同上 |
| `sub_indicators` | array | 風險紀錄 | 同上 |
| `change_reasons` | array | 風險紀錄 | 同上 |
| `supporting_evidence`、`counter_evidence` | array | 風險紀錄 | 同上 |
| `watchlist` | array | 風險紀錄 | 同上 |
| `ai_confidence`、`data_completeness` | integer | 風險紀錄 | 同上 |
| `as_of`、`method_version` | string | 風險紀錄 | 同上 |

完整度低於 70% 顯示低完整度警示；紀錄過期顯示最後時間；版本並存時預設最新但可回看原版。不得顯示 Beta、持股、再平衡或買賣動作映射。
