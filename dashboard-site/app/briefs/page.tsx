import { BriefArchive } from "./brief-components";
import { DashboardShell } from "../dashboard-shell";
import { loadAuthorizedDashboardSnapshot } from "../dashboard-snapshot";

export const dynamic = "force-dynamic";

export default async function BriefsPage() {
  const { user, snapshot } = await loadAuthorizedDashboardSnapshot("/briefs");

  return (
    <DashboardShell user={user} generatedAt={snapshot.generatedAt}>
      <BriefArchive documents={snapshot.briefArchive} />
    </DashboardShell>
  );
}
