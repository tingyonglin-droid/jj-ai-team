import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { DashboardBriefDocument } from "../../lib/dashboard-types";
import { BriefArchive } from "./brief-components";

const documents: DashboardBriefDocument[] = [
  {
    id: "records/daily-briefs/2026-07-30-v01.md",
    date: "2026-07-30",
    version: 1,
    versionLabel: "v01",
    isLatest: false,
    title: "7 月 30 日晨報初稿",
    summary: "初稿摘要",
    freshness: "過期",
    artifactStatus: "草稿",
    rawStatus: "草稿",
    source: "records/daily-briefs/2026-07-30-v01.md",
    asOf: "2026-07-30 07:00（Asia/Taipei，UTC+8）",
    updatedAt: "2026-07-30T00:00:00.000Z",
    dependencies: [],
    blocks: [],
  },
  {
    id: "records/daily-briefs/2026-07-30-v02.md",
    date: "2026-07-30",
    version: 2,
    versionLabel: "v02",
    isLatest: true,
    title: "7 月 30 日晨報定稿",
    summary: "定稿摘要",
    freshness: "過期",
    artifactStatus: "待核准",
    rawStatus: "待核准",
    source: "records/daily-briefs/2026-07-30-v02.md",
    asOf: "2026-07-30 08:00（Asia/Taipei，UTC+8）",
    updatedAt: "2026-07-30T01:00:00.000Z",
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
    freshness: "過期",
    artifactStatus: "已核准",
    rawStatus: "已核准",
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
