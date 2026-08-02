import assert from "node:assert/strict";
import test from "node:test";

import {
  ApprovalStore,
  approvalEventFromRow,
  type ApprovalEvent,
  type ApprovalEventRepository,
  type ApprovalInput,
} from "./approval-store.ts";

const input: ApprovalInput = {
  artifactId: "records/daily-briefs/2026-07-31-v01.md",
  artifactType: "晨報",
  artifactVersion: 1,
  artifactHash: "sha256:brief-v01",
  actorUserId: "user-123",
};

test("同一成果版本重複核准時回傳同一事件", async () => {
  const repository = new MemoryApprovalRepository();
  let nextId = 0;
  const store = new ApprovalStore(repository, {
    createId: () => `event-${++nextId}`,
    now: () => "2026-08-03T00:00:00.000Z",
  });

  const first = await store.approve(input);
  const second = await store.approve(input);

  assert.equal(second.eventId, first.eventId);
  assert.equal((await store.list()).length, 1);
  assert.equal(first.syncStatus, "pending");
});

test("不同版本各自保存核准事件", async () => {
  const repository = new MemoryApprovalRepository();
  let nextId = 0;
  const store = new ApprovalStore(repository, {
    createId: () => `event-${++nextId}`,
    now: () => "2026-08-03T00:00:00.000Z",
  });

  const first = await store.approve(input);
  const second = await store.approve({
    ...input,
    artifactVersion: 2,
    artifactHash: "sha256:brief-v02",
  });

  assert.notEqual(second.eventId, first.eventId);
  assert.equal((await store.list()).length, 2);
});

test("同一版本內容雜湊改變時拒絕沿用既有核准", async () => {
  const repository = new MemoryApprovalRepository();
  const store = new ApprovalStore(repository, {
    createId: () => "event-1",
    now: () => "2026-08-03T00:00:00.000Z",
  });
  await store.approve(input);

  await assert.rejects(
    store.approve({ ...input, artifactHash: "sha256:changed-content" }),
    /內容雜湊不相符/,
  );
});

test("同步只更新指定事件且不改寫核准內容", async () => {
  const repository = new MemoryApprovalRepository();
  let nextId = 0;
  const store = new ApprovalStore(repository, {
    createId: () => `event-${++nextId}`,
    now: () => "2026-08-03T00:00:00.000Z",
  });
  const first = await store.approve(input);
  const second = await store.approve({
    ...input,
    artifactVersion: 2,
    artifactHash: "sha256:brief-v02",
  });

  await store.markSynced([first.eventId], "2026-08-03T01:00:00.000Z");

  assert.deepEqual(
    (await store.listPendingSync()).map((event) => event.eventId),
    [second.eventId],
  );
  const synced = (await store.list()).find((event) => event.eventId === first.eventId);
  assert.equal(synced?.artifactHash, input.artifactHash);
  assert.equal(synced?.syncStatus, "synced");
  assert.equal(synced?.syncedAt, "2026-08-03T01:00:00.000Z");
});

test("資料庫列只接受核准事件允許的列舉值", () => {
  const row = {
    eventId: "event-1",
    artifactId: input.artifactId,
    artifactType: "晨報",
    artifactVersion: 1,
    artifactHash: input.artifactHash,
    action: "approve",
    actorUserId: input.actorUserId,
    createdAt: "2026-08-03T00:00:00.000Z",
    syncStatus: "pending",
    syncedAt: null,
  };

  assert.equal(approvalEventFromRow(row).eventId, "event-1");
  assert.throws(
    () => approvalEventFromRow({ ...row, action: "publish" }),
    /無效的核准事件動作/,
  );
});

class MemoryApprovalRepository implements ApprovalEventRepository {
  private readonly events = new Map<string, ApprovalEvent>();

  async list() {
    return [...this.events.values()];
  }

  async findByArtifact(
    artifactId: string,
    artifactVersion: number,
    action: ApprovalEvent["action"],
  ) {
    return (
      [...this.events.values()].find(
        (event) =>
          event.artifactId === artifactId &&
          event.artifactVersion === artifactVersion &&
          event.action === action,
      ) ?? null
    );
  }

  async insert(event: ApprovalEvent) {
    if (
      await this.findByArtifact(
        event.artifactId,
        event.artifactVersion,
        event.action,
      )
    ) {
      return false;
    }
    this.events.set(event.eventId, event);
    return true;
  }

  async markSynced(eventIds: string[], syncedAt: string) {
    for (const eventId of eventIds) {
      const event = this.events.get(eventId);
      if (!event) continue;
      this.events.set(eventId, {
        ...event,
        syncStatus: "synced",
        syncedAt,
      });
    }
  }
}
