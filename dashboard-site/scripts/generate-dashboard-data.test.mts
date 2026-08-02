import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { generateDashboardSnapshot, sourceUpdatedAt } from "./generate-dashboard-data.mts";

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

async function writeRoles(root: string) {
  await Promise.all(
    roles.map(([id, name]) =>
      writeFixture(
        root,
        `roles/${id}/ROLE.md`,
        `# ${name}\n\n## 使命\n\n測試角色。\n\n## 交接對象\n\n向總司令交接。\n`,
      ),
    ),
  );
}

function brief({
  title = "每日投資晨報｜2026-07-30",
  status = "待核准",
  cutoff = "2026-07-30 12:13（Asia/Taipei，UTC+8）",
  includeExternalView = true,
}: {
  title?: string;
  status?: string;
  cutoff?: string;
  includeExternalView?: boolean;
} = {}) {
  return `# ${title}

- 狀態：${status}
- 資料截止：${cutoff}
- 依賴：美國官方經濟資料、市場風險紀錄

## 一分鐘摘要

- 可追溯摘要。

## 已確認事實

- 測試事實。

## AI 推論與初步判斷

- 測試推論。

${includeExternalView ? "## 外部觀點比較\n\n- 測試觀點。\n" : ""}
## 最終判斷與反方證據

- 測試反證。

## 尚未確認與待觀察

- 測試缺口。

## 人工核准

- 待核准事項：確認晨報範圍。
`;
}

function threads(status = "待核准") {
  return `# Threads 草稿｜可追溯主題

- 日期：2026-07-30
- 狀態：${status}
- 來源研究：records/daily-briefs/2026-07-30-v01.md

## 主版本

內文。

## 查核與語氣

- 事實與來源：已列出。

## 核准

- 最終文字與發布由使用者決定：等待使用者決定。
`;
}

function instagram(status = "待核准") {
  return `# IG 輪播｜可追溯主題

- 日期：2026-07-30
- 狀態：${status}

## 逐頁腳本

| 頁次 | 文案 |
|---:|---|
| 1 | 封面 |

## 圖說與核准

- 核准紀錄：等待使用者決定。
`;
}

function riskMethod(status = "待核准") {
  return `# 市場風險方法｜權重檢視

- 日期：2026-07-30
- 狀態：${status}

## 方法變更

- 本次只是待審規格。

## 證據與限制

- 未取得新資料。

## 核准

- 待核准事項：是否採用新權重。
`;
}

function marketRisk(status = "待核准") {
  return `# 市場風險報告｜2026-07-30-v01

- 狀態：${status}
- 資料截止：2026-07-30 17:30（Asia/Taipei，UTC+8）
- 方法版本：v2.0
- 影子運行：實驗性指標／第 1 個交易日
- 觀察期：主分數為 1–4 週

## 總覽

- 市場風險分數：65
- 基準分：55
- 事件調整：+10
- 單日變動：尚無前值
- 5 日趨勢：尚無資料
- 20 日趨勢：尚無資料
- 風險狀態及趨勢：偏高；尚無趨勢
- 即時風險：1–3 個交易日留意能源衝擊
- 結構性風險：1–2 季留意資本支出回報
- 三項主要風險：能源衝擊、長端利率、市場廣度
- AI 判斷信心：72
- 資料完整度：82

## 子指標

| 子指標 | 權重 | 分數 | 趨勢 | 理由 | 來源 |
|---|---:|---:|---|---|---|
| 景氣與成長 | 20% | 45 | 持平 | 測試 | 官方來源 |
| 通膨與利率 | 20% | 75 | 上升 | 測試 | 官方來源 |
| 流動性 | 20% | 50 | 持平 | 測試 | 官方來源 |
| 信用 | 20% | 40 | 持平 | 測試 | 官方來源 |
| 市場結構 | 20% | 65 | 上升 | 測試 | 市場資料 |

## 事件調整

- 調整事件：能源衝擊

## 證據與限制

- 支持證據：官方來源。

## 核准

- 待核准事項：是否接受試跑內容。
`;
}

function appSpec(status = "待核准") {
  return `# App 功能規格｜範例

- 狀態：${status}
- 文件日期與版本：2026-07-30、v01
- 負責人：App 設計員
- 依賴與待確認：產品決策

## 問題與證據

- 已列出。

## 用戶故事與價值

- 已列出。

## 範圍與非目標

- 已列出。

## 畫面流程與狀態

1. 進入畫面。

## 資料與成功指標

- 已列出。

## 風險、依賴與核准

- 上線決策：必須由使用者決定。
`;
}

test("更新時間優先使用來源紀錄，再使用 Git 並且不臆造精度", () => {
  assert.equal(
    sourceUpdatedAt(
      "- 產製時間：2026-08-02 21:35（Asia/Taipei；人工回溯試跑）",
      "records/daily-briefs/2026-07-30-v02.md",
      "2026-08-02T14:00:00+08:00",
    ),
    "2026-08-02 21:35（Asia/Taipei；人工回溯試跑）",
  );
  assert.equal(
    sourceUpdatedAt(
      "# 沒有明示更新時間",
      "records/daily-briefs/2026-07-30-v01.md",
      "2026-08-02T14:00:00+08:00",
    ),
    "2026-08-02T14:00:00+08:00",
  );
  assert.equal(
    sourceUpdatedAt("# 測試夾記錄", "records/daily-briefs/2026-07-30-v01.md", null),
    "2026-07-30",
  );
  assert.equal(sourceUpdatedAt("# 測試角色", "roles/test/ROLE.md", null), "來源未提供更新時間");
});

test("用台北日期產生可追溯的任務、員工、摘要與核准欄位", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "dashboard-snapshot-"));

  try {
    await writeRoles(root);
    await writeFixture(root, "records/daily-briefs/2026-07-30-v01.md", brief());

    const snapshot = await generateDashboardSnapshot(root, new Date("2026-07-29T16:30:00.000Z"));
    const approval = snapshot.approvals[0];
    const task = snapshot.tasks.find((item) => item.owner === "總經研究員");
    const employee = snapshot.employees.find((item) => item.id === "macro-researcher");

    assert.equal(snapshot.date, "2026-07-30");
    assert.equal(approval.type, "晨報");
    assert.equal(approval.owner, "總經研究員");
    assert.equal(approval.createdAt, null);
    assert.equal(approval.recordDate, "2026-07-30");
    assert.equal("effectiveDate" in approval, false);
    assert.equal(approval.asOf, "2026-07-30 12:13（Asia/Taipei，UTC+8）");
    assert.equal(approval.updatedAt, "2026-07-30");
    assert.deepEqual(approval.dependencies, ["美國官方經濟資料", "市場風險紀錄"]);
    assert.equal(task?.source, "records/daily-briefs/2026-07-30-v01.md");
    assert.equal(task?.asOf, approval.asOf);
    assert.equal(task?.updatedAt, approval.updatedAt);
    assert.deepEqual(task?.dependencies, approval.dependencies);
    assert.equal(employee?.source, task?.source);
    assert.equal(employee?.asOf, task?.asOf);
    assert.equal(employee?.updatedAt, task?.updatedAt);
    assert.equal(snapshot.brief?.source, task?.source);
    assert.equal(snapshot.brief?.updatedAt, task?.updatedAt);
    assert.deepEqual(snapshot.brief?.dependencies, task?.dependencies);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("保留原始成果狀態並映射全部政策狀態為工作狀態", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "dashboard-snapshot-"));
  const cases = [
    ["草稿", "進行中"],
    ["待核准", "待核准"],
    ["已核准", "已完成"],
    ["退回修訂", "進行中"],
    ["已核准並執行（2026-07-30）", "已完成"],
  ] as const;

  try {
    await Promise.all(
      cases.map(([status], index) =>
        writeFixture(
          root,
          `records/content/threads/2026-07-30-status-${index + 1}-v01.md`,
          threads(status),
        ),
      ),
    );

    const snapshot = await generateDashboardSnapshot(root, new Date("2026-07-30T04:30:00.000Z"));

    assert.equal(snapshot.tasks.length, cases.length);
    for (const [status, workStatus] of cases) {
      const task = snapshot.tasks.find((item) => item.rawStatus === status);
      assert.equal(task?.status, workStatus, status);
      assert.equal(task?.rawStatus, status);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("五類成果使用正式來源與中文 owner，舊 v01 待核准會被 v02 取代", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "dashboard-snapshot-"));

  try {
    await writeFixture(root, "records/daily-briefs/2026-07-30-v01.md", brief());
    await writeFixture(
      root,
      "records/daily-briefs/2026-07-30-v02.md",
      brief({ title: "每日投資晨報｜2026-07-30 v02" }),
    );
    await writeFixture(root, "records/content/threads/2026-07-30-topic-v01.md", threads());
    await writeFixture(root, "records/content/threads/2026-07-30-topic-v02.md", threads("已核准"));
    await writeFixture(root, "records/content/instagram/2026-07-30-topic-v01.md", instagram());
    await writeFixture(root, "records/market-risk-methods/2026-07-30-weights-v01.md", riskMethod());
    await writeFixture(root, "records/app-specs/2026-07-30-feature-v01.md", appSpec());

    const snapshot = await generateDashboardSnapshot(root, new Date("2026-07-30T04:30:00.000Z"));

    assert.deepEqual(
      snapshot.approvals.map((approval) => [approval.type, approval.owner]).sort(),
      [
        ["App 規格", "App 設計員"],
        ["IG", "社群經營員"],
        ["晨報", "總經研究員"],
        ["風險方法", "總經研究員"],
      ].sort(),
    );
    assert.equal(
      snapshot.approvals.some(
        (approval) => approval.source === "records/content/threads/2026-07-30-topic-v01.md",
      ),
      false,
    );
    assert.equal(
      snapshot.tasks.some(
        (task) => task.source === "records/content/threads/2026-07-30-topic-v01.md",
      ),
      false,
    );
    assert.equal(
      snapshot.tasks.find((task) => task.source.endsWith("topic-v02.md"))?.rawStatus,
      "已核准",
    );
    assert.equal(snapshot.brief?.source, "records/daily-briefs/2026-07-30-v02.md");
    assert.equal(snapshot.approvals.filter((approval) => approval.type === "晨報").length, 1);
    assert.equal(
      snapshot.approvals.find((approval) => approval.type === "晨報")?.source,
      "records/daily-briefs/2026-07-30-v02.md",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("晨報 archive 保留同日有效版本、標示最新版並略過壞格式版本", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "dashboard-snapshot-"));

  try {
    await writeFixture(root, "records/daily-briefs/2026-07-30-v01.md", brief());
    await writeFixture(
      root,
      "records/daily-briefs/2026-07-30-v02.md",
      `${brief({ title: "每日投資晨報｜2026-07-30 v02" })}
| 指標 | 數值 |
|---|---:|
| 測試 | 1 |
`,
    );
    await writeFixture(
      root,
      "records/daily-briefs/2026-07-30-v03.md",
      brief({ title: "每日投資晨報｜2026-07-30 v03", includeExternalView: false }),
    );

    const snapshot = await generateDashboardSnapshot(root, new Date("2026-07-30T04:30:00.000Z"));

    assert.deepEqual(
      snapshot.briefArchive.map(({ date, versionLabel, isLatest }) => ({ date, versionLabel, isLatest })),
      [
        { date: "2026-07-30", versionLabel: "v02", isLatest: true },
        { date: "2026-07-30", versionLabel: "v01", isLatest: false },
      ],
    );
    assert.equal(
      snapshot.blockers.some((blocker) => blocker.source?.endsWith("2026-07-30-v03.md")),
      true,
    );
    assert.equal(snapshot.briefArchive[0]?.blocks.some((block) => block.type === "table"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("晨報 archive 依日期與版本降冪排列", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "dashboard-snapshot-"));

  try {
    await writeFixture(root, "records/daily-briefs/2026-07-30-v01.md", brief());
    await writeFixture(
      root,
      "records/daily-briefs/2026-07-30-v02.md",
      brief({ title: "每日投資晨報｜2026-07-30 v02" }),
    );
    await writeFixture(
      root,
      "records/daily-briefs/2026-07-31-v01.md",
      brief({
        title: "每日投資晨報｜2026-07-31",
        cutoff: "2026-07-31 12:13（Asia/Taipei，UTC+8）",
      }),
    );

    const snapshot = await generateDashboardSnapshot(root, new Date("2026-07-31T04:30:00.000Z"));

    assert.deepEqual(
      snapshot.briefArchive.map(({ date, versionLabel, isLatest }) => ({ date, versionLabel, isLatest })),
      [
        { date: "2026-07-31", versionLabel: "v01", isLatest: true },
        { date: "2026-07-30", versionLabel: "v02", isLatest: true },
        { date: "2026-07-30", versionLabel: "v01", isLatest: false },
      ],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("市場風險紀錄解析可重現的風險優先欄位", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "dashboard-snapshot-"));

  try {
    await writeFixture(root, "records/market-risk/2026-07-30-v01.md", marketRisk());

    const snapshot = await generateDashboardSnapshot(root, new Date("2026-07-30T04:30:00.000Z"));

    assert.equal(snapshot.marketRisk?.score, 65);
    assert.equal(snapshot.marketRisk?.baseline, 55);
    assert.equal(snapshot.marketRisk?.eventAdjustment, 10);
    assert.equal(snapshot.marketRisk?.dailyChange, null);
    assert.equal(snapshot.marketRisk?.experimental, true);
    assert.equal(snapshot.marketRisk?.confidence, 72);
    assert.equal(snapshot.marketRisk?.completeness, 82);
    assert.equal(snapshot.marketRisk?.immediateRisk, "1–3 個交易日留意能源衝擊");
    assert.equal(snapshot.marketRisk?.structuralRisk, "1–2 季留意資本支出回報");
    assert.deepEqual(snapshot.marketRisk?.topRisks, ["能源衝擊", "長端利率", "市場廣度"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("過期有效摘要會明示最後有效時間，不會冒充今日", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "dashboard-snapshot-"));

  try {
    await writeFixture(
      root,
      "records/daily-briefs/2026-07-29-v01.md",
      brief({
        title: "每日投資晨報｜2026-07-29",
        status: "已核准",
        cutoff: "2026-07-29 12:00（Asia/Taipei，UTC+8）",
      }),
    );

    const snapshot = await generateDashboardSnapshot(root, new Date("2026-07-30T04:30:00.000Z"));

    assert.equal(snapshot.brief?.freshness, "過期");
    assert.equal(snapshot.brief?.asOf, "2026-07-29 12:00（Asia/Taipei，UTC+8）");
    assert.equal(snapshot.tasks.length, 0);
    assert.equal(snapshot.blockers.some((issue) => issue.kind === "stale" && issue.severity === "warning"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("壞格式、缺必要章節與來源衝突會成為可追溯 blocker", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "dashboard-snapshot-"));

  try {
    await writeFixture(
      root,
      "records/daily-briefs/2026-07-30-v01.md",
      brief({ includeExternalView: false }),
    );
    await writeFixture(
      root,
      "records/content/threads/2026-07-30-conflict-v01.md",
      `${threads("待核准")}\n- 狀態：已核准\n`,
    );
    await writeFixture(
      root,
      "records/app-specs/2026-07-30-malformed-v01.md",
      "# App 功能規格｜壞格式\n\n## 問題與證據\n\n- 沒有狀態與日期。\n",
    );
    await writeFixture(
      root,
      "records/content/threads/2026-07-30-unknown-status-v01.md",
      threads("不明狀態"),
    );

    const snapshot = await generateDashboardSnapshot(root, new Date("2026-07-30T04:30:00.000Z"));

    assert.equal(snapshot.brief, null);
    assert.equal(snapshot.tasks.length, 0);
    assert.equal(snapshot.blockers.some((issue) => issue.kind === "missing" && /外部觀點比較/.test(issue.reason)), true);
    assert.equal(snapshot.blockers.some((issue) => issue.kind === "malformed" && issue.source?.includes("unknown-status")), true);
    assert.equal(snapshot.blockers.some((issue) => issue.kind === "conflict" && issue.source?.includes("conflict")), true);
    assert.equal(snapshot.blockers.some((issue) => issue.kind === "missing" && issue.source?.includes("malformed")), true);
    assert.equal(snapshot.blockers.every((issue) => "updatedAt" in issue && "source" in issue), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("員工狀態由最新有效工作決定，現有復盤與生效決策不會被忽略", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "dashboard-snapshot-"));

  try {
    await writeRoles(root);
    await writeFixture(
      root,
      "records/reviews/2026-07-30-threads-review.md",
      "# Threads 復盤\n\n- 整理日期：2026-07-30\n- 狀態：已核准並執行（2026-07-30）\n\n## 摘要\n\n- 已完成。\n",
    );
    await writeFixture(
      root,
      "records/decisions/2026-07-30-dashboard-decision.md",
      "# Dashboard 決策\n\n- 決策日期：2026-07-30\n- 決策者：使用者\n- 決定：採用。\n- 生效日：2026-07-30\n",
    );

    const snapshot = await generateDashboardSnapshot(root, new Date("2026-07-30T04:30:00.000Z"));
    const social = snapshot.employees.find((employee) => employee.id === "social-operator");
    const commander = snapshot.employees.find((employee) => employee.id === "commander");

    assert.equal(social?.status, "已完成");
    assert.equal(social?.rawStatus, "已核准並執行（2026-07-30）");
    assert.equal(social?.source, "records/reviews/2026-07-30-threads-review.md");
    assert.equal(commander?.status, "已完成");
    assert.equal(commander?.rawStatus, null);
    assert.equal(commander?.artifactStatus, "已核准");
    assert.equal(commander?.source, "records/decisions/2026-07-30-dashboard-decision.md");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
