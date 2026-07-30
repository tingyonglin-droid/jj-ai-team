# 今日總覽資料契約

## 用途

回答今天要做什麼、已完成什麼、哪裡受阻、需要使用者決定什麼。

## 必要資料

| 欄位 | 型別 | 來源 | 更新頻率 |
|---|---|---|---|
| `date` | date | 系統日期 | 每日 |
| `tasks` | array | 工作流執行狀態 | 狀態變更時 |
| `morning_brief_summary` | string/null | 最新晨報 | 平日晨報後 |
| `market_risk_snapshot` | object/null | 最新風險紀錄 | 平日更新後 |
| `content_drafts` | array | 內容成果 | 草稿更新時 |
| `approval_queue` | array | 核准狀態與決策紀錄 | 狀態變更時 |
| `blockers` | array | 工作流失敗處理 | 發生時 |

資料未產生時顯示「尚未產出」；來源未取得顯示原因與下一步，不以空白或舊資料冒充今日結果。此頁不得提供一鍵發布或投資操作。
