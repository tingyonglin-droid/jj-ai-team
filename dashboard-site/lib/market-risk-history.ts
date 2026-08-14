import type { MarketRiskHistoryNode, MarketRiskState } from "./dashboard-types";

export type MarketRiskRange = "4w" | "all";

export const RISK_BANDS: ReadonlyArray<{
  min: number;
  max: number;
  label: MarketRiskState;
}> = [
  { min: 0, max: 20, label: "低" },
  { min: 21, max: 24, label: "保留區間" },
  { min: 25, max: 40, label: "偏低" },
  { min: 41, max: 44, label: "保留區間" },
  { min: 45, max: 60, label: "中性" },
  { min: 61, max: 64, label: "保留區間" },
  { min: 65, max: 80, label: "偏高" },
  { min: 81, max: 84, label: "保留區間" },
  { min: 85, max: 100, label: "高" },
];

const DAYS_IN_FOUR_WEEKS = 28;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function dateTimestamp(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    return null;
  }

  return parsed.getTime();
}

export function filterRiskHistory(
  nodes: MarketRiskHistoryNode[],
  range: MarketRiskRange,
): MarketRiskHistoryNode[] {
  if (range === "all") return nodes;

  const latestTimestamp = [...nodes]
    .reverse()
    .map((node) => dateTimestamp(node.date))
    .find((timestamp): timestamp is number => timestamp !== null);

  if (latestTimestamp === undefined) return [];

  const boundary = latestTimestamp - DAYS_IN_FOUR_WEEKS * MILLISECONDS_PER_DAY;
  return nodes.filter((node) => {
    const timestamp = dateTimestamp(node.date);
    return timestamp !== null && timestamp >= boundary && timestamp <= latestTimestamp;
  });
}

export function riskChartPoints(
  nodes: MarketRiskHistoryNode[],
  width: number,
  height: number,
): Array<{ id: string; x: number; y: number }> {
  if (nodes.length < 2) return [];

  const timestamps = nodes.map((node) => dateTimestamp(node.date));
  if (timestamps.some((timestamp) => timestamp === null)) return [];

  const firstTimestamp = timestamps[0]!;
  const lastTimestamp = timestamps.at(-1)!;
  const elapsed = lastTimestamp - firstTimestamp;

  return nodes.map((node, index) => ({
    id: node.id,
    x: elapsed === 0 ? 0 : ((timestamps[index]! - firstTimestamp) / elapsed) * width,
    y: height - (node.score / 100) * height,
  }));
}

export function changeFromPrevious(
  nodes: MarketRiskHistoryNode[],
  nodeId: string,
): number | null {
  const index = nodes.findIndex((node) => node.id === nodeId);
  if (index <= 0) return null;

  return nodes[index]!.score - nodes[index - 1]!.score;
}
