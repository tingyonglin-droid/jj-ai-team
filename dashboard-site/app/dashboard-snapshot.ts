import type { ApprovalEvent } from "../db/approval-store";
import { applyApprovalEvents } from "../lib/approval-events";
import type { DashboardSnapshot } from "../lib/dashboard-types";
import type { ChatGPTUser } from "./chatgpt-auth";
import { requireAllowedUser } from "./authorization";

type AuthorizeUser = (returnTo: string) => Promise<ChatGPTUser>;
type LoadSnapshot = () => Promise<DashboardSnapshot>;
type LoadApprovalEvents = () => Promise<ApprovalEvent[]>;

export async function loadDashboardSnapshot(): Promise<DashboardSnapshot> {
  const { default: snapshot } = await import("../data/dashboard.json");
  return snapshot as DashboardSnapshot;
}

export async function loadAuthorizedDashboardSnapshot(
  returnTo: string,
  authorizeUser: AuthorizeUser = requireAllowedUser,
  loadSnapshot: LoadSnapshot = loadDashboardSnapshot,
  loadApprovalEvents: LoadApprovalEvents = loadPersistedApprovalEvents,
) {
  const user = await authorizeUser(returnTo);
  const snapshot = await loadSnapshot();
  let approvalEvents: ApprovalEvent[];

  try {
    approvalEvents = await loadApprovalEvents();
  } catch (error) {
    console.error("Unable to load Dashboard approval events", error);

    return {
      user,
      snapshot: {
        ...snapshot,
        blockers: [
          ...snapshot.blockers,
          {
            severity: "blocker" as const,
            kind: "sync" as const,
            title: "核准資料庫受阻",
            reason: "無法讀取 Dashboard 核准紀錄，頁面顯示的核准狀態可能不是最新狀態。",
            nextStep: "檢查 D1 的 DB 綁定與 migration，恢復後重新整理 Dashboard。",
            source: "Dashboard approval store",
            asOf: null,
            updatedAt: null,
          },
        ],
      },
    };
  }

  return { user, snapshot: applyApprovalEvents(snapshot, approvalEvents) };
}

async function loadPersistedApprovalEvents() {
  const { createApprovalStore } = await import("../db/approval-store-runtime");
  return createApprovalStore().list();
}
