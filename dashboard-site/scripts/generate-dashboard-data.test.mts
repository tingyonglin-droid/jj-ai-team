import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { generateDashboardSnapshot } from "./generate-dashboard-data.mts";

const roles = [
  ["commander", "總司令"],
  ["macro-researcher", "總經研究員"],
  ["social-operator", "社群經營員"],
  ["app-designer", "App 設計員"],
] as const;

async function writeFixture(root: string, relativePath: string, content: string) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

test("uses the newest pending brief as a traceable approval without inventing missing market risk", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "dashboard-snapshot-"));

  try {
    await Promise.all(
      roles.map(([id, name]) =>
        writeFixture(root, `roles/${id}/ROLE.md`, `# ${name}\n\n## 使命\n\n測試角色。\n`),
      ),
    );
    await writeFixture(
      root,
      "workflows/README.md",
      "| 工作流 | 節奏 | 主責 | 主要成果 |\n|---|---|---|---|\n| 每日投資晨報 | 平日 | 總經研究員 | 晨報 |\n",
    );
    await writeFixture(
      root,
      "records/daily-briefs/2026-07-29-v01.md",
      "# 每日投資晨報｜舊版\n\n- 狀態：已完成\n- 資料截止：2026-07-29 12:00（Asia/Taipei，UTC+8）\n\n## 一分鐘摘要\n\n- 舊摘要。\n",
    );
    await writeFixture(
      root,
      "records/daily-briefs/2026-07-30-v01.md",
      "# 每日投資晨報｜新版\n\n- 狀態：待核准\n- 資料截止：2026-07-30 12:13（Asia/Taipei，UTC+8）\n\n## 一分鐘摘要\n\n- 新版摘要。\n- 第二項摘要。\n\n## 人工核准\n\n- 待核准事項：確認晨報範圍。\n",
    );

    const snapshot = await generateDashboardSnapshot(root, new Date("2026-07-30T04:30:00.000Z"));

    assert.equal(snapshot.generatedAt, "2026-07-30T04:30:00.000Z");
    assert.equal(snapshot.approvals[0].status, "待核准");
    assert.equal(snapshot.approvals[0].source, "records/daily-briefs/2026-07-30-v01.md");
    assert.equal(snapshot.brief?.source, "records/daily-briefs/2026-07-30-v01.md");
    assert.equal(snapshot.brief?.summary, "新版摘要。 第二項摘要。");
    assert.equal(snapshot.marketRisk, null);
    assert.equal(snapshot.employees.length, 4);
    assert.match(snapshot.blockers[0].reason, /尚未產出|資料/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("does not turn an unsupported record status into an unstarted task", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "dashboard-snapshot-"));

  try {
    await writeFixture(
      root,
      "records/reviews/2026-07-30-review.md",
      "# 已核准復盤\n\n- 狀態：已核准\n",
    );

    const snapshot = await generateDashboardSnapshot(root, new Date("2026-07-30T04:30:00.000Z"));

    assert.deepEqual(snapshot.tasks, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
