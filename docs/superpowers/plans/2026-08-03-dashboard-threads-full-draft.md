# Dashboard Threads Full Draft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authorized user expand and read the complete Threads draft inside its Dashboard approval card before using the existing approval action.

**Architecture:** Parse the validated Threads Markdown into the existing safe `BriefBlock` structure while generating the static Dashboard snapshot. Add an optional full-content payload only to Threads approvals, then render it through a focused client-side disclosure component shared by the overview and approval center; keep approval writes isolated in `ApprovalAction`.

**Tech Stack:** TypeScript, React Server Components plus a small React client component, Node test runner, React DOM server rendering, vinext/OpenNext, OpenAI Sites.

## Global Constraints

- Threads full content is embedded in the generated snapshot; the deployed Worker must not read repository files at runtime.
- The card is collapsed by default and expands in place with the labels `查看完整草稿` and `收合草稿`.
- Today Overview and Approval Center use the same Threads disclosure component.
- Existing two-step approval remains unchanged and approval never publishes, replies, or performs an investment action.
- Non-Threads approvals retain their current presentation.
- Unsafe non-HTTP(S) Markdown links render as text, never clickable HTML.
- Missing Threads full content is shown as a traceable error and must not be represented by the summary.
- Preserve owner-only Sites access, the existing project, D1 bindings, migrations, and allowed-user policy.
- Do not modify or deploy `jj-invest-public`.

---

## File Structure

- Modify `dashboard-site/lib/dashboard-types.ts`: define the optional Threads full-draft payload on approval records.
- Reuse `dashboard-site/lib/brief-content.ts`: parse Markdown into safe `BriefBlock[]`; no second Markdown parser.
- Modify `dashboard-site/scripts/generate-dashboard-data.mts`: attach full content only to Threads approvals.
- Modify `dashboard-site/scripts/generate-dashboard-data.test.mts`: prove full source coverage and absence on other approval types.
- Create `dashboard-site/app/approvals/artifact-content.tsx`: shared safe block renderer for artifact content.
- Create `dashboard-site/app/approvals/threads-draft-disclosure.tsx`: client-side collapsed/expanded Threads reader.
- Create `dashboard-site/app/approvals/threads-draft-disclosure.test.tsx`: reducer and rendered accessibility tests.
- Modify `dashboard-site/app/briefs/brief-components.tsx`: reuse the shared block renderer rather than duplicate rendering logic.
- Modify `dashboard-site/app/dashboard-components.tsx`: place the shared disclosure in both approval-card contexts.
- Modify `dashboard-site/app/dashboard-routes.test.tsx`: verify overview and approval-center integration.
- Modify `dashboard-site/app/globals.css`: scope readable long-form styles to the disclosure without changing other cards.
- Modify `dashboard-site/README.md`: document full Threads review behavior and non-publishing boundary.

### Task 1: Carry complete Threads content in the snapshot

**Files:**
- Modify: `dashboard-site/lib/dashboard-types.ts`
- Modify: `dashboard-site/scripts/generate-dashboard-data.mts`
- Test: `dashboard-site/scripts/generate-dashboard-data.test.mts`

**Interfaces:**
- Consumes: `parseBriefMarkdown(markdown: string): BriefBlock[]` from `dashboard-site/lib/brief-content.ts`.
- Produces: approval property `fullContent: { format: "structured-markdown"; blocks: BriefBlock[] } | null`.

- [ ] **Step 1: Write the failing generator assertions**

Add assertions to the existing snapshot-generation test that locate the Threads approval and verify representative text from every section is present in its block JSON, while a morning-brief approval has `fullContent === null`:

```ts
const threadsApproval = snapshot.approvals.find((approval) => approval.type === "Threads");
assert.ok(threadsApproval?.fullContent);
const serializedDraft = JSON.stringify(threadsApproval.fullContent.blocks);
assert.match(serializedDraft, /美股三大指數都上漲/);
assert.match(serializedDraft, /備選開頭/);
assert.match(serializedDraft, /查核與語氣/);
assert.match(serializedDraft, /最終文字與發布由使用者決定/);

const briefApproval = snapshot.approvals.find((approval) => approval.type === "晨報");
assert.equal(briefApproval?.fullContent, null);
```

- [ ] **Step 2: Run the generator test and confirm RED**

Run:

```bash
cd dashboard-site
node --import tsx --test scripts/generate-dashboard-data.test.mts
```

Expected: FAIL because approval records do not define or populate `fullContent`.

- [ ] **Step 3: Add the typed payload**

In `DashboardSnapshot["approvals"]`, add:

```ts
fullContent: {
  format: "structured-markdown";
  blocks: BriefBlock[];
} | null;
```

- [ ] **Step 4: Populate only Threads approvals**

In the approval mapper, add:

```ts
fullContent:
  record.definition.type === "Threads"
    ? { format: "structured-markdown" as const, blocks: parseBriefMarkdown(record.content) }
    : null,
```

Do not use `summaryFrom()` as fallback full content. Existing invalid records remain excluded and represented through generator blockers.

- [ ] **Step 5: Regenerate the committed snapshot and run the focused tests**

Run the repository's existing Dashboard generation command from `dashboard-site/package.json`, then:

```bash
node --import tsx --test lib/brief-content.test.ts scripts/generate-dashboard-data.test.mts
```

Expected: PASS, and `data/dashboard.json` contains structured complete content for the Threads approval only.

- [ ] **Step 6: Commit the snapshot contract**

```bash
git add dashboard-site/lib/dashboard-types.ts dashboard-site/scripts/generate-dashboard-data.mts dashboard-site/scripts/generate-dashboard-data.test.mts dashboard-site/data/dashboard.json
git commit -m "feat: include Threads drafts in dashboard snapshot"
```

### Task 2: Build a safe reusable artifact renderer and disclosure

**Files:**
- Create: `dashboard-site/app/approvals/artifact-content.tsx`
- Create: `dashboard-site/app/approvals/threads-draft-disclosure.tsx`
- Create: `dashboard-site/app/approvals/threads-draft-disclosure.test.tsx`
- Modify: `dashboard-site/app/briefs/brief-components.tsx`

**Interfaces:**
- Consumes: `BriefBlock[]` and `BriefInlineNode[]` from `dashboard-site/lib/dashboard-types.ts`.
- Produces: `ArtifactContent({ blocks }: { blocks: BriefBlock[] })` and `ThreadsDraftDisclosure({ artifactId, blocks, source }: { artifactId: string; blocks: BriefBlock[] | null; source: string })`.
- Produces pure state API `threadsDraftDisclosureReducer(state: boolean, event: "toggle"): boolean` for deterministic testing.

- [ ] **Step 1: Write failing reducer and server-render tests**

Create `threads-draft-disclosure.test.tsx` with these behaviors:

```tsx
assert.equal(threadsDraftDisclosureReducer(false, "toggle"), true);
assert.equal(threadsDraftDisclosureReducer(true, "toggle"), false);

const collapsed = renderToStaticMarkup(
  <ThreadsDraftDisclosure
    artifactId="records/content/threads/example-v01.md"
    blocks={[{ type: "paragraph", content: [{ type: "text", text: "完整正文" }] }]}
    source="records/content/threads/example-v01.md"
  />,
);
assert.match(collapsed, /查看完整草稿/);
assert.match(collapsed, /aria-expanded="false"/);
assert.doesNotMatch(collapsed, />完整正文</);

const unavailable = renderToStaticMarkup(
  <ThreadsDraftDisclosure
    artifactId="records/content/threads/missing-v01.md"
    blocks={null}
    source="records/content/threads/missing-v01.md"
  />,
);
assert.match(unavailable, /完整草稿無法載入/);
assert.match(unavailable, /重新產生 Dashboard 快照/);
```

- [ ] **Step 2: Run the disclosure test and confirm RED**

Run:

```bash
node --import tsx --test app/approvals/threads-draft-disclosure.test.tsx
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Extract the safe block renderer**

Move the `InlineContent` and block switch from `brief-components.tsx` into `artifact-content.tsx`. Export only:

```tsx
export function ArtifactContent({ blocks }: { blocks: BriefBlock[] }) {
  return blocks.map((block, index) => <ArtifactBlock key={index} block={block} />);
}
```

Keep links rendered as `<a href={node.href} rel="noreferrer">`; URL safety remains owned by `parseBriefMarkdown`. Update `BriefReader` to render `<ArtifactContent blocks={document.blocks} />` inside its existing `.brief-content` container.

- [ ] **Step 4: Implement the client disclosure**

Create a `"use client"` component using `useReducer`. Generate a stable panel ID with `useId()`. The button must include `aria-expanded={expanded}` and `aria-controls={panelId}`. Render the content only when expanded:

```tsx
<button type="button" className="text-link threads-draft-toggle" aria-expanded={expanded} aria-controls={panelId} onClick={() => dispatch("toggle")}>
  {expanded ? "收合草稿" : "查看完整草稿"}
</button>
{expanded ? (
  <div id={panelId} className="threads-draft-content">
    <ArtifactContent blocks={blocks} />
  </div>
) : null}
```

When `blocks` is null or empty, render an `.error-text` message naming `source` and the exact next step `重新產生 Dashboard 快照後再審閱。`; do not render the toggle or summary as replacement content.

- [ ] **Step 5: Run focused tests and confirm GREEN**

Run:

```bash
node --import tsx --test lib/brief-content.test.ts app/briefs/brief-components.test.tsx app/approvals/threads-draft-disclosure.test.tsx
```

Expected: PASS. Existing brief output remains unchanged, the disclosure defaults closed, and missing content fails visibly.

- [ ] **Step 6: Commit the isolated renderer**

```bash
git add dashboard-site/app/approvals/artifact-content.tsx dashboard-site/app/approvals/threads-draft-disclosure.tsx dashboard-site/app/approvals/threads-draft-disclosure.test.tsx dashboard-site/app/briefs/brief-components.tsx
git commit -m "feat: add expandable Threads draft reader"
```

### Task 3: Integrate the reader into both approval-card contexts

**Files:**
- Modify: `dashboard-site/app/dashboard-components.tsx`
- Modify: `dashboard-site/app/dashboard-routes.test.tsx`
- Modify: `dashboard-site/app/globals.css`
- Modify: `dashboard-site/README.md`

**Interfaces:**
- Consumes: `ThreadsDraftDisclosure` and approval `fullContent` from Tasks 1 and 2.
- Produces: identical in-card Threads review behavior on `TodayOverview` and `ApprovalCenter`.

- [ ] **Step 1: Write failing route-level assertions**

Extend `dashboard-routes.test.tsx` with a Threads approval containing structured blocks. Render `TodayOverview` and `ApprovalCenter`, then assert each contains one collapsed control and no control appears on a morning-brief card:

```ts
assert.equal((todayHtml.match(/查看完整草稿/g) ?? []).length, 1);
assert.equal((approvalHtml.match(/查看完整草稿/g) ?? []).length, 1);
assert.match(todayHtml, /aria-expanded="false"/);
assert.match(approvalHtml, /aria-expanded="false"/);
assert.doesNotMatch(briefOnlyHtml, /查看完整草稿/);
```

Also keep the existing count and markup assertions for Threads approval buttons. Add a malformed Threads fixture with `fullContent: null` and assert it shows `完整草稿無法載入` but does not show `核准此版本`; this makes complete review fail closed.

- [ ] **Step 2: Run the route test and confirm RED**

Run:

```bash
node --import tsx --test app/dashboard-routes.test.tsx
```

Expected: FAIL because neither card renders `ThreadsDraftDisclosure`.

- [ ] **Step 3: Add a single card helper and integrate both views**

In `dashboard-components.tsx`, add a focused helper:

```tsx
function ThreadsDraftReview({ approval }: { approval: Approval }) {
  if (approval.type !== "Threads") return null;
  return (
    <ThreadsDraftDisclosure
      artifactId={approval.id}
      blocks={approval.fullContent?.blocks ?? null}
      source={approval.source}
    />
  );
}
```

Render `<ThreadsDraftReview approval={approval} />` after the traceability text and before `ApprovalAction` in both `TodayOverview` and `ApprovalCenter`. Do not duplicate disclosure logic.

Change the local approval-action guard to require complete Threads content:

```ts
function canApproveInDashboard(approval: Approval) {
  if (approval.type === "Threads") {
    return Boolean(approval.fullContent?.blocks.length);
  }
  return approval.type === "晨報" || approval.type === "市場風險報告";
}
```

This check is a presentation guard only; keep the server-side approval API allowlist unchanged because valid Threads snapshots remain approvable.

- [ ] **Step 4: Add scoped long-form styles**

Add styles that preserve card layout and readability:

```css
.threads-draft-toggle { margin-top: 0.85rem; }
.threads-draft-content {
  width: 100%;
  margin-top: 0.85rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--line);
  line-height: 1.75;
}
.threads-draft-content h2,
.threads-draft-content h3,
.threads-draft-content h4 { margin: 1.25rem 0 0.5rem; }
.threads-draft-content p,
.threads-draft-content ol,
.threads-draft-content ul { margin: 0.65rem 0 0; }
```

Ensure the parent decision card permits the content column to shrink (`min-width: 0`) and the disclosure stays within that column on narrow screens. Reuse the existing mobile breakpoint; do not add a new breakpoint solely for this feature.

- [ ] **Step 5: Document the behavior and boundary**

Update `dashboard-site/README.md` to state that authorized users can expand a full Threads draft in its card before approval, and that approval records internal copy approval only—no content is published or interacted with automatically.

- [ ] **Step 6: Run integration tests and confirm GREEN**

Run:

```bash
node --import tsx --test app/dashboard-routes.test.tsx app/approvals/approval-action.test.tsx app/approvals/threads-draft-disclosure.test.tsx
```

Expected: PASS with one Threads disclosure in each relevant route, unchanged two-stage approval, and no disclosure on non-Threads cards.

- [ ] **Step 7: Commit the integration**

```bash
git add dashboard-site/app/dashboard-components.tsx dashboard-site/app/dashboard-routes.test.tsx dashboard-site/app/globals.css dashboard-site/README.md
git commit -m "feat: show full Threads drafts in approval cards"
```

### Task 4: Verify, merge, and deploy the private Dashboard

**Files:**
- Verify: `dashboard-site/data/dashboard.json`
- Verify: `dashboard-site/.openai/hosting.json`
- Verify: repository-wide validation inputs

**Interfaces:**
- Consumes: the complete feature from Tasks 1–3.
- Produces: a tested commit deployed as a new saved version of the existing owner-only Sites project.

- [ ] **Step 1: Run type checking and the complete Dashboard test suite**

Run the exact existing test command documented in `dashboard-site/package.json` or `tests/release-contract.test.mjs`, including API, database, generator, route, and release-contract tests. Also run:

```bash
node_modules/.bin/tsc --noEmit
```

Expected: all tests pass and TypeScript reports no errors.

- [ ] **Step 2: Build and verify rendered production pages**

Run:

```bash
WRANGLER_LOG_PATH=.wrangler/wrangler.log node_modules/.bin/vinext build
node --test tests/rendered-html.test.mjs
```

Expected: production build succeeds and all rendered HTML tests pass. The test-only warning about an unavailable D1 binding is acceptable only when the associated fail-closed tests pass.

- [ ] **Step 3: Run repository validation**

From the repository root:

```bash
sh scripts/validation/validate-workspace.sh
```

Expected final line: `ALL CHECKS PASSED`.

- [ ] **Step 4: Review the final diff and commit verification-only changes if any**

Run:

```bash
git diff --check
git status --short
```

Preserve unrelated user modifications. If regeneration or verification changed tracked feature files, commit only those files with:

```bash
git commit -m "chore: verify Threads draft dashboard output"
```

- [ ] **Step 5: Save and deploy through OpenAI Sites**

Read the opaque existing project ID from `dashboard-site/.openai/hosting.json`; do not print it. Verify the current caller is owner and the access policy has exactly one allowed user and no allowed groups. Package the successfully built source at the exact current commit, push that exact commit with a short-lived repository credential, save a new site version with the package archive, and deploy it using the private deployment operation. Poll the returned deployment ID until `succeeded` or `failed`.

Expected: a new production version succeeds at `https://jj-ai-team-dashboard.tingyong-lin.chatgpt.site` without creating a second project or changing access policy.

- [ ] **Step 6: Verify private access and perform an authorized acceptance check**

Run an unauthenticated HEAD request:

```bash
curl -I https://jj-ai-team-dashboard.tingyong-lin.chatgpt.site
```

Expected: `HTTP/2 401`. In the authorized Dashboard, confirm the Threads card starts collapsed, expands to show text from every source section, collapses again, and still presents the existing two-stage approval action. Do not click final approval merely to test the reader.

- [ ] **Step 7: Finish the isolated branch**

Use `superpowers:finishing-a-development-branch`. Present its required four options. If the user selects local merge, fast-forward `main`, rerun the full test/build/workspace validation from `main`, and remove the temporary worktree only after successful verification.
