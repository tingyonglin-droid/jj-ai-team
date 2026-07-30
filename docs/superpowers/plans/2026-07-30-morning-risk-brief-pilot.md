# Morning Risk Brief Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a traceable `2026-07-30-v02` five-event downside-risk brief and first experimental market-risk snapshot, make the private Dashboard select those records, and stop for user approval before enabling any recurring schedule.

**Architecture:** Implement the pilot on the existing `dashboard` worktree so the source records, snapshot generator, UI, tests, and deployable site stay on one branch. Markdown remains the authoritative human-readable record; a deterministic Node.js validator checks the five-event contract and risk arithmetic; the Dashboard generator parses the newest valid `vNN` records into typed display fields. Real 2026-07-30 research is performed from public traceable sources and stored as append-only v02/v01 records.

**Tech Stack:** Markdown records, Node.js `>=22.13.0`, TypeScript 5.9, built-in `node:test`, React 19, Next.js 16/Vinext, existing private Dashboard deployment.

## Global Constraints

- Execute implementation in `/Users/jjlin/Library/CloudStorage/SynologyDrive-1/Codex/jj-ai-team/.worktrees/dashboard`.
- Preserve `records/daily-briefs/2026-07-30-v01.md`; create `2026-07-30-v02.md` and let version selection replace only the Dashboard's current view.
- Do not overwrite historical risk records; create `records/market-risk/2026-07-30-v01.md`.
- First version has exactly five events, no images, and uses only legal, traceable public sources.
- Main risk score represents 1–4 weeks; separately label 1–3 trading-day immediate risk and 1–2 quarter structural risk.
- Risk score equals the equal-weight five-pillar baseline plus an event adjustment from `-10` through `+15`, clamped to 0–100.
- Every event includes a downside transmission chain, confirming signal, counterevidence, and invalidation condition.
- Status remains `待核准`; do not publish externally, recommend trades, alter Beta, or enable recurring automation.
- Do not stage the pre-existing `dashboard-site/data/dashboard.json` mode-only change. The build may regenerate its content for deployment, but this pilot's commits exclude that file.
- Use primary sources first; secondary media may only provide context or cross-checking.
- Complete `sh scripts/validation/validate-workspace.sh` and Dashboard tests before deployment. If workspace validation still scans dependency/cache files, fix the validator's scope rather than deleting unrelated user or dependency files.

---

### Task 1: Align the operating documents and templates with the approved pilot

**Files:**
- Modify: `docs/risk-score-methodology.md`
- Modify: `workflows/daily-brief.md`
- Modify: `workflows/market-risk.md`
- Modify: `templates/daily-brief.md`
- Modify: `templates/market-risk-report.md`
- Test: `scripts/validation/validate-workspace.sh`

**Interfaces:**
- Consumes: approved design in `docs/superpowers/specs/2026-07-30-morning-investment-risk-brief-design.md`.
- Produces: authoritative headings and fields consumed by Tasks 2–5.

- [ ] **Step 1: Add failing workspace contract checks**

Add checks that require the daily brief template to contain `今日風險儀表`, `五則重要事件`, `今日市場一句話`, and `反方證據與尚未確認資料`; require the risk template to contain `事件調整`, `即時風險`, `結構性風險`, and `影子運行`.

```sh
for heading in 今日風險儀表 五則重要事件 今日市場一句話 反方證據與尚未確認資料; do
  grep -q "^## $heading" templates/daily-brief.md || exit 1
done
for phrase in 事件調整 即時風險 結構性風險 影子運行; do
  grep -q "$phrase" templates/market-risk-report.md || exit 1
done
```

- [ ] **Step 2: Run validation and verify the new checks fail**

Run: `sh scripts/validation/validate-workspace.sh`

Expected: FAIL because the existing templates do not contain the approved pilot headings and fields.

- [ ] **Step 3: Update methodology, workflows, and templates**

Document the 06:30 collection, 07:10 cutoff, 07:30 delivery, public-source rule, fixed five-event selection, causal deduplication, five-minute output, five equal-weight pillars, `-10..+15` event adjustment, three horizons, data completeness, AI confidence, and 30-trading-day shadow label. Preserve the existing fact/inference/external-view/counterevidence sections required by the Dashboard source manifest.

The brief template must include this event skeleton exactly five times with numbers 1–5:

```markdown
### 1｜[請填寫：事件名稱]

#### 發生什麼事

#### 關鍵數據

#### 市場意義

#### 下行風險判斷

- 主要／次要性質：
- 風險階段：
- 影響期限：
- 傳導鏈：

#### 接下來要看什麼

- 確認訊號：
- 反方證據：
- 失效條件：
```

- [ ] **Step 4: Restrict zero-byte validation to authoritative workspace files**

If the current validator still fails on `.pnpm-store/`, `.worktrees/`, or `node_modules/`, change its `find` expression to prune those generated directories while continuing to scan project-owned documents and scripts. Do not delete the directories or their files.

- [ ] **Step 5: Run workspace validation**

Run: `sh scripts/validation/validate-workspace.sh`

Expected: PASS.

- [ ] **Step 6: Commit the operating-contract update**

```bash
git add docs/risk-score-methodology.md workflows/daily-brief.md workflows/market-risk.md templates/daily-brief.md templates/market-risk-report.md scripts/validation/validate-workspace.sh
git commit -m "docs: align morning brief risk workflow"
```

### Task 2: Add a deterministic morning-brief and risk-record validator

**Files:**
- Create: `scripts/validation/validate-morning-risk-records.mjs`
- Create: `scripts/validation/validate-morning-risk-records.test.mjs`
- Modify: `scripts/validation/validate-workspace.sh`

**Interfaces:**
- Consumes: a brief Markdown path and a market-risk Markdown path.
- Produces: `validateBrief(text)` and `validateRiskRecord(text)` returning arrays of human-readable errors; CLI exits non-zero when either record is invalid.

- [ ] **Step 1: Write failing tests for the brief contract**

Cover exactly five numbered `### N｜` events, unique event names, all required `####` subsections, a non-empty source section, a core-contradiction title, and the final `今天市場真正交易的不是...而是...` sentence.

```js
test("brief requires exactly five complete and unique events", () => {
  const errors = validateBrief(validBrief.replace("### 5｜事件五", "### 4｜事件四"));
  assert.ok(errors.some((error) => error.includes("恰好五則")));
  assert.ok(errors.some((error) => error.includes("事件名稱不可重複")));
});
```

- [ ] **Step 2: Write failing tests for risk arithmetic and bounds**

Cover five 0–100 pillar scores in 5-point increments, equal-weight baseline, event adjustment bounds, clamped final score, completeness, confidence, horizons, and shadow status.

```js
test("risk total must reproduce from pillars and event adjustment", () => {
  const errors = validateRiskRecord(validRisk.replace("- 市場風險分數：60", "- 市場風險分數：61"));
  assert.ok(errors.some((error) => error.includes("無法重算")));
});
```

- [ ] **Step 3: Run the validator tests and verify they fail**

Run: `node --test scripts/validation/validate-morning-risk-records.test.mjs`

Expected: FAIL because the validator module does not exist.

- [ ] **Step 4: Implement the minimal parser and CLI**

Use only Node.js standard-library modules. Parse labeled list fields and Markdown headings; do not infer missing values. Export both validator functions and accept:

```text
node scripts/validation/validate-morning-risk-records.mjs <brief-path> <risk-path>
```

Print each error with its file label and exit `1`; print `PASS: 晨報與風險紀錄契約有效` and exit `0` when valid.

- [ ] **Step 5: Run focused tests**

Run: `node --test scripts/validation/validate-morning-risk-records.test.mjs`

Expected: PASS.

- [ ] **Step 6: Add the validator test to workspace validation and run both**

Run: `node --test scripts/validation/validate-morning-risk-records.test.mjs && sh scripts/validation/validate-workspace.sh`

Expected: PASS.

- [ ] **Step 7: Commit the deterministic validator**

```bash
git add scripts/validation/validate-morning-risk-records.mjs scripts/validation/validate-morning-risk-records.test.mjs scripts/validation/validate-workspace.sh
git commit -m "test: validate morning risk records"
```

### Task 3: Extend the Dashboard snapshot contract for risk-first fields

**Files:**
- Modify: `dashboard-site/lib/dashboard-types.ts`
- Modify: `dashboard-site/scripts/generate-dashboard-data.mts`
- Modify: `dashboard-site/scripts/generate-dashboard-data.test.mts`

**Interfaces:**
- Consumes: newest valid `records/daily-briefs/*-vNN.md` and `records/market-risk/*-vNN.md`.
- Produces: `DashboardSnapshot.brief.headline`, `DashboardSnapshot.marketRisk.score`, `baseline`, `eventAdjustment`, `dailyChange`, `label`, `immediateRisk`, `structuralRisk`, `topRisks`, `confidence`, `completeness`, `experimental`.

- [ ] **Step 1: Add a failing latest-version test**

Create v01 and v02 fixtures for the same 2026-07-30 brief. Assert that only v02 appears in `brief`, `tasks`, and `approvals`, while the source is `records/daily-briefs/2026-07-30-v02.md`.

```ts
assert.equal(snapshot.brief?.source, "records/daily-briefs/2026-07-30-v02.md");
assert.equal(snapshot.approvals.filter((item) => item.type === "晨報").length, 1);
assert.equal(snapshot.approvals[0]?.source, "records/daily-briefs/2026-07-30-v02.md");
```

- [ ] **Step 2: Add a failing risk-field parsing test**

Create a complete risk fixture and assert exact numeric and text fields:

```ts
assert.equal(snapshot.marketRisk?.score, 65);
assert.equal(snapshot.marketRisk?.baseline, 55);
assert.equal(snapshot.marketRisk?.eventAdjustment, 10);
assert.equal(snapshot.marketRisk?.experimental, true);
assert.deepEqual(snapshot.marketRisk?.topRisks, ["能源衝擊", "長端利率", "市場廣度"]);
```

- [ ] **Step 3: Run the focused generator tests and verify failure**

Run from `dashboard-site`: `node --import tsx --test scripts/generate-dashboard-data.test.mts`

Expected: FAIL because the risk-first fields are not present in the type or parser.

- [ ] **Step 4: Extend types and parse explicit labeled fields**

Add the risk fields to `DashboardSnapshot`. Parse only exact Markdown labels; return a blocker for missing, malformed, out-of-range, or irreproducible arithmetic. Do not derive a score from prose.

- [ ] **Step 5: Run generator tests and typecheck**

Run from `dashboard-site`: `node --import tsx --test scripts/generate-dashboard-data.test.mts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the snapshot contract**

```bash
git add dashboard-site/lib/dashboard-types.ts dashboard-site/scripts/generate-dashboard-data.mts dashboard-site/scripts/generate-dashboard-data.test.mts
git commit -m "feat: parse daily market risk snapshot"
```

### Task 4: Present the risk-first pilot in the private Dashboard

**Files:**
- Modify: `dashboard-site/app/dashboard-components.tsx`
- Modify: `dashboard-site/app/dashboard-routes.test.tsx`
- Modify: `dashboard-site/app/globals.css`

**Interfaces:**
- Consumes: risk-first fields from Task 3.
- Produces: accessible Dashboard cards showing experimental status, score, change, three horizons, top risks, completeness, confidence, and source.

- [ ] **Step 1: Add failing route-render tests**

Assert the rendered homepage contains `實驗性指標`, `1–4 週風險`, `即時風險`, `結構性風險`, `事件調整`, `資料完整度`, and a traceable source path. Assert the approval center displays only v02 for the 7/30 brief.

- [ ] **Step 2: Run the route tests and verify failure**

Run from `dashboard-site`: `node --import tsx --test app/dashboard-routes.test.tsx`

Expected: FAIL because the current card only shows a risk label and completeness.

- [ ] **Step 3: Implement the risk-first card**

Keep status in text, not color alone. Show the main score and day change prominently; show the immediate and structural horizons as text; show the baseline and event adjustment so the total remains explainable. Preserve explicit empty, stale, and blocked states.

- [ ] **Step 4: Add responsive styles without changing the established design system**

Use the current card, badge, grid, spacing, and focus patterns. At narrow widths, stack score details in one column; do not create a new visual language.

- [ ] **Step 5: Run route tests, typecheck, and lint**

Run from `dashboard-site`: `node --import tsx --test app/dashboard-routes.test.tsx && npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 6: Commit the Dashboard presentation**

```bash
git add dashboard-site/app/dashboard-components.tsx dashboard-site/app/dashboard-routes.test.tsx dashboard-site/app/globals.css
git commit -m "feat: show experimental risk brief dashboard"
```

### Task 5: Research and write the 2026-07-30 pilot records

**Files:**
- Create: `records/daily-briefs/2026-07-30-v02.md`
- Create: `records/market-risk/2026-07-30-v01.md`
- Preserve: `records/daily-briefs/2026-07-30-v01.md`

**Interfaces:**
- Consumes: public primary sources available for the 2026-07-29 U.S. session and information available by the chosen 2026-07-30 cutoff; Task 1 templates.
- Produces: one pending-approval brief and one pending-approval experimental risk record accepted by Task 2 and Task 3.

- [ ] **Step 1: Establish the pilot cutoff and candidate pool**

Record a cutoff no later than the actual research time and never claim 07:10 if the pilot is produced later. Search official Fed, Treasury, BEA/BLS, company investor-relations/SEC, exchange, and other relevant primary sources first. Build at least eight candidate events with source, date, surprise, affected assets, downside chain, imminence, and counterevidence.

- [ ] **Step 2: Select five causally distinct events**

Rank by probability, downside magnitude, breadth, persistence, and imminence. Retain the discarded candidates and reasons in research notes inside the brief's `尚未確認與待觀察` section or a source appendix; do not fabricate a fifth event.

- [ ] **Step 3: Write `2026-07-30-v02.md`**

Use the approved headline, risk instrument, five-event, counterevidence, one-line market statement, and source format. Preserve the source-policy sections required by the Dashboard manifest: `一分鐘摘要`, `已確認事實`, `AI 推論與初步判斷`, `外部觀點比較`, `最終判斷與反方證據`, `尚未確認與待觀察`, and `人工核准`.

Set:

```markdown
- 狀態：待核准
- 版本：v02（下行風險優先試跑版）
```

The approval question must ask whether the five-event selection, downside-risk framing, headline, and reading length are suitable for the 30-day shadow run. State that approval does not authorize public distribution or recurring scheduling.

- [ ] **Step 4: Compute and write the first market-risk record**

Score each pillar in 5-point increments using cited evidence; compute the equal-weight baseline; apply an event adjustment only if the documented tests are satisfied; clamp the final score. Mark it `實驗性指標／影子運行第 1 日`, record all three horizons, completeness, confidence, top three risks, confirming signals, counterevidence, and invalidation conditions.

- [ ] **Step 5: Validate both records**

Run:

```bash
node scripts/validation/validate-morning-risk-records.mjs records/daily-briefs/2026-07-30-v02.md records/market-risk/2026-07-30-v01.md
sh scripts/validation/validate-workspace.sh
```

Expected: both commands PASS.

- [ ] **Step 6: Perform the research-policy review**

Confirm every verifiable fact has source name, publication date, represented period, and link or location; confirm facts, AI inference, external views, final judgment, counterevidence, and unknowns remain separate; confirm no advice or unsupported certainty appears.

- [ ] **Step 7: Commit the pilot records**

```bash
git add records/daily-briefs/2026-07-30-v02.md records/market-risk/2026-07-30-v01.md
git commit -m "feat: add July 30 downside risk brief pilot"
```

### Task 6: Verify latest-version selection and generate the deployment snapshot

**Files:**
- Verify only: `dashboard-site/data/dashboard.json`
- Modify if test coverage requires: `dashboard-site/tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: Tasks 3–5.
- Produces: generated snapshot selecting brief v02 and market-risk v01, with v01 retained only as history.

- [ ] **Step 1: Generate Dashboard data**

Run from `dashboard-site`: `npm run data:generate`

Expected: generated snapshot references `records/daily-briefs/2026-07-30-v02.md` and `records/market-risk/2026-07-30-v01.md`.

- [ ] **Step 2: Assert snapshot selection and approval state**

Run:

```bash
node -e 'const d=require("./data/dashboard.json"); if(d.brief.source!=="records/daily-briefs/2026-07-30-v02.md"||d.marketRisk.source!=="records/market-risk/2026-07-30-v01.md"||!d.approvals.some(x=>x.source==="records/daily-briefs/2026-07-30-v02.md")||d.approvals.some(x=>x.source==="records/daily-briefs/2026-07-30-v01.md")) process.exit(1)'
```

Expected: exit `0`.

- [ ] **Step 3: Run the full Dashboard test suite**

Run from `dashboard-site`: `npm test`

Expected: PASS, including data generation, typecheck, unit tests, build, and rendered HTML tests.

- [ ] **Step 4: Inspect generated changes without staging the pre-existing mode drift**

Run: `git diff --summary -- dashboard-site/data/dashboard.json` and `git diff -- dashboard-site/data/dashboard.json`.

Expected: content shows v02/risk v01; any prior `100644 -> 100755` mode-only drift remains unstaged. Do not include `dashboard.json` in a commit unless the user separately confirms normalizing that pre-existing mode change.

- [ ] **Step 5: Commit only additional test changes, if any**

```bash
git add dashboard-site/tests/rendered-html.test.mjs
git commit -m "test: verify latest risk brief rendering"
```

Skip this commit when no test file changed.

### Task 7: Deploy the private pilot and stop for approval

**Files:**
- Verify: `dashboard-site/README.md`
- Do not modify: deployment allow-list secrets or authentication policy.

**Interfaces:**
- Consumes: verified worktree and generated snapshot from Task 6.
- Produces: protected Dashboard showing v02 and the experimental risk snapshot; a user approval request; no recurring automation.

- [ ] **Step 1: Confirm commit and working-tree scope**

Run: `git status --short` and `git log --oneline -8`.

Expected: implementation commits are present; unrelated `.pnpm-store` and the pre-existing `dashboard.json` mode change are not staged.

- [ ] **Step 2: Deploy through the existing protected Dashboard workflow**

Use the already linked private Dashboard project and existing allow-list environment configuration. Do not print or modify the permitted Email value. Deployment must rebuild the data snapshot from the worktree records.

- [ ] **Step 3: Verify the protected production pages**

Verify `/`, `/employees`, and `/approvals` require the existing ChatGPT identity; verify the authorized view shows the v02 source path, risk v01 source path, `待核准`, `實驗性指標`, score arithmetic, completeness, confidence, and update time. Verify v01 is not the current approval item.

- [ ] **Step 4: Run final local validation**

Run from the worktree root: `sh scripts/validation/validate-workspace.sh`

Run from `dashboard-site`: `npm test`

Expected: PASS for both.

- [ ] **Step 5: Hand the pilot to the user**

Provide the protected Dashboard link, direct links to both Markdown records, the score and its arithmetic, source cutoff, known limitations, and the exact decision requested. State explicitly:

```text
目前只完成 7/30 試跑與 Dashboard 更新；每日 07:30 排程尚未啟用。
```

Stop and wait for one of: `核准進入 30 日影子運行`, `退回修訂`, or specific change requests. Do not create the recurring automation in this plan.
