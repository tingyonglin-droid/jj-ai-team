# Dashboard 晨報全文與歷史閱讀 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在既有私人 Dashboard 加入可追溯的晨報歷史列表、完整內容閱讀頁與同日版本切換。

**Architecture:** `records/daily-briefs/*.md` 維持唯一權威來源；建置前的資料產生器驗證每個版本，使用受限 Markdown 解析器轉成安全且具型別的內容區塊，再寫入唯讀 Dashboard 快照。受保護的 `/briefs` 與 `/briefs/[date]` 只讀快照；首頁與待核准中心連到同一份最新版全文。

**Tech Stack:** TypeScript、React 19、Next.js App Router／Vinext、Node.js test runner、Sites 私人託管

## Global Constraints

- `records/daily-briefs/*.md` 是唯一權威來源，不建立第二份文章內容。
- `/briefs` 與 `/briefs/[date]` 必須沿用既有 ChatGPT 身分及允許名單驗證。
- 同一日期在歷史列表只顯示最高有效 `vNN`；全文頁可切換所有有效版本。
- Markdown 原始 HTML 不執行；連結只允許 `http:` 與 `https:`。
- 新版格式錯誤時保留最後有效版本，並沿用既有 blocker。
- 第一版不做搜尋、分頁、核准操作、外部發布操作或 07:30 自動排程。
- 不修改允許帳號、登入政策、環境祕密、晨報研究內容或風險評分方法。

---

### Task 1: 安全的晨報內容型別與 Markdown 解析器

**Files:**
- Create: `dashboard-site/lib/brief-content.ts`
- Create: `dashboard-site/lib/brief-content.test.ts`
- Modify: `dashboard-site/lib/dashboard-types.ts`

**Interfaces:**
- Consumes: 一份已通過成果 manifest 驗證的 Markdown 字串。
- Produces: `parseBriefMarkdown(markdown: string): BriefBlock[]`、`selectBriefVersion(documents, date, version?)`、`BriefInlineNode`、`BriefBlock`、`DashboardBriefDocument`。

- [ ] **Step 1: 定義內容與文件型別**

在 `dashboard-site/lib/dashboard-types.ts` 新增：

```ts
export type BriefInlineNode =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string };

export type BriefBlock =
  | { type: "heading"; level: 2 | 3 | 4; content: BriefInlineNode[] }
  | { type: "paragraph"; content: BriefInlineNode[] }
  | { type: "list"; ordered: boolean; items: BriefInlineNode[][] }
  | { type: "table"; headers: BriefInlineNode[][]; rows: BriefInlineNode[][][] };

export interface DashboardBriefDocument extends TraceableRecord {
  id: string;
  date: string;
  version: number;
  versionLabel: string;
  isLatest: boolean;
  title: string;
  summary: string;
  freshness: Freshness;
  artifactStatus: ArtifactStatus;
  rawStatus: string;
  blocks: BriefBlock[];
}
```

並在 `DashboardSnapshot` 新增：

```ts
briefArchive: DashboardBriefDocument[];
```

- [ ] **Step 2: 寫解析器的失敗測試**

建立 `dashboard-site/lib/brief-content.test.ts`，以一份含標題、段落、清單、表格、外部連結與原始 HTML 的 Markdown 驗證：

```ts
test("把晨報 Markdown 解析為安全的結構化區塊", () => {
  const blocks = parseBriefMarkdown(`# 主標題

## 一分鐘摘要

- **風險上升**但仍需確認

| 指標 | 數值 |
|---|---:|
| 風險 | 65 |

[Fed](https://www.federalreserve.gov/) <script>alert(1)</script>`);

  assert.deepEqual(blocks[0], {
    type: "heading",
    level: 2,
    content: [{ type: "text", text: "一分鐘摘要" }],
  });
  assert.equal(blocks.some((block) => block.type === "list"), true);
  assert.equal(blocks.some((block) => block.type === "table"), true);
  assert.equal(JSON.stringify(blocks).includes("https://www.federalreserve.gov/"), true);
  assert.equal(JSON.stringify(blocks).includes("<script>"), true);
});

test("不把非 http 連結建立成可點擊節點", () => {
  const blocks = parseBriefMarkdown("[危險](javascript:alert(1))");
  assert.equal(JSON.stringify(blocks).includes('"type":"link"'), false);
});
```

原始 HTML 保留為 React 文字節點，因此測試允許看見 `<script>` 字串，但不得生成 HTML 或執行內容。

- [ ] **Step 3: 執行測試並確認紅燈**

Run:

```bash
node --import tsx --test lib/brief-content.test.ts
```

Expected: FAIL，因 `brief-content.ts` 與 `parseBriefMarkdown` 尚不存在。

- [ ] **Step 4: 實作受限解析器與版本選擇器**

在 `dashboard-site/lib/brief-content.ts` 實作以下公開介面：

```ts
import type {
  BriefBlock,
  BriefInlineNode,
  DashboardBriefDocument,
} from "./dashboard-types";

export function parseBriefMarkdown(markdown: string): BriefBlock[];

export function selectBriefVersion(
  documents: DashboardBriefDocument[],
  date: string,
  version?: string,
): DashboardBriefDocument | null;

export function versionsForDate(
  documents: DashboardBriefDocument[],
  date: string,
): DashboardBriefDocument[];
```

解析規則固定為：忽略第一個 `#` 主標題；`##`、`###`、`####` 分別轉成 level 2–4；連續非空白文字合併成 paragraph；連續 `-`／`*` 或 `1.` 轉成 list；含分隔列的 pipe table 轉成 table；`**文字**`、反引號及 Markdown 連結轉成 inline node；只有 `new URL(href).protocol` 為 `http:` 或 `https:` 時才建立 link，其他連結只保留標籤文字。React 顯示時不得使用 `dangerouslySetInnerHTML`。

`selectBriefVersion` 在未傳版本時選 `isLatest === true`；傳入版本時以 `versionLabel` 精確比對，找不到即回傳 `null`。`versionsForDate` 依 `version` 由大到小排列。

- [ ] **Step 5: 執行解析器測試、型別檢查與提交**

Run:

```bash
node --import tsx --test lib/brief-content.test.ts
node node_modules/typescript/bin/tsc --noEmit
```

Expected: 全部 PASS。

Commit:

```bash
git add dashboard-site/lib/brief-content.ts dashboard-site/lib/brief-content.test.ts dashboard-site/lib/dashboard-types.ts
git commit -m "feat: parse safe morning brief content"
```

### Task 2: 產生所有有效版本的晨報歷史快照

**Files:**
- Modify: `dashboard-site/scripts/generate-dashboard-data.mts`
- Modify: `dashboard-site/scripts/generate-dashboard-data.test.mts`
- Modify: `dashboard-site/data/dashboard.json`（只在最終生成快照時更新）

**Interfaces:**
- Consumes: Task 1 的 `parseBriefMarkdown`、`DashboardBriefDocument`，以及 `markdownRecords()` 讀出的 daily-brief 版本。
- Produces: `DashboardSnapshot.briefArchive`，包含所有有效版本並標示每個日期的最新版。

- [ ] **Step 1: 寫同日版本與壞格式回退的失敗測試**

在 `generate-dashboard-data.test.mts` 的既有暫存工作區測試加入 `2026-07-30-v01.md`、`v02.md` 與缺必要章節的 `v03.md`，斷言：

```ts
assert.deepEqual(
  snapshot.briefArchive.map(({ date, versionLabel, isLatest }) => ({ date, versionLabel, isLatest })),
  [
    { date: "2026-07-30", versionLabel: "v02", isLatest: true },
    { date: "2026-07-30", versionLabel: "v01", isLatest: false },
  ],
);
assert.equal(
  snapshot.blockers.some((blocker) => blocker.source?.endsWith("2026-07-30-v03.md")),
  true,
);
assert.equal(snapshot.briefArchive[0]?.blocks.some((block) => block.type === "table"), true);
```

另加第二個日期，驗證 `briefArchive` 先依日期降冪，再依版本降冪。

- [ ] **Step 2: 執行資料產生器測試並確認紅燈**

Run:

```bash
node --import tsx --test scripts/generate-dashboard-data.test.mts
```

Expected: FAIL，因快照尚無 `briefArchive`。

- [ ] **Step 3: 實作 `buildBriefArchive`**

在 `generate-dashboard-data.mts` 匯入 `parseBriefMarkdown`，新增：

```ts
function buildBriefArchive(
  records: MarkdownRecord[],
  dashboardDate: string,
): DashboardSnapshot["briefArchive"];
```

實作規則：逐份呼叫既有 `validateRecord`，只保留 `valid: true`；以 `representativeDate` 分組；每組最高 `version` 標成 `isLatest: true`；`versionLabel` 使用 `v${String(version).padStart(2, "0")}`；`blocks` 使用 `parseBriefMarkdown(record.content)`；結果依日期降冪、版本降冪。壞格式來源的 blocker 繼續由既有 `selectLatestEffective` 產生，不重複新增第二個 blocker。

在 `generateDashboardSnapshot()` 從 `definitions` 找出 `id === "daily-brief"` 對應的 record set，建立 `briefArchive` 並放入回傳值。保留現有 `brief` 欄位，避免破壞首頁資料契約。

- [ ] **Step 4: 執行資料、解析與型別測試**

Run:

```bash
node --import tsx --test lib/brief-content.test.ts scripts/generate-dashboard-data.test.mts
node node_modules/typescript/bin/tsc --noEmit
```

Expected: 全部 PASS，且壞掉的 v03 不會取代 v02。

- [ ] **Step 5: 提交歷史快照資料流**

```bash
git add dashboard-site/scripts/generate-dashboard-data.mts dashboard-site/scripts/generate-dashboard-data.test.mts
git commit -m "feat: generate morning brief archive"
```

此任務不暫存生成的 `dashboard-site/data/dashboard.json`；最終發布任務會重新產生並驗證它。

### Task 3: 加入全文入口與歷史列表

**Files:**
- Create: `dashboard-site/app/briefs/brief-components.tsx`
- Create: `dashboard-site/app/briefs/brief-components.test.tsx`
- Create: `dashboard-site/app/briefs/page.tsx`
- Modify: `dashboard-site/app/dashboard-shell.tsx`
- Modify: `dashboard-site/app/dashboard-components.tsx`
- Modify: `dashboard-site/app/approvals/page.tsx`
- Modify: `dashboard-site/app/dashboard-routes.test.tsx`

**Interfaces:**
- Consumes: `DashboardSnapshot.briefArchive` 與每份文件的 `isLatest`、`date`、`versionLabel`。
- Produces: `BriefArchive({ documents })`、主選單「晨報全文」、首頁與待核准中心的「查看全文」連結。

- [ ] **Step 1: 寫入口與歷史列表的失敗測試**

在 `brief-components.test.tsx` 建立兩日、同日兩版本的 `DashboardBriefDocument[]`，斷言：

```ts
const html = renderToStaticMarkup(<BriefArchive documents={documents} />);
assert.match(html, /晨報歷史/);
assert.match(html, /2026-07-30/);
assert.match(html, /2026-07-29/);
assert.match(html, /href="\/briefs\/2026-07-30"/);
assert.equal((html.match(/2026-07-30/g) ?? []).length >= 1, true);
assert.doesNotMatch(html, />v01</);
```

在 `dashboard-routes.test.tsx` 新增斷言：首頁晨報卡有 `/briefs/2026-07-30`；待核准中心只有晨報項目出現「查看全文」。

- [ ] **Step 2: 執行畫面測試並確認紅燈**

Run:

```bash
node --import tsx --test app/briefs/brief-components.test.tsx app/dashboard-routes.test.tsx
```

Expected: FAIL，因列表元件、路由與連結尚不存在。

- [ ] **Step 3: 實作歷史列表與導覽**

在 `brief-components.tsx` 新增：

```tsx
export function BriefArchive({
  documents,
}: {
  documents: DashboardBriefDocument[];
}) {
  const latest = documents.filter((document) => document.isLatest);
  // 以語意化 article 列出最新版卡片；空集合使用既有 EmptyState 文案模式。
}
```

每張卡片顯示 `title`、`date`、`versionLabel`、`artifactStatus`、`asOf`、`summary` 與 `<Link href={\`/briefs/${document.date}\`}>查看全文</Link>`。

在 `app/briefs/page.tsx` 先呼叫：

```ts
const { user, snapshot } = await loadAuthorizedDashboardSnapshot("/briefs");
```

再以 `DashboardShell` 包住 `BriefArchive`。在 `dashboard-shell.tsx` 主選單加入 `/briefs`。在首頁從 `snapshot.briefArchive` 找出 `source === snapshot.brief.source` 的文件並顯示全文連結。`ApprovalCenter` 對 `approval.type === "晨報" && approval.recordDate` 顯示 `/briefs/${approval.recordDate}`；其他類型不顯示。

- [ ] **Step 4: 執行元件、路由與型別測試**

Run:

```bash
node --import tsx --test app/briefs/brief-components.test.tsx app/dashboard-routes.test.tsx
node node_modules/typescript/bin/tsc --noEmit
```

Expected: 全部 PASS。

- [ ] **Step 5: 提交入口與歷史列表**

```bash
git add dashboard-site/app/briefs/brief-components.tsx dashboard-site/app/briefs/brief-components.test.tsx dashboard-site/app/briefs/page.tsx dashboard-site/app/dashboard-shell.tsx dashboard-site/app/dashboard-components.tsx dashboard-site/app/approvals/page.tsx dashboard-site/app/dashboard-routes.test.tsx
git commit -m "feat: add morning brief archive view"
```

### Task 4: 加入完整閱讀頁、版本切換與權限回歸

**Files:**
- Create: `dashboard-site/app/briefs/[date]/page.tsx`
- Modify: `dashboard-site/app/briefs/brief-components.tsx`
- Modify: `dashboard-site/app/briefs/brief-components.test.tsx`
- Modify: `dashboard-site/app/dashboard-snapshot.test.ts`
- Modify: `dashboard-site/tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `selectBriefVersion()`、`versionsForDate()` 與 `BriefBlock`。
- Produces: `BriefReader({ document, versions })`，以及 `/briefs/[date]?version=vNN` 的受保護全文頁。

- [ ] **Step 1: 寫全文渲染與版本切換的失敗測試**

在 `brief-components.test.tsx` 加入：

```ts
const html = renderToStaticMarkup(
  <BriefReader document={documents[0]} versions={documents.slice(0, 2)} />,
);
assert.match(html, /完整晨報/);
assert.match(html, /目前版本：v02/);
assert.match(html, /href="\/briefs\/2026-07-30\?version=v01"/);
assert.match(html, /<table/);
assert.match(html, /rel="noreferrer"/);
assert.doesNotMatch(html, /dangerouslySetInnerHTML/);
```

在 `dashboard-snapshot.test.ts` 的授權路由清單加入 `/briefs` 與 `/briefs/2026-07-30?version=v01`。在 `rendered-html.test.mjs` 的授權測試加入 `/briefs`、`/briefs/2026-07-30`，並在未授權測試確認回應不含晨報標題、摘要或來源路徑。

- [ ] **Step 2: 執行全文與權限測試並確認紅燈**

Run:

```bash
node --import tsx --test app/briefs/brief-components.test.tsx app/dashboard-snapshot.test.ts
```

Expected: FAIL，因 `BriefReader` 與動態路由尚不存在。

- [ ] **Step 3: 實作安全內容渲染器**

在 `brief-components.tsx` 新增 `InlineContent`、`BriefBlockView` 與：

```tsx
export function BriefReader({
  document,
  versions,
}: {
  document: DashboardBriefDocument;
  versions: DashboardBriefDocument[];
}) {
  // 顯示返回列表、狀態、資料截止、版本連結與所有結構化內容區塊。
}
```

`link` 節點使用 `<a href={node.href} rel="noreferrer">`；表格放在 `div.brief-table-scroll`；不得使用 `dangerouslySetInnerHTML`。找不到日期或版本時使用 `BriefNotFound`，文案只包含要求的日期／版本，不顯示其他文件資訊。

- [ ] **Step 4: 實作受保護的動態路由**

在 `app/briefs/[date]/page.tsx` 使用：

```tsx
type BriefPageProps = {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ version?: string }>;
};

export default async function BriefPage({ params, searchParams }: BriefPageProps) {
  const { date } = await params;
  const { version } = await searchParams;
  const returnTo = version
    ? `/briefs/${date}?version=${encodeURIComponent(version)}`
    : `/briefs/${date}`;
  const { user, snapshot } = await loadAuthorizedDashboardSnapshot(returnTo);
  const document = selectBriefVersion(snapshot.briefArchive, date, version);
  const versions = versionsForDate(snapshot.briefArchive, date);
  return (
    <DashboardShell user={user} generatedAt={snapshot.generatedAt}>
      {document ? <BriefReader document={document} versions={versions} /> : <BriefNotFound date={date} version={version} />}
    </DashboardShell>
  );
}
```

授權必須發生在版本查找之前，避免未授權請求藉由不同回應推測文件是否存在。

- [ ] **Step 5: 執行元件、授權、型別與正式渲染測試**

Run:

```bash
node --import tsx --test app/briefs/brief-components.test.tsx app/dashboard-snapshot.test.ts app/dashboard-routes.test.tsx
node node_modules/typescript/bin/tsc --noEmit
WRANGLER_LOG_PATH=.wrangler/wrangler.log node node_modules/vinext/dist/cli.js build
node --test tests/rendered-html.test.mjs
```

Expected: 全部 PASS；允許帳號可讀兩個新路由，其他帳號得到 403 且不含私人內容。

- [ ] **Step 6: 提交全文閱讀與權限保護**

```bash
git add 'dashboard-site/app/briefs/[date]/page.tsx' dashboard-site/app/briefs/brief-components.tsx dashboard-site/app/briefs/brief-components.test.tsx dashboard-site/app/dashboard-snapshot.test.ts dashboard-site/tests/rendered-html.test.mjs
git commit -m "feat: add protected full brief reader"
```

### Task 5: 響應式樣式、完整驗證與私人部署

**Files:**
- Modify: `dashboard-site/app/globals.css`
- Modify: `dashboard-site/tests/release-contract.test.mjs`
- Generate: `dashboard-site/data/dashboard.json`
- Verify: `dashboard-site/README.md`

**Interfaces:**
- Consumes: Tasks 1–4 的完整功能與既有 Sites `project_id`。
- Produces: 通過完整驗證並顯示晨報全文、歷史與版本切換的私人正式 Dashboard。

- [ ] **Step 1: 寫響應式與可用性契約的失敗測試**

在 `release-contract.test.mjs` 讀取 `app/globals.css` 與全文元件，斷言：

```js
assert.match(css, /\.brief-archive-grid/);
assert.match(css, /\.brief-reader/);
assert.match(css, /\.brief-version-nav/);
assert.match(css, /\.brief-table-scroll[\s\S]*overflow-x:\s*auto/);
assert.match(css, /@media\s*\(max-width:\s*720px\)/);
assert.doesNotMatch(briefComponents, /dangerouslySetInnerHTML/);
```

- [ ] **Step 2: 執行發布契約並確認紅燈**

Run:

```bash
node --test tests/release-contract.test.mjs
```

Expected: FAIL，因全文閱讀樣式尚未加入。

- [ ] **Step 3: 加入最小響應式樣式**

在 `globals.css` 加入：歷史卡片網格、全文最大閱讀寬度、版本導覽、正文標題層級、清單間距、表格框線與 `overflow-x: auto`。在既有 `@media (max-width: 720px)` 中把歷史卡片改成單欄，版本連結允許換行，全文左右留白縮小。維持既有色票與狀態 badge，不引入新 UI 套件。

- [ ] **Step 4: 重新生成快照並斷言正式資料**

Run:

```bash
node --import tsx scripts/generate-dashboard-data.mts ..
node -e 'const d=require("./data/dashboard.json"); const latest=d.briefArchive.find(x=>x.date==="2026-07-30"&&x.isLatest); const old=d.briefArchive.find(x=>x.date==="2026-07-30"&&x.versionLabel==="v01"); if(!latest||latest.versionLabel!=="v02"||!old||!latest.blocks.length) process.exit(1)'
```

Expected: exit 0；v02 是 7/30 最新版、v01 仍可追溯、全文 blocks 非空。

- [ ] **Step 5: 執行完整驗證**

在工作樹根目錄：

```bash
NODE_BIN=/Users/jjlin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node sh scripts/validation/validate-workspace.sh
```

在 `dashboard-site`：

```bash
node --import tsx --test lib/brief-content.test.ts app/authorization.test.ts app/dashboard-snapshot.test.ts app/dashboard-routes.test.tsx app/briefs/brief-components.test.tsx scripts/generate-dashboard-data.test.mts tests/release-contract.test.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js app lib scripts tests
WRANGLER_LOG_PATH=.wrangler/wrangler.log node node_modules/vinext/dist/cli.js build
node --test tests/rendered-html.test.mjs
```

Expected: 工作區顯示 `ALL CHECKS PASSED`；所有測試、型別、lint、建置與正式渲染均通過。

- [ ] **Step 6: 提交樣式與正式快照**

```bash
git add dashboard-site/app/globals.css dashboard-site/tests/release-contract.test.mjs dashboard-site/data/dashboard.json
git commit -m "feat: finish full brief reading experience"
```

- [ ] **Step 7: 依既有私人 Sites 流程部署**

使用 `sites-hosting` 技能：重新建置完全相同的已提交來源、推送到 `.openai/hosting.json` 既有專案、封裝 `dist/`、儲存新版本並呼叫私人部署。不得修改 site access 或環境變數。

- [ ] **Step 8: 驗證正式站並交付**

確認匿名請求對 `/`、`/briefs`、`/briefs/2026-07-30`、`/employees`、`/approvals` 均要求登入。請使用者登入後確認：首頁與待核准中心有「查看全文」、歷史列表每天一張最新版卡片、7/30 頁面可切換 v02／v01、全文表格可在手機水平捲動。

交付時提供私人 Dashboard 網址，並明確說明：「晨報全文與歷史閱讀已上線；每日 07:30 排程仍未啟用。」
