# AI 團隊 Dashboard 實作計畫

> **給執行代理：** 必須使用 `superpowers:subagent-driven-development`（建議）或 `superpowers:executing-plans`，逐項執行本計畫。核取方塊用來追蹤進度。

**目標：** 建立並發布一個唯讀的 AI 團隊 Dashboard；可從外網開啟，但必須使用 ChatGPT 登入，且只有指定帳號能查看。

**架構：** 在 `dashboard-site/` 建立 Sites/Vinext 網站。資料產生器會讀取工作區內的 Markdown 紀錄，整理成具型別的 JSON 快照；受保護的網頁會先在伺服器確認 ChatGPT 身分及單一帳號允許名單，再顯示資料。網站包含今日總覽、AI 員工與待核准中心三個頁面，不會寫入專案或任何外部系統。

**技術：** TypeScript、React、Vinext／Next 相容的 App Router、OpenAI Sites、Node 測試工具、CSS、平台提供的 ChatGPT 登入。

## 全域限制

- 第一版只有一位管理者，使用 ChatGPT 登入與伺服器端 Email 允許名單。
- Dashboard 是唯讀介面，資料只來自現有工作區紀錄。
- 不得提供發布內容、投資操作、App 上線、Notion 寫入或其他外部寫入功能。
- 缺少資料時標示「尚未產出」；過期或失敗來源須顯示最後更新時間或下一步。
- 狀態不可只靠顏色表達。
- 電腦與手機版都必須容易閱讀並支援鍵盤操作。
- 完成前必須通過 `sh scripts/validation/validate-workspace.sh`。

---

### Task 1：建立受保護的網站基礎

**檔案：**

- 建立：由 Sites 初始化的 `dashboard-site/`
- 建立：`dashboard-site/app/authorization.ts`
- 建立：`dashboard-site/app/authorization.test.ts`
- 修改：`dashboard-site/app/layout.tsx`
- 修改：`dashboard-site/app/page.tsx`
- 修改：`dashboard-site/.env.example`

**介面契約：**

- 輸入：`app/chatgpt-auth.ts` 的 `getChatGPTUser()`；環境設定 `ALLOWED_USER_EMAIL`
- 輸出：`requireAllowedUser(returnTo: string): Promise<{ email: string; name?: string }>`

- [ ] **步驟 1：初始化網站並保持本機預覽運作**

只執行一次 Sites 初始化器，保留產生的套件管理方式、`.openai/hosting.json` 與 Vinext 結構，然後啟動本機預覽。

- [ ] **步驟 2：先寫帳號授權測試**

測試須確認 Email 不分大小寫精確比對、沒有允許名單時拒絕，以及其他帳號被拒絕：

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedEmail } from "./authorization";

test("允許指定帳號且不區分大小寫", () => {
  assert.equal(isAllowedEmail("Owner@Example.com", "owner@example.com"), true);
});

test("拒絕缺少設定及其他帳號", () => {
  assert.equal(isAllowedEmail("owner@example.com", undefined), false);
  assert.equal(isAllowedEmail("other@example.com", "owner@example.com"), false);
});
```

- [ ] **步驟 3：執行測試並確認它先失敗**

執行：`node --import tsx --test app/authorization.test.ts`

預期：因 `app/authorization.ts` 尚不存在而失敗。

- [ ] **步驟 4：實作伺服器端允許名單**

```ts
import { getChatGPTUser, requireChatGPTUser } from "./chatgpt-auth";

export function isAllowedEmail(actual: string, allowed?: string) {
  return Boolean(allowed && actual.trim().toLowerCase() === allowed.trim().toLowerCase());
}

export async function requireAllowedUser(returnTo: string) {
  await requireChatGPTUser(returnTo);
  const user = await getChatGPTUser();
  if (!user || !isAllowedEmail(user.email, process.env.ALLOWED_USER_EMAIL)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}
```

所有受保護頁面必須先在伺服器呼叫這個函式，才能讀取或顯示私有資料。移除起始預覽內容，網站名稱改為 `JJ AI Team Dashboard`。`.env.example` 只記錄變數名稱，不寫入真實 Email。

- [ ] **步驟 5：確認帳號測試及網站基礎測試通過**

執行：`node --import tsx --test app/authorization.test.ts tests/rendered-html.test.mjs`

預期：全部通過。

- [ ] **步驟 6：若專案已啟用 Git，提交本階段成果**

```bash
git add dashboard-site
git commit -m "feat: scaffold protected AI team dashboard"
```

若工作區仍不是 Git 專案，只記錄此狀態，不自行初始化 Git。

---

### Task 2：產生可追溯的 Dashboard 資料快照

**檔案：**

- 建立：`dashboard-site/lib/dashboard-types.ts`
- 建立：`dashboard-site/scripts/generate-dashboard-data.mts`
- 建立：`dashboard-site/scripts/generate-dashboard-data.test.mts`
- 建立：`dashboard-site/data/dashboard.json`
- 修改：`dashboard-site/package.json`

**介面契約：**

- 輸入：`roles/`、`workflows/`、`records/daily-briefs/`、`records/market-risk/`、`records/reviews/`、`records/decisions/`
- 輸出：`data/dashboard.json` 的 `DashboardSnapshot`；函式 `generateDashboardSnapshot(root, now)`

- [ ] **步驟 1：定義資料快照型別**

```ts
export type WorkStatus = "尚未開始" | "等待中" | "進行中" | "待核准" | "已完成" | "受阻";

export interface DashboardSnapshot {
  generatedAt: string;
  date: string;
  approvals: Array<{ id: string; title: string; type: string; owner: string; status: "待核准"; summary: string; decision: string; source: string; updatedAt: string }>;
  employees: Array<{ id: string; name: string; role: string; status: WorkStatus; currentTask: string; progress: string; dependencies: string[]; handoff: string; blocker: string | null; nextStep: string; updatedAt: string }>;
  tasks: Array<{ id: string; title: string; owner: string; status: WorkStatus; nextStep: string }>;
  brief: { title: string; summary: string; asOf: string; source: string } | null;
  marketRisk: { label: string; asOf: string; source: string; completeness: number | null } | null;
  blockers: Array<{ title: string; reason: string; nextStep: string }>;
}
```

- [ ] **步驟 2：使用暫存測試資料撰寫資料產生器測試**

測試要建立假的 Markdown 檔案，確認待核准狀態、來源路徑、四位員工，以及缺少市場風險資料時不會虛構分數：

```ts
assert.equal(snapshot.approvals[0].status, "待核准");
assert.equal(snapshot.brief?.source, "records/daily-briefs/2026-07-30-v01.md");
assert.equal(snapshot.marketRisk, null);
assert.equal(snapshot.employees.length, 4);
assert.match(snapshot.blockers[0].reason, /尚未產出|資料/);
```

- [ ] **步驟 3：執行測試並確認它先失敗**

執行：`node --import tsx --test scripts/generate-dashboard-data.test.mts`

預期：因資料產生器尚未實作而失敗。

- [ ] **步驟 4：實作穩定、可重現的 Markdown 資料整理**

規則如下：

- 檔名由新到舊排序，選取最新版但不修改原始檔。
- 只解析明確寫出的狀態、資料截止時間、標題與清單，不推測不存在的數字。
- 四位員工由角色檔案建立；目前工作只能來自真實紀錄與工作流。
- 每筆資料保留相對來源路徑與檔案更新時間。
- 沒有市場風險紀錄時，`marketRisk` 設為 `null` 並加入受阻事項。
- JSON 欄位順序固定，檔尾保留換行。

加入資料更新及建置前自動更新指令：

```json
{
  "scripts": {
    "data:generate": "node --import tsx scripts/generate-dashboard-data.mts ..",
    "prebuild": "npm run data:generate"
  }
}
```

- [ ] **步驟 5：通過測試並產生真實快照**

執行測試後，再執行 `npm run data:generate`。

預期：資料包含現有的 2026-07-30 晨報，而且沒有虛構市場風險分數。

- [ ] **步驟 6：若 Git 可用，提交資料邊界**

```bash
git add dashboard-site/lib dashboard-site/scripts dashboard-site/data dashboard-site/package.json dashboard-site/package-lock.json
git commit -m "feat: generate traceable dashboard snapshot"
```

---

### Task 3：建立三個受保護頁面

**檔案：**

- 建立：`dashboard-site/app/dashboard-shell.tsx`
- 建立：`dashboard-site/app/dashboard-components.tsx`
- 建立：`dashboard-site/app/employees/page.tsx`
- 建立：`dashboard-site/app/approvals/page.tsx`
- 建立：`dashboard-site/app/not-authorized.tsx`
- 修改：`dashboard-site/app/page.tsx`
- 修改：`dashboard-site/app/globals.css`
- 建立：`dashboard-site/app/dashboard-routes.test.tsx`

**介面契約：**

- 輸入：任務二的 `DashboardSnapshot` 與任務一的 `requireAllowedUser()`
- 輸出：`/`、`/employees`、`/approvals` 三個受保護頁面，以及共用的 `StatusBadge`、`EmptyState`

- [ ] **步驟 1：先寫頁面顯示測試**

```tsx
assert.match(todayHtml, /需要你決定/);
assert.match(todayHtml, /員工動態/);
assert.match(todayHtml, /尚未產出/);
assert.match(employeeHtml, /依賴與交接/);
assert.match(approvalHtml, /待你決定/);
assert.doesNotMatch(todayHtml, /一鍵發布|買進|賣出/);
```

- [ ] **步驟 2：執行測試並確認它先失敗**

執行：`node --import tsx --test app/dashboard-routes.test.tsx`

預期：因頁面元件尚不存在而失敗。

- [ ] **步驟 3：建立共用框架與安全元件**

`DashboardShell` 顯示網站名稱、三個導覽連結、登入 Email、資料更新時間及 ChatGPT 登出連結。`StatusBadge` 同時顯示文字與 `data-status`；`EmptyState` 接收標題、說明及下一步。

- [ ] **步驟 4：建立 A 方案的今日總覽**

內容固定依下列順序顯示：

1. 需要你決定
2. 員工動態
3. 今日工作
4. 今日摘要
5. 受阻項目

員工動態顯示四位角色的簡要狀態，並連結到 `/employees`。晨報或市場風險缺少時顯示空狀態，不可放示範數字。

- [ ] **步驟 5：建立 AI 員工與待核准中心**

AI 員工頁顯示目前任務、狀態、進度、依賴、交接、卡點、下一步與更新時間。待核准中心依成果類型分組，只顯示真實項目；沒有項目時顯示「目前沒有待核准事項」。

- [ ] **步驟 6：加入響應式與無障礙設計**

使用語意化區塊與標題、清楚的鍵盤焦點、帶文字的狀態標籤。桌面版採多欄；寬度低於 720px 時改為單欄。主要內容不得依賴水平捲動。

- [ ] **步驟 7：確認頁面測試通過**

執行：`node --import tsx --test app/dashboard-routes.test.tsx`

預期：全部通過。

- [ ] **步驟 8：若 Git 可用，提交介面成果**

```bash
git add dashboard-site/app
git commit -m "feat: add AI team dashboard views"
```

---

### Task 4：驗證隱私、手機版與正式建置

**檔案：**

- 修改：`dashboard-site/tests/rendered-html.test.mjs`
- 修改：`dashboard-site/README.md`
- 修改：`dashboard-site/app/layout.tsx`
- 移除：`dashboard-site/app/_sites-preview/`

- [ ] **步驟 1：加入正式版驗收測試**

測試要確認網站名稱與導覽正確，並且沒有殘留起始預覽：

```js
assert.match(html, /JJ AI Team Dashboard/);
assert.match(html, /今日總覽/);
assert.doesNotMatch(html, /codex-preview|SkeletonPreview/);
```

- [ ] **步驟 2：執行全部網站測試**

執行：`npm test`

預期：帳號、資料、頁面與正式輸出測試全部通過。

- [ ] **步驟 3：移除起始版專用內容**

刪除 `_sites-preview`，移除不再使用的 `react-loading-skeleton`，更新鎖定檔；網站描述改成私人 AI 團隊控制台。私人網站不建立通用社群分享圖。

- [ ] **步驟 4：建立正式版**

執行：`ALLOWED_USER_EMAIL=test-owner@example.com npm run build`

預期：建置成功，且建置前會重新產生最新資料快照。

- [ ] **步驟 5：驗證整個工作區**

在專案根目錄執行：`sh scripts/validation/validate-workspace.sh`

預期：顯示 `ALL CHECKS PASSED`。

- [ ] **步驟 6：補充日常更新說明**

文件需寫清楚以下順序：

1. 完成工作並將來源紀錄存入工作區。
2. 執行資料更新或重新部署。
3. 確認畫面中的更新時間與來源路徑。
4. 不得把真實允許 Email 寫入版本控制檔案。

- [ ] **步驟 7：若 Git 可用，提交驗證成果**

```bash
git add dashboard-site
git commit -m "test: verify private dashboard release"
```

---

### Task 5：發布受保護的網站

**可能修改：** `dashboard-site/.openai/hosting.json`，只在託管驗證要求時調整。

**輸入與成果：** 使用任務四通過驗證的正式版本，並在託管環境安全設定 `ALLOWED_USER_EMAIL`；產出受 ChatGPT 登入與單一帳號允許名單保護的外網網址。

- [ ] **步驟 1：依 Sites 託管程序發布**

使用 `sites-hosting` 技能，不另換平台，除非使用者重新決定。

- [ ] **步驟 2：安全設定允許帳號**

在託管環境設定 `ALLOWED_USER_EMAIL`，不得將真實值顯示於紀錄、程式碼、截圖或最終回覆。

- [ ] **步驟 3：發布已驗證的版本**

只有任務四全部通過後才發布，並保留伺服器端登入與授權檢查。

- [ ] **步驟 4：驗證存取邊界**

確認：

- 未登入者會被導向 ChatGPT 登入。
- 不在允許名單的帳號會被拒絕。
- 指定帳號能開啟 `/`、`/employees`、`/approvals`。
- 登出後回到無法查看私有資料的狀態。

- [ ] **步驟 5：最終驗證與交付**

再次執行 `sh scripts/validation/validate-workspace.sh`，必須顯示 `ALL CHECKS PASSED`。

交付時提供受保護網址、三個頁面摘要，並說明 Dashboard 會在 Codex 更新專案紀錄及重新發布資料快照後更新。
