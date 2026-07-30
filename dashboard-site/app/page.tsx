import { DashboardShell } from "./dashboard-shell";
import { TodayOverview } from "./dashboard-components";
import { loadAuthorizedDashboardSnapshot } from "./dashboard-snapshot";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { user, snapshot } = await loadAuthorizedDashboardSnapshot("/");

  return (
    <DashboardShell user={user} generatedAt={snapshot.generatedAt}>
      <TodayOverview snapshot={snapshot} />
    </DashboardShell>
  );
}
