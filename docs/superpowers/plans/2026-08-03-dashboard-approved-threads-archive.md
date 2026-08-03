# Dashboard Approved Threads Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an owner-only `內容 › Threads 歷史` archive that lists only D1-approved Threads versions and opens each version on a stable full-text page.

**Architecture:** Generate an immutable `threadsDocuments` snapshot from every valid versioned Threads Markdown artifact, independent of the pending approval queue. At request time, join D1 approval events to those documents by artifact ID, type, version, and SHA-256; expose matched documents through an approved archive projection and expose unmatched Threads approvals as traceable unreadable issues. Render the projection through focused archive and reader components that reuse the existing safe structured-Markdown renderer.

**Tech Stack:** TypeScript, Next.js App Router, React server components, Node test runner, Cloudflare Sites/Vinext, D1 approval events, existing `parseBriefMarkdown()` and `ArtifactContent`.

## Global Constraints

- The archive shows only Threads versions with a matching D1 `approve` event; pending, returned, draft, mismatched, and unapproved versions must not appear as readable history.
- Match approval events on artifact ID, artifact type `Threads`, version, and SHA-256; mismatches fail closed.
- Approval means internal copy approval only. Never label an item published and never add editing, deletion, publishing, reply, or investment-action controls.
- Keep `待核准中心` restricted to pending decisions; approved history belongs under `內容`.
- The first version includes no search, tags, reuse workflow, performance integration, IG archive, or analytics instrumentation.
- Reuse the safe structured-Markdown parser and renderer; never inject raw Markdown as HTML and allow clickable links only for safe HTTP(S) destinations.
- Preserve owner-only authorization for `/content`, `/content/threads`, and `/content/threads/[artifactKey]`.
- Do not change the Dashboard allowlist, Sites visibility, D1 binding, approval semantics, external projects, or `jj-invest-public`.
- This plan authorizes local implementation and verification only. Deployment remains a separate explicit user approval.

---

## File Structure

- Modify `dashboard-site/lib/dashboard-types.ts`: define immutable Threads source documents, approved archive entries, and unreadable approval issues on `DashboardSnapshot`.
- Modify `dashboard-site/scripts/generate-dashboard-data.mts`: generate every valid Threads version into `threadsDocuments` without using approval state to filter it.
- Modify `dashboard-site/scripts/generate-dashboard-data.test.mts`: prove version preservation, full-content coverage, ordering, and malformed-source exclusion.
- Modify `dashboard-site/lib/approval-events.ts`: join approval events to canonical Threads documents and produce `approvedThreadsArchive` plus `threadsArchiveIssues`.
- Modify `dashboard-site/lib/approval-events.test.ts`: prove exact matching, same-day multi-version preservation, sync labels, and fail-closed orphan/mismatch behavior.
- Create `dashboard-site/app/content/threads/threads-components.tsx`: archive list, full reader, error list, selectors, and not-found state.
- Create `dashboard-site/app/content/threads/threads-components.test.tsx`: focused selector and static-render tests.
- Create `dashboard-site/app/content/page.tsx`: owner-only Content landing page that exposes Threads as the only first-version content type.
- Create `dashboard-site/app/content/threads/page.tsx`: owner-only approved Threads archive route.
- Create `dashboard-site/app/content/threads/[artifactKey]/page.tsx`: owner-only stable full-text route.
- Modify `dashboard-site/app/dashboard-shell.tsx`: add the `內容` navigation item between `晨報全文` and `AI 員工`.
- Modify `dashboard-site/app/dashboard-routes.test.tsx`: verify navigation, route output, archive boundaries, and absence of actions.
- Modify `dashboard-site/app/dashboard-snapshot.test.ts`: verify authorization-first behavior for all new routes.
- Modify `dashboard-site/app/globals.css`: add responsive archive and reader styles using existing Dashboard tokens.
- Modify `dashboard-site/tests/rendered-html.test.mjs`: verify generated pages and private-route output after production build.
- Modify `dashboard-site/tests/release-contract.test.mjs`: include the new source files and route constraints in release checks.
- Modify `dashboard-site/package.json`: include the focused Threads archive component test in the canonical test command.
- Modify `dashboard-site/README.md`: document approved-history semantics, route locations, synchronization label, and non-publishing boundary.
- Modify `dashboard/content.md`: add the approved Threads archive fields and D1 approval-event dependency to the content data contract.

---

### Task 1: Generate an immutable Threads document archive

**Files:**
- Modify: `dashboard-site/lib/dashboard-types.ts`
- Modify: `dashboard-site/scripts/generate-dashboard-data.mts`
- Modify: `dashboard-site/scripts/generate-dashboard-data.test.mts`
- Modify: `dashboard/content.md`

**Interfaces:**
- Consumes: validated `MarkdownRecord` values for the `Threads` source definition, `artifactContentHash(content)`, `summaryFrom(content)`, and `parseBriefMarkdown(content)`.
- Produces: `DashboardThreadsDocument`, `DashboardApprovedThreadsDocument`, `DashboardThreadsArchiveIssue`, and three snapshot arrays named `threadsDocuments`, `approvedThreadsArchive`, and `threadsArchiveIssues`.

- [ ] **Step 1: Add a failing generator test for every valid Threads version**

In `dashboard-site/scripts/generate-dashboard-data.test.mts`, add a test that writes two same-day versioned files with distinct bodies and verifies both immutable source documents are preserved:

```ts
test("Threads 文件庫保留每個有效版本及完整內容", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "dashboard-snapshot-"));
  try {
    await writeFixture(
      root,
      "records/content/threads/2026-07-30-market-v01.md",
      threads().replace("美股三大指數都上漲", "第一版完整正文"),
    );
    await writeFixture(
      root,
      "records/content/threads/2026-07-30-market-v02.md",
      threads().replace("美股三大指數都上漲", "第二版完整正文"),
    );

    const snapshot = await generateDashboardSnapshot(
      root,
      new Date("2026-07-30T10:00:00.000Z"),
    );

    assert.deepEqual(
      snapshot.threadsDocuments.map((document) => document.version),
      [2, 1],
    );
    assert.match(JSON.stringify(snapshot.threadsDocuments[0]?.blocks), /第二版完整正文/);
    assert.match(JSON.stringify(snapshot.threadsDocuments[1]?.blocks), /第一版完整正文/);
    assert.equal(snapshot.approvedThreadsArchive.length, 0);
    assert.equal(snapshot.threadsArchiveIssues.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the generator test and verify the new field is missing**

Run from `dashboard-site`:

```bash
node --import tsx --test scripts/generate-dashboard-data.test.mts
```

Expected: FAIL because `DashboardSnapshot` and the generated snapshot do not define `threadsDocuments`, `approvedThreadsArchive`, or `threadsArchiveIssues`.

- [ ] **Step 3: Define the Threads archive types**

In `dashboard-site/lib/dashboard-types.ts`, add:

```ts
export type ApprovalSyncStatus = "pending" | "synced" | "blocked";

export interface DashboardThreadsDocument extends TraceableRecord {
  id: string;
  artifactKey: string;
  date: string;
  version: number;
  versionLabel: string;
  title: string;
  summary: string;
  rawStatus: string;
  artifactHash: string;
  blocks: BriefBlock[];
}

export interface DashboardApprovedThreadsDocument extends DashboardThreadsDocument {
  approvedAt: string;
  approvalSyncStatus: ApprovalSyncStatus;
}

export interface DashboardThreadsArchiveIssue {
  eventId: string;
  artifactId: string;
  version: number;
  artifactHash: string;
  approvedAt: string;
  approvalSyncStatus: ApprovalSyncStatus;
  reason: string;
}
```

Add these fields to `DashboardSnapshot` immediately after `briefArchive`:

```ts
threadsDocuments: DashboardThreadsDocument[];
approvedThreadsArchive: DashboardApprovedThreadsDocument[];
threadsArchiveIssues: DashboardThreadsArchiveIssue[];
```

The stable `artifactKey` must be derived from the full artifact ID, version, and hash rather than from the title. Add and export this helper in `dashboard-site/lib/dashboard-types.ts` so the generator and route selectors share one definition:

```ts
export function threadsArtifactKey(
  artifactId: string,
  version: number,
  artifactHash: string,
) {
  return Buffer.from(`${artifactId}\u0000${version}\u0000${artifactHash}`, "utf8")
    .toString("base64url");
}
```

- [ ] **Step 4: Build every valid Threads version into the snapshot**

Import `threadsArtifactKey` into `generate-dashboard-data.mts`. Add a focused builder next to `buildBriefArchive`:

```ts
function buildThreadsDocuments(
  records: MarkdownRecord[],
): DashboardSnapshot["threadsDocuments"] {
  return records
    .flatMap((record) => {
      const validation = validateRecord(record);
      if (!validation.valid) return [];
      const valid = validation.record;
      const artifactHash = artifactContentHash(valid.content);
      return [{
        id: valid.relativePath,
        artifactKey: threadsArtifactKey(valid.relativePath, valid.version, artifactHash),
        date: valid.recordDate ?? valid.representativeDate,
        version: valid.version,
        versionLabel: `v${String(valid.version).padStart(2, "0")}`,
        title: valid.title,
        summary: summaryFrom(valid.content),
        rawStatus: valid.rawStatus ?? valid.artifactStatus,
        artifactHash,
        blocks: parseBriefMarkdown(valid.content),
        source: valid.relativePath,
        asOf: valid.asOf,
        updatedAt: valid.updatedAt,
        dependencies: valid.dependencies,
      } satisfies DashboardSnapshot["threadsDocuments"][number]];
    })
    .sort((left, right) =>
      right.date.localeCompare(left.date) ||
      right.version - left.version ||
      right.source.localeCompare(left.source),
    );
}
```

Find the source-definition index whose ID is `threads`, call `buildThreadsDocuments()` with that record set, and return:

```ts
threadsDocuments,
approvedThreadsArchive: [],
threadsArchiveIssues: [],
```

Do not filter by Markdown status here. Validation determines whether the source is readable; D1 approval events determine whether it appears in approved history.

- [ ] **Step 5: Cover malformed source behavior**

Extend the generator test with a malformed Threads version that omits `## 主版本`. Assert it is absent from `threadsDocuments` and the existing generator blocker identifies its source path. This proves invalid content cannot later become readable merely because a D1 event exists.

- [ ] **Step 6: Update the content data contract**

In `dashboard/content.md`, add rows for:

```markdown
| `threads_documents` | array | `records/content/threads/` 的有效版本化成果 | Dashboard 快照產生時 |
| `approved_threads_archive` | array | Threads 文件與 D1 核准事件的 ID／版本／雜湊配對 | 核准狀態變更時 |
| `threads_archive_issues` | array | 無法配對或無法載入的 Threads 核准事件 | 核准狀態變更時 |
```

Add a rule below the table: only exact D1 approval-event matches enter readable history; `已核准` never means `已發布`.

- [ ] **Step 7: Run focused tests and type checking**

Run:

```bash
node --import tsx --test scripts/generate-dashboard-data.test.mts
npm run typecheck
```

Expected: PASS. The generated snapshot contains every valid Threads version, no pre-approved projections, and a malformed version remains unreadable.

- [ ] **Step 8: Commit the immutable source archive**

```bash
git add dashboard-site/lib/dashboard-types.ts dashboard-site/scripts/generate-dashboard-data.mts dashboard-site/scripts/generate-dashboard-data.test.mts dashboard/content.md
git commit -m "feat: snapshot versioned Threads documents"
```

---

### Task 2: Project D1 approvals into readable history

**Files:**
- Modify: `dashboard-site/lib/approval-events.ts`
- Modify: `dashboard-site/lib/approval-events.test.ts`

**Interfaces:**
- Consumes: `DashboardSnapshot.threadsDocuments`, `ApprovalEvent[]`, and exact `{ artifactId, artifactType, artifactVersion, artifactHash, action }` fields.
- Produces: `approvedThreadsArchive` sorted by approved artifact date and version, plus `threadsArchiveIssues` for unmatched Threads approval events.

- [ ] **Step 1: Add failing exact-match and multi-version tests**

Extend `pendingSnapshot()` in `dashboard-site/lib/approval-events.test.ts` with the three arrays introduced in Task 1. Add two same-day documents and two matching approval events:

```ts
test("Threads 核准事件依 ID、版本與雜湊產生可讀歷史", () => {
  const snapshot = pendingSnapshot();
  snapshot.threadsDocuments = [threadsDocument(2), threadsDocument(1)];

  const approved = applyApprovalEvents(snapshot, [
    threadsEvent(2, "sha256:threads-v02"),
    threadsEvent(1, "sha256:threads-v01", { syncStatus: "synced", syncedAt: "2026-08-03T02:00:00.000Z" }),
  ]);

  assert.deepEqual(
    approved.approvedThreadsArchive.map((document) => document.version),
    [2, 1],
  );
  assert.equal(approved.approvedThreadsArchive[0]?.approvalSyncStatus, "pending");
  assert.equal(approved.approvedThreadsArchive[1]?.approvalSyncStatus, "synced");
  assert.equal(approved.threadsArchiveIssues.length, 0);
});
```

Use helpers with complete values:

```ts
function threadsDocument(version: number): DashboardSnapshot["threadsDocuments"][number] {
  const artifactHash = `sha256:threads-v${String(version).padStart(2, "0")}`;
  const id = `records/content/threads/2026-08-03-market-v${String(version).padStart(2, "0")}.md`;
  return {
    id,
    artifactKey: threadsArtifactKey(id, version, artifactHash),
    date: "2026-08-03",
    version,
    versionLabel: `v${String(version).padStart(2, "0")}`,
    title: `Threads 草稿 v${version}`,
    summary: "摘要",
    rawStatus: "待核准",
    artifactHash,
    blocks: [{ type: "paragraph", content: [{ type: "text", text: `正文 v${version}` }] }],
    source: id,
    asOf: "2026-08-03",
    updatedAt: "2026-08-03",
    dependencies: [],
  };
}

function threadsEvent(
  version: number,
  artifactHash: string,
  overrides: Partial<ApprovalEvent> = {},
): ApprovalEvent {
  const artifactId = `records/content/threads/2026-08-03-market-v${String(version).padStart(2, "0")}.md`;
  return {
    eventId: `threads-event-${version}`,
    artifactId,
    artifactType: "Threads",
    artifactVersion: version,
    artifactHash,
    action: "approve",
    actorUserId: "user-123",
    createdAt: `2026-08-03T0${version}:00:00.000Z`,
    syncStatus: "pending",
    syncedAt: null,
    ...overrides,
  };
}
```

- [ ] **Step 2: Add failing mismatch and orphan-event tests**

Add assertions that a wrong hash and a missing source never enter the readable archive:

```ts
test("Threads 雜湊不符或來源缺失時 fail closed 並保留問題", () => {
  const snapshot = pendingSnapshot();
  snapshot.threadsDocuments = [threadsDocument(1)];

  const result = applyApprovalEvents(snapshot, [
    threadsEvent(1, "sha256:wrong"),
    threadsEvent(3, "sha256:missing"),
  ]);

  assert.equal(result.approvedThreadsArchive.length, 0);
  assert.equal(result.threadsArchiveIssues.length, 2);
  assert.equal(
    result.threadsArchiveIssues.some((issue) => /雜湊不相符/.test(issue.reason)),
    true,
  );
  assert.equal(
    result.threadsArchiveIssues.some((issue) => /找不到對應全文/.test(issue.reason)),
    true,
  );
});
```

- [ ] **Step 3: Run the approval projection tests and verify failure**

Run:

```bash
node --import tsx --test lib/approval-events.test.ts
```

Expected: FAIL because `applyApprovalEvents()` does not populate the new archive arrays.

- [ ] **Step 4: Add a focused Threads approval projection**

In `dashboard-site/lib/approval-events.ts`, build an exact document lookup:

```ts
function threadsDocumentKey(
  artifactId: string,
  version: number,
  artifactHash: string,
) {
  return `${artifactId}\u0000${version}\u0000${artifactHash}`;
}

function projectApprovedThreads(
  snapshot: DashboardSnapshot,
  events: ApprovalEvent[],
) {
  const byExactVersion = new Map(
    snapshot.threadsDocuments.map((document) => [
      threadsDocumentKey(document.id, document.version, document.artifactHash),
      document,
    ]),
  );
  const byIdVersion = new Map(
    snapshot.threadsDocuments.map((document) => [
      `${document.id}\u0000${document.version}`,
      document,
    ]),
  );
  const approvedThreadsArchive: DashboardSnapshot["approvedThreadsArchive"] = [];
  const threadsArchiveIssues: DashboardSnapshot["threadsArchiveIssues"] = [];

  for (const event of events) {
    if (event.action !== "approve" || event.artifactType !== "Threads") continue;
    const exact = byExactVersion.get(
      threadsDocumentKey(event.artifactId, event.artifactVersion, event.artifactHash),
    );
    if (exact) {
      approvedThreadsArchive.push({
        ...exact,
        approvedAt: event.createdAt,
        approvalSyncStatus: event.syncStatus,
      });
      continue;
    }
    const sameVersion = byIdVersion.get(`${event.artifactId}\u0000${event.artifactVersion}`);
    threadsArchiveIssues.push({
      eventId: event.eventId,
      artifactId: event.artifactId,
      version: event.artifactVersion,
      artifactHash: event.artifactHash,
      approvedAt: event.createdAt,
      approvalSyncStatus: event.syncStatus,
      reason: sameVersion
        ? "核准紀錄與 Threads 全文雜湊不相符，已停止顯示正文。"
        : "找不到核准紀錄對應的 Threads 全文，已停止顯示正文。",
    });
  }

  approvedThreadsArchive.sort((left, right) =>
    right.date.localeCompare(left.date) ||
    right.version - left.version ||
    right.approvedAt.localeCompare(left.approvedAt),
  );
  threadsArchiveIssues.sort((left, right) => right.approvedAt.localeCompare(left.approvedAt));
  return { approvedThreadsArchive, threadsArchiveIssues };
}
```

Call this helper before `validEvents` is calculated and always return its two arrays, even when no event matches the pending approval queue. Remove the current early `if (validEvents.length === 0) return snapshot;`; replace it with a return path that preserves the projection while leaving unrelated Dashboard status unchanged.

- [ ] **Step 5: Keep existing approval behavior and sync warnings intact**

Refactor `validEvents` so a Threads event is valid when it exactly matches a canonical `threadsDocuments` entry, even if the corresponding item is no longer present in `snapshot.approvals`. Non-Threads events must retain the existing pending-approval validation. Use this predicate:

```ts
const validEvents = events.filter((event) => {
  if (event.artifactType === "Threads") {
    return snapshot.threadsDocuments.some((document) =>
      document.id === event.artifactId &&
      document.version === event.artifactVersion &&
      document.artifactHash === event.artifactHash &&
      event.action === "approve"
    );
  }
  const approval = approvalsById.get(event.artifactId);
  return Boolean(
    approval &&
    event.action === "approve" &&
    approval.type === event.artifactType &&
    approval.version === event.artifactVersion &&
    approval.artifactHash === event.artifactHash,
  );
});
```

Refactor the existing status-update code so the final return includes:

```ts
return {
  ...snapshot,
  approvedThreadsArchive,
  threadsArchiveIssues,
  approvals: snapshot.approvals.filter((approval) => !isApproved(approval.id)),
  employees: updatedEmployees,
  tasks: updatedTasks,
  briefArchive: updatedBriefArchive,
  brief: updatedBrief,
  marketRisk: updatedMarketRisk,
  blockers: updatedBlockers,
};
```

When `validEvents` is empty, use the existing arrays and records unchanged for `approvals`, `employees`, `tasks`, `briefArchive`, `brief`, `marketRisk`, and `blockers`, but still return `approvedThreadsArchive` and `threadsArchiveIssues`. A valid Threads event with `syncStatus !== "synced"` must continue producing the existing global sync warning as well as the per-item `approvalSyncStatus` label; when no pending approval object exists, use the matching Threads document title and `asOf` in the warning rather than falling back to an unlabelled artifact ID.

- [ ] **Step 6: Run approval, snapshot, and handler regression tests**

Run:

```bash
node --import tsx --test lib/approval-events.test.ts app/dashboard-snapshot.test.ts app/api/approvals/approval-handler.test.ts
npm run typecheck
```

Expected: PASS. Existing morning brief and market-risk approval behavior remains unchanged, while valid Threads events populate readable history independently of the pending queue.

- [ ] **Step 7: Commit the approval projection**

```bash
git add dashboard-site/lib/approval-events.ts dashboard-site/lib/approval-events.test.ts
git commit -m "feat: project approved Threads history"
```

---

### Task 3: Add the owner-only Content and Threads archive routes

**Files:**
- Create: `dashboard-site/app/content/page.tsx`
- Create: `dashboard-site/app/content/threads/page.tsx`
- Create: `dashboard-site/app/content/threads/[artifactKey]/page.tsx`
- Create: `dashboard-site/app/content/threads/threads-components.tsx`
- Create: `dashboard-site/app/content/threads/threads-components.test.tsx`
- Modify: `dashboard-site/app/dashboard-shell.tsx`
- Modify: `dashboard-site/app/dashboard-routes.test.tsx`
- Modify: `dashboard-site/app/dashboard-snapshot.test.ts`
- Modify: `dashboard-site/package.json`

**Interfaces:**
- Consumes: `DashboardApprovedThreadsDocument[]`, `DashboardThreadsArchiveIssue[]`, `ArtifactContent`, `EmptyState`, `StatusBadge`, `DashboardShell`, and `loadAuthorizedDashboardSnapshot(returnTo)`.
- Produces: `ApprovedThreadsArchive`, `ApprovedThreadsReader`, `ThreadsArchiveNotFound`, `selectApprovedThreadsDocument(documents, artifactKey)`, `/content`, `/content/threads`, and `/content/threads/[artifactKey]`.

- [ ] **Step 1: Add failing selector and component tests**

Create `dashboard-site/app/content/threads/threads-components.test.tsx` with a complete approved fixture and assertions for the list, reader, sync label, and unknown key:

```tsx
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { DashboardApprovedThreadsDocument } from "../../../lib/dashboard-types";
import {
  ApprovedThreadsArchive,
  ApprovedThreadsReader,
  selectApprovedThreadsDocument,
} from "./threads-components.tsx";

const document: DashboardApprovedThreadsDocument = {
  id: "records/content/threads/2026-08-03-market-v01.md",
  artifactKey: "stable-key",
  date: "2026-08-03",
  version: 1,
  versionLabel: "v01",
  title: "Threads 草稿｜市場觀察",
  summary: "市場高檔時的三個觀察。",
  rawStatus: "待核准",
  artifactHash: "sha256:threads-v01",
  approvedAt: "2026-08-03T02:32:00.000Z",
  approvalSyncStatus: "pending",
  blocks: [{ type: "paragraph", content: [{ type: "text", text: "完整 Threads 正文" }] }],
  source: "records/content/threads/2026-08-03-market-v01.md",
  asOf: "2026-08-03",
  updatedAt: "2026-08-03",
  dependencies: [],
};

test("歷史列表只呈現核准文件及全文入口", () => {
  const html = renderToStaticMarkup(
    <ApprovedThreadsArchive documents={[document]} issues={[]} />,
  );
  assert.match(html, /Threads 草稿｜市場觀察/);
  assert.match(html, /2026-08-03/);
  assert.match(html, /v01/);
  assert.match(html, /已核准、尚未同步/);
  assert.match(html, /\/content\/threads\/stable-key/);
  assert.doesNotMatch(html, /核准此版本|發布|編輯|刪除/);
});

test("全文頁顯示完整內容與核准追溯資訊", () => {
  const html = renderToStaticMarkup(<ApprovedThreadsReader document={document} />);
  assert.match(html, /完整 Threads 正文/);
  assert.match(html, /2026-08-03T02:32:00.000Z/);
  assert.match(html, /sha256:threads-v01/);
  assert.match(html, /records\/content\/threads/);
});

test("只依穩定 artifactKey 選擇全文", () => {
  assert.equal(selectApprovedThreadsDocument([document], "stable-key"), document);
  assert.equal(selectApprovedThreadsDocument([document], "unknown"), null);
});
```

- [ ] **Step 2: Run the component test and verify missing modules**

Run:

```bash
node --import tsx --test app/content/threads/threads-components.test.tsx
```

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement focused archive and reader components**

Create `threads-components.tsx`. Export:

```tsx
export function selectApprovedThreadsDocument(
  documents: DashboardApprovedThreadsDocument[],
  artifactKey: string,
) {
  return documents.find((document) => document.artifactKey === artifactKey) ?? null;
}
```

`ApprovedThreadsArchive` must:

- render the heading `Threads 歷史` and copy `只顯示已核准的 Threads 完整草稿；核准不等於發布。`;
- map `documents` in the order received without re-sorting;
- show date, title, `versionLabel`, `approvedAt`, source, and `StatusBadge status="已核准"`;
- show `已核准、尚未同步` for `pending`, `核准同步受阻` for `blocked`, and no extra sync warning for `synced`;
- link to `/content/threads/${encodeURIComponent(document.artifactKey)}` with copy `閱讀全文`;
- render `EmptyState` with title `目前沒有已核准 Threads 草稿` when both arrays are empty;
- render every `threadsArchiveIssues` entry in a separate `資料無法載入` section with artifact ID, version, approval time, reason, and no full-text link.

`ApprovedThreadsReader` must render a back link, approved badge, date, version, approval time, sync label, source, complete hash, and `<ArtifactContent blocks={document.blocks} />`. `ThreadsArchiveNotFound` must explain that the approved Threads version cannot be found and link back to `/content/threads`.

- [ ] **Step 4: Add route-level failing tests**

In `dashboard-site/app/dashboard-routes.test.tsx`, import the new components and add a fixture assertion that navigation and route content exist:

```tsx
test("內容導覽與 Threads 歷史維持已核准閱讀邊界", () => {
  const archiveHtml = renderToStaticMarkup(
    <ApprovedThreadsArchive documents={[approvedThreadsDocument]} issues={[]} />,
  );
  assert.match(archiveHtml, /Threads 歷史/);
  assert.match(archiveHtml, /閱讀全文/);
  assert.doesNotMatch(archiveHtml, /核准此版本|發布/);
});
```

Render `DashboardShell` with the test user and assert link order matches:

```ts
assert.match(shellHtml, /晨報全文[\s\S]*?內容[\s\S]*?AI 員工[\s\S]*?待核准中心/);
```

- [ ] **Step 5: Add the three protected routes and navigation item**

Create `dashboard-site/app/content/page.tsx` as a small landing route. It must call `loadAuthorizedDashboardSnapshot("/content")`, wrap content in `DashboardShell`, explain that the first version contains approved Threads history, and link to `/content/threads`.

Create `dashboard-site/app/content/threads/page.tsx`:

```tsx
import { DashboardShell } from "../../dashboard-shell";
import { loadAuthorizedDashboardSnapshot } from "../../dashboard-snapshot";
import { ApprovedThreadsArchive } from "./threads-components";

export const dynamic = "force-dynamic";

export default async function ApprovedThreadsPage() {
  const { user, snapshot } = await loadAuthorizedDashboardSnapshot("/content/threads");
  return (
    <DashboardShell user={user} generatedAt={snapshot.generatedAt}>
      <ApprovedThreadsArchive
        documents={snapshot.approvedThreadsArchive}
        issues={snapshot.threadsArchiveIssues}
      />
    </DashboardShell>
  );
}
```

Create `dashboard-site/app/content/threads/[artifactKey]/page.tsx` with promised params, an encoded `returnTo`, `selectApprovedThreadsDocument()`, and either `ApprovedThreadsReader` or `ThreadsArchiveNotFound`. Do not accept artifact IDs, source paths, titles, or hashes directly as route parameters.

In `dashboard-shell.tsx`, insert:

```tsx
<Link href="/content">內容</Link>
```

between `晨報全文` and `AI 員工`.

- [ ] **Step 6: Extend authorization-first tests**

Add these values to the route loop in `dashboard-site/app/dashboard-snapshot.test.ts`:

```ts
"/content",
"/content/threads",
"/content/threads/stable-key",
```

Expected event order for each route remains exactly `authorize → load-snapshot → load-approval-events`.

- [ ] **Step 7: Add the focused test to the canonical suite**

In `dashboard-site/package.json`, add `app/content/threads/threads-components.test.tsx` after the existing Threads disclosure test in the `test` script.

- [ ] **Step 8: Run focused UI and authorization tests**

Run:

```bash
node --import tsx --test app/content/threads/threads-components.test.tsx app/dashboard-routes.test.tsx app/dashboard-snapshot.test.ts
npm run typecheck
npm run lint
```

Expected: PASS. The archive contains no approval or publishing controls, direct reader URLs resolve by `artifactKey`, and every new route authorizes before loading private data.

- [ ] **Step 9: Commit the protected archive routes**

```bash
git add dashboard-site/app/content dashboard-site/app/dashboard-shell.tsx dashboard-site/app/dashboard-routes.test.tsx dashboard-site/app/dashboard-snapshot.test.ts dashboard-site/package.json
git commit -m "feat: add approved Threads archive routes"
```

---

### Task 4: Finish responsive presentation, documentation, and release verification

**Files:**
- Modify: `dashboard-site/app/globals.css`
- Modify: `dashboard-site/tests/rendered-html.test.mjs`
- Modify: `dashboard-site/tests/release-contract.test.mjs`
- Modify: `dashboard-site/README.md`

**Interfaces:**
- Consumes: Task 3 archive classes and routes plus the existing production build and rendered-HTML test harness.
- Produces: responsive archive/reader presentation, release-contract coverage, operational documentation, and a locally verified production build.

- [ ] **Step 1: Add failing rendered-output and release-contract assertions**

Extend `dashboard-site/tests/release-contract.test.mjs` so the expected source set includes:

```js
"app/content/page.tsx",
"app/content/threads/page.tsx",
"app/content/threads/[artifactKey]/page.tsx",
"app/content/threads/threads-components.tsx",
```

Assert `app/content/threads/threads-components.tsx` contains `核准不等於發布`, uses `ArtifactContent`, and does not contain an approval API call or publishing control. Extend both protected-route loops in `tests/rendered-html.test.mjs` with `/content` and `/content/threads`. Assert an allowed user receives `200` and `登出 ChatGPT`, while a non-allowed user receives `403` without source paths or Threads body text. Full reader content remains covered deterministically by `threads-components.test.tsx`, because the rendered Worker test has no seeded D1 approval event from which to obtain a valid `artifactKey`.

- [ ] **Step 2: Run the release tests and verify missing style/documentation coverage**

Run:

```bash
node --test tests/release-contract.test.mjs tests/rendered-html.test.mjs
```

Expected: FAIL until the new protected routes and required source markers are represented in the harness.

- [ ] **Step 3: Add responsive archive and long-form reader styles**

In `dashboard-site/app/globals.css`, add focused classes used by Task 3:

```css
.threads-archive-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.threads-archive-card,
.threads-archive-issue {
  min-width: 0;
}

.threads-reader {
  max-width: 52rem;
  margin-inline: auto;
}

.threads-reader .brief-table-scroll {
  overflow-x: auto;
}
```

Inside the existing `@media (max-width: 720px)` block, add:

```css
.threads-archive-grid {
  grid-template-columns: 1fr;
}

.threads-reader {
  max-width: none;
}
```

Use the existing card, spacing, text-link, status-badge, source-line, `brief-table-scroll`, and artifact-content styles wherever possible. Do not introduce a new UI library or a parallel color system.

- [ ] **Step 4: Document the operational and safety behavior**

Update `dashboard-site/README.md` with:

- `/content` as the content landing route;
- `/content/threads` as the D1-approved archive;
- the stable full-text path `/content/threads/[artifactKey]`;
- exact ID/type/version/SHA-256 matching;
- `已核准、尚未同步` and `核准同步受阻` meanings;
- the fact that history is read-only and approval never means publication;
- the rule that missing or mismatched full text fails closed.

State explicitly that deployment was not performed by this implementation plan.

- [ ] **Step 5: Run all local Dashboard checks**

Run from `dashboard-site`:

```bash
npm test
```

Expected: data generation, typecheck, all Node tests, production build, and rendered HTML tests pass. Do not click a real approval action and do not deploy.

- [ ] **Step 6: Run workspace validation**

Run from the repository root:

```bash
sh scripts/validation/validate-workspace.sh
```

Expected: `ALL CHECKS PASSED`.

- [ ] **Step 7: Inspect the generated snapshot without exposing private content**

Run from `dashboard-site`:

```bash
node -e 'const d=require("./data/dashboard.json"); console.log({threadsDocuments:d.threadsDocuments.length,approvedThreadsArchive:d.approvedThreadsArchive.length,threadsArchiveIssues:d.threadsArchiveIssues.length})'
```

Expected: all three values are non-negative integers. Do not print full draft bodies, actor user IDs, tokens, or private account identifiers to logs.

- [ ] **Step 8: Commit presentation and verification**

```bash
git add dashboard-site/app/globals.css dashboard-site/tests/rendered-html.test.mjs dashboard-site/tests/release-contract.test.mjs dashboard-site/README.md
git commit -m "chore: verify approved Threads archive"
```

- [ ] **Step 9: Record the deployment approval boundary in the handoff**

The implementation handoff must say:

```text
已核准 Threads 歷史功能已在本機完成並通過驗證；尚未部署。若要更新私人正式 Dashboard，請另行明確核准部署。
```

Do not run a Sites or Vercel deployment command in this plan.

---

## Final Acceptance Checklist

- [ ] `內容` appears between `晨報全文` and `AI 員工` in the main navigation.
- [ ] `/content/threads` lists only exact D1-approved Threads versions, newest artifact date first.
- [ ] Each approved version has a stable reader URL and displays every structured source block in order.
- [ ] Two approved versions from the same date remain separate and neither overwrites the other.
- [ ] Pending, draft, returned, hash-mismatched, and missing-source versions never appear as readable history.
- [ ] Mismatched or missing approved sources appear as traceable unreadable issues with no body or reader link.
- [ ] Pending and blocked approval synchronization states are labeled without changing approval into publication.
- [ ] The archive and reader contain no approval, edit, delete, publish, reply, or investment-action controls.
- [ ] `/content`, `/content/threads`, and direct reader URLs authorize before loading the snapshot or D1 events.
- [ ] Desktop and mobile layouts are readable; long text does not overflow and necessary tables scroll within their wrapper.
- [ ] `npm test` passes in `dashboard-site`.
- [ ] `sh scripts/validation/validate-workspace.sh` reports `ALL CHECKS PASSED`.
- [ ] No deployment occurred without a separate explicit user approval.
