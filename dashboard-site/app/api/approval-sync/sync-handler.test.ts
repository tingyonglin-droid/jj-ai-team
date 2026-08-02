import assert from "node:assert/strict";
import test from "node:test";
import type { ApprovalEvent } from "../../../db/approval-store";
import { createApprovalSyncHandler } from "./sync-handler";

const pendingEvent: ApprovalEvent = {
  eventId: "event-1",
  artifactId: "records/daily-briefs/2026-07-31-v01.md",
  artifactType: "晨報",
  artifactVersion: 1,
  artifactHash: "sha256:brief-v01",
  action: "approve",
  actorUserId: "private-user-id",
  createdAt: "2026-08-03T01:00:00.000Z",
  syncStatus: "pending",
  syncedAt: null,
};

function request(method: "GET" | "POST", secret?: string, body?: unknown) {
  return new Request("https://dashboard.example/api/approval-sync", {
    method,
    headers: {
      ...(secret ? { authorization: `Bearer ${secret}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test("缺少或錯誤服務密鑰時拒絕同步 API", async () => {
  const handler = createApprovalSyncHandler({
    secret: "correct-secret-value",
    store: {
      listPendingSync: async () => [pendingEvent],
      markSynced: async () => assert.fail("未授權時不可寫入"),
    },
  });

  assert.equal((await handler(request("GET"))).status, 401);
  assert.equal((await handler(request("GET", "wrong-secret"))).status, 401);
});

test("GET 只匯出同步所需欄位，不洩漏使用者身份", async () => {
  const handler = createApprovalSyncHandler({
    secret: "correct-secret-value",
    store: {
      listPendingSync: async () => [pendingEvent],
      markSynced: async () => undefined,
    },
  });

  const response = await handler(request("GET", "correct-secret-value"));
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.doesNotMatch(text, /private-user-id|actorUserId|email/i);
  assert.deepEqual(JSON.parse(text), {
    events: [
      {
        eventId: "event-1",
        artifactId: "records/daily-briefs/2026-07-31-v01.md",
        artifactType: "晨報",
        artifactVersion: 1,
        artifactHash: "sha256:brief-v01",
        action: "approve",
        createdAt: "2026-08-03T01:00:00.000Z",
      },
    ],
  });
});

test("POST 只接受有效事件清單與 ISO 同步時間", async () => {
  const calls: Array<{ eventIds: string[]; syncedAt: string }> = [];
  const handler = createApprovalSyncHandler({
    secret: "correct-secret-value",
    store: {
      listPendingSync: async () => [],
      markSynced: async (eventIds, syncedAt) => {
        calls.push({ eventIds, syncedAt });
      },
    },
  });

  const response = await handler(
    request("POST", "correct-secret-value", {
      eventIds: ["event-1", "event-1", "event-2"],
      syncedAt: "2026-08-03T02:00:00.000Z",
    }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    {
      eventIds: ["event-1", "event-2"],
      syncedAt: "2026-08-03T02:00:00.000Z",
    },
  ]);

  const invalid = await handler(
    request("POST", "correct-secret-value", {
      eventIds: ["event-1"],
      syncedAt: "tomorrow",
    }),
  );
  assert.equal(invalid.status, 400);
});
