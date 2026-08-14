import assert from "node:assert/strict";
import test from "node:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

import type { DashboardSnapshot, MarketRiskHistoryNode } from "../lib/dashboard-types";
import { MarketRiskHistoryChart } from "./market-risk-history-chart";
import {
  installTestDom,
  TestElement,
  TestEvent,
  TestMouseEvent,
} from "./approvals/test-dom";

function riskNode(
  id: string,
  date: string,
  score: number,
  overrides: Partial<MarketRiskHistoryNode> = {},
): MarketRiskHistoryNode {
  return {
    id,
    date,
    score,
    state: "中性",
    version: 1,
    versionLabel: "v01",
    artifactHash: `sha256:${id}`,
    artifactStatus: "待核准",
    rawStatus: "待核准",
    dailyChange: null,
    changeReasons: `${date} 調整原因`,
    topRisks: ["能源", "利率", "市場廣度"],
    supportingEvidence: `${date} 支持證據`,
    counterEvidence: `${date} 反方證據`,
    confidence: 72,
    completeness: 82,
    lowCompleteness: false,
    versions: [
      {
        id: `${id}-v01`,
        version: 1,
        versionLabel: "v01",
        source: `records/market-risk/${date}-v01.md`,
        readable: true,
      },
    ],
    source: `records/market-risk/${date}-v01.md`,
    asOf: `${date} 07:00（Asia/Taipei，UTC+8）`,
    updatedAt: `${date}T00:00:00.000Z`,
    dependencies: [],
    ...overrides,
  };
}

const threeNodeHistory: DashboardSnapshot["marketRiskHistory"] = {
  nodes: [
    riskNode("old", "2026-07-01", 35, {
      state: "偏低",
      artifactStatus: "已核准",
      rawStatus: "已核准",
    }),
    riskNode("recent", "2026-08-01", 50, {
      completeness: 65,
      lowCompleteness: true,
    }),
    riskNode("latest", "2026-08-14", 60),
  ],
  issues: [
    {
      date: "2026-08-02",
      source: "records/market-risk/2026-08-02-v02.md",
      version: 2,
      reason: "最新版本無法解析",
    },
  ],
};

function elementsWithin(
  root: TestElement,
  predicate: (element: TestElement) => boolean,
): TestElement[] {
  const matches: TestElement[] = [];
  const visit = (element: TestElement) => {
    if (predicate(element)) matches.push(element);
    for (const child of element.childNodes) {
      if (child instanceof TestElement) visit(child);
    }
  };
  visit(root);
  return matches;
}

function buttonWithText(root: TestElement, text: string) {
  return elementsWithin(root, (element) =>
    element.tagName === "BUTTON" && element.textContent === text
  )[0] ?? null;
}

function buttonWithLabel(root: TestElement, label: string) {
  return elementsWithin(root, (element) =>
    element.tagName === "BUTTON" && element.getAttribute("aria-label") === label
  )[0] ?? null;
}

test("三筆風險歷史清楚呈現預測邊界、狀態形狀、資料品質與阻擋問題", () => {
  const html = renderToStaticMarkup(<MarketRiskHistoryChart history={threeNodeHistory} />);

  assert.match(html, /未來 1–4 週市場下行風險/);
  assert.match(html, /0–100；不是市場漲跌預測/);
  assert.match(html, /最近 4 週/);
  assert.match(html, /全部歷史/);
  assert.match(html, /aria-label="2026-08-14，風險 60 分，中性，待核准"/);
  assert.match(html, /data-approval-state="pending"/);
  assert.match(html, /資料完整度低於 70%/);
  assert.match(
    html,
    /aria-label="2026-08-01，風險 50 分，中性，待核准"[^>]*aria-describedby="risk-history-node-warning-recent"/,
  );
  assert.match(html, /id="risk-history-node-warning-recent"/);
  assert.match(html, /href="\/market-risk\/2026-08-14\?version=v01"/);
  assert.doesNotMatch(html, /href="\/records\/market-risk/);
  assert.match(html, /data-risk-band="reserved"/);
  assert.match(html, /待核准：空心點/);
  assert.match(html, /已核准：實心圓/);
  assert.match(html, /最新版本無法解析/);
  assert.match(html, /<polyline/);
});

test("單一有效節點不畫趨勢線並明示歷史資料不足", () => {
  const html = renderToStaticMarkup(
    <MarketRiskHistoryChart history={{ nodes: [riskNode("only", "2026-08-14", 60)], issues: [] }} />,
  );

  assert.match(html, /歷史資料不足/);
  assert.doesNotMatch(html, /<polyline/);
  assert.match(html, /2026-08-14/);
});

test("完全沒有有效節點時只顯示明確空狀態而不虛構零分", () => {
  const html = renderToStaticMarkup(
    <MarketRiskHistoryChart history={{ nodes: [], issues: [] }} />,
  );

  assert.match(html, /目前沒有有效的市場風險歷史資料/);
  assert.doesNotMatch(html, /0 分/);
  assert.doesNotMatch(html, /<polyline/);
});

test("點擊、範圍切換與 Enter 鍵都能選取真實歷史節點", async () => {
  const dom = installTestDom();
  const container = dom.document.createElement("div");
  dom.document.body.appendChild(container);
  const root = createRoot(container as unknown as Element);

  try {
    await act(async () => {
      root.render(<MarketRiskHistoryChart history={threeNodeHistory} />);
    });

    assert.match(container.textContent, /2026-08-14 調整原因/);
    assert.equal(buttonWithLabel(container, "2026-07-01，風險 35 分，偏低，已核准"), null);

    const recent = buttonWithLabel(container, "2026-08-01，風險 50 分，中性，待核准");
    assert.ok(recent);
    await act(async () => {
      recent.dispatchEvent(new TestMouseEvent("click", { bubbles: true }));
    });
    assert.match(container.textContent, /2026-08-01 調整原因/);

    const allHistory = buttonWithText(container, "全部歷史");
    assert.ok(allHistory);
    await act(async () => {
      allHistory.dispatchEvent(new TestMouseEvent("click", { bubbles: true }));
    });
    assert.match(container.textContent, /2026-08-01 調整原因/);

    const old = buttonWithLabel(container, "2026-07-01，風險 35 分，偏低，已核准");
    assert.ok(old);
    assert.equal(dom.document.activeElement, null);
    const enter = new TestEvent("keydown", { bubbles: true }) as TestEvent & { key: string };
    enter.key = "Enter";
    await act(async () => {
      old.dispatchEvent(enter);
    });
    assert.match(container.textContent, /2026-07-01 調整原因/);
  } finally {
    await act(async () => root.unmount());
    dom.restore();
  }
});
