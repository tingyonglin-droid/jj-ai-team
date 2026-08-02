import type { ApprovalEvent } from "../db/approval-store";
import type { DashboardSnapshot } from "./dashboard-types";

export function applyApprovalEvents(
  snapshot: DashboardSnapshot,
  events: ApprovalEvent[],
): DashboardSnapshot {
  const approvalsById = new Map(snapshot.approvals.map((approval) => [approval.id, approval]));
  const validEvents = events.filter((event) => {
    const approval = approvalsById.get(event.artifactId);
    return Boolean(
      approval &&
      event.action === "approve" &&
      approval.type === event.artifactType &&
      approval.version === event.artifactVersion &&
      approval.artifactHash === event.artifactHash,
    );
  });
  if (validEvents.length === 0) return snapshot;

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
      return {
        severity: "warning",
        kind: "sync",
        title: "核准已記錄，尚未同步版本庫",
        reason: `${approval?.title ?? event.artifactId} 的核准已生效，稽核鏡像將在安全同步流程完成後更新。`,
        nextStep: "由下一次晨報流程重試核准 outbox 同步。",
        source: event.artifactId,
        asOf: approval?.asOf ?? null,
        updatedAt: event.createdAt,
      };
    });

  return {
    ...snapshot,
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
