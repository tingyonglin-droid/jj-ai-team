# 2026-08-03 Daily Threads Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce one source-traceable, unpublished Threads draft from the 2026-08-03 morning brief.

**Architecture:** Treat the approved morning brief as the sole research source and transform one core angle into the existing Threads template. Save the result as an append-only content artifact, then validate both its claims and the workspace contract.

**Tech Stack:** Markdown, POSIX shell validation, Git.

## Global Constraints

- The output remains `待核准` and must not be published.
- The core angle is「指數上漲，不代表風險下降」.
- Do not invent holdings, trades, personal experiences, or personalized investment advice.
- Do not add an App CTA.
- Every market number must be traceable to `records/daily-briefs/2026-08-03-v01.md` and its dated sources.

---

### Task 1: Produce and verify the Threads draft

**Files:**
- Create: `records/content/threads/2026-08-03-index-up-risk-not-down-v01.md`
- Reference: `records/daily-briefs/2026-08-03-v01.md`
- Reference: `templates/threads-draft.md`
- Reference: `knowledge/writing-style.md`
- Reference: `knowledge/investment-philosophy.md`

**Interfaces:**
- Consumes: approved design in `docs/superpowers/specs/2026-08-03-daily-threads-pilot-design.md` and the source brief above.
- Produces: one Markdown artifact recognized by the Dashboard artifact contract under `records/content/threads`.

- [ ] **Step 1: Create the append-only artifact directory and draft**

Use `apply_patch` to create `records/content/threads/2026-08-03-index-up-risk-not-down-v01.md` with the exact template fields `日期`, `狀態`, `來源研究`, and `建議時機`; and the exact sections `主版本`, `備選開頭`, `查核與語氣`, and `核准`.

The complete copy must use short Traditional Chinese paragraphs and include: S&P 500 `+0.7%`, Nasdaq `+1%`, 10-year Treasury `4.68%→4.75%`, Amazon `+15.3%`, Apple `-7.4%`, Micron `-5.9%`, plus the counterevidence and uncertainty required by the design.

- [ ] **Step 2: Run deterministic content checks**

Run:

```bash
test -f records/content/threads/2026-08-03-index-up-risk-not-down-v01.md
rg -n '^## (主版本|備選開頭|查核與語氣|核准)$' records/content/threads/2026-08-03-index-up-risk-not-down-v01.md
rg -n 'S&P 500|Nasdaq|4\.75%|Amazon|Apple|Micron|反方|待核准|不加入' records/content/threads/2026-08-03-index-up-risk-not-down-v01.md
! rg -n '保證|一定會|建議買進|建議賣出|我已買|我已賣' records/content/threads/2026-08-03-index-up-risk-not-down-v01.md
```

Expected: the file exists; all required headings and claims are found; prohibited claims return no matches.

- [ ] **Step 3: Run the complete workspace validation**

Run `sh scripts/validation/validate-workspace.sh`.

Expected: exit code `0` with all workspace validation checks passing.

- [ ] **Step 4: Review and commit only the draft**

Run `git diff --check` and inspect the draft diff. Then stage only `records/content/threads/2026-08-03-index-up-risk-not-down-v01.md` and commit with message `content: draft August 3 Threads post`.

Expected: no whitespace errors; only the new draft is staged and committed.
