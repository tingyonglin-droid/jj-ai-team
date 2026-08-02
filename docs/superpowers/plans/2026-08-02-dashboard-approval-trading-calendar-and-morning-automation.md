# Dashboard 核准、交易日與晨報自動化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓私人 Dashboard 依美股交易時段正確顯示資料狀態、可安全核准晨報與風險版本，補產 2026-07-31 成果，並在台灣平日 07:30 前自動交付待核准晨報。

**Architecture:** 靜態 Markdown 仍是研究內容來源，產生器以版本化 NYSE 日曆計算應有報告日；Sites D1 保存逐版本核准事件，授權後由純函式把事件疊加到 Dashboard 快照。核准同步採 outbox：私人 API 匯出未同步事件，本機流程驗證內容雜湊、追加決策紀錄、提交後才回報同步完成。自動晨報在本機 Codex 專案中於 06:30 啟動，驗證與私人部署完成後於 07:30 前回報。

**Tech Stack:** TypeScript 5.9、Next.js App Router 16、React 19、Vinext、Cloudflare Workers／D1、Drizzle ORM、Node test runner、Markdown、Codex 專案自動化、Sites 私人部署。

## Global Constraints

- 所有自動產生的晨報與市場風險指標初始狀態必須是 `待核准`。
- 核准不等於發布、上線、投資、Beta、再平衡或持股調整。
- 晨報固定五則，以最可能影響行情、尤其是下行風險的事件為優先。
- 台灣時間週一至週五 06:30 啟動、07:10 鎖定資料截止、07:30 前交付；週末不產生例行版。
- 美國完整休市日之後跳過例行版；提早收盤仍視為有效交易時段。
- 市場風險歷史只新增版本或勘誤，不覆寫既有版本。
- Dashboard 維持私人擁有者限制，不公開、不放寬允許名單。
- D1 只保存必要的穩定使用者 ID，不保存不必要的 Email；所有寫入須經伺服器重新驗證。
- 同步憑證不得提交版本庫；未取得安全服務授權時顯示 `已核准、尚未同步`。
- 每個可查證的市場事實須附來源名稱、發布日期、資料期間與連結；不足或衝突時停止確定結論。
- 完成前必須通過 Dashboard 全測試、正式建置及 `sh scripts/validation/validate-workspace.sh`。

---

### Task 1: 建立可重現的 NYSE 交易日與晨報期望模組

**Files:**
- Create: `dashboard-site/data/nyse-market-calendar.json`
- Create: `dashboard-site/lib/market-calendar.ts`
- Create: `dashboard-site/lib/market-calendar.test.ts`
- Modify: `dashboard-site/package.json`

**Interfaces:**
- Produces: `type ReportExpectation = { dashboardDate: string; expectedReportDate: string | null; coveredSessionDate: string | null; phase: "before_cutoff" | "due" | "carry_forward" | "blocked"; reason: string }`.
- Produces: `resolveReportExpectation(now: Date, calendar: MarketCalendar): ReportExpectation`.
- Produces: `loadMarketCalendar(): MarketCalendar`，資料含 `timeZone`、`deliveryCutoff`、`coverageYears`、`fullCloseDates`、`earlyCloseDates`、`sources`、`reviewBy`。
- Consumes: 官方 NYSE 年度完整休市日與提早收盤日資料。

- [ ] **Step 1: 寫入市場日曆測試**

```ts
test("週日沿用週五晨報，週一 07:30 後要求週一晨報", () => {
  assert.equal(resolveReportExpectation(new Date("2026-08-02T01:00:00Z"), calendar).expectedReportDate, "2026-07-31");
  assert.equal(resolveReportExpectation(new Date("2026-08-03T00:00:00Z"), calendar).phase, "due");
});

test("完整休市不建立新晨報，提早收盤仍建立", () => {
  assert.equal(expectationAfterFullClose.expectedReportDate, previousEligibleReportDate);
  assert.equal(expectationAfterEarlyClose.coveredSessionDate, earlyCloseDate);
});
```

- [ ] **Step 2: 執行測試確認先失敗**

Run: `cd dashboard-site && node --import tsx --test lib/market-calendar.test.ts`

Expected: FAIL，因 `market-calendar.ts` 尚不存在。

- [ ] **Step 3: 加入經官方資料核對的日曆資料與最小演算法**

```ts
export function resolveReportExpectation(now: Date, calendar: MarketCalendar): ReportExpectation {
  const taipei = taipeiClock(now);
  if (!calendar.coverageYears.includes(taipei.year)) return blockedExpectation(taipei.date);
  return expectationForTaipeiClock(taipei, calendar);
}
```

演算法必須明確處理台灣週末、07:30 前後、前一美國交易日、完整休市、提早收盤與跨年；日曆 JSON 保存官方來源 URL、核對日期及下一次檢查日期。

- [ ] **Step 4: 把測試加入 `npm test` 並確認通過**

Run: `cd dashboard-site && npm run typecheck && node --import tsx --test lib/market-calendar.test.ts`

Expected: PASS。

- [ ] **Step 5: 提交交易日模組**

```bash
git add dashboard-site/data/nyse-market-calendar.json dashboard-site/lib/market-calendar.ts dashboard-site/lib/market-calendar.test.ts dashboard-site/package.json
git commit -m "feat: add morning report trading calendar"
```

### Task 2: 將 Dashboard 新鮮度改成交易日資料狀態

**Files:**
- Modify: `dashboard-site/lib/dashboard-types.ts`
- Modify: `dashboard-site/scripts/generate-dashboard-data.mts`
- Modify: `dashboard-site/scripts/generate-dashboard-data.test.mts`
- Modify: `dashboard-site/app/dashboard-components.tsx`
- Modify: `dashboard-site/app/dashboard-routes.test.tsx`
- Modify: `dashboard-site/app/briefs/brief-components.tsx`
- Modify: `dashboard-site/app/briefs/brief-components.test.tsx`
- Modify: `dashboard-site/app/globals.css`

**Interfaces:**
- Consumes: `resolveReportExpectation()` from Task 1.
- Produces: `type Freshness = "最新" | "沿用最近交易日" | "待更新" | "受阻" | "歷史版本"`.
- Produces: `DashboardSnapshot.expectation: ReportExpectation`.
- Produces: `freshnessFor(recordDate: string, expectation: ReportExpectation, isHistorical?: boolean): Freshness`.

- [ ] **Step 1: 將舊「日曆今日／過期」測試改成交易日案例**

```ts
test("週末不把最近有效晨報列為過期警告", async () => {
  const snapshot = await generateDashboardSnapshot(root, new Date("2026-08-02T01:00:00Z"));
  assert.equal(snapshot.brief?.freshness, "沿用最近交易日");
  assert.equal(snapshot.blockers.some((item) => item.kind === "stale"), false);
});

test("交付門檻後缺少應有晨報才顯示待更新", async () => {
  const snapshot = await generateDashboardSnapshot(root, new Date("2026-08-03T00:00:00Z"));
  assert.equal(snapshot.brief?.freshness, "待更新");
  assert.equal(snapshot.blockers.some((item) => item.severity === "warning"), true);
});
```

- [ ] **Step 2: 執行產生器與畫面測試確認失敗**

Run: `cd dashboard-site && node --import tsx --test scripts/generate-dashboard-data.test.mts app/dashboard-routes.test.tsx app/briefs/brief-components.test.tsx`

Expected: FAIL，舊程式仍輸出 `今日`／`過期` 並把週末列為 stale。

- [ ] **Step 3: 實作期望日期與資料狀態映射**

```ts
export function freshnessFor(
  recordDate: string,
  expectation: ReportExpectation,
  isHistorical = false,
): Freshness {
  if (isHistorical) return "歷史版本";
  if (expectation.phase === "blocked") return "受阻";
  if (recordDate === expectation.expectedReportDate) {
    return expectation.phase === "carry_forward" || expectation.phase === "before_cutoff"
      ? "沿用最近交易日"
      : "最新";
  }
  return "待更新";
}
```

移除 `staleIssue()` 的日曆日比較，改成只有超過交付門檻且缺少期望報告時產生 warning；日曆缺失、驗證失敗與研究／部署錯誤維持 blocker。

- [ ] **Step 4: 更新今日總覽文案與狀態視覺**

將區塊標題由「受阻項目」改成「資料狀態」，提醒與阻擋分開呈現；`沿用最近交易日` 使用中性色，`待更新` 使用提醒色，`受阻` 使用錯誤色。晨報與風險卡保留實際日期、涵蓋交易時段及資料截止，不把舊資料寫成今日。

- [ ] **Step 5: 執行相關測試與型別檢查**

Run: `cd dashboard-site && npm run typecheck && node --import tsx --test lib/market-calendar.test.ts scripts/generate-dashboard-data.test.mts app/dashboard-routes.test.tsx app/briefs/brief-components.test.tsx`

Expected: PASS。

- [ ] **Step 6: 提交資料狀態規則**

```bash
git add dashboard-site/lib/dashboard-types.ts dashboard-site/scripts/generate-dashboard-data.mts dashboard-site/scripts/generate-dashboard-data.test.mts dashboard-site/app/dashboard-components.tsx dashboard-site/app/dashboard-routes.test.tsx dashboard-site/app/briefs/brief-components.tsx dashboard-site/app/briefs/brief-components.test.tsx dashboard-site/app/globals.css
git commit -m "fix: derive dashboard status from trading days"
```

### Task 3: 建立 D1 核准事件儲存層

**Files:**
- Create: `dashboard-site/db/index.ts`
- Create: `dashboard-site/db/schema.ts`
- Create: `dashboard-site/db/approval-store.ts`
- Create: `dashboard-site/db/approval-store.test.ts`
- Create: `dashboard-site/drizzle.config.ts`
- Create: `dashboard-site/drizzle/0000_approval_events.sql`
- Create: `dashboard-site/drizzle/meta/_journal.json`
- Create: `dashboard-site/drizzle/meta/0000_snapshot.json`
- Modify: `dashboard-site/.openai/hosting.json`
- Modify: `dashboard-site/vite.config.ts`
- Modify: `dashboard-site/build/sites-vite-plugin.ts`
- Modify: `dashboard-site/package.json`
- Modify: `dashboard-site/package-lock.json`
- Modify: `dashboard-site/tests/release-contract.test.mjs`

**Interfaces:**
- Produces: `type ApprovalEvent = { eventId: string; artifactId: string; artifactType: "晨報" | "市場風險報告"; artifactVersion: number; artifactHash: string; action: "approve"; actorUserId: string; createdAt: string; syncStatus: "pending" | "synced" | "blocked"; syncedAt: string | null }`.
- Produces: `ApprovalStore.list(): Promise<ApprovalEvent[]>`、`approve(input): Promise<ApprovalEvent>`、`listPendingSync(): Promise<ApprovalEvent[]>`、`markSynced(eventIds, syncedAt): Promise<void>`.
- Produces: D1 binding logical name `DB`.

- [ ] **Step 1: 安裝固定版本的 Drizzle 並加入產生指令**

Run: `cd dashboard-site && npm install drizzle-orm@0.45.2 && npm install --save-dev drizzle-kit@0.31.10`

在 `package.json` 加入 `"db:generate": "drizzle-kit generate"`。

- [ ] **Step 2: 寫儲存層行為測試**

```ts
test("同一成果版本重複核准時回傳同一事件", async () => {
  const first = await store.approve(input);
  const second = await store.approve(input);
  assert.equal(second.eventId, first.eventId);
});

test("同步只更新指定事件，不改寫核准內容", async () => {
  await store.markSynced([event.eventId], "2026-08-03T00:00:00Z");
  assert.equal((await store.listPendingSync()).length, 0);
});
```

- [ ] **Step 3: 執行測試確認先失敗**

Run: `cd dashboard-site && node --import tsx --test db/approval-store.test.ts`

Expected: FAIL，因 schema 與 store 尚不存在。

- [ ] **Step 4: 實作 schema、唯一約束與儲存 helper**

```ts
export const approvalEvents = sqliteTable("approval_events", {
  eventId: text("event_id").primaryKey(),
  artifactId: text("artifact_id").notNull(),
  artifactType: text("artifact_type").notNull(),
  artifactVersion: integer("artifact_version").notNull(),
  artifactHash: text("artifact_hash").notNull(),
  action: text("action").notNull(),
  actorUserId: text("actor_user_id").notNull(),
  createdAt: text("created_at").notNull(),
  syncStatus: text("sync_status").notNull().default("pending"),
  syncedAt: text("synced_at"),
}, (table) => [uniqueIndex("approval_artifact_action_idx").on(table.artifactId, table.artifactVersion, table.action)]);
```

所有 D1 存取集中在 `db/index.ts` 與 `db/approval-store.ts`；同一 `prepare()` 不得包含多個 SQL statement。

- [ ] **Step 5: 宣告 D1、產生 migration 並封裝到建置輸出**

把 `.openai/hosting.json` 的 `d1` 設為 `DB`，在 `vite.config.ts` 加入本機 D1 binding，在 Sites build plugin 複製 `drizzle/` 至 `dist/.openai/drizzle/`。

Run: `cd dashboard-site && npm run db:generate && npm run build`

Expected: `dist/.openai/hosting.json` 宣告 `DB`，且 `dist/.openai/drizzle/` 含 migration。

- [ ] **Step 6: 執行儲存層、release contract 與型別測試**

Run: `cd dashboard-site && npm run typecheck && node --import tsx --test db/approval-store.test.ts tests/release-contract.test.mjs`

Expected: PASS。

- [ ] **Step 7: 提交 D1 基礎**

```bash
git add dashboard-site/.openai/hosting.json dashboard-site/vite.config.ts dashboard-site/build/sites-vite-plugin.ts dashboard-site/db dashboard-site/drizzle.config.ts dashboard-site/drizzle dashboard-site/package.json dashboard-site/package-lock.json dashboard-site/tests/release-contract.test.mjs
git commit -m "feat: persist dashboard approval events"
```

### Task 4: 實作逐版本核准驗證與快照疊加

**Files:**
- Create: `dashboard-site/lib/approval-events.ts`
- Create: `dashboard-site/lib/approval-events.test.ts`
- Create: `dashboard-site/app/api/approvals/approval-handler.ts`
- Create: `dashboard-site/app/api/approvals/approval-handler.test.ts`
- Create: `dashboard-site/app/api/approvals/route.ts`
- Modify: `dashboard-site/app/chatgpt-auth.ts`
- Modify: `dashboard-site/app/authorization.ts`
- Modify: `dashboard-site/app/authorization.test.ts`
- Modify: `dashboard-site/app/dashboard-snapshot.ts`
- Modify: `dashboard-site/app/dashboard-snapshot.test.ts`
- Modify: `dashboard-site/lib/dashboard-types.ts`
- Modify: `dashboard-site/scripts/generate-dashboard-data.mts`
- Modify: `dashboard-site/scripts/generate-dashboard-data.test.mts`
- Modify: `dashboard-site/package.json`

**Interfaces:**
- Produces: `ChatGPTUser.id` from `oai-authenticated-user-id`.
- Produces: `artifactHash` on every approvable snapshot record，使用 SHA-256 over normalized source content.
- Produces: `applyApprovalEvents(snapshot: DashboardSnapshot, events: ApprovalEvent[]): DashboardSnapshot`.
- Produces: `createApprovalHandler(deps): (request: Request) => Promise<Response>`，正式 `POST` route 注入 `requireAllowedUser`、`loadDashboardSnapshot`、`ApprovalStore`。

- [ ] **Step 1: 寫授權、雜湊、版本與疊加測試**

```ts
test("只將雜湊相符的指定版本標成已核准", () => {
  const approved = applyApprovalEvents(snapshot, [matchingEvent]);
  assert.equal(approved.approvals.some((item) => item.id === matchingEvent.artifactId), false);
  assert.equal(approved.brief?.artifactStatus, "已核准");
});

test("新版不繼承舊版核准", () => {
  assert.equal(applyApprovalEvents(v2Snapshot, [v1Event]).brief?.artifactStatus, "待核准");
});

test("跨來源、錯誤版本與非待核准成果回傳 409", async () => {
  assert.equal((await handler(invalidRequest)).status, 409);
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `cd dashboard-site && node --import tsx --test lib/approval-events.test.ts app/api/approvals/approval-handler.test.ts app/authorization.test.ts app/dashboard-snapshot.test.ts scripts/generate-dashboard-data.test.mts`

Expected: FAIL，尚無事件疊加、穩定使用者 ID 與 POST handler。

- [ ] **Step 3: 加入穩定使用者 ID 與成果內容雜湊**

`getChatGPTUser()` 必須同時取得 ID 與 Email；缺少任一必要身份欄位視為未登入。產生器將 normalized Markdown 的 SHA-256 存入 approvable record；前端不得自行提供可信雜湊。

- [ ] **Step 4: 實作純函式事件疊加**

`applyApprovalEvents()` 必須同步更新 `approvals`、`tasks`、`employees`、`brief`、`marketRisk` 及 `briefArchive`；只有 artifact ID、版本、雜湊和 action 全部相符才套用。同步尚未完成時附加 warning，不撤銷 `已核准`。

- [ ] **Step 5: 實作同源、大小與後端狀態驗證**

```ts
export async function handleApproval(request: Request, deps: ApprovalHandlerDeps) {
  if (request.method !== "POST" || !isSameOrigin(request)) return jsonError(403, "核准請求來源不符");
  const user = await deps.requireUser("/approvals");
  const input = await readBoundedJson(request, 2048);
  const artifact = findPendingArtifact(await deps.loadSnapshot(), input.artifactId, input.version);
  if (!artifact) return jsonError(409, "此版本已不是可核准狀態");
  return jsonSuccess(await deps.store.approve(toApprovalInput(artifact, user.id)));
}
```

- [ ] **Step 6: 讓所有受保護頁面先授權、再載入靜態快照與核准事件**

`loadAuthorizedDashboardSnapshot()` 的依賴順序固定為 `authorize → load snapshot → load approval events → apply events`；授權失敗時不得讀取私人快照或 D1。

- [ ] **Step 7: 執行全部相關測試**

Run: `cd dashboard-site && npm run typecheck && node --import tsx --test lib/approval-events.test.ts app/api/approvals/approval-handler.test.ts app/authorization.test.ts app/dashboard-snapshot.test.ts scripts/generate-dashboard-data.test.mts`

Expected: PASS。

- [ ] **Step 8: 提交核准領域與 API**

```bash
git add dashboard-site/lib dashboard-site/app/api/approvals dashboard-site/app/chatgpt-auth.ts dashboard-site/app/authorization.ts dashboard-site/app/authorization.test.ts dashboard-site/app/dashboard-snapshot.ts dashboard-site/app/dashboard-snapshot.test.ts dashboard-site/scripts/generate-dashboard-data.mts dashboard-site/scripts/generate-dashboard-data.test.mts dashboard-site/package.json
git commit -m "feat: validate versioned dashboard approvals"
```

### Task 5: 加入二次確認核准按鍵

**Files:**
- Create: `dashboard-site/app/approvals/approval-action.tsx`
- Create: `dashboard-site/app/approvals/approval-action.test.tsx`
- Modify: `dashboard-site/app/dashboard-components.tsx`
- Modify: `dashboard-site/app/dashboard-routes.test.tsx`
- Modify: `dashboard-site/app/globals.css`

**Interfaces:**
- Consumes: `POST /api/approvals` with `{ artifactId: string; version: number }`.
- Produces: `ApprovalAction({ artifactId, version, label })` client component，狀態為 `idle | confirming | submitting | error`.
- Produces: `approvalActionReducer(state, event)` 與 `submitApproval(fetcher, artifactId, version)`，讓狀態轉換與網路錯誤可在沒有瀏覽器 DOM 的 Node 測試中驗證。
- Produces: 成功後 `router.refresh()`，由伺服器重新載入 D1 疊加狀態。

- [ ] **Step 1: 寫二次確認、取消、送出與錯誤測試**

```ts
test("第一次動作只進入確認狀態", () => {
  assert.deepEqual(approvalActionReducer({ phase: "idle" }, { type: "request" }), {
    phase: "confirming",
  });
});

test("送出成功回傳成功，失敗保留錯誤訊息", async () => {
  assert.deepEqual(await submitApproval(okFetch, artifactId, version), { ok: true });
  assert.deepEqual(await submitApproval(failedFetch, artifactId, version), {
    ok: false,
    error: "此版本已不是可核准狀態",
  });
});
```

- [ ] **Step 2: 執行元件測試確認失敗**

Run: `cd dashboard-site && node --import tsx --test app/approvals/approval-action.test.tsx app/dashboard-routes.test.tsx`

Expected: FAIL，核准元件尚不存在。

- [ ] **Step 3: 實作可鍵盤操作的 inline 二次確認**

第一次按鍵不得寫入；確認與取消使用明確文字。送出時停用重複點擊並用 `aria-live` 回報；錯誤不得先把卡片從畫面移除。

- [ ] **Step 4: 在首頁待決定清單與核准中心共用按鍵**

只有 `晨報` 與 `市場風險報告` 顯示第一版核准按鍵；其他成果仍保持唯讀待核准狀態。晨報「查看全文」連結繼續存在。

- [ ] **Step 5: 執行畫面、型別與 lint 測試**

Run: `cd dashboard-site && npm run typecheck && npm run lint && node --import tsx --test app/approvals/approval-action.test.tsx app/dashboard-routes.test.tsx`

Expected: PASS，且 HTML 不含發布、買進或賣出操作。

- [ ] **Step 6: 提交核准介面**

```bash
git add dashboard-site/app/approvals/approval-action.tsx dashboard-site/app/approvals/approval-action.test.tsx dashboard-site/app/dashboard-components.tsx dashboard-site/app/dashboard-routes.test.tsx dashboard-site/app/globals.css
git commit -m "feat: add dashboard approval confirmation"
```

### Task 6: 建立核准 outbox 同步器，服務憑證採明確閘門

**Files:**
- Create: `dashboard-site/app/api/approval-sync/sync-handler.ts`
- Create: `dashboard-site/app/api/approval-sync/sync-handler.test.ts`
- Create: `dashboard-site/app/api/approval-sync/route.ts`
- Create: `dashboard-site/scripts/sync-approval-events.mts`
- Create: `dashboard-site/scripts/sync-approval-events.test.mts`
- Modify: `dashboard-site/package.json`
- Modify: `.gitignore`
- Modify: `records/decisions/README.md`

**Interfaces:**
- Produces: authenticated `GET /api/approval-sync` returning pending events without Email.
- Produces: authenticated `POST /api/approval-sync` accepting `{ eventIds: string[], syncedAt: string }` only after local validation and commit.
- Produces: `npm run approvals:sync -- fetch` and `npm run approvals:sync -- acknowledge <manifest-path>`.
- Consumes environment only: `DASHBOARD_SITE_URL`、`SITES_BYPASS_TOKEN`、`APPROVAL_SYNC_SECRET`; none may enter Git.

- [ ] **Step 1: 寫同步授權、匯出、雜湊不符與冪等測試**

```ts
test("缺少或錯誤服務密鑰時拒絕同步 API", async () => {
  assert.equal((await handler(requestWithoutSecret)).status, 401);
});

test("內容雜湊不符時不建立決策紀錄也不 acknowledge", async () => {
  await assert.rejects(fetchAndMaterialize(eventWithWrongHash), /內容雜湊不符/);
});
```

- [ ] **Step 2: 執行同步測試確認失敗**

Run: `cd dashboard-site && node --import tsx --test app/api/approval-sync/sync-handler.test.ts scripts/sync-approval-events.test.mts`

Expected: FAIL，outbox API 與 CLI 尚不存在。

- [ ] **Step 3: 實作雙層授權與最小資料匯出**

Sites 私人登入閘門由 `OAI-Sites-Authorization` 處理，應用層再以 timing-safe comparison 驗證 `APPROVAL_SYNC_SECRET`。API 不接受瀏覽器使用者身份代替服務身份，不回傳 Email、允許名單或環境值。

- [ ] **Step 4: 實作 fetch 與 acknowledge 兩階段 CLI**

`fetch` 逐筆驗證來源路徑在允許目錄、版本與 SHA-256，使用 exclusive create 追加 `records/decisions/YYYY-MM-DD-approve-<artifact>-<version>.md`，並將 event IDs 寫入被 `.gitignore` 排除的本機 manifest。決策紀錄固定包含 `決策日期`、`決策者：使用者（Dashboard 已驗證）`、`決定`、`生效日`、`適用範圍`、來源版本、內容雜湊及事件 ID。`acknowledge` 只有在呼叫者確認相對應 commit 已存在後才標為 synced。

- [ ] **Step 5: 執行同步與安全測試**

Run: `cd dashboard-site && npm run typecheck && node --import tsx --test app/api/approval-sync/sync-handler.test.ts scripts/sync-approval-events.test.mts`

Expected: PASS；缺少三個環境值任一項時 fail closed，Dashboard 仍保留 `已核准、尚未同步`。

- [ ] **Step 6: 提交同步程式，但不建立服務憑證**

```bash
git add dashboard-site/app/api/approval-sync dashboard-site/scripts/sync-approval-events.mts dashboard-site/scripts/sync-approval-events.test.mts dashboard-site/package.json .gitignore records/decisions/README.md
git commit -m "feat: add audited approval outbox sync"
```

- [ ] **Step 7: 在啟用前取得服務授權**

若正式私站需要 Sites 登入繞過 token，停止在此閘門並請使用者明確授權建立／旋轉 token。獲准後，將 bypass token 與獨立 sync secret 只保存於 Sites 環境及本機忽略檔；未獲准時不啟用自動同步，畫面保留尚未同步提醒。

### Task 7: 補產 2026-07-31 晨報與市場風險指標

**Files:**
- Create: `records/daily-briefs/2026-07-31-v01.md`
- Create: `records/market-risk/2026-07-31-v01.md`
- Modify: `dashboard-site/data/dashboard.json`（由產生器建立）

**Interfaces:**
- Consumes: `workflows/daily-brief.md`、`workflows/market-risk.md`、`templates/daily-brief.md`、`templates/market-risk-report.md`、`knowledge/investment-philosophy.md` 與 2026-07-30 美國交易時段可追溯資料。
- Produces: 恰好五則、五分鐘內可讀完、狀態 `待核准` 的晨報；同證據產生可重現的 0–100 風險指標。

- [ ] **Step 1: 鎖定研究範圍與資料截止**

以 2026-07-31 台灣晨間可取得資料為範圍，明示涵蓋 2026-07-30 美國交易時段。先查央行、政府、交易所、監管機構與公司 IR，再以可信二手資料核對市場反應；後續才發布的資訊不得寫成當時已知。

- [ ] **Step 2: 建立至少八則候選並排序成五則**

每則候選評估發生機率、下跌衝擊、影響廣度、持續時間及迫近度；合併同一因果鏈，同一因果鏈原則上最多兩則。固定選五則，不以低品質事件湊數。

- [ ] **Step 3: 依模板建立晨報 v01**

每則包含發生什麼事、關鍵數據、市場意義、A–D 性質、風險階段、三種期限、傳導鏈、確認訊號、反方證據、失效條件與接下來觀察。AI 財報同時比較 CapEx、自由現金流、雲端／AI 收入與商業化速度。

- [ ] **Step 4: 使用同一證據建立風險 v01**

五項子分數各 20%，每項使用 5 分刻度，列基準分、事件調整、最終分、即時風險、結構性風險、三項主要風險、完整度與信心；與前一有效版本比較但不得修改前值。

- [ ] **Step 5: 執行內容契約與工作區驗證**

Run: `PATH=/Users/jjlin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH sh scripts/validation/validate-workspace.sh`

Expected: ALL CHECKS PASSED；晨報恰好五則，風險分數可重算，兩份狀態均為 `待核准`。

- [ ] **Step 6: 重建 Dashboard 快照並檢查 7/31 成果**

Run: `cd dashboard-site && npm run data:generate && npm test`

Expected: 快照最新版為 2026-07-31；晨報與風險兩項出現在待核准清單，週末狀態是 `沿用最近交易日`。

- [ ] **Step 7: 提交補產成果**

```bash
git add records/daily-briefs/2026-07-31-v01.md records/market-risk/2026-07-31-v01.md dashboard-site/data/dashboard.json
git commit -m "feat: add July 31 morning risk brief"
```

### Task 8: 記錄已核准決策並完成全功能驗證

**Files:**
- Create: `records/decisions/2026-08-02-enable-dashboard-approval-and-morning-schedule.md`
- Modify: `dashboard-site/README.md`
- Modify: `workflows/daily-brief.md`（只有實作驗證發現契約需精確化時才追加，不能改變已核准方法）

**Interfaces:**
- Produces: 可追溯的使用者核准日期、決策者、方案 A、二次確認、交易日規則、06:30／07:30 排程、生效範圍及後續檢查日。
- Produces: Dashboard README 的 D1 migration、核准測試、同步狀態與私人部署操作說明。

- [ ] **Step 1: 寫入決策紀錄與操作文件**

決策紀錄不得把排程核准延伸成發布或投資授權；同步憑證閘門需單獨標示尚未授權或已授權的真實狀態。

- [ ] **Step 2: 執行 Dashboard 全測試**

Run: `cd dashboard-site && npm test && npm run lint`

Expected: 型別、全部 Node 測試、正式 build 及 rendered HTML 測試通過。

- [ ] **Step 3: 執行工作區驗證與差異檢查**

Run: `PATH=/Users/jjlin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH sh scripts/validation/validate-workspace.sh`

Run: `git diff --check && git status --short`

Expected: ALL CHECKS PASSED；沒有空白錯誤或未說明的產物。

- [ ] **Step 4: 提交決策與文件**

```bash
git add records/decisions/2026-08-02-enable-dashboard-approval-and-morning-schedule.md dashboard-site/README.md workflows/daily-brief.md
git commit -m "docs: record dashboard approval automation decision"
```

### Task 9: 私人部署、主分支整合與 06:30 排程啟用

**Files:**
- Verify: `dashboard-site/dist/**`
- Verify: `dashboard-site/dist/.openai/hosting.json`
- Verify: `dashboard-site/dist/.openai/drizzle/**`
- Verify: repository root main worktree and `.git`
- External state: existing private Sites project and Codex `jj-ai-team` project automation.

**Interfaces:**
- Consumes: Tasks 1–8 的已提交 feature branch。
- Produces: 新的私人 Sites production version；本機 `main` 含所有實作；一個台灣時間週一至週五 06:30 的獨立晨報 automation。

- [ ] **Step 1: 依 Sites 發布流程重新建置並檢查封包**

Run: `cd dashboard-site && npm run build`

Expected: `dist/` 存在，hosting metadata 宣告 `DB`，migration 一併封裝；沒有祕密或本機同步 manifest。

- [ ] **Step 2: 推送精確 source commit、保存並部署私人版本**

使用既有 `.openai/hosting.json` project ID，不建立第二個 Site；先推送精確 commit，再保存該 commit 的版本，最後部署已保存版本。不得改變 owner-only access。

Expected: 部署狀態 terminal success，首頁、核准中心、晨報全文與市場風險頁皆能通過授權載入。

- [ ] **Step 3: 執行正式站冒煙測試**

驗證未授權請求不洩漏私人內容；授權頁顯示 7/31 待核准成果、週末沿用最近交易日、二次確認按鍵。使用測試 fixture 或未核准的測試 artifact 驗證 D1 寫入與冪等，不得誤核准真實成果。

- [ ] **Step 4: 依 finishing-a-development-branch 檢查主工作區後 fast-forward 整合**

先確認 root worktree 沒有會被覆蓋的使用者變更；僅在可 fast-forward 且全測試仍通過時把 `feature/dashboard` 整合至 `main`。不得使用 reset、checkout 覆寫或 force push。

- [ ] **Step 5: 建立工作日 06:30 台灣時間自動化**

automation prompt 必須要求：讀 AGENTS、每日晨報與風險工作流；確認是否有新完成美股交易時段；先同步可安全讀取的核准 outbox；研究至少八則候選並固定五則；產生 `待核准` 晨報與風險；07:10 鎖定截止；執行完整驗證；部署既有私人 Site；07:30 前回報成功、有限版、跳過或受阻；不發布、不核准、不做投資行動。

Schedule: `30 6 * * 1-5`，timezone `Asia/Taipei`，project `jj-ai-team`，standalone local run。

- [ ] **Step 6: 檢查排程與私人部署最終狀態**

確認 automation 已啟用、下一次執行時間正確、沒有修改既有 `jj-invest-public` 排程；確認 Sites 仍只有獲准使用者可讀。

- [ ] **Step 7: 最終交付**

回報實際部署網址、7/31 晨報與風險路徑、Dashboard 核准位置、排程下一次執行時間、同步憑證是否已啟用，以及所有驗證命令結果。不得宣稱尚未測試或尚未啟用的部分已完成。
