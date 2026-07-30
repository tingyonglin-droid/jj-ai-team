import assert from "node:assert/strict";
import test from "node:test";
import type { ChatGPTUser } from "./chatgpt-auth";
import { loadAuthorizedDashboardSnapshot } from "./dashboard-snapshot";

const allowedUser: ChatGPTUser = {
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
    ),
    /FORBIDDEN/,
  );

  assert.equal(snapshotWasLoaded, false);
});

test("每個 Dashboard 路由都先授權再載入快照", async () => {
  for (const returnTo of ["/", "/employees", "/approvals"]) {
    const events: string[] = [];

    await loadAuthorizedDashboardSnapshot(
      returnTo,
      async (path) => {
        events.push(`authorize:${path}`);
        return allowedUser;
      },
      async () => {
        events.push("load-snapshot");
        return {} as never;
      },
    );

    assert.deepEqual(events, [`authorize:${returnTo}`, "load-snapshot"]);
  }
});
