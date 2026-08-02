# Dashboard Social Artifact Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the 2026-08-03 Threads draft in the private Dashboard approval center and update the social operator's current progress, while preventing future delivery gaps.

**Architecture:** Reuse the existing artifact manifest and snapshot generator because a read-only reproduction already proves they parse the Threads artifact correctly. Regenerate the committed snapshot, add an explicit Dashboard handoff step to the daily Threads workflow, validate the exact production package, and deploy a saved version to the existing private Sites project.

**Tech Stack:** Markdown, TypeScript 5.9, Node.js 22, Next.js 16, Vinext, OpenAI Sites, Cloudflare D1, POSIX shell, Git.

## Global Constraints

- The Threads artifact remains `待核准`; deployment does not approve or publish it.
- Reuse the existing private Sites project and preserve owner-only access, D1 binding, migrations, and allowed-user configuration.
- Do not modify or deploy `jj-invest-public`.
- Do not create or rotate sync credentials.
- Do not expose Email addresses, tokens, project IDs, or source write credentials.

---

### Task 1: Regenerate and verify the Dashboard snapshot

**Files:**
- Modify: `dashboard-site/data/dashboard.json`
- Reference: `records/content/threads/2026-08-03-index-up-risk-not-down-v01.md`
- Reference: `dashboard-site/data/artifact-sources.json`
- Reference: `dashboard-site/scripts/generate-dashboard-data.mts`

**Interfaces:**
- Consumes: the committed Threads artifact and existing source definition `threads`.
- Produces: a static Dashboard snapshot containing the approval, task, and employee progress records.

- [ ] **Step 1: Generate the snapshot with the supported command**

From `dashboard-site`, run `npm run data:generate` using Node.js `>=22.13.0`.

Expected: `data/dashboard.json` is updated without validation blockers for the Threads source.

- [ ] **Step 2: Assert the exact regression state**

Use `jq -e` to assert all of the following in `dashboard-site/data/dashboard.json`:

- `approvals` contains source `records/content/threads/2026-08-03-index-up-risk-not-down-v01.md`, type `Threads`, status `待核准`.
- `tasks` contains the same source with `ownerId` equal to `social-operator` and status `待核准`.
- employee `social-operator` has `currentTask` equal to `Threads 草稿｜指數上漲，不代表風險下降`, `progress` equal to `等待人工核准`, and the same source.

Expected: every assertion exits `0`.

### Task 2: Add the delivery guardrail

**Files:**
- Modify: `workflows/daily-threads.md`

**Interfaces:**
- Consumes: the existing daily Threads workflow.
- Produces: an explicit post-save Dashboard refresh, verification, and private deployment requirement.

- [ ] **Step 1: Add one workflow step after artifact creation**

Use `apply_patch` to add a step requiring the operator to regenerate the Dashboard snapshot, verify the Threads approval and social-operator progress, validate the workspace, and deploy the existing private Dashboard. State that failure is reported as blocked and never treated as successful Dashboard delivery.

- [ ] **Step 2: Verify the guardrail text**

Run `rg -n 'Dashboard|社群經營員|待核准|受阻|私人' workflows/daily-threads.md`.

Expected: the new step contains all five concepts and does not authorize publishing or automatic approval.

### Task 3: Validate and commit the exact source

**Files:**
- Modify: `dashboard-site/data/dashboard.json`
- Modify: `workflows/daily-threads.md`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: one validated source commit used for the Sites version.

- [ ] **Step 1: Run Dashboard full verification and production build**

From `dashboard-site`, run `npm test` with the configured allowed-user test fixture required by the repository.

Expected: data generation, typecheck, unit tests, release contract, production build, and rendered HTML tests all pass.

- [ ] **Step 2: Validate the packaged Sites contract**

Assert that `dist/server/index.js`, `dist/.openai/hosting.json`, and `dist/.openai/drizzle/` exist; compare the packaged hosting metadata to the source metadata without printing project IDs; confirm `d1` remains `DB`.

Expected: all package checks exit `0` and no secrets are present in the diff.

- [ ] **Step 3: Run the workspace validation**

From the repository root, run `sh scripts/validation/validate-workspace.sh` with the project Node runtime on `PATH`.

Expected: `ALL CHECKS PASSED` and 6/6 morning-risk validator tests pass.

- [ ] **Step 4: Review and commit only the intended files**

Run `git diff --check`, inspect the two intended diffs, stage only `dashboard-site/data/dashboard.json` and `workflows/daily-threads.md`, and commit with message `fix: refresh social dashboard progress`.

Expected: existing unrelated changes remain unstaged.

### Task 4: Save and deploy the existing private Sites version

**Files:**
- Package: `dashboard-site/dist/`
- Package metadata: `dashboard-site/dist/.openai/hosting.json`
- Package migrations: `dashboard-site/dist/.openai/drizzle/`

**Interfaces:**
- Consumes: the exact source commit from Task 3 and its successful production build.
- Produces: one deployed private Sites version for the existing project.

- [ ] **Step 1: Obtain a scoped source write credential and push the exact source commit**

Use the Sites connector for the existing project. Keep the credential out of Git configuration, remote URLs, logs, files, and user-facing output.

Expected: the remote branch head equals the validated local commit SHA.

- [ ] **Step 2: Package and save one version**

Use the Sites plugin `scripts/package-site.sh` helper with `dashboard-site` as the project directory and a temporary archive path. Save exactly one version using the validated commit SHA.

Expected: the connector accepts the package and returns a version identifier.

- [ ] **Step 3: Deploy privately and poll to completion**

Deploy the saved version with private access and poll deployment status until it succeeds or fails.

Expected: status is `succeeded`; any failure leaves the previous production version active and is reported as blocked.

- [ ] **Step 4: Verify user-visible behavior**

Confirm an unauthorized request does not expose private content. Open the deployed private URL in Codex and confirm the authorized snapshot contains the Threads approval and updated social-operator progress without approving the artifact.

Expected: privacy remains enforced and the two requested Dashboard surfaces show the new state.
