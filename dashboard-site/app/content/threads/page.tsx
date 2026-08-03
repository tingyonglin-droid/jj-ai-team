import { DashboardShell } from "../../dashboard-shell";
import { loadAuthorizedDashboardSnapshot } from "../../dashboard-snapshot";
import { ApprovedThreadsArchive } from "./threads-components";

export const dynamic = "force-dynamic";

export default async function ApprovedThreadsPage() {
  const { user, snapshot } = await loadAuthorizedDashboardSnapshot("/content/threads");
  return (
    <DashboardShell user={user} generatedAt={snapshot.generatedAt}>
      <ApprovedThreadsArchive
        documents={snapshot.approvedThreadsArchive}
        issues={snapshot.threadsArchiveIssues}
      />
    </DashboardShell>
  );
}
