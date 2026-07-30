import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import type { DashboardSnapshot } from "../lib/dashboard-types";
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
  assert.doesNotMatch(todayHtml, /一鍵發布|買進|賣出/);
});

test("AI 員工頁呈現任務進度與依賴交接資訊", () => {
  const employeeHtml = renderToStaticMarkup(
    <EmployeeDirectory employees={snapshot.employees} />,
  );

  assert.match(employeeHtml, /依賴與交接/);
  assert.match(employeeHtml, /目前任務/);
  assert.match(employeeHtml, /下一步/);
});

test("待核准中心只呈現真實待決定事項", () => {
  const approvalHtml = renderToStaticMarkup(
    <ApprovalCenter approvals={snapshot.approvals} />,
  );

  assert.match(approvalHtml, /待你決定/);
  assert.match(approvalHtml, /每日投資晨報/);
});
