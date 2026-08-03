# Daily Threads Conditional Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing 06:30 Asia/Taipei morning automation so a newly validated morning brief immediately produces one traceable Threads draft, delivers it to the private Dashboard for approval, and never publishes it.

**Architecture:** Add a deterministic preflight that derives a trigger identity from the validated brief path, version, and SHA-256, then checks saved Threads metadata before an agent performs creative drafting. The existing morning automation calls this preflight only after brief/risk validation; `execute` enters the current daily Threads workflow, while `skipped` and `blocked` stop safely. Dashboard generation, testing, private Sites deployment, and user notification remain the delivery tail.

**Tech Stack:** Node.js ESM, built-in `node:test`, Markdown records and templates, existing Dashboard TypeScript/vinext build, existing Codex project automation, OpenAI Sites.

## Global Constraints

- Trigger from the successful morning workflow; do not create a competing fixed 08:00 or 12:00 schedule.
- Apply only when the trading-calendar expectation requires a new brief covering a newly completed U.S. market session.
- Every generated Threads artifact starts as `待核准`; approval does not publish it.
- The trigger identity is exactly the brief source path, brief version, and normalized-content SHA-256.
- Re-running the same trigger identity returns `skipped` and creates no draft, deployment, or duplicate notification.
- A changed brief version or content hash may create a new append-only Threads version; never overwrite an earlier artifact.
- Missing/invalid brief or risk input, source conflict, validation failure, or delivery failure is explicit `blocked`, never a stale “today” draft.
- Preserve the existing owner-only Sites project and access policy; do not create a second Site.
- Do not publish, reply, interact, provide individualized investment actions, or modify/deploy `jj-invest-public`.
- Do not enable approval-outbox Git synchronization credentials; that remains separately unauthorized.

---

## File Structure

- Create `scripts/threads/daily-trigger.mjs`: pure trigger identity, saved-artifact lookup, and CLI preflight.
- Create `scripts/threads/daily-trigger.test.mjs`: execute/skipped/blocked/version-change/trading-day tests using temporary fixtures.
- Modify `templates/threads-draft.md`: require traceable trigger metadata.
- Modify `workflows/daily-threads.md`: define the preflight, status outcomes, immediate post-brief entry, and retry boundary.
- Modify `workflows/daily-brief.md`: add the successful-delivery handoff to the Threads preflight.
- Modify `scripts/README.md`: document the preflight command and automation-only boundary.
- Modify `scripts/validation/validate-workspace.sh`: include trigger-preflight tests and check the template/workflow contract.
- Create `records/decisions/2026-08-03-enable-daily-threads-schedule.md`: record the user's exact authorization and permanent exclusions.
- External state: update the existing `jj-ai-team` 06:30 Asia/Taipei morning automation prompt; do not create a second schedule unless the platform proves in-task conditional continuation unavailable.

### Task 1: Build a deterministic Threads trigger preflight

**Files:**
- Create: `scripts/threads/daily-trigger.mjs`
- Create: `scripts/threads/daily-trigger.test.mjs`

**Interfaces:**
- Produces: `normalizedContentHash(content: string): string` returning `sha256:<hex>` after CRLF normalization.
- Produces: `briefTriggerIdentity({ source, version, content }): { briefSource: string; briefVersion: number; briefHash: string; key: string }`.
- Produces: `evaluateDailyThreadsTrigger({ root, briefSource, expectedReportDate, phase }): Promise<{ status: "execute" | "skipped" | "blocked"; trigger: TriggerIdentity | null; existingArtifact: string | null; reason: string }>`.
- CLI: `node scripts/threads/daily-trigger.mjs --root <repo> --brief <relative-path> --expected-report-date YYYY-MM-DD --phase <phase>`; print one JSON object and exit 0 for `execute`/`skipped`, exit 2 for `blocked`.

- [ ] **Step 1: Write failing identity and decision tests**

Create temporary repositories with a minimal valid brief and Threads directory. Cover:

```js
test("new validated brief executes once and the same trigger skips", async () => {
  const first = await evaluateDailyThreadsTrigger({
    root,
    briefSource: "records/daily-briefs/2026-08-04-v01.md",
    expectedReportDate: "2026-08-04",
    phase: "due",
  });
  assert.equal(first.status, "execute");

  await writeFile(join(root, "records/content/threads/2026-08-04-example-v01.md"), `
- 觸發晨報：records/daily-briefs/2026-08-04-v01.md
- 觸發晨報版本：1
- 觸發晨報雜湊：${first.trigger.briefHash}
`);
  const second = await evaluateDailyThreadsTrigger({ ...sameInput });
  assert.equal(second.status, "skipped");
  assert.equal(second.existingArtifact, "records/content/threads/2026-08-04-example-v01.md");
});
```

Also assert: CRLF/LF hashes match; missing brief is blocked; filename/report-date mismatch is blocked; `carry_forward` and `blocked` phases do not execute; changed v02 or changed content hash returns execute; malformed duplicate metadata is blocked rather than ignored.

- [ ] **Step 2: Run the new tests and confirm RED**

Run:

```bash
node --test scripts/threads/daily-trigger.test.mjs
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement strict parsing and trigger evaluation**

Use only Node built-ins. Parse the brief version from `-vNN.md`, require the filename date to equal `expectedReportDate`, require `phase === "due"`, read all `records/content/threads/*.md`, and match all three exact metadata fields. Treat `before_cutoff`, `carry_forward`, and `blocked` as non-executing states. Normalize paths to `/`; do not accept absolute or `..` brief paths.

The key format is:

```js
`${briefSource}|v${String(version).padStart(2, "0")}|${briefHash}`
```

If any Threads file has only a subset of the three trigger fields, return `blocked` naming that file so corrupt traceability cannot silently permit a duplicate.

- [ ] **Step 4: Implement the CLI without side effects**

The CLI only reads and decides. It must not create draft files, edit records, deploy, or notify. Serialize the result with `JSON.stringify(result)`; send usage/parse errors to stderr with exit 2.

- [ ] **Step 5: Run focused tests and confirm GREEN**

```bash
node --test scripts/threads/daily-trigger.test.mjs
```

Expected: all cases pass.

- [ ] **Step 6: Commit the preflight**

```bash
git add scripts/threads/daily-trigger.mjs scripts/threads/daily-trigger.test.mjs
git commit -m "feat: add daily Threads trigger preflight"
```

### Task 2: Bind the trigger contract to templates, workflows, and validation

**Files:**
- Modify: `templates/threads-draft.md`
- Modify: `workflows/daily-threads.md`
- Modify: `workflows/daily-brief.md`
- Modify: `scripts/README.md`
- Modify: `scripts/validation/validate-workspace.sh`
- Test: `scripts/validation/validate-workspace.test.sh`

**Interfaces:**
- Consumes: Task 1 CLI JSON and its `execute | skipped | blocked` statuses.
- Produces: every scheduled Threads artifact includes `觸發晨報`, `觸發晨報版本`, and `觸發晨報雜湊`.

- [ ] **Step 1: Add failing validation tests**

Extend `validate-workspace.test.sh` with fixtures that remove each trigger field from `templates/threads-draft.md` and remove the preflight command from `workflows/daily-threads.md`. Each mutation must make validation fail with the missing contract named in stderr.

- [ ] **Step 2: Run the validation tests and confirm RED**

```bash
sh scripts/validation/validate-workspace.test.sh
```

Expected: new assertions fail because validation does not guard the schedule contract.

- [ ] **Step 3: Add exact metadata fields to the template**

Add these required lines near source metadata:

```markdown
- 觸發晨報：`records/daily-briefs/YYYY-MM-DD-vNN.md`
- 觸發晨報版本：NN
- 觸發晨報雜湊：sha256:<64 lowercase hex characters>
```

Keep `狀態：待核准` and the existing human-approval language unchanged.

- [ ] **Step 4: Update both workflow handoff boundaries**

In `daily-brief.md`, after brief/risk and workspace validation succeed, call the Threads preflight with the calendar module's `expectedReportDate` and `phase`. In `daily-threads.md`, state:

- `execute`: perform the existing drafting steps and copy all trigger fields verbatim.
- `skipped`: report the existing artifact and stop before drafting/deploying/notifying.
- `blocked`: record the reason and stop without creating a draft.
- After a saved draft, regenerate/validate/deploy the Dashboard and notify; retry only incomplete delivery work for the same saved artifact.

- [ ] **Step 5: Add the preflight to workspace validation and documentation**

Run `node --test scripts/threads/daily-trigger.test.mjs` from `validate-workspace.sh`, assert the three template labels, the `待核准` status, and the workflow command. Document a sample read-only CLI invocation in `scripts/README.md` and state it never publishes or creates files.

- [ ] **Step 6: Run validation and focused tests**

```bash
sh scripts/validation/validate-workspace.test.sh
sh scripts/validation/validate-workspace.sh
```

Expected: mutation tests pass and final output is `ALL CHECKS PASSED`.

- [ ] **Step 7: Commit the workflow contract**

```bash
git add templates/threads-draft.md workflows/daily-threads.md workflows/daily-brief.md scripts/README.md scripts/validation/validate-workspace.sh scripts/validation/validate-workspace.test.sh
git commit -m "feat: connect morning briefs to daily Threads workflow"
```

### Task 3: Prove idempotency and real-data readiness without publishing

**Files:**
- Test: `scripts/threads/daily-trigger.test.mjs`
- Verify: `records/daily-briefs/2026-08-03-v01.md`
- Verify: `records/market-risk/2026-08-03-v01.md`
- Verify: `records/content/threads/2026-08-03-index-up-risk-not-down-v01.md`

**Interfaces:**
- Consumes: preflight and metadata contract.
- Produces: saved dry-run evidence in the implementation report; no new public or approved artifact.

- [ ] **Step 1: Run a complete fixture execution and duplicate check**

Use a temporary directory—not `records/`—to copy the valid 2026-08-03 brief/risk/draft. Add the trigger metadata to the temporary draft, run the preflight once before the temp draft exists (`execute`) and once after (`skipped`). Verify the second result names the exact temp artifact.

- [ ] **Step 2: Run skip/block calendar scenarios**

Against temporary copies, verify `carry_forward`, complete-closure/no-new-session, missing risk handoff at the workflow layer, and invalid brief source all stop without creating any file.

- [ ] **Step 3: Verify a changed brief identity permits an append-only version**

Create temporary v02 content and confirm `execute`; verify the proposed automation instructions require a new Threads `v02` path and forbid overwriting v01.

- [ ] **Step 4: Run all repository validation**

```bash
sh scripts/validation/validate-workspace.sh
```

Expected: `ALL CHECKS PASSED`; `git status --short` contains no dry-run records.

- [ ] **Step 5: Record test evidence without changing production records**

Append commands, statuses, temporary paths, and results to the SDD task report. Do not claim the schedule is enabled and do not alter the already approved 2026-08-03 Threads artifact merely to retrofit schedule metadata.

### Task 4: Record authorization and update the existing morning automation

**Files:**
- Create: `records/decisions/2026-08-03-enable-daily-threads-schedule.md`
- Modify: `workflows/README.md` only if the external automation name or cadence needs a discoverable reference.
- External state: existing Codex `jj-ai-team` weekday 06:30 Asia/Taipei morning automation.

**Interfaces:**
- Consumes: green Tasks 1–3 and the approved design at `docs/superpowers/specs/2026-08-03-daily-threads-schedule-design.md`.
- Produces: one enabled automation whose successful morning path immediately enters daily Threads; a verifiable next run; no publishing authority.

- [ ] **Step 1: Write the decision record**

Record decision date `2026-08-03`, decision maker `使用者`, selected option `晨報完成後立即產出`, trigger identity, duplicate behavior, owner-only Dashboard delivery, effective date, review date after ten eligible runs, and explicit exclusions: auto-approval, publishing, replies, investment actions, `jj-invest-public`, access-policy changes, and approval-sync credentials.

- [ ] **Step 2: Discover and read the existing automation before mutation**

Use the available Codex automation manager to identify the existing `jj-ai-team` automation with schedule `30 6 * * 1-5`, timezone `Asia/Taipei`. Read its current prompt and enabled state. If it cannot be uniquely identified, or no callable automation manager exists, stop as `blocked`; do not create a guessed duplicate or claim activation.

- [ ] **Step 3: Update the existing prompt, preserving its schedule**

Append a conditional continuation that requires:

1. Read `AGENTS.md`, `workflows/daily-brief.md`, `workflows/market-risk.md`, and `workflows/daily-threads.md`.
2. Complete and validate the brief/risk path first.
3. Run `daily-trigger.mjs` with the actual expected report date and phase.
4. On `execute`, create one traceable `待核准` Threads draft, verify facts, update/test/build/deploy the existing private Dashboard, and report its approval location.
5. On `skipped` or `blocked`, stop according to the returned reason.
6. Never approve, publish, interact, modify `jj-invest-public`, or create/obtain unauthorized synchronization credentials.

Keep the existing `30 6 * * 1-5` schedule and `Asia/Taipei` timezone. Do not create a second automation unless the manager explicitly proves the existing task cannot perform a conditional continuation; if that limitation occurs, stop and request a separate design amendment before creating anything.

- [ ] **Step 4: Verify external state**

Re-read the automation and confirm: enabled; schedule/timezone unchanged; prompt contains the exact preflight command and all prohibited actions; next run is available; no `jj-invest-public` automation was changed.

- [ ] **Step 5: Commit the decision record**

```bash
git add records/decisions/2026-08-03-enable-daily-threads-schedule.md workflows/README.md
git commit -m "docs: enable conditional daily Threads schedule"
```

Only include `workflows/README.md` if it actually changed.

### Task 5: Final verification and handoff

**Files:**
- Verify: all Task 1–4 files and external automation state.

**Interfaces:**
- Consumes: implementation commits and external automation result.
- Produces: evidence-backed status, next run, and safe rollback instructions.

- [ ] **Step 1: Run all trigger and workspace tests**

```bash
node --test scripts/threads/daily-trigger.test.mjs
sh scripts/validation/validate-workspace.test.sh
sh scripts/validation/validate-workspace.sh
```

Expected: all pass and final output is `ALL CHECKS PASSED`.

- [ ] **Step 2: Run Dashboard regression verification**

From `dashboard-site`, run the canonical package test sequence. Expected: typecheck, complete Node suite, production build, and rendered HTML tests pass; no real approval action is clicked.

- [ ] **Step 3: Review repository and permission boundaries**

```bash
git diff --check
git status --short
```

Confirm no secrets, automation tokens, temporary fixtures, generated duplicate drafts, or unrelated user files entered commits.

- [ ] **Step 4: Re-read the automation and report exact state**

Report automation name, enabled status, unchanged weekday 06:30 Asia/Taipei schedule, next run, conditional prompt presence, and the review date. If external state could not be verified, report `blocked` instead of `enabled`.

- [ ] **Step 5: Document rollback**

Rollback is to disable or restore the prior prompt of the same morning automation; it does not delete saved drafts or history. Do not automatically execute rollback.

- [ ] **Step 6: Finish the development branch**

Use `superpowers:verification-before-completion`, request final code review, then use `superpowers:finishing-a-development-branch`. Merge only after the user selects an integration option and the merged tree remains green.
