import assert from "node:assert/strict";
import test from "node:test";

import {
  loadMarketCalendar,
  resolveReportExpectation,
} from "./market-calendar.ts";

const calendar = loadMarketCalendar();

test("台灣週日沿用週五晨報", () => {
  const expectation = resolveReportExpectation(
    new Date("2026-08-02T01:00:00.000Z"),
    calendar,
  );

  assert.deepEqual(expectation, {
    dashboardDate: "2026-08-02",
    expectedReportDate: "2026-07-31",
    coveredSessionDate: "2026-07-30",
    phase: "carry_forward",
    reason: "週末不產生例行晨報，沿用最近一個應有報告日。",
  });
});

test("台灣週一交付門檻前沿用舊報，門檻後要求週一晨報", () => {
  const beforeCutoff = resolveReportExpectation(
    new Date("2026-08-02T23:00:00.000Z"),
    calendar,
  );
  const afterCutoff = resolveReportExpectation(
    new Date("2026-08-03T00:00:00.000Z"),
    calendar,
  );

  assert.equal(beforeCutoff.expectedReportDate, "2026-07-31");
  assert.equal(beforeCutoff.phase, "before_cutoff");
  assert.equal(afterCutoff.expectedReportDate, "2026-08-03");
  assert.equal(afterCutoff.coveredSessionDate, "2026-07-31");
  assert.equal(afterCutoff.phase, "due");
});

test("美股完整休市後不建立新例行晨報", () => {
  const expectation = resolveReportExpectation(
    new Date("2026-11-27T00:00:00.000Z"),
    calendar,
  );

  assert.equal(expectation.expectedReportDate, "2026-11-26");
  assert.equal(expectation.coveredSessionDate, "2026-11-25");
  assert.equal(expectation.phase, "carry_forward");
  assert.match(expectation.reason, /完整休市/);
});

test("美股提早收盤仍由下一個台灣工作日建立晨報", () => {
  const expectation = resolveReportExpectation(
    new Date("2026-11-30T00:00:00.000Z"),
    calendar,
  );

  assert.equal(expectation.expectedReportDate, "2026-11-30");
  assert.equal(expectation.coveredSessionDate, "2026-11-27");
  assert.equal(expectation.phase, "due");
});

test("跨年完整休市後沿用涵蓋前一交易日的元旦晨報", () => {
  const expectation = resolveReportExpectation(
    new Date("2026-01-02T00:00:00.000Z"),
    calendar,
  );

  assert.equal(expectation.expectedReportDate, "2026-01-01");
  assert.equal(expectation.coveredSessionDate, "2025-12-31");
  assert.equal(expectation.phase, "carry_forward");
});

test("日曆不涵蓋的年度停止做出最新判斷", () => {
  const expectation = resolveReportExpectation(
    new Date("2028-01-03T00:00:00.000Z"),
    calendar,
  );

  assert.equal(expectation.expectedReportDate, null);
  assert.equal(expectation.coveredSessionDate, null);
  assert.equal(expectation.phase, "blocked");
  assert.match(expectation.reason, /未涵蓋 2028 年/);
});
