import assert from "node:assert/strict";
import test from "node:test";

import type { ApprovalEvent } from "../db/approval-store";
import { threadsArtifactKey, type DashboardSnapshot } from "./dashboard-types";
import { applyApprovalEvents, projectExactApproval } from "./approval-events.ts";

const artifactId = "records/daily-briefs/2026-07-31-v01.md";
const artifactHash = "sha256:brief-v01";

test("雜湊相符的指定版本會在全站改成已核准並移出待核准清單", () => {
  const approved = applyApprovalEvents(pendingSnapshot(), [approvalEvent()]);

  assert.equal(approved.approvals.length, 0);
  assert.equal(approved.brief?.artifactStatus, "已核准");
  assert.equal(approved.briefArchive[0]?.artifactStatus, "已核准");
  assert.equal(approved.tasks[0]?.artifactStatus, "已核准");
  assert.equal(approved.tasks[0]?.status, "已完成");
  assert.equal(approved.employees[0]?.artifactStatus, "已核准");
  assert.equal(approved.employees[0]?.status, "已完成");
  assert.equal(
    approved.blockers.some(
      (issue) => issue.kind === "sync" && issue.severity === "warning",
    ),
    true,
  );
});

test("新版本不繼承舊版核准", () => {
  const snapshot = pendingSnapshot();
  snapshot.approvals[0].version = 2;
  snapshot.brief = snapshot.brief
    ? { ...snapshot.brief, version: 2, artifactHash: "sha256:brief-v02" }
    : null;

  const unchanged = applyApprovalEvents(snapshot, [approvalEvent()]);

  assert.equal(unchanged.approvals.length, 1);
  assert.equal(unchanged.brief?.artifactStatus, "待核准");
});

test("歷史風險節點只套用 ID、版本與雜湊皆相符的核准", () => {
  const snapshot = pendingSnapshot();
  snapshot.marketRiskHistory.nodes = [
    marketRiskHistoryNode(2, "sha256:risk-v02"),
    marketRiskHistoryNode(1, "sha256:risk-v01"),
  ];
  snapshot.marketRiskArchive = [marketRiskDocument(2, "sha256:risk-v02")];

  const applied = applyApprovalEvents(snapshot, [
    approvalEvent({
      artifactId: "records/market-risk/2026-07-30-v02.md",
      artifactType: "市場風險報告",
      artifactVersion: 2,
      artifactHash: "sha256:risk-v02",
    }),
  ]);

  assert.equal(applied.marketRiskHistory.nodes[0]?.artifactStatus, "已核准");
  assert.equal(applied.marketRiskHistory.nodes[1]?.artifactStatus, "待核准");
  assert.equal(applied.marketRiskArchive[0]?.artifactStatus, "已核准");
});

test("單一歷史風險紀錄不繼承版本或雜湊不符的核准", () => {
  const node = marketRiskHistoryNode(2, "sha256:risk-v02");
  const wrongVersion = approvalEvent({
    artifactId: node.id,
    artifactType: "市場風險報告",
    artifactVersion: 1,
    artifactHash: node.artifactHash,
  });
  const wrongHash = approvalEvent({
    artifactId: node.id,
    artifactType: "市場風險報告",
    artifactVersion: node.version,
    artifactHash: "sha256:other-content",
  });

  assert.equal(projectExactApproval(node, [wrongVersion]).artifactStatus, "待核准");
  assert.equal(projectExactApproval(node, [wrongHash]).artifactStatus, "待核准");
  assert.equal(
    projectExactApproval(node, [approvalEvent({
      artifactId: node.id,
      artifactType: "市場風險報告",
      artifactVersion: node.version,
      artifactHash: node.artifactHash,
    })]).artifactStatus,
    "已核准",
  );
});

test("已同步核准不顯示尚未同步提醒", () => {
  const approved = applyApprovalEvents(pendingSnapshot(), [
    approvalEvent({ syncStatus: "synced", syncedAt: "2026-08-03T01:00:00.000Z" }),
  ]);

  assert.equal(approved.brief?.artifactStatus, "已核准");
  assert.equal(approved.blockers.some((issue) => issue.kind === "sync"), false);
});

test("Threads 核准事件依 ID、版本與雜湊保留同日每個已核准版本", () => {
  const snapshot = pendingSnapshot();
  snapshot.threadsDocuments = [threadsDocument(2), threadsDocument(1)];

  const approved = applyApprovalEvents(snapshot, [
    threadsEvent(2, "sha256:threads-v02"),
    threadsEvent(1, "sha256:threads-v01", {
      syncStatus: "synced",
      syncedAt: "2026-08-03T02:00:00.000Z",
    }),
  ]);

  assert.deepEqual(
    approved.approvedThreadsArchive.map((document) => document.version),
    [2, 1],
  );
  assert.equal(approved.approvedThreadsArchive[0]?.approvalSyncStatus, "pending");
  assert.equal(approved.approvedThreadsArchive[1]?.approvalSyncStatus, "synced");
  assert.equal(approved.threadsArchiveIssues.length, 0);
});

test("Threads 雜湊不符或來源缺失時不顯示正文並保留問題", () => {
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
    result.threadsArchiveIssues.some((issue) => /找不到.*全文/.test(issue.reason)),
    true,
  );
});

function approvalEvent(overrides: Partial<ApprovalEvent> = {}): ApprovalEvent {
  return {
    eventId: "event-1",
    artifactId,
    artifactType: "晨報",
    artifactVersion: 1,
    artifactHash,
    action: "approve",
    actorUserId: "user-123",
    createdAt: "2026-08-03T00:00:00.000Z",
    syncStatus: "pending",
    syncedAt: null,
    ...overrides,
  };
}

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

function marketRiskHistoryNode(
  version: number,
  artifactHash: string,
): DashboardSnapshot["marketRiskHistory"]["nodes"][number] {
  const id = `records/market-risk/2026-07-30-v${String(version).padStart(2, "0")}.md`;
  return {
    id,
    date: "2026-07-30",
    version,
    versionLabel: `v${String(version).padStart(2, "0")}`,
    artifactHash,
    artifactStatus: "待核准",
    rawStatus: "待核准",
    score: 42,
    state: "中性",
    dailyChange: null,
    changeReasons: "測試資料",
    topRisks: [],
    supportingEvidence: "測試資料",
    counterEvidence: "測試資料",
    confidence: 80,
    completeness: 100,
    lowCompleteness: false,
    versions: [],
    source: id,
    asOf: "2026-07-30",
    updatedAt: "2026-07-30",
    dependencies: [],
  };
}

function marketRiskDocument(
  version: number,
  artifactHash: string,
): DashboardSnapshot["marketRiskArchive"][number] {
  const id = `records/market-risk/2026-07-30-v${String(version).padStart(2, "0")}.md`;
  return {
    id,
    date: "2026-07-30",
    version,
    versionLabel: `v${String(version).padStart(2, "0")}`,
    isLatest: true,
    title: `市場風險報告｜2026-07-30-v${String(version).padStart(2, "0")}`,
    artifactHash,
    artifactStatus: "待核准",
    rawStatus: "待核准",
    blocks: [],
    source: id,
    asOf: "2026-07-30",
    updatedAt: "2026-07-30",
    dependencies: [],
  };
}

function pendingSnapshot(): DashboardSnapshot {
  return {
    generatedAt: "2026-08-03T00:00:00.000Z",
    date: "2026-08-03",
    expectation: {
      dashboardDate: "2026-08-03",
      expectedReportDate: "2026-08-03",
      coveredSessionDate: "2026-07-31",
      phase: "due",
      reason: "今日應有晨報。",
    },
    approvals: [
      {
        id: artifactId,
        title: "每日投資晨報｜2026-07-31",
        type: "晨報",
        owner: "總經研究員",
        status: "待核准",
        artifactStatus: "待核准",
        rawStatus: "待核准",
        summary: "摘要",
        fullContent: null,
        decision: "是否核准此晨報版本。",
        createdAt: null,
        recordDate: "2026-07-31",
        version: 1,
        artifactHash,
        source: artifactId,
        asOf: "2026-07-31 07:10（Asia/Taipei，UTC+8）",
        updatedAt: "2026-07-31",
        dependencies: [],
      },
    ],
    employees: [
      {
        id: "macro-researcher",
        name: "總經研究員",
        role: "總經研究員",
        status: "待核准",
        artifactStatus: "待核准",
        rawStatus: "待核准",
        currentTask: "每日投資晨報｜2026-07-31",
        progress: "等待人工核准",
        handoff: "交付總司令",
        blocker: null,
        nextStep: "等待使用者核准",
        source: artifactId,
        asOf: "2026-07-31 07:10（Asia/Taipei，UTC+8）",
        updatedAt: "2026-07-31",
        dependencies: [],
      },
    ],
    tasks: [
      {
        id: artifactId,
        title: "每日投資晨報｜2026-07-31",
        owner: "總經研究員",
        ownerId: "macro-researcher",
        status: "待核准",
        artifactStatus: "待核准",
        rawStatus: "待核准",
        nextStep: "等待使用者核准",
        source: artifactId,
        asOf: "2026-07-31 07:10（Asia/Taipei，UTC+8）",
        updatedAt: "2026-07-31",
        dependencies: [],
      },
    ],
    briefArchive: [
      {
        id: artifactId,
        date: "2026-07-31",
        version: 1,
        versionLabel: "v01",
        isLatest: true,
        title: "每日投資晨報｜2026-07-31",
        summary: "摘要",
        freshness: "待更新",
        artifactStatus: "待核准",
        rawStatus: "待核准",
        artifactHash,
        coveredSessionDate: "2026-07-30",
        blocks: [],
        source: artifactId,
        asOf: "2026-07-31 07:10（Asia/Taipei，UTC+8）",
        updatedAt: "2026-07-31",
        dependencies: [],
      },
    ],
    threadsDocuments: [],
    approvedThreadsArchive: [],
    threadsArchiveIssues: [],
    brief: {
      title: "每日投資晨報｜2026-07-31",
      summary: "摘要",
      freshness: "待更新",
      artifactStatus: "待核准",
      rawStatus: "待核准",
      version: 1,
      artifactHash,
      coveredSessionDate: "2026-07-30",
      source: artifactId,
      asOf: "2026-07-31 07:10（Asia/Taipei，UTC+8）",
      updatedAt: "2026-07-31",
      dependencies: [],
    },
    marketRisk: null,
    marketRiskHistory: {
      nodes: [],
      issues: [],
    },
    marketRiskArchive: [],
    blockers: [],
  };
}
