import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { artifactContentHash } from "./generate-dashboard-data.mts";
import {
  acknowledgeManifest,
  createRemoteClient,
  fetchAndMaterialize,
  type ApprovalSyncClient,
  type PendingApprovalEvent,
} from "./sync-approval-events.mts";

const content = `# 每日投資晨報｜2026-07-31\n\n- 狀態：待核准\n`;

function event(overrides: Partial<PendingApprovalEvent> = {}): PendingApprovalEvent {
  return {
    eventId: "event-1",
    artifactId: "records/daily-briefs/2026-07-31-v01.md",
    artifactType: "晨報",
    artifactVersion: 1,
    artifactHash: artifactContentHash(content),
    action: "approve",
    createdAt: "2026-08-03T01:00:00.000Z",
    ...overrides,
  };
}

async function fixtureRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "jj-approval-sync-"));
  await mkdir(path.join(root, "records/daily-briefs"), { recursive: true });
  await mkdir(path.join(root, "records/decisions"), { recursive: true });
  await writeFile(path.join(root, "records/daily-briefs/2026-07-31-v01.md"), content);
  return root;
}

test("三個同步環境值缺少任一項時保持停用", () => {
  for (const environment of [
    {},
    { DASHBOARD_SITE_URL: "https://dashboard.example" },
    {
      DASHBOARD_SITE_URL: "https://dashboard.example",
      SITES_BYPASS_TOKEN: "bypass-token",
    },
  ]) {
    assert.throws(() => createRemoteClient(environment), /同步保持停用/);
  }
});

test("內容雜湊不符時不建立決策紀錄也不 acknowledge", async () => {
  const root = await fixtureRoot();
  let acknowledged = false;
  const client: ApprovalSyncClient = {
    fetchPending: async () => [event({ artifactHash: `sha256:${"0".repeat(64)}` })],
    acknowledge: async () => {
      acknowledged = true;
    },
  };

  await assert.rejects(
    fetchAndMaterialize(client, { root, now: new Date("2026-08-03T02:00:00.000Z") }),
    /內容雜湊不符/,
  );
  await assert.rejects(readFile(path.join(root, "records/decisions/2026-08-03-approve-daily-brief-2026-07-31-v01.md")), {
    code: "ENOENT",
  });
  assert.equal(acknowledged, false);
});

test("fetch 以 exclusive create 建立決策與本機 manifest，但不提前 acknowledge", async () => {
  const root = await fixtureRoot();
  let acknowledged = false;
  const client: ApprovalSyncClient = {
    fetchPending: async () => [event()],
    acknowledge: async () => {
      acknowledged = true;
    },
  };

  const manifestPath = await fetchAndMaterialize(client, {
    root,
    now: new Date("2026-08-03T02:00:00.000Z"),
  });
  assert.ok(manifestPath);
  const decision = await readFile(
    path.join(root, "records/decisions/2026-08-03-approve-daily-brief-2026-07-31-v01.md"),
    "utf8",
  );
  assert.match(decision, /決策者：使用者（Dashboard 已驗證）/);
  assert.match(decision, /決定：核准指定成果版本/);
  assert.match(decision, /適用範圍：僅限 records\/daily-briefs\/2026-07-31-v01\.md v01/);
  assert.match(decision, new RegExp(event().artifactHash));
  assert.match(decision, /事件 ID：event-1/);
  assert.equal(acknowledged, false);

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.deepEqual(manifest.eventIds, ["event-1"]);
  assert.deepEqual(manifest.decisionPaths, [
    "records/decisions/2026-08-03-approve-daily-brief-2026-07-31-v01.md",
  ]);
});

test("Threads 核准事件建立可追溯決策紀錄", async () => {
  const root = await fixtureRoot();
  const threadsPath = "records/content/threads/2026-08-03-topic-v01.md";
  const threadsContent = "# Threads 草稿｜測試\n\n- 日期：2026-08-03\n- 狀態：待核准\n";
  await mkdir(path.join(root, "records/content/threads"), { recursive: true });
  await writeFile(path.join(root, threadsPath), threadsContent);
  const client: ApprovalSyncClient = {
    fetchPending: async () => [event({
      eventId: "threads-event-1",
      artifactId: threadsPath,
      artifactType: "Threads",
      artifactHash: artifactContentHash(threadsContent),
    })],
    acknowledge: async () => {},
  };

  const manifestPath = await fetchAndMaterialize(client, {
    root,
    now: new Date("2026-08-03T02:00:00.000Z"),
  });
  assert.ok(manifestPath);
  const decision = await readFile(
    path.join(root, "records/decisions/2026-08-03-approve-threads-2026-08-03-v01.md"),
    "utf8",
  );
  assert.match(decision, /核准 Threads/);
  assert.match(decision, /僅限 records\/content\/threads\/2026-08-03-topic-v01\.md v01/);
});

test("acknowledge 只在 manifest 對應決策已提交後送出", async () => {
  const root = await fixtureRoot();
  const manifestPath = path.join(root, ".approval-sync/manifest.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({
      eventIds: ["event-1"],
      decisionPaths: ["records/decisions/decision.md"],
      createdAt: "2026-08-03T02:00:00.000Z",
    }),
  );
  const calls: unknown[] = [];
  const client: ApprovalSyncClient = {
    fetchPending: async () => [],
    acknowledge: async (eventIds, syncedAt) => {
      calls.push({ eventIds, syncedAt });
    },
  };

  await assert.rejects(
    acknowledgeManifest(client, manifestPath, {
      root,
      now: new Date("2026-08-03T03:00:00.000Z"),
      verifyCommitted: async () => false,
    }),
    /尚未提交/,
  );
  assert.deepEqual(calls, []);

  await acknowledgeManifest(client, manifestPath, {
    root,
    now: new Date("2026-08-03T03:00:00.000Z"),
    verifyCommitted: async () => true,
  });
  assert.deepEqual(calls, [
    { eventIds: ["event-1"], syncedAt: "2026-08-03T03:00:00.000Z" },
  ]);
});
