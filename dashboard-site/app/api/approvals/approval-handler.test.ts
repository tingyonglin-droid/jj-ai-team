import assert from "node:assert/strict";
import test from "node:test";
import snapshotFixture from "../../../data/dashboard.json" with { type: "json" };

import {
  ApprovalStore,
  type ApprovalEvent,
  type ApprovalEventRepository,
} from "../../../db/approval-store";
import type { ChatGPTUser } from "../../chatgpt-auth";
import type { DashboardSnapshot } from "../../../lib/dashboard-types";
import { createApprovalHandler } from "./approval-handler.ts";

const artifactId = "records/daily-briefs/2026-07-31-v01.md";
const threadsArtifactId = "records/content/threads/2026-08-03-topic-v01.md";

test("同源且仍待核准的版本會以伺服器快照資料建立事件", async () => {
  const store = testStore();
  const handler = createApprovalHandler({
    requireUser: async () => allowedUser,
    loadSnapshot: async () => snapshotWithPendingBrief(),
    store,
  });

  const response = await handler(approvalRequest());
  const body = await response.json() as { eventId: string; artifactId: string };
  const [saved] = await store.list();

  assert.equal(response.status, 200);
  assert.equal(body.artifactId, artifactId);
  assert.equal(saved.actorUserId, allowedUser.id);
  assert.equal(saved.artifactHash, "sha256:brief-v01");
});

test("Threads 待核准版本會以伺服器快照資料建立事件", async () => {
  const store = testStore();
  const handler = createApprovalHandler({
    requireUser: async () => allowedUser,
    loadSnapshot: async () => snapshotWithPendingThreads(),
    store,
  });

  const response = await handler(approvalRequest({ artifactId: threadsArtifactId }));
  const [saved] = await store.list();

  assert.equal(response.status, 200);
  assert.equal(saved.artifactId, threadsArtifactId);
  assert.equal(saved.artifactType, "Threads");
  assert.equal(saved.artifactHash, "sha256:threads-v01");
});

test("跨來源核准請求在授權與寫入前被拒絕", async () => {
  const store = testStore();
  let authorizationCalls = 0;
  const handler = createApprovalHandler({
    requireUser: async () => {
      authorizationCalls += 1;
      return allowedUser;
    },
    loadSnapshot: async () => snapshotWithPendingBrief(),
    store,
  });

  const response = await handler(
    approvalRequest({ origin: "https://attacker.example" }),
  );

  assert.equal(response.status, 403);
  assert.equal(authorizationCalls, 0);
  assert.equal((await store.list()).length, 0);
});

test("不存在或已不是待核准的版本回傳衝突", async () => {
  const store = testStore();
  const handler = createApprovalHandler({
    requireUser: async () => allowedUser,
    loadSnapshot: async () => ({
      ...snapshotWithPendingBrief(),
      approvals: [],
    }),
    store,
  });

  const response = await handler(approvalRequest());

  assert.equal(response.status, 409);
  assert.equal((await store.list()).length, 0);
});

function approvalRequest({
  origin = "https://dashboard.example",
  artifactId: requestedArtifactId = artifactId,
} = {}) {
  return new Request("https://dashboard.example/api/approvals", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
    },
    body: JSON.stringify({ artifactId: requestedArtifactId, version: 1 }),
  });
}

function snapshotWithPendingThreads(): DashboardSnapshot {
  const brief = snapshotWithPendingBrief().approvals[0];
  return {
    ...snapshotWithPendingBrief(),
    approvals: [{
      ...brief,
      id: threadsArtifactId,
      title: "Threads 草稿｜測試",
      type: "Threads",
      owner: "社群經營員",
      artifactHash: "sha256:threads-v01",
      source: threadsArtifactId,
      recordDate: "2026-08-03",
      asOf: "2026-08-03",
      updatedAt: "2026-08-03",
    }],
  };
}

const allowedUser: ChatGPTUser = {
  id: "user-123",
  displayName: "Owner",
  email: "owner@example.com",
  fullName: "Owner",
};

function snapshotWithPendingBrief(): DashboardSnapshot {
  return {
    ...snapshotFixture,
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
        decision: "是否核准此版本。",
        createdAt: null,
        recordDate: "2026-07-31",
        version: 1,
        artifactHash: "sha256:brief-v01",
        source: artifactId,
        asOf: "2026-07-31 07:10（Asia/Taipei，UTC+8）",
        updatedAt: "2026-07-31",
        dependencies: [],
      },
    ],
  } as unknown as DashboardSnapshot;
}

function testStore() {
  return new ApprovalStore(new MemoryApprovalRepository(), {
    createId: () => "event-1",
    now: () => "2026-08-03T00:00:00.000Z",
  });
}

class MemoryApprovalRepository implements ApprovalEventRepository {
  private readonly events: ApprovalEvent[] = [];

  async list() {
    return [...this.events];
  }

  async findByArtifact(
    requestedArtifactId: string,
    artifactVersion: number,
    action: ApprovalEvent["action"],
  ) {
    return this.events.find(
      (event) =>
        event.artifactId === requestedArtifactId &&
        event.artifactVersion === artifactVersion &&
        event.action === action,
    ) ?? null;
  }

  async insert(event: ApprovalEvent) {
    if (await this.findByArtifact(event.artifactId, event.artifactVersion, event.action)) {
      return false;
    }
    this.events.push(event);
    return true;
  }

  async markSynced() {}
}
