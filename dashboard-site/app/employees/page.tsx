import { DashboardShell } from "../dashboard-shell";
import { EmployeeDirectory } from "../dashboard-components";
import { loadAuthorizedDashboardSnapshot } from "../dashboard-snapshot";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const { user, snapshot } = await loadAuthorizedDashboardSnapshot("/employees");

  return (
    <DashboardShell user={user} generatedAt={snapshot.generatedAt}>
      <EmployeeDirectory employees={snapshot.employees} />
    </DashboardShell>
  );
}
