import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import type { DashboardBriefDocument, DashboardSnapshot } from "../lib/dashboard-types";
import {
  ApprovalCenter,
  EmployeeDirectory,
  TodayOverview,
} from "./dashboard-components";

const snapshot = JSON.parse(
  readFileSync(new URL("../data/dashboard.json", import.meta.url), "utf8"),
) as DashboardSnapshot;

test("今日總覽優先呈現需決定事項，並排除未核准行動", () => {
  const todayHtml = renderToStaticMarkup(<TodayOverview snapshot={snapshot} />);

  assert.match(todayHtml, /<h1[^>]*>今日總覽<\/h1>/);
  assert.match(todayHtml, /需要你決定/);
  assert.match(todayHtml, /員工動態/);
  assert.match(todayHtml, /尚未產出/);
  assert.match(todayHtml, /主責角色/);
  assert.match(todayHtml, /依賴/);
  assert.match(todayHtml, /來源：/);
  assert.match(todayHtml, /更新時間：/);
  assert.doesNotMatch(todayHtml, /一鍵發布|買進|賣出/);
});

test("今日總覽呈現可解釋的實驗性風險指標與三種期限", () => {
  const riskSnapshot: DashboardSnapshot = {
    ...snapshot,
    marketRisk: {
      label: "市場風險報告｜2026-07-30-v01",
      freshness: "今日",
      artifactStatus: "待核准",
      rawStatus: "待核准",
      score: 65,
      baseline: 55,
      eventAdjustment: 10,
      dailyChange: null,
      immediateRisk: "1–3 個交易日留意能源衝擊",
      structuralRisk: "1–2 季留意資本支出回報",
      topRisks: ["能源衝擊", "長端利率", "市場廣度"],
      confidence: 72,
      completeness: 82,
      experimental: true,
      source: "records/market-risk/2026-07-30-v01.md",
      asOf: "2026-07-30 17:30（Asia/Taipei，UTC+8）",
      updatedAt: "2026-07-30T09:30:00.000Z",
      dependencies: ["records/daily-briefs/2026-07-30-v02.md"],
    },
  };

  const todayHtml = renderToStaticMarkup(<TodayOverview snapshot={riskSnapshot} />);

  assert.match(todayHtml, /實驗性指標/);
  assert.match(todayHtml, /1–4 週風險/);
  assert.match(todayHtml, /65/);
  assert.match(todayHtml, /基準分/);
  assert.match(todayHtml, /事件調整/);
  assert.match(todayHtml, /即時風險/);
  assert.match(todayHtml, /結構性風險/);
  assert.match(todayHtml, /資料完整度[\s\S]*82%/);
  assert.match(todayHtml, /AI 信心[\s\S]*72%/);
  assert.match(todayHtml, /records\/market-risk\/2026-07-30-v01.md/);
});

test("AI 員工頁呈現任務進度與依賴交接資訊", () => {
  const employeeHtml = renderToStaticMarkup(
    <EmployeeDirectory employees={snapshot.employees} />,
  );

  assert.match(employeeHtml, /依賴與交接/);
  assert.match(employeeHtml, /目前任務/);
  assert.match(employeeHtml, /下一步/);
  assert.match(employeeHtml, /成果狀態/);
  assert.match(employeeHtml, /資料代表時間/);
  assert.match(employeeHtml, /來源/);
});

test("待核准中心只呈現真實待決定事項", () => {
  const approvalHtml = renderToStaticMarkup(
    <ApprovalCenter approvals={snapshot.approvals} />,
  );

  assert.match(approvalHtml, /待你決定/);
  assert.match(approvalHtml, /成果類型：晨報/);
  assert.match(approvalHtml, /records\/daily-briefs\/2026-07-30-v02.md/);
  assert.match(approvalHtml, /紀錄日期：2026-07-30/);
  assert.doesNotMatch(approvalHtml, /生效日期/);
  assert.doesNotMatch(approvalHtml, /建立時間：2026-07-30T00:00:00\+08:00/);
  assert.match(approvalHtml, /資料代表時間/);
  assert.match(approvalHtml, /負責角色：總經研究員/);
  assert.match(approvalHtml, /成果類型：Threads/);
  assert.match(approvalHtml, /成果類型：IG/);
  assert.match(approvalHtml, /成果類型：風險方法/);
  assert.match(approvalHtml, /成果類型：App 規格/);
  assert.match(approvalHtml, /此類型目前沒有待核准成果/);
});

test("首頁晨報卡提供對應日期的全文入口", () => {
  const document: DashboardBriefDocument = {
    id: snapshot.brief?.source ?? "records/daily-briefs/2026-07-30-v02.md",
    date: "2026-07-30",
    version: 2,
    versionLabel: "v02",
    isLatest: true,
    title: snapshot.brief?.title ?? "晨報",
    summary: snapshot.brief?.summary ?? "摘要",
    freshness: snapshot.brief?.freshness ?? "過期",
    artifactStatus: snapshot.brief?.artifactStatus ?? "待核准",
    rawStatus: snapshot.brief?.rawStatus ?? "待核准",
    source: snapshot.brief?.source ?? "records/daily-briefs/2026-07-30-v02.md",
    asOf: snapshot.brief?.asOf ?? "2026-07-30 07:00（Asia/Taipei，UTC+8）",
    updatedAt: snapshot.brief?.updatedAt ?? "2026-07-30T00:00:00.000Z",
    dependencies: snapshot.brief?.dependencies ?? [],
    blocks: [],
  };
  const html = renderToStaticMarkup(
    <TodayOverview snapshot={{ ...snapshot, briefArchive: [document] }} />,
  );

  assert.match(html, /href="\/briefs\/2026-07-30"/);
  assert.match(html, />查看全文</);
});

test("待核准中心只有晨報項目提供全文入口", () => {
  const html = renderToStaticMarkup(<ApprovalCenter approvals={snapshot.approvals} />);

  assert.match(html, /href="\/briefs\/2026-07-30"/);
  assert.equal((html.match(/>查看全文</g) ?? []).length, 1);
});
