# Dashboard Market Risk History Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an accessible Dashboard chart that shows how the single 1–4 week market downside-risk score changed over the latest 28 days, with an all-history option, version-aware nodes, approval state, evidence details, and explicit data-quality failures.

**Architecture:** Extend the generated `DashboardSnapshot` with a normalized `marketRiskHistory` collection built from every versioned market-risk Markdown record. Keep parsing/version selection in the generator, approval projection in `approval-events`, pure chart geometry/filtering in a focused library, and interactive SVG rendering in a client component embedded in the existing market-risk card.

**Tech Stack:** TypeScript 5.9, React 19, Next.js 16/Vinext, native SVG and CSS, Node test runner, existing custom DOM test harness. Add no charting dependency.

## Global Constraints

- The chart title is `未來 1–4 週市場下行風險`; the subtitle states `0–100；不是市場漲跌預測`.
- The Y axis is fixed at 0–100. The default range is the 28 calendar days ending on the latest valid `asOf` date; the alternate range is all history.
- A date renders only the highest filename version. If that version is invalid, do not fall back to an older version; expose a blocker for that date.
- Do not invent nodes or interpolate values for weekends, holidays, or missing reports.
- `待核准` uses a hollow node and `已核准` uses a filled node. Other artifact states remain visibly distinct.
- Risk bands must match `docs/risk-score-methodology.md`, including neutral reserved bands at 21–24, 41–44, 61–64, and 81–84.
- A score below 0 or above 100, an invalid date, or a missing required history field is invalid data, not a value to repair.
- Completeness below 70 adds a visible warning without hiding the node.
- Do not create four forecast lines, numeric immediate/structural risk lines, smoothing, interpolation, backtesting, Beta links, portfolio actions, or personalized investment advice.
- Do not modify or deploy `jj-invest-public`. Dashboard deployment remains a separate user approval.

---

## File Map

- Modify `dashboard-site/lib/dashboard-types.ts`: define the serialized history node, same-day version summary, and history issue types.
- Modify `dashboard-site/scripts/generate-dashboard-data.mts`: parse all risk reports, select the highest version per date, and emit nodes/issues.
- Modify `dashboard-site/scripts/generate-dashboard-data.test.mts`: lock parsing, version, invalid-latest, and quality-warning behavior.
- Modify `dashboard-site/lib/approval-events.ts`: project persisted approval events onto historical nodes.
- Modify `dashboard-site/lib/approval-events.test.ts`: verify only the exact approved historical version becomes filled.
- Create `dashboard-site/lib/market-risk-history.ts`: pure date filtering, risk bands, SVG coordinates, and previous-change helpers.
- Create `dashboard-site/lib/market-risk-history.test.ts`: verify 28-day boundaries, all-history, bands, and geometry.
- Create `dashboard-site/app/market-risk-history-chart.tsx`: client-side range switch, SVG, focusable nodes, and selected-node detail panel.
- Create `dashboard-site/app/market-risk-history-chart.test.tsx`: verify initial markup and click/range interaction.
- Modify `dashboard-site/app/dashboard-components.tsx`: mount the chart inside the current market-risk card.
- Modify `dashboard-site/app/dashboard-routes.test.tsx`: verify page-level copy and safety boundaries.
- Modify `dashboard-site/app/globals.css`: chart, status shapes, reserved bands, warnings, responsive detail panel, and focus styles.
- Regenerate `dashboard-site/data/dashboard.json`: include production history nodes from existing records.

---

### Task 1: Define and Generate Version-Aware History Data

**Files:**
- Modify: `dashboard-site/lib/dashboard-types.ts`
- Modify: `dashboard-site/scripts/generate-dashboard-data.mts`
- Test: `dashboard-site/scripts/generate-dashboard-data.test.mts`

**Interfaces:**
- Produces: `MarketRiskHistoryNode`, `MarketRiskHistoryVersion`, `MarketRiskHistoryIssue`, and `DashboardSnapshot.marketRiskHistory`.
- `MarketRiskHistoryNode` fields: `id`, `date`, `version`, `versionLabel`, `artifactHash`, `artifactStatus`, `rawStatus`, `asOf`, `updatedAt`, `source`, `score`, `state`, `dailyChange`, `changeReasons`, `topRisks`, `supportingEvidence`, `counterEvidence`, `confidence`, `completeness`, `lowCompleteness`, `versions`.
- Consumers: Tasks 2–5.

- [ ] **Step 1: Add a failing fixture test for a complete history node**

Extend the `marketRisk()` fixture to accept date, version, status, score, completeness, confidence, state/trend, reasons, and evidence. Add this test:

```ts
test("市場風險歷史輸出可追查節點、證據與版本", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "dashboard-snapshot-"));
  try {
    await writeFixture(root, "records/market-risk/2026-07-30-v01.md", marketRisk({
      date: "2026-07-30", version: 1, score: 65, completeness: 82,
      stateTrend: "偏高；上升", changeReasons: "能源與長端利率同步上升",
      supportingEvidence: "油價上升", counterEvidence: "信用利差仍低",
    }));
    const snapshot = await generateDashboardSnapshot(root, new Date("2026-07-30T04:30:00.000Z"));
    assert.equal(snapshot.marketRiskHistory.nodes.length, 1);
    const node = snapshot.marketRiskHistory.nodes[0];
    assert.equal(node.date, "2026-07-30");
    assert.equal(node.version, 1);
    assert.equal(node.versionLabel, "v01");
    assert.equal(node.score, 65);
    assert.equal(node.state, "偏高");
    assert.equal(node.changeReasons, "能源與長端利率同步上升");
    assert.equal(node.supportingEvidence, "油價上升");
    assert.equal(node.counterEvidence, "信用利差仍低");
    assert.equal(node.lowCompleteness, false);
    assert.deepEqual(snapshot.marketRiskHistory.issues, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the targeted generator test and confirm failure**

Run: `cd dashboard-site && node --import tsx --test --test-name-pattern="市場風險歷史輸出" scripts/generate-dashboard-data.test.mts`

Expected: FAIL because `marketRiskHistory` does not exist.

- [ ] **Step 3: Add exact serialized types**

Add before `DashboardSnapshot`:

```ts
export type MarketRiskState = "低" | "偏低" | "中性" | "偏高" | "高" | "保留區間";

export interface MarketRiskHistoryVersion {
  id: string;
  version: number;
  versionLabel: string;
  source: string;
  readable: boolean;
}

export interface MarketRiskHistoryNode extends TraceableRecord {
  id: string;
  date: string;
  version: number;
  versionLabel: string;
  artifactHash: string;
  artifactStatus: ArtifactStatus;
  rawStatus: string;
  score: number;
  state: MarketRiskState;
  dailyChange: number | null;
  changeReasons: string;
  topRisks: string[];
  supportingEvidence: string;
  counterEvidence: string;
  confidence: number;
  completeness: number;
  lowCompleteness: boolean;
  versions: MarketRiskHistoryVersion[];
}

export interface MarketRiskHistoryIssue {
  date: string;
  source: string;
  version: number;
  reason: string;
}
```

Add to `DashboardSnapshot` immediately after `marketRisk`:

```ts
marketRiskHistory: {
  nodes: MarketRiskHistoryNode[];
  issues: MarketRiskHistoryIssue[];
};
```

- [ ] **Step 4: Implement strict history parsing and highest-version selection**

Import the three new types. Add these focused helpers beside `riskDetails()`:

```ts
function riskState(score: number, content: string): MarketRiskState | null;
function marketRiskHistoryNode(record: ValidRecord): Omit<MarketRiskHistoryNode, "versions"> | null;
function buildMarketRiskHistory(records: MarkdownRecord[]): DashboardSnapshot["marketRiskHistory"];
```

`riskState()` must derive the chart state from the score bands in `docs/risk-score-methodology.md`, including `保留區間` for 21–24/41–44/61–64/81–84. The report's prose status remains source context but cannot relabel the chart band. `marketRiskHistoryNode()` must require score, change reasons, exactly three top risks, supporting/counter evidence, confidence, completeness, valid `representativeDate`, and 0–100 numeric ranges. It must set `lowCompleteness: completeness < 70` and hash the exact content.

`buildMarketRiskHistory()` must:

1. keep only records whose definition id is `market-risk-report`;
2. group by filename date before discarding invalid records;
3. sort each group by numeric `version` descending;
4. validate and parse only the highest version for the plotted node;
5. return an issue instead of falling back when the highest version is invalid;
6. include every same-day version in `versions`, with `readable` based on validation/parsing;
7. sort nodes ascending by date and issues ascending by date.

Call it with the uncollapsed market-risk artifact set and add it to the returned snapshot:

```ts
const riskDefinitionIndex = definitions.findIndex((definition) => definition.id === "market-risk-report");
const marketRiskHistory = buildMarketRiskHistory(
  riskDefinitionIndex >= 0 ? artifactRecordSets[riskDefinitionIndex] : [],
);
// ... return object
marketRiskHistory,
```

- [ ] **Step 5: Add failing tests for version and quality rules**

Add named tests that assert:

```ts
assert.deepEqual(snapshot.marketRiskHistory.nodes.map((node) => [node.date, node.version]), [
  ["2026-07-30", 2], ["2026-07-31", 1],
]);
assert.deepEqual(snapshot.marketRiskHistory.nodes[0].versions.map((item) => [item.version, item.readable]), [
  [2, true], [1, true],
]);
assert.equal(snapshot.marketRiskHistory.nodes.find((node) => node.date === "2026-07-31")?.lowCompleteness, true);
```

For an invalid `2026-07-30-v02.md` above a valid `v01`, assert no 7/30 node exists, an issue points to `v02`, and `v01` is not used as fallback. Also assert out-of-range score and missing supporting or counter evidence each create an issue. Add a score of 61 and assert its chart state is `保留區間`, even if the prose status begins with `中性`.

- [ ] **Step 6: Run generator tests**

Run: `cd dashboard-site && node --import tsx --test scripts/generate-dashboard-data.test.mts`

Expected: PASS.

- [ ] **Step 7: Commit the data contract**

```bash
git add dashboard-site/lib/dashboard-types.ts dashboard-site/scripts/generate-dashboard-data.mts dashboard-site/scripts/generate-dashboard-data.test.mts
git commit -m "feat: generate market risk history data"
```

---

### Task 2: Project Persisted Approvals onto Historical Nodes

**Files:**
- Modify: `dashboard-site/lib/approval-events.ts`
- Test: `dashboard-site/lib/approval-events.test.ts`

**Interfaces:**
- Consumes: `DashboardSnapshot.marketRiskHistory.nodes` from Task 1 and existing `isApproved(artifactId, version, artifactHash)`.
- Produces: runtime snapshot nodes whose `artifactStatus` reflects the exact persisted approval event.

- [ ] **Step 1: Write the failing exact-version approval test**

Create a snapshot with two risk nodes and one approval event. Assert only the exact id/version/hash changes:

```ts
const applied = applyApprovalEvents(snapshot, [eventFor({
  artifactId: "records/market-risk/2026-07-30-v02.md",
  version: 2,
  artifactHash: "sha256:risk-v02",
})]);
assert.equal(applied.marketRiskHistory.nodes[0].artifactStatus, "已核准");
assert.equal(applied.marketRiskHistory.nodes[1].artifactStatus, "待核准");
```

- [ ] **Step 2: Run and confirm failure**

Run: `cd dashboard-site && node --import tsx --test --test-name-pattern="歷史風險節點" lib/approval-events.test.ts`

Expected: FAIL because historical nodes are unchanged.

- [ ] **Step 3: Map approval events onto the history collection**

Add this field to the returned object in `applyApprovalEvents()`:

```ts
marketRiskHistory: {
  ...snapshot.marketRiskHistory,
  nodes: snapshot.marketRiskHistory.nodes.map((node) =>
    isApproved(node.id, node.version, node.artifactHash)
      ? { ...node, artifactStatus: "已核准" as const }
      : node,
  ),
},
```

Do not mutate `rawStatus`; it remains the source-document status for traceability.

- [ ] **Step 4: Run approval and snapshot tests**

Run: `cd dashboard-site && node --import tsx --test lib/approval-events.test.ts app/dashboard-snapshot.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit approval projection**

```bash
git add dashboard-site/lib/approval-events.ts dashboard-site/lib/approval-events.test.ts
git commit -m "feat: apply approvals to risk history"
```

---

### Task 3: Add Pure Range, Band, and SVG Geometry Helpers

**Files:**
- Create: `dashboard-site/lib/market-risk-history.ts`
- Create: `dashboard-site/lib/market-risk-history.test.ts`
- Modify: `dashboard-site/package.json`

**Interfaces:**
- Consumes: `MarketRiskHistoryNode`.
- Produces: `RISK_BANDS`, `filterRiskHistory(nodes, range)`, `riskChartPoints(nodes, width, height)`, and `changeFromPrevious(allNodes, nodeId)`.

- [ ] **Step 1: Write failing pure-function tests**

Create tests covering the inclusive 28-day boundary, latest-node anchoring, all-history, no interpolation, fixed 0–100 coordinates, and previous value outside the visible range:

```ts
assert.deepEqual(filterRiskHistory(nodes, "4w").map((node) => node.date), [
  "2026-07-17", "2026-08-14",
]);
assert.deepEqual(filterRiskHistory(nodes, "all"), nodes);
assert.deepEqual(riskChartPoints(twoNodes, 100, 100), [
  { id: "old", x: 0, y: 100 },
  { id: "new", x: 100, y: 0 },
]);
assert.equal(changeFromPrevious(nodes, "new"), 5);
```

Also deep-equal `RISK_BANDS` to all nine exact ranges from the spec.

- [ ] **Step 2: Run and confirm failure**

Run: `cd dashboard-site && node --import tsx --test lib/market-risk-history.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement deterministic helpers**

Use these signatures:

```ts
export type MarketRiskRange = "4w" | "all";
export const RISK_BANDS: ReadonlyArray<{ min: number; max: number; label: MarketRiskState }>;
export function filterRiskHistory(nodes: MarketRiskHistoryNode[], range: MarketRiskRange): MarketRiskHistoryNode[];
export function riskChartPoints(nodes: MarketRiskHistoryNode[], width: number, height: number): Array<{ id: string; x: number; y: number }>;
export function changeFromPrevious(nodes: MarketRiskHistoryNode[], nodeId: string): number | null;
```

Parse dates by appending `T00:00:00Z`, anchor `4w` to the last valid node, subtract exactly 28 days, and include the boundary. Calculate X positions from actual elapsed dates; calculate `y = height - (score / 100) * height`. Return no line geometry for fewer than two nodes.

- [ ] **Step 4: Add the new test to the standard test script**

Insert `lib/market-risk-history.test.ts` beside other `lib` tests in `package.json`.

- [ ] **Step 5: Run pure tests and typecheck**

Run: `cd dashboard-site && node --import tsx --test lib/market-risk-history.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit chart logic**

```bash
git add dashboard-site/lib/market-risk-history.ts dashboard-site/lib/market-risk-history.test.ts dashboard-site/package.json
git commit -m "feat: add risk history chart helpers"
```

---

### Task 4: Render the Accessible Interactive Chart

**Files:**
- Create: `dashboard-site/app/market-risk-history-chart.tsx`
- Create: `dashboard-site/app/market-risk-history-chart.test.tsx`
- Modify: `dashboard-site/app/dashboard-components.tsx`
- Modify: `dashboard-site/app/globals.css`
- Modify: `dashboard-site/package.json`

**Interfaces:**
- Consumes: `{ history: DashboardSnapshot["marketRiskHistory"] }` and Task 3 helpers.
- Produces: `MarketRiskHistoryChart` client component.

- [ ] **Step 1: Write failing server-markup tests**

Render a three-node fixture and assert the chart contains:

```ts
assert.match(html, /未來 1–4 週市場下行風險/);
assert.match(html, /0–100；不是市場漲跌預測/);
assert.match(html, /最近 4 週/);
assert.match(html, /全部歷史/);
assert.match(html, /aria-label="2026-08-14，風險 60 分，中性，待核准"/);
assert.match(html, /data-approval-state="pending"/);
assert.match(html, /資料完整度低於 70%/);
```

Add separate fixtures for one node (`歷史資料不足`) and zero nodes (no `0 分`, explicit empty state).

- [ ] **Step 2: Run and confirm failure**

Run: `cd dashboard-site && node --import tsx --test app/market-risk-history-chart.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the client component with native SVG**

Start with:

```tsx
"use client";

export function MarketRiskHistoryChart({
  history,
}: {
  history: DashboardSnapshot["marketRiskHistory"];
}) {
  const [range, setRange] = useState<MarketRiskRange>("4w");
  const visible = filterRiskHistory(history.nodes, range);
  const [selectedId, setSelectedId] = useState<string | null>(visible.at(-1)?.id ?? null);
  // render labelled controls, SVG bands/axes/polyline/nodes, warnings, and detail panel
}
```

Implementation requirements:

- use two `<button>` controls with `aria-pressed` for `最近 4 週` and `全部歷史`;
- render band `<rect>` elements plus visible text labels; reserved bands use `data-risk-band="reserved"`;
- render a `<polyline>` only when there are at least two visible nodes;
- render each node as a focusable `<button>` over the SVG or an SVG element with `role="button"`, `tabIndex={0}`, Enter/Space handling, and the exact accessible label;
- use `data-approval-state="pending" | "approved" | "other"`, shape/fill differences, and adjacent legend text instead of color alone;
- add `⚠` plus screen-reader text when `lowCompleteness` is true;
- select a node on click/focus and render date, score/change, state, version/status, reasons, top risks, supporting/counter evidence, confidence, completeness, as-of/update time, source, and all version links in a detail `<section aria-live="polite">`;
- show `history.issues` above the chart as blockers;
- if no nodes exist, render an explicit no-data state; if one node exists, omit the polyline and show `歷史資料不足`;
- keep the latest selected node when switching range if still visible; otherwise select the latest visible node.

- [ ] **Step 4: Add click and range interaction tests**

Use `installTestDom()`, `createRoot()`, and `act()` following `threads-draft-disclosure.test.tsx`. Verify clicking the older point changes the detail panel, clicking `全部歷史` exposes a node older than 28 days, and Enter selects a focused node.

- [ ] **Step 5: Embed the chart and add responsive CSS**

Import and mount immediately after `.risk-score-panel`:

```tsx
<MarketRiskHistoryChart history={snapshot.marketRiskHistory} />
```

Add CSS for `.risk-history`, `.risk-history-controls`, `.risk-history-svg`, `.risk-history-node`, `.risk-history-legend`, `.risk-history-detail`, `.risk-history-warning`, `[data-risk-band="reserved"]`, `[data-approval-state="pending"]`, `[data-approval-state="approved"]`, and `:focus-visible`. At `max-width: 720px`, make the detail panel a full-width bottom sheet-style card in document flow; do not use hover-only content.

- [ ] **Step 6: Register the component test and refresh the generated fixture**

Add `app/market-risk-history-chart.test.tsx` to `package.json`.

Run: `cd dashboard-site && npm run data:generate`

Expected: `data/dashboard.json` now contains `marketRiskHistory`, allowing route tests that import the production fixture to render the component. Leave the generated file unstaged until Task 5.

- [ ] **Step 7: Run component/page tests**

Run: `cd dashboard-site && node --import tsx --test app/market-risk-history-chart.test.tsx app/dashboard-routes.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 8: Commit chart UI**

```bash
git add dashboard-site/app/market-risk-history-chart.tsx dashboard-site/app/market-risk-history-chart.test.tsx dashboard-site/app/dashboard-components.tsx dashboard-site/app/globals.css dashboard-site/package.json
git commit -m "feat: show market risk history chart"
```

---

### Task 5: Lock Page-Level Safety and Production Data

**Files:**
- Modify: `dashboard-site/app/dashboard-routes.test.tsx`
- Modify: `dashboard-site/tests/rendered-html.test.mjs`
- Regenerate: `dashboard-site/data/dashboard.json`

**Interfaces:**
- Consumes: completed generator, approval projection, and chart component.
- Produces: release-level evidence that real records render safely.

- [ ] **Step 1: Add route and rendered-output assertions**

Extend the market-risk route test:

```ts
assert.match(todayHtml, /未來 1–4 週市場下行風險/);
assert.match(todayHtml, /不是市場漲跌預測/);
assert.match(todayHtml, /待核准：空心點/);
assert.doesNotMatch(todayHtml, /買進|賣出|調整持股|再平衡建議/);
```

Extend `rendered-html.test.mjs` to assert the production build contains the chart title, both range labels, and no personalized-action copy.

- [ ] **Step 2: Run targeted route tests**

Run: `cd dashboard-site && node --import tsx --test app/dashboard-routes.test.tsx`

Expected: PASS because Task 4 already wires the chart and refreshes the generated fixture.

- [ ] **Step 3: Regenerate the snapshot from real versioned reports**

Run: `cd dashboard-site && npm run data:generate`

Inspect `data/dashboard.json` and confirm `marketRiskHistory.nodes` is chronological, same-day duplicates are collapsed to the highest version, and no unrelated record type appears.

- [ ] **Step 4: Run the full Dashboard verification suite**

Run: `cd dashboard-site && npm test`

Expected: generator, typecheck, unit/component/route/release tests, production build, and rendered HTML tests all PASS.

- [ ] **Step 5: Run lint, workspace validation, and diff checks**

Run:

```bash
cd dashboard-site && npm run lint
cd .. && sh scripts/validation/validate-workspace.sh
git diff --check
git status --short
```

Expected: lint and workspace validation PASS; diff check has no whitespace errors; status contains only intended implementation files plus pre-existing unrelated user changes.

- [ ] **Step 6: Commit production snapshot and release assertions**

```bash
git add dashboard-site/app/dashboard-routes.test.tsx dashboard-site/tests/rendered-html.test.mjs dashboard-site/data/dashboard.json
git commit -m "test: verify market risk history release"
```

---

### Task 6: Final Review and Deployment Gate

**Files:**
- Review only: all files listed in Tasks 1–5

**Interfaces:**
- Consumes: all implementation commits.
- Produces: a verified local feature ready for the user's separate deployment decision.

- [ ] **Step 1: Review the implementation against every global constraint**

Confirm the rendered chart uses one score line, correct bands, latest-version selection, hollow/filled approval status, 28-day anchoring, real gaps, data-quality warnings, evidence details, accessible controls, and no investment-action mapping.

- [ ] **Step 2: Inspect commit scope and final diff**

Run:

```bash
git log --oneline --decorate -6
git diff HEAD~5..HEAD --stat
git diff HEAD~5..HEAD --check
```

Expected: only Dashboard implementation, tests, generated snapshot, and plan-approved documentation are present. Do not stage or alter the pre-existing `AGENTS.md`, `.pnpm-store/`, or `skills/` changes.

- [ ] **Step 3: Run final verification once more from the repository root**

Run:

```bash
cd dashboard-site && npm test && npm run lint
cd .. && sh scripts/validation/validate-workspace.sh
```

Expected: ALL PASS with fresh output.

- [ ] **Step 4: Stop at the deployment approval gate**

Report the local implementation, test/build evidence, changed-file scope, and remaining user-owned workspace changes. Do not deploy the private Dashboard and do not modify `jj-invest-public` until the user explicitly approves that separate action.
