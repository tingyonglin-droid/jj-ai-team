import type { DashboardMarketRiskDocument } from "./dashboard-types";

export function marketRiskDocumentHref(date: string, version?: string) {
  const base = `/market-risk/${encodeURIComponent(date)}`;
  return version === undefined
    ? base
    : `${base}?version=${encodeURIComponent(version)}`;
}

export function selectMarketRiskVersion(
  documents: DashboardMarketRiskDocument[],
  date: string,
  version?: string,
): DashboardMarketRiskDocument | null {
  const documentsForDate = documents.filter((document) => document.date === date);
  if (version === undefined) {
    return documentsForDate.find((document) => document.isLatest) ?? null;
  }
  return documentsForDate.find((document) => document.versionLabel === version) ?? null;
}

export function marketRiskVersionsForDate(
  documents: DashboardMarketRiskDocument[],
  date: string,
) {
  return documents
    .filter((document) => document.date === date)
    .sort((left, right) => right.version - left.version);
}
