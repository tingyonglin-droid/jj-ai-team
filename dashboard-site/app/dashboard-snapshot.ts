import type { DashboardSnapshot } from "../lib/dashboard-types";
import type { ChatGPTUser } from "./chatgpt-auth";
import { requireAllowedUser } from "./authorization";

type AuthorizeUser = (returnTo: string) => Promise<ChatGPTUser>;
type LoadSnapshot = () => Promise<DashboardSnapshot>;

export async function loadDashboardSnapshot(): Promise<DashboardSnapshot> {
  const { default: snapshot } = await import("../data/dashboard.json");
  return snapshot as DashboardSnapshot;
}

export async function loadAuthorizedDashboardSnapshot(
  returnTo: string,
  authorizeUser: AuthorizeUser = requireAllowedUser,
  loadSnapshot: LoadSnapshot = loadDashboardSnapshot,
) {
  const user = await authorizeUser(returnTo);
  const snapshot = await loadSnapshot();

  return { user, snapshot };
}
