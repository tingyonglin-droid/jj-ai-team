import type { ApprovalEvent } from "../db/approval-store";
import type { DashboardSnapshot } from "./dashboard-types";

function threadsDocumentKey(
  artifactId: string,
  version: number,
  artifactHash: string,
) {
  return `${artifactId}\u0000${version}\u0000${artifactHash}`;
}

function projectApprovedThreads(
  snapshot: DashboardSnapshot,
  events: ApprovalEvent[],
) {
  const byExactVersion = new Map(
    snapshot.threadsDocuments.map((document) => [
      threadsDocumentKey(document.id, document.version, document.artifactHash),
      document,
    ]),
  );
  const byIdVersion = new Map(
    snapshot.threadsDocuments.map((document) => [
      `${document.id}\u0000${document.version}`,
      document,
    ]),
  );
  const approvedThreadsArchive: DashboardSnapshot["approvedThreadsArchive"] = [];
  const threadsArchiveIssues: DashboardSnapshot["threadsArchiveIssues"] = [];

  for (const event of events) {
    if (event.action !== "approve" || event.artifactType !== "Threads") continue;
    const exact = byExactVersion.get(
      threadsDocumentKey(event.artifactId, event.artifactVersion, event.artifactHash),
    );
    if (exact) {
      approvedThreadsArchive.push({
        ...exact,
        approvedAt: event.createdAt,
        approvalSyncStatus: event.syncStatus,
      });
      continue;
    }
    const sameVersion = byIdVersion.get(`${event.artifactId}\u0000${event.artifactVersion}`);
    threadsArchiveIssues.push({
      eventId: event.eventId,
      artifactId: event.artifactId,
      version: event.artifactVersion,
      artifactHash: event.artifactHash,
      approvedAt: event.createdAt,
      approvalSyncStatus: event.syncStatus,
      reason: sameVersion
        ? "核准紀錄與 Threads 全文雜湊不相符，已停止顯示正文。"
        : "找不到核准紀錄對應的 Threads 全文，已停止顯示正文。",
    });
  }

  approvedThreadsArchive.sort((left, right) =>
    right.date.localeCompare(left.date) ||
    right.version - left.version ||
    right.approvedAt.localeCompare(left.approvedAt),
  );
  threadsArchiveIssues.sort((left, right) => right.approvedAt.localeCompare(left.approvedAt));
  return { approvedThreadsArchive, threadsArchiveIssues };
}

export function applyApprovalEvents(
  snapshot: DashboardSnapshot,
  events: ApprovalEvent[],
): DashboardSnapshot {
  const approvalsById = new Map(snapshot.approvals.map((approval) => [approval.id, approval]));
  const threadsById = new Map(snapshot.threadsDocuments.map((document) => [document.id, document]));
  const marketRiskHistory = snapshot.marketRiskHistory ?? { nodes: [], issues: [] };
  const marketRiskArchive = snapshot.marketRiskArchive ?? [];
  const { approvedThreadsArchive, threadsArchiveIssues } = projectApprovedThreads(snapshot, events);
  const validEvents = events.filter((event) => {
    if (event.artifactType === "Threads") {
      return snapshot.threadsDocuments.some(
        (document) =>
          document.id === event.artifactId &&
          document.version === event.artifactVersion &&
          document.artifactHash === event.artifactHash &&
          event.action === "approve",
      );
    }
    if (event.artifactType === "市場風險報告") {
      return marketRiskHistory.nodes.some(
        (node) =>
          node.id === event.artifactId &&
          node.version === event.artifactVersion &&
          node.artifactHash === event.artifactHash &&
          event.action === "approve",
      ) || marketRiskArchive.some(
        (document) =>
          document.id === event.artifactId &&
          document.version === event.artifactVersion &&
          document.artifactHash === event.artifactHash &&
          event.action === "approve",
      );
    }
    const approval = approvalsById.get(event.artifactId);
    return Boolean(
      approval &&
      event.action === "approve" &&
      approval.type === event.artifactType &&
      approval.version === event.artifactVersion &&
      approval.artifactHash === event.artifactHash,
    );
  });

  const eventByArtifactId = new Map(
    validEvents.map((event) => [event.artifactId, event]),
  );
  const isApproved = (
    artifactId: string,
    version?: number,
    artifactHash?: string,
  ) => {
    const event = eventByArtifactId.get(artifactId);
    return Boolean(
      event &&
      (version === undefined || event.artifactVersion === version) &&
      (artifactHash === undefined || event.artifactHash === artifactHash),
    );
  };

  const syncWarnings = validEvents
    .filter((event) => event.syncStatus !== "synced")
    .map((event): DashboardSnapshot["blockers"][number] => {
      const approval = approvalsById.get(event.artifactId);
      const threadsDocument = threadsById.get(event.artifactId);
      return {
        severity: "warning",
        kind: "sync",
        title: "核准已記錄，尚未同步版本庫",
        reason: `${approval?.title ?? threadsDocument?.title ?? event.artifactId} 的核准已生效，稽核鏡像將在安全同步流程完成後更新。`,
        nextStep: "由下一次晨報流程重試核准 outbox 同步。",
        source: event.artifactId,
        asOf: approval?.asOf ?? threadsDocument?.asOf ?? null,
        updatedAt: event.createdAt,
      };
    });
  return {
    ...snapshot,
    approvedThreadsArchive,
    threadsArchiveIssues,
    approvals: snapshot.approvals.filter((approval) => !isApproved(approval.id)),
    employees: snapshot.employees.map((employee) =>
      isApproved(employee.source)
        ? {
            ...employee,
            status: "已完成",
            artifactStatus: "已核准",
            progress: "已由使用者核准",
            nextStep: "保留核准紀錄並追蹤同步狀態",
          }
        : employee,
    ),
    tasks: snapshot.tasks.map((task) =>
      isApproved(task.id)
        ? {
            ...task,
            status: "已完成",
            artifactStatus: "已核准",
            nextStep: "保留核准紀錄並追蹤同步狀態",
          }
        : task,
    ),
    briefArchive: snapshot.briefArchive.map((document) =>
      isApproved(document.id, document.version, document.artifactHash)
        ? { ...document, artifactStatus: "已核准" }
        : document,
    ),
    brief:
      snapshot.brief &&
      isApproved(
        snapshot.brief.source,
        snapshot.brief.version,
        snapshot.brief.artifactHash,
      )
        ? { ...snapshot.brief, artifactStatus: "已核准" }
        : snapshot.brief,
    marketRisk:
      snapshot.marketRisk &&
      isApproved(
        snapshot.marketRisk.source,
        snapshot.marketRisk.version,
        snapshot.marketRisk.artifactHash,
      )
        ? { ...snapshot.marketRisk, artifactStatus: "已核准" }
        : snapshot.marketRisk,
    marketRiskHistory: {
      ...marketRiskHistory,
      nodes: marketRiskHistory.nodes.map((node) =>
        isApproved(node.id, node.version, node.artifactHash)
          ? { ...node, artifactStatus: "已核准" as const }
          : node,
      ),
    },
    marketRiskArchive: marketRiskArchive.map((document) =>
      isApproved(document.id, document.version, document.artifactHash)
        ? { ...document, artifactStatus: "已核准" as const }
        : document,
    ),
    blockers: [
      ...snapshot.blockers.filter(
        (issue) =>
          issue.kind !== "sync" ||
          !issue.source ||
          !eventByArtifactId.has(issue.source),
      ),
      ...syncWarnings,
    ],
  };
}
