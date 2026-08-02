import { selectBriefVersion, versionsForDate } from "../../../lib/brief-content";
import { DashboardShell } from "../../dashboard-shell";
import { loadAuthorizedDashboardSnapshot } from "../../dashboard-snapshot";
import { BriefNotFound, BriefReader } from "../brief-components";

export const dynamic = "force-dynamic";

type BriefPageProps = {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ version?: string }>;
};

export default async function BriefPage({ params, searchParams }: BriefPageProps) {
  const { date } = await params;
  const { version } = await searchParams;
  const returnTo = version
    ? `/briefs/${date}?version=${encodeURIComponent(version)}`
    : `/briefs/${date}`;
  const { user, snapshot } = await loadAuthorizedDashboardSnapshot(returnTo);
  const document = selectBriefVersion(snapshot.briefArchive, date, version);
  const versions = versionsForDate(snapshot.briefArchive, date);

  return (
    <DashboardShell user={user} generatedAt={snapshot.generatedAt}>
      {document ? (
        <BriefReader document={document} versions={versions} />
      ) : (
        <BriefNotFound date={date} version={version} />
      )}
    </DashboardShell>
  );
}
