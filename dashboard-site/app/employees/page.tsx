import snapshotData from "../../data/dashboard.json";
import { DashboardShell } from "../dashboard-shell";
import { EmployeeDirectory } from "../dashboard-components";
import { requireAllowedUser } from "../authorization";
import type { DashboardSnapshot } from "../../lib/dashboard-types";

export const dynamic = "force-dynamic";

const snapshot = snapshotData as DashboardSnapshot;

export default async function EmployeesPage() {
  const user = await requireAllowedUser("/employees");

  return (
    <DashboardShell user={user} generatedAt={snapshot.generatedAt}>
      <EmployeeDirectory employees={snapshot.employees} />
    </DashboardShell>
  );
}
