"use client";

import { useState, type CSSProperties, type KeyboardEvent } from "react";

import type { DashboardSnapshot, MarketRiskHistoryNode } from "../lib/dashboard-types";
import {
  changeFromPrevious,
  filterRiskHistory,
  riskChartPoints,
  RISK_BANDS,
  type MarketRiskRange,
} from "../lib/market-risk-history";

const CHART_WIDTH = 800;
const CHART_HEIGHT = 320;
const PLOT_LEFT = 64;
const PLOT_TOP = 20;
const PLOT_WIDTH = 712;
const PLOT_HEIGHT = 256;

type ApprovalState = "pending" | "approved" | "other";

function approvalState(node: MarketRiskHistoryNode): ApprovalState {
  if (node.artifactStatus === "待核准") return "pending";
  if (node.artifactStatus === "已核准" || node.artifactStatus === "已核准並執行") {
    return "approved";
  }
  return "other";
}

function nodeLabel(node: MarketRiskHistoryNode) {
  return `${node.date}，風險 ${node.score} 分，${node.state}，${node.artifactStatus}`;
}

function changeLabel(change: number | null) {
  if (change === null) return "尚無前值";
  return `${change >= 0 ? "+" : ""}${change} 分`;
}

function sourceHref(source: string) {
  if (/^https?:\/\//.test(source)) return source;
  return `/${source.replace(/^\/+/, "")}`;
}

function RiskHistoryIssues({
  issues,
}: {
  issues: DashboardSnapshot["marketRiskHistory"]["issues"];
}) {
  if (issues.length === 0) return null;

  return (
    <section className="risk-history-warning" aria-labelledby="risk-history-issues-heading">
      <h4 id="risk-history-issues-heading">歷史資料阻擋</h4>
      <ul>
        {issues.map((issue) => (
          <li key={`${issue.source}:${issue.version}`}>
            <strong>{issue.date || "日期無法判定"}・v{String(issue.version).padStart(2, "0")}</strong>
            ：{issue.reason}
            <span className="source-line">（來源：{issue.source}）</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RiskHistoryDetail({
  node,
  change,
}: {
  node: MarketRiskHistoryNode;
  change: number | null;
}) {
  return (
    <section className="risk-history-detail" aria-live="polite" aria-labelledby="risk-history-detail-heading">
      <div className="risk-history-detail-heading">
        <div>
          <p className="item-meta">{node.date}・{node.versionLabel}</p>
          <h4 id="risk-history-detail-heading">節點詳情</h4>
        </div>
        <span data-approval-state={approvalState(node)}>{node.artifactStatus}</span>
      </div>
      <dl>
        <div><dt>風險分數／較前次</dt><dd>{node.score} 分／{changeLabel(change)}</dd></div>
        <div><dt>風險狀態</dt><dd>{node.state}</dd></div>
        <div><dt>文件版本／原始狀態</dt><dd>{node.versionLabel}／{node.rawStatus}</dd></div>
        <div><dt>AI 判斷信心</dt><dd>{node.confidence}%</dd></div>
        <div><dt>資料完整度</dt><dd>{node.completeness}%{node.lowCompleteness ? "（低於 70%）" : ""}</dd></div>
        <div><dt>資料代表時間</dt><dd>{node.asOf}</dd></div>
        <div><dt>更新時間</dt><dd>{node.updatedAt}</dd></div>
        <div><dt>來源</dt><dd>{node.source}</dd></div>
      </dl>
      <div className="risk-history-evidence">
        <p><strong>分數改變原因：</strong>{node.changeReasons}</p>
        <p><strong>三項主要風險：</strong>{node.topRisks.join("、")}</p>
        <p><strong>支持證據：</strong>{node.supportingEvidence}</p>
        <p><strong>反方證據：</strong>{node.counterEvidence}</p>
      </div>
      <nav className="risk-history-versions" aria-label={`${node.date} 市場風險版本`}>
        <span>該日版本：</span>
        {node.versions.length > 0 ? node.versions.map((version) => (
          <a
            key={version.id}
            href={sourceHref(version.source)}
            data-readable={String(version.readable)}
            aria-disabled={version.readable ? undefined : true}
            onClick={version.readable ? undefined : (event) => event.preventDefault()}
          >
            {version.versionLabel}{version.readable ? "" : "（無法讀取）"}
          </a>
        )) : <span>尚無版本入口</span>}
      </nav>
    </section>
  );
}

export function MarketRiskHistoryChart({
  history,
}: {
  history: DashboardSnapshot["marketRiskHistory"];
}) {
  const [range, setRange] = useState<MarketRiskRange>("4w");
  const visible = filterRiskHistory(history.nodes, range);
  const [selectedId, setSelectedId] = useState<string | null>(visible.at(-1)?.id ?? null);
  const effectiveSelectedId = visible.some((node) => node.id === selectedId)
    ? selectedId
    : visible.at(-1)?.id ?? null;
  const selected = visible.find((node) => node.id === effectiveSelectedId) ?? null;

  const helperPoints = riskChartPoints(visible, PLOT_WIDTH, PLOT_HEIGHT);
  const chartPoints = visible.length === 1
    ? [{ id: visible[0]!.id, x: PLOT_WIDTH / 2, y: PLOT_HEIGHT - (visible[0]!.score / 100) * PLOT_HEIGHT }]
    : helperPoints;
  const pointById = new Map(chartPoints.map((point) => [point.id, point]));
  const polylinePoints = helperPoints
    .map((point) => `${PLOT_LEFT + point.x},${PLOT_TOP + point.y}`)
    .join(" ");

  function selectRange(nextRange: MarketRiskRange) {
    const nextVisible = filterRiskHistory(history.nodes, nextRange);
    setRange(nextRange);
    setSelectedId((current) =>
      nextVisible.some((node) => node.id === current)
        ? current
        : nextVisible.at(-1)?.id ?? null,
    );
  }

  function selectWithKeyboard(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    setSelectedId(id);
  }

  return (
    <section className="risk-history" aria-labelledby="risk-history-heading">
      <div className="risk-history-header">
        <div>
          <p className="item-meta">歷史趨勢</p>
          <h4 id="risk-history-heading">未來 1–4 週市場下行風險</h4>
          <p>0–100；不是市場漲跌預測</p>
        </div>
        <div className="risk-history-controls" aria-label="市場風險歷史範圍">
          <button type="button" aria-pressed={range === "4w"} onClick={() => selectRange("4w")}>
            最近 4 週
          </button>
          <button type="button" aria-pressed={range === "all"} onClick={() => selectRange("all")}>
            全部歷史
          </button>
        </div>
      </div>

      <RiskHistoryIssues issues={history.issues} />

      {visible.length === 0 ? (
        <div className="risk-history-empty">
          <h5>目前沒有有效的市場風險歷史資料</h5>
          <p>圖表不會以零分代替缺失資料；請先處理上方阻擋問題或產出可解析報告。</p>
        </div>
      ) : (
        <>
          {visible.length === 1 ? <p className="risk-history-warning">歷史資料不足</p> : null}
          <div
            className="risk-history-chart-scroll"
            tabIndex={0}
            aria-label="市場風險歷史圖表；窄螢幕可水平捲動"
          >
            <div className="risk-history-chart">
              <svg
              className="risk-history-svg"
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              role="img"
              aria-labelledby="risk-history-svg-title risk-history-svg-description"
            >
              <title id="risk-history-svg-title">市場下行風險歷史曲線</title>
              <desc id="risk-history-svg-description">縱軸固定零到一百分；橫軸依真實報告日期排列，不補入缺少報告的日期。</desc>
              {RISK_BANDS.map((band) => {
                const y = PLOT_TOP + ((100 - band.max) / 100) * PLOT_HEIGHT;
                const height = ((band.max - band.min) / 100) * PLOT_HEIGHT;
                return (
                  <g key={`${band.min}-${band.max}`}>
                    <rect
                      className={`risk-history-band risk-history-band-${band.label}`}
                      data-risk-band={band.label === "保留區間" ? "reserved" : undefined}
                      data-risk-state={band.label}
                      x={PLOT_LEFT}
                      y={y}
                      width={PLOT_WIDTH}
                      height={height}
                    />
                    <text
                      x={band.label === "保留區間" ? PLOT_LEFT + PLOT_WIDTH - 8 : PLOT_LEFT + 8}
                      y={y + height / 2 + 4}
                      textAnchor={band.label === "保留區間" ? "end" : "start"}
                    >
                      {band.label}
                    </text>
                  </g>
                );
              })}
              {[0, 50, 100].map((score) => {
                const y = PLOT_TOP + ((100 - score) / 100) * PLOT_HEIGHT;
                return (
                  <g key={score}>
                    <line x1={PLOT_LEFT} x2={PLOT_LEFT + PLOT_WIDTH} y1={y} y2={y} />
                    <text x={PLOT_LEFT - 12} y={y + 4} textAnchor="end">{score}</text>
                  </g>
                );
              })}
              {helperPoints.length >= 2 ? (
                <polyline className="risk-history-line" points={polylinePoints} />
              ) : null}
              <text x={PLOT_LEFT} y={CHART_HEIGHT - 10}>{visible[0]?.date}</text>
              {visible.length > 1 ? (
                <text x={PLOT_LEFT + PLOT_WIDTH} y={CHART_HEIGHT - 10} textAnchor="end">
                  {visible.at(-1)?.date}
                </text>
              ) : null}
              </svg>

              {visible.map((node) => {
                const point = pointById.get(node.id);
                if (!point) return null;
                const style = {
                  left: `${((PLOT_LEFT + point.x) / CHART_WIDTH) * 100}%`,
                  top: `${((PLOT_TOP + point.y) / CHART_HEIGHT) * 100}%`,
                } satisfies CSSProperties;
                return (
                  <div className="risk-history-node-wrap" style={style} key={node.id}>
                    <button
                      type="button"
                      className="risk-history-node"
                      data-approval-state={approvalState(node)}
                      aria-label={nodeLabel(node)}
                      aria-pressed={effectiveSelectedId === node.id}
                      title={nodeLabel(node)}
                      onClick={() => setSelectedId(node.id)}
                      onFocus={() => setSelectedId(node.id)}
                      onKeyDown={(event) => selectWithKeyboard(event, node.id)}
                    />
                    {node.lowCompleteness ? (
                      <span className="risk-history-node-warning" role="note">
                        <span aria-hidden="true">⚠</span>
                        <span className="sr-only">資料完整度低於 70%</span>
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="risk-history-legend" aria-label="節點核准狀態圖例">
            <span><i data-approval-state="pending" />待核准：空心圓</span>
            <span><i data-approval-state="approved" />已核准：實心圓</span>
            <span><i data-approval-state="other" />其他狀態：方形</span>
          </div>

          {selected ? (
            <RiskHistoryDetail
              node={selected}
              change={changeFromPrevious(history.nodes, selected.id)}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
