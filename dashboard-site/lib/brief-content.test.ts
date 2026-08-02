import assert from "node:assert/strict";
import test from "node:test";

import {
  parseBriefMarkdown,
  selectBriefVersion,
  versionsForDate,
} from "./brief-content";
import type { DashboardBriefDocument } from "./dashboard-types";

test("把晨報 Markdown 解析為安全的結構化區塊", () => {
  const blocks = parseBriefMarkdown(`# 主標題

## 一分鐘摘要

- **風險上升**但仍需確認

| 指標 | 數值 |
|---|---:|
| 風險 | 65 |

[Fed](https://www.federalreserve.gov/) <script>alert(1)</script>`);

  assert.deepEqual(blocks[0], {
    type: "heading",
    level: 2,
    content: [{ type: "text", text: "一分鐘摘要" }],
  });
  assert.equal(blocks.some((block) => block.type === "list"), true);
  assert.equal(blocks.some((block) => block.type === "table"), true);
  assert.equal(JSON.stringify(blocks).includes("https://www.federalreserve.gov/"), true);
  assert.equal(JSON.stringify(blocks).includes("<script>"), true);
});

test("不把非 http 連結建立成可點擊節點", () => {
  const blocks = parseBriefMarkdown("[危險](javascript:alert(1))");
  assert.equal(JSON.stringify(blocks).includes('\"type\":\"link\"'), false);
});

test("依版本標籤選取指定晨報，否則選取最新版本", () => {
  const documents = [
    makeDocument({ version: 1, versionLabel: "v1", isLatest: false }),
    makeDocument({ version: 2, versionLabel: "v2", isLatest: true }),
  ];

  assert.equal(selectBriefVersion(documents, "2026-08-02"), documents[1]);
  assert.equal(selectBriefVersion(documents, "2026-08-02", "v1"), documents[0]);
  assert.equal(selectBriefVersion(documents, "2026-08-02", "missing"), null);
});

test("依日期回傳版本由新到舊的晨報", () => {
  const documents = [
    makeDocument({ version: 1, versionLabel: "v1", isLatest: false }),
    makeDocument({ version: 3, versionLabel: "v3", isLatest: true }),
    makeDocument({ date: "2026-08-01", version: 2, versionLabel: "v2", isLatest: true }),
  ];

  assert.deepEqual(
    versionsForDate(documents, "2026-08-02").map((document) => document.version),
    [3, 1],
  );
});

function makeDocument(
  overrides: Partial<DashboardBriefDocument>,
): DashboardBriefDocument {
  return {
    id: "brief-2026-08-02-v1",
    date: "2026-08-02",
    version: 1,
    versionLabel: "v1",
    isLatest: false,
    title: "晨報",
    summary: "摘要",
    freshness: "今日",
    artifactStatus: "草稿",
    rawStatus: "草稿",
    blocks: [],
    source: "test",
    asOf: "2026-08-02",
    updatedAt: "2026-08-02T00:00:00Z",
    dependencies: [],
    ...overrides,
  };
}
