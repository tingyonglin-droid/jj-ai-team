import { DashboardShell } from "../../../dashboard-shell";
import { loadAuthorizedDashboardSnapshot } from "../../../dashboard-snapshot";
import {
  ApprovedThreadsReader,
  selectApprovedThreadsDocument,
  ThreadsArchiveNotFound,
} from "../threads-components";

export const dynamic = "force-dynamic";

type ApprovedThreadsReaderPageProps = {
  params: Promise<{ artifactKey: string }>;
};

export default async function ApprovedThreadsReaderPage({
  params,
}: ApprovedThreadsReaderPageProps) {
  const { artifactKey } = await params;
  const returnTo = `/content/threads/${encodeURIComponent(artifactKey)}`;
  const { user, snapshot } = await loadAuthorizedDashboardSnapshot(returnTo);
  const document = selectApprovedThreadsDocument(
    snapshot.approvedThreadsArchive,
    artifactKey,
  );

  return (
    <DashboardShell user={user} generatedAt={snapshot.generatedAt}>
      {document ? (
        <ApprovedThreadsReader document={document} />
      ) : (
        <ThreadsArchiveNotFound />
      )}
    </DashboardShell>
  );
}
