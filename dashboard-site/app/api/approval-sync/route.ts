import { createApprovalStore } from "../../../db/approval-store-runtime";
import { getRuntimeEnv } from "../../../lib/runtime-env";
import { createApprovalSyncHandler } from "./sync-handler";

function handler() {
  const value = getRuntimeEnv().APPROVAL_SYNC_SECRET;
  return createApprovalSyncHandler({
    secret: typeof value === "string" ? value : undefined,
    store: createApprovalStore(),
  });
}

export async function GET(request: Request) {
  return handler()(request);
}

export async function POST(request: Request) {
  return handler()(request);
}
