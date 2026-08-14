export type MarketRiskRecordIdentity = {
  date: string;
  version: number;
  versionLabel: string;
};

function isIsoCalendarDate(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parseMarketRiskRecordPath(
  source: string,
): MarketRiskRecordIdentity | null {
  const filename = source.replaceAll("\\", "/").split("/").at(-1) ?? "";
  const match = /^(\d{4}-\d{2}-\d{2})-v(\d{2})\.md$/.exec(filename);
  if (!match || !isIsoCalendarDate(match[1]!)) return null;

  return {
    date: match[1]!,
    version: Number(match[2]),
    versionLabel: `v${match[2]}`,
  };
}
