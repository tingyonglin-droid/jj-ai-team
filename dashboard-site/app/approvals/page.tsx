import snapshotData from "../../data/dashboard.json";
import { DashboardShell } from "../dashboard-shell";
import { ApprovalCenter } from "../dashboard-components";
import { requireAllowedUser } from "../authorization";
import type { DashboardSnapshot } from "../../lib/dashboard-types";

export const dynamic = "force-dynamic";

const snapshot = snapshotData as DashboardSnapshot;

export default async function ApprovalsPage() {
  const user = await requireAllowedUser("/approvals");

  return (
    <DashboardShell user={user} generatedAt={snapshot.generatedAt}>
      <ApprovalCenter approvals={snapshot.approvals} />
    </DashboardShell>
  );
}
