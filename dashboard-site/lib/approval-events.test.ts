import assert from "node:assert/strict";
import test from "node:test";

import type { ApprovalEvent } from "../db/approval-store";
import type { DashboardSnapshot } from "./dashboard-types";
import { applyApprovalEvents } from "./approval-events.ts";

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

test("已同步核准不顯示尚未同步提醒", () => {
  const approved = applyApprovalEvents(pendingSnapshot(), [
    approvalEvent({ syncStatus: "synced", syncedAt: "2026-08-03T01:00:00.000Z" }),
  ]);

  assert.equal(approved.brief?.artifactStatus, "已核准");
  assert.equal(approved.blockers.some((issue) => issue.kind === "sync"), false);
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
    blockers: [],
  };
}
