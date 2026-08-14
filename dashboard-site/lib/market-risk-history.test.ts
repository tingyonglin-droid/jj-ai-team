import assert from "node:assert/strict";
import test from "node:test";

import type { MarketRiskHistoryNode, MarketRiskState } from "./dashboard-types.ts";
import {
  changeFromPrevious,
  filterRiskHistory,
  riskChartPoints,
  RISK_BANDS,
} from "./market-risk-history.ts";

function node(id: string, date: string, score: number): MarketRiskHistoryNode {
  return {
    id,
    date,
    score,
    state: "中性" as MarketRiskState,
    version: 1,
    versionLabel: "v01",
    artifactHash: "hash",
    artifactStatus: "待核准",
    rawStatus: "待核准",
    dailyChange: null,
    changeReasons: "reason",
    topRisks: ["a", "b", "c"],
    supportingEvidence: "support",
    counterEvidence: "counter",
    confidence: 80,
    completeness: 80,
    lowCompleteness: false,
    versions: [],
    source: "test",
    asOf: date,
    updatedAt: `${date}T00:00:00Z`,
    dependencies: [],
  };
}

test("風險區間完整對應既定的九個分數帶", () => {
  assert.deepEqual(RISK_BANDS, [
    { min: 0, max: 20, label: "低" },
    { min: 21, max: 24, label: "保留區間" },
    { min: 25, max: 40, label: "偏低" },
    { min: 41, max: 44, label: "保留區間" },
    { min: 45, max: 60, label: "中性" },
    { min: 61, max: 64, label: "保留區間" },
    { min: 65, max: 80, label: "偏高" },
    { min: 81, max: 84, label: "保留區間" },
    { min: 85, max: 100, label: "高" },
  ]);
});

test("四週範圍以最後有效節點為錨點並包含第 28 天邊界", () => {
  const nodes = [
    node("before", "2026-07-16", 50),
    node("boundary", "2026-07-17", 51),
    node("latest", "2026-08-14", 52),
  ];

  assert.deepEqual(filterRiskHistory(nodes, "4w").map((item) => item.date), [
    "2026-07-17",
    "2026-08-14",
  ]);
});

test("無效日期不會成為四週範圍的最新錨點", () => {
  const nodes = [
    node("boundary", "2026-07-17", 51),
    node("latest", "2026-08-14", 52),
    node("invalid", "2026-02-30", 53),
  ];

  assert.deepEqual(filterRiskHistory(nodes, "4w").map((item) => item.id), [
    "boundary",
    "latest",
  ]);
});

test("全部歷史範圍只保留有效日期的節點", () => {
  const old = node("old", "2026-07-01", 50);
  const newest = node("new", "2026-08-14", 55);
  const nodes = [old, node("invalid", "2026-02-30", 60), newest];

  assert.deepEqual(filterRiskHistory(nodes, "all"), [old, newest]);
});

test("曲線以真實日期間隔與固定 0 到 100 分數座標定位", () => {
  const nodes = [node("old", "2026-08-01", 0), node("new", "2026-08-11", 100)];

  assert.deepEqual(riskChartPoints(nodes, 100, 100), [
    { id: "old", x: 0, y: 100 },
    { id: "new", x: 100, y: 0 },
  ]);
  assert.deepEqual(riskChartPoints([nodes[0]!], 100, 100), []);
});

test("曲線不插補缺少報告的日期", () => {
  const nodes = [
    node("old", "2026-08-01", 0),
    node("middle", "2026-08-03", 50),
    node("new", "2026-08-11", 100),
  ];

  assert.deepEqual(riskChartPoints(nodes, 100, 100), [
    { id: "old", x: 0, y: 100 },
    { id: "middle", x: 20, y: 50 },
    { id: "new", x: 100, y: 0 },
  ]);
});

test("節點變動從完整歷史取得前一個節點", () => {
  const nodes = [node("old", "2026-07-01", 50), node("new", "2026-08-14", 55)];

  assert.equal(changeFromPrevious(nodes, "new"), 5);
  assert.equal(changeFromPrevious(nodes, "old"), null);
  assert.equal(changeFromPrevious(nodes, "missing"), null);
});
