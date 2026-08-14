import {
  marketRiskDocumentHref,
} from "../../../lib/market-risk-content";
import { DashboardShell } from "../../dashboard-shell";
import { loadAuthorizedDashboardSnapshot } from "../../dashboard-snapshot";
import { MarketRiskRouteContent } from "../market-risk-components";

export const dynamic = "force-dynamic";

type MarketRiskPageProps = {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ version?: string }>;
};

export default async function MarketRiskPage({ params, searchParams }: MarketRiskPageProps) {
  const { date } = await params;
  const { version } = await searchParams;
  const returnTo = marketRiskDocumentHref(date, version);
  const { user, snapshot } = await loadAuthorizedDashboardSnapshot(returnTo);

  return (
    <DashboardShell user={user} generatedAt={snapshot.generatedAt}>
      <MarketRiskRouteContent
        documents={snapshot.marketRiskArchive}
        date={date}
        version={version}
      />
    </DashboardShell>
  );
}
