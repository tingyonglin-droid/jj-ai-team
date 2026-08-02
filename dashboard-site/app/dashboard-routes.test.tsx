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
  const todayHtml = renderToStaticMarkup(
    <TodayOverview
      snapshot={{
        ...snapshot,
        tasks: [
          {
            id: "records/daily-briefs/2026-07-31-v01.md",
            title: "每日投資晨報｜2026-07-31",
            owner: "總經研究員",
            ownerId: "macro-researcher",
            status: "待核准",
            artifactStatus: "待核准",
            rawStatus: "待核准",
            nextStep: "等待使用者核准",
            source: "records/daily-briefs/2026-07-31-v01.md",
            asOf: "2026-07-31 07:10（Asia/Taipei，UTC+8）",
            updatedAt: "2026-07-31T00:00:00.000Z",
            dependencies: ["workflows/daily-brief.md"],
          },
        ],
      }}
    />,
  );

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
      freshness: "最新",
      artifactStatus: "待核准",
      rawStatus: "待核准",
      version: 1,
      artifactHash: "sha256:risk-v01",
      coveredSessionDate: "2026-07-29",
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

test("資料狀態分開呈現正常沿用、提醒與真正阻擋", () => {
  const statusSnapshot: DashboardSnapshot = {
    ...snapshot,
    expectation: {
      dashboardDate: "2026-08-02",
      expectedReportDate: "2026-07-31",
      coveredSessionDate: "2026-07-30",
      phase: "carry_forward",
      reason: "週末不產生例行晨報，沿用最近一個應有報告日。",
    },
    brief: snapshot.brief
      ? {
          ...snapshot.brief,
          freshness: "沿用最近交易日",
          coveredSessionDate: "2026-07-30",
        }
      : null,
    blockers: [
      {
        severity: "warning",
        kind: "pending_update",
        title: "晨報待更新",
        reason: "目前應有報告尚未完成。",
        nextStep: "完成晨報。",
        source: "records/daily-briefs/2026-07-31-v01.md",
        asOf: "2026-07-31 07:10（Asia/Taipei，UTC+8）",
        updatedAt: "2026-07-31",
      },
      {
        severity: "blocker",
        kind: "malformed",
        title: "風險分數無法重現",
        reason: "分數欄位缺失。",
        nextStep: "建立新版本。",
        source: "records/market-risk/2026-07-31-v01.md",
        asOf: "2026-07-31 07:10（Asia/Taipei，UTC+8）",
        updatedAt: "2026-07-31",
      },
    ],
  };

  const html = renderToStaticMarkup(<TodayOverview snapshot={statusSnapshot} />);

  assert.match(html, /資料狀態/);
  assert.match(html, /沿用最近交易日/);
  assert.match(html, /涵蓋美股交易時段：2026-07-30/);
  assert.match(html, /提醒/);
  assert.match(html, /阻擋/);
  assert.doesNotMatch(html, /受阻項目|已過期/);
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

test("待核准中心在成果全數核准後顯示空狀態", () => {
  const approvalHtml = renderToStaticMarkup(
    <ApprovalCenter approvals={[]} />,
  );

  assert.match(approvalHtml, /待你決定/);
  assert.match(approvalHtml, /目前沒有待核准事項/);
  assert.match(approvalHtml, /成果類型：晨報/);
  assert.doesNotMatch(approvalHtml, /records\/daily-briefs\//);
  assert.doesNotMatch(approvalHtml, /records\/market-risk\//);
  assert.doesNotMatch(approvalHtml, /<strong>待決定：<\/strong>/);
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
    freshness: snapshot.brief?.freshness ?? "待更新",
    artifactStatus: snapshot.brief?.artifactStatus ?? "待核准",
    rawStatus: snapshot.brief?.rawStatus ?? "待核准",
    artifactHash: snapshot.brief?.artifactHash ?? "sha256:brief-v02",
    coveredSessionDate: snapshot.brief?.coveredSessionDate ?? "2026-07-29",
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
  const pendingBrief: DashboardSnapshot["approvals"][number] = {
    id: "records/daily-briefs/2026-07-31-v01.md",
    title: "每日投資晨報｜2026-07-31",
    type: "晨報",
    owner: "總經研究員",
    status: "待核准",
    artifactStatus: "待核准",
    rawStatus: "待核准",
    summary: "測試待核准晨報。",
    decision: "是否核准晨報內容。",
    createdAt: null,
    recordDate: "2026-07-31",
    version: 1,
    artifactHash: "sha256:brief-v01",
    source: "records/daily-briefs/2026-07-31-v01.md",
    asOf: "2026-07-31 07:00（Asia/Taipei，UTC+8）",
    updatedAt: "2026-07-31",
    dependencies: [],
  };
  const html = renderToStaticMarkup(
    <ApprovalCenter approvals={[pendingBrief]} />,
  );

  assert.match(html, /href="\/briefs\/2026-07-31"/);
  assert.equal((html.match(/>查看全文</g) ?? []).length, 1);
});

test("首頁與待核准中心只替晨報及市場風險提供兩段式核准入口", () => {
  const pendingBrief: DashboardSnapshot["approvals"][number] = {
    id: "records/daily-briefs/2026-07-31-v01.md",
    title: "每日投資晨報｜2026-07-31",
    type: "晨報",
    owner: "總經研究員",
    status: "待核准",
    artifactStatus: "待核准",
    rawStatus: "待核准",
    summary: "晨報摘要。",
    decision: "是否核准晨報內容。",
    createdAt: null,
    recordDate: "2026-07-31",
    version: 1,
    artifactHash: "sha256:brief-v01",
    source: "records/daily-briefs/2026-07-31-v01.md",
    asOf: "2026-07-31 07:00（Asia/Taipei，UTC+8）",
    updatedAt: "2026-07-31",
    dependencies: [],
  };
  const pendingRisk: DashboardSnapshot["approvals"][number] = {
    ...pendingBrief,
    id: "records/market-risk/2026-07-31-v01.md",
    title: "市場風險報告｜2026-07-31",
    type: "市場風險報告",
    summary: "風險摘要。",
    decision: "是否核准風險指標。",
    artifactHash: "sha256:risk-v01",
    source: "records/market-risk/2026-07-31-v01.md",
  };
  const pendingThreads: DashboardSnapshot["approvals"][number] = {
    ...pendingBrief,
    id: "records/drafts/threads/2026-07-31-v01.md",
    title: "Threads 草稿",
    type: "Threads",
    summary: "社群草稿。",
    decision: "是否核准草稿。",
    artifactHash: "sha256:threads-v01",
    source: "records/drafts/threads/2026-07-31-v01.md",
  };
  const approvals = [pendingBrief, pendingRisk, pendingThreads];

  const overviewHtml = renderToStaticMarkup(
    <TodayOverview snapshot={{ ...snapshot, approvals }} />,
  );
  const centerHtml = renderToStaticMarkup(<ApprovalCenter approvals={approvals} />);

  assert.equal((overviewHtml.match(/>核准此版本</g) ?? []).length, 2);
  assert.equal((centerHtml.match(/>核准此版本</g) ?? []).length, 2);
  assert.doesNotMatch(centerHtml, /Threads 草稿[\s\S]*?核准此版本[\s\S]*?成果類型：IG/);
});
