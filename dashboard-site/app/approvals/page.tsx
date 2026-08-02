import { DashboardShell } from "../dashboard-shell";
import { ApprovalCenter } from "../dashboard-components";
import { loadAuthorizedDashboardSnapshot } from "../dashboard-snapshot";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const { user, snapshot } = await loadAuthorizedDashboardSnapshot("/approvals");

  return (
    <DashboardShell user={user} generatedAt={snapshot.generatedAt}>
      <ApprovalCenter approvals={snapshot.approvals} />
    </DashboardShell>
  );
}
