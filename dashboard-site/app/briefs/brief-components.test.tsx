import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { DashboardBriefDocument } from "../../lib/dashboard-types";
import { BriefArchive, BriefNotFound, BriefReader } from "./brief-components";

const documents: DashboardBriefDocument[] = [
  {
    id: "records/daily-briefs/2026-07-30-v02.md",
    date: "2026-07-30",
    version: 2,
    versionLabel: "v02",
    isLatest: true,
    title: "7 月 30 日晨報定稿",
    summary: "定稿摘要",
    freshness: "待更新",
    artifactStatus: "待核准",
    rawStatus: "待核准",
    artifactHash: "sha256:brief-v02",
    coveredSessionDate: "2026-07-29",
    source: "records/daily-briefs/2026-07-30-v02.md",
    asOf: "2026-07-30 08:00（Asia/Taipei，UTC+8）",
    updatedAt: "2026-07-30T01:00:00.000Z",
    dependencies: [],
    blocks: [
      {
        type: "heading",
        level: 2,
        content: [{ type: "text", text: "市場焦點" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "確認 " },
          { type: "strong", text: "原始資料" },
          { type: "text", text: " 與 " },
          { type: "code", text: "風險情境" },
          { type: "text", text: "，參考 " },
          { type: "link", text: "官方來源", href: "https://example.com/source" },
          { type: "text", text: "。" },
        ],
      },
      {
        type: "list",
        ordered: false,
        items: [[{ type: "text", text: "反方證據仍待確認" }]],
      },
      {
        type: "table",
        headers: [[{ type: "text", text: "指標" }], [{ type: "text", text: "狀態" }]],
        rows: [
          [[{ type: "text", text: "市場廣度" }], [{ type: "text", text: "觀察" }]],
        ],
      },
    ],
  },
  {
    id: "records/daily-briefs/2026-07-30-v01.md",
    date: "2026-07-30",
    version: 1,
    versionLabel: "v01",
    isLatest: false,
    title: "7 月 30 日晨報初稿",
    summary: "初稿摘要",
    freshness: "歷史版本",
    artifactStatus: "草稿",
    rawStatus: "草稿",
    artifactHash: "sha256:brief-v01",
    coveredSessionDate: "2026-07-29",
    source: "records/daily-briefs/2026-07-30-v01.md",
    asOf: "2026-07-30 07:00（Asia/Taipei，UTC+8）",
    updatedAt: "2026-07-30T00:00:00.000Z",
    dependencies: [],
    blocks: [],
  },
  {
    id: "records/daily-briefs/2026-07-29-v02.md",
    date: "2026-07-29",
    version: 2,
    versionLabel: "v02",
    isLatest: true,
    title: "7 月 29 日晨報",
    summary: "前一日摘要",
    freshness: "歷史版本",
    artifactStatus: "已核准",
    rawStatus: "已核准",
    artifactHash: "sha256:brief-previous",
    coveredSessionDate: "2026-07-28",
    source: "records/daily-briefs/2026-07-29-v02.md",
    asOf: "2026-07-29 08:00（Asia/Taipei，UTC+8）",
    updatedAt: "2026-07-29T01:00:00.000Z",
    dependencies: [],
    blocks: [],
  },
];

test("晨報歷史僅列出各日期最新版並提供全文入口", () => {
  const html = renderToStaticMarkup(<BriefArchive documents={documents} />);

  assert.match(html, /晨報歷史/);
  assert.match(html, /2026-07-30/);
  assert.match(html, /2026-07-29/);
  assert.match(html, /href="\/briefs\/2026-07-30"/);
  assert.equal((html.match(/2026-07-30/g) ?? []).length >= 1, true);
  assert.doesNotMatch(html, />v01</);
});

test("完整晨報安全渲染結構化內容並提供版本切換", () => {
  const html = renderToStaticMarkup(
    <BriefReader document={documents[0]} versions={documents.slice(0, 2)} />,
  );

  assert.match(html, /完整晨報/);
  assert.match(html, /目前版本：v02/);
  assert.match(html, /href="\/briefs\/2026-07-30\?version=v01"/);
  assert.match(html, /<table/);
  assert.match(html, /rel="noreferrer"/);
  assert.doesNotMatch(html, /dangerouslySetInnerHTML/);
});

test("找不到晨報時只顯示要求的日期與版本", () => {
  const html = renderToStaticMarkup(
    <BriefNotFound date="2026-07-31" version="v99" />,
  );

  assert.match(html, /2026-07-31/);
  assert.match(html, /v99/);
  assert.doesNotMatch(html, /7 月 30 日晨報|定稿摘要|records\/daily-briefs/);
});
