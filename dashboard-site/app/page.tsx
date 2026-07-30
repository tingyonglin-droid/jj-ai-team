import { requireAllowedUser } from "./authorization";
import snapshotData from "../data/dashboard.json";
import type { DashboardSnapshot } from "../lib/dashboard-types";
import { DashboardShell } from "./dashboard-shell";
import { TodayOverview } from "./dashboard-components";

export const dynamic = "force-dynamic";

const snapshot = snapshotData as DashboardSnapshot;

export default async function Home() {
  const user = await requireAllowedUser("/");

  return (
    <DashboardShell user={user} generatedAt={snapshot.generatedAt}>
      <TodayOverview snapshot={snapshot} />
    </DashboardShell>
  );
}
