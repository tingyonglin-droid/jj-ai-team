import { createApprovalStore } from "../../../db/approval-store-runtime";
import { requireAllowedUser } from "../../authorization";
import { loadDashboardSnapshot } from "../../dashboard-snapshot";
import { createApprovalHandler } from "./approval-handler";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return createApprovalHandler({
    requireUser: requireAllowedUser,
    loadSnapshot: loadDashboardSnapshot,
    store: createApprovalStore(),
  })(request);
}
