import assert from "node:assert/strict";
import test from "node:test";
import type { ChatGPTUser } from "./chatgpt-auth";
import { loadAuthorizedDashboardSnapshot } from "./dashboard-snapshot";

const allowedUser: ChatGPTUser = {
  id: "user-123",
  displayName: "owner@example.com",
  email: "owner@example.com",
  fullName: null,
};

test("授權失敗時不載入私有 Dashboard 快照", async () => {
  let snapshotWasLoaded = false;

  await assert.rejects(
    loadAuthorizedDashboardSnapshot(
      "/employees",
      async () => {
        throw new Error("FORBIDDEN");
      },
      async () => {
        snapshotWasLoaded = true;
        throw new Error("私人快照不應被讀取");
      },
      async () => {
        throw new Error("授權失敗時不應讀取核准事件");
      },
    ),
    /FORBIDDEN/,
  );

  assert.equal(snapshotWasLoaded, false);
});

test("每個 Dashboard 路由都先授權再載入快照", async () => {
  for (const returnTo of [
    "/",
    "/employees",
    "/approvals",
    "/briefs",
    "/briefs/2026-07-30?version=v01",
    "/content",
    "/content/threads",
    "/content/threads/stable-key",
  ]) {
    const events: string[] = [];

    await loadAuthorizedDashboardSnapshot(
      returnTo,
      async (path) => {
        events.push(`authorize:${path}`);
        return allowedUser;
      },
      async () => {
        events.push("load-snapshot");
        return {
          approvals: [],
          employees: [],
          tasks: [],
          briefArchive: [],
          threadsDocuments: [],
          approvedThreadsArchive: [],
          threadsArchiveIssues: [],
          brief: null,
          marketRisk: null,
          blockers: [],
        } as never;
      },
      async () => {
        events.push("load-approval-events");
        return [];
      },
    );

    assert.deepEqual(events, [
      `authorize:${returnTo}`,
      "load-snapshot",
      "load-approval-events",
    ]);
  }
});

test("核准資料庫無法讀取時保留 Dashboard 並顯示明確受阻項目", async () => {
  const result = await loadAuthorizedDashboardSnapshot(
    "/",
    async () => allowedUser,
    async () =>
      ({
        approvals: [],
        employees: [],
        tasks: [],
        briefArchive: [],
        threadsDocuments: [],
        approvedThreadsArchive: [],
        threadsArchiveIssues: [],
        brief: null,
        marketRisk: null,
        blockers: [],
      }) as never,
    async () => {
      throw new Error("Cloudflare D1 binding DB is unavailable");
    },
  );

  assert.deepEqual(result.snapshot.blockers, [
    {
      severity: "blocker",
      kind: "sync",
      title: "核准資料庫受阻",
      reason: "無法讀取 Dashboard 核准紀錄，頁面顯示的核准狀態可能不是最新狀態。",
      nextStep: "檢查 D1 的 DB 綁定與 migration，恢復後重新整理 Dashboard。",
      source: "Dashboard approval store",
      asOf: null,
      updatedAt: null,
    },
  ]);
});
