# Task 5 報告：受保護 Dashboard 發布

## 狀態

私人 Sites 部署已成功；但完整線上存取邊界驗收為 **NEEDS_CONTEXT**。本次已實測匿名導向並取得 Sites 的去敏平台設定證據，惟此工作階段的瀏覽器沒有既有 ChatGPT 登入工作階段，不能代替使用者完成登入或取得另一個非允許帳號。

## 發布結果

- 部署結果：成功。
- 網址：https://jj-ai-team-dashboard.tingyong-lin.chatgpt.site
- 網站頁面：`/` 今日總覽、`/employees` AI 員工、`/approvals` 待核准中心。

## 去敏平台證據

於 2026-07-30T06:15:04Z 以 Sites connector 重新讀取，完整去敏欄位記於 `task-5-sites-evidence.json`：

- 部署狀態為 `succeeded`，沒有失敗訊息。
- 存取模式為 `custom`；目前呼叫者角色為 `owner`；允許使用者計數為 1；所有群組計數均為 0。
- 受管 runtime 存在 `ALLOWED_USER_EMAIL`；connector 將其回傳為已遮蔽的 secret，未回傳設定值。

以上是平台層的設定／部署證據；不將任何帳號、secret、token 或 project 識別寫入本報告或證據檔。

## 線上存取邊界

瀏覽器在未登入狀態對三條路由的實測結果如下：

- `/`、`/employees`、`/approvals` 均顯示登入必要頁，沒有私有 Dashboard 內容。
- 每條路由的登入入口都保留原本的返回路徑，導向 ChatGPT 登入流程。
- 點選登入入口後抵達 OpenAI 登入頁；該瀏覽器沒有既有登入工作階段，因此停止於使用者驗證步驟，沒有輸入帳號或嘗試繞過登入。

尚未可線上驗證的部分（明確分層，不以程式測試取代）：

- 允許帳號登入後可開啟三條頁面。
- 登出後重新回到匿名拒絕狀態。
- 另一個非允許帳號的線上拒絕；未取得該帳號，未偽造驗證。

## 已有程式層驗證

- 來源、帳號授權、資料快照、三個頁面與正式版契約：13/13 通過。
- 正式 Worker 輸出：4/4 通過，涵蓋允許帳號的三條受保護路由與非允許帳號不得取得內容。
- 正式建置成功，產出三條動態路由。
- `sh scripts/validation/validate-workspace.sh`：`ALL CHECKS PASSED`。

## 最小所需使用者步驟

請在目前的 Codex in-app Browser 依畫面登入已允許的 ChatGPT 帳號，回覆「已登入」即可。之後可由本工作階段驗證三條頁面與登出後的匿名邊界；非允許帳號的真人驗證仍需要另有一個已明確授權的測試帳號。

## 後續更新

Dashboard 會在 Codex 更新專案紀錄並重新發布資料快照後更新。
