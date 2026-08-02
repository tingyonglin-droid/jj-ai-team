export type ApprovalArtifactType = "晨報" | "市場風險報告";

export type ApprovalEvent = {
  eventId: string;
  artifactId: string;
  artifactType: ApprovalArtifactType;
  artifactVersion: number;
  artifactHash: string;
  action: "approve";
  actorUserId: string;
  createdAt: string;
  syncStatus: "pending" | "synced" | "blocked";
  syncedAt: string | null;
};

export type ApprovalInput = Pick<
  ApprovalEvent,
  | "artifactId"
  | "artifactType"
  | "artifactVersion"
  | "artifactHash"
  | "actorUserId"
>;

export interface ApprovalEventRepository {
  list(): Promise<ApprovalEvent[]>;
  findByArtifact(
    artifactId: string,
    artifactVersion: number,
    action: ApprovalEvent["action"],
  ): Promise<ApprovalEvent | null>;
  insert(event: ApprovalEvent): Promise<boolean>;
  markSynced(eventIds: string[], syncedAt: string): Promise<void>;
}

type ApprovalEventRow = {
  eventId: string;
  artifactId: string;
  artifactType: string;
  artifactVersion: number;
  artifactHash: string;
  action: string;
  actorUserId: string;
  createdAt: string;
  syncStatus: string;
  syncedAt: string | null;
};

export function approvalEventFromRow(row: ApprovalEventRow): ApprovalEvent {
  if (row.artifactType !== "晨報" && row.artifactType !== "市場風險報告") {
    throw new Error(`無效的核准成果類型：${row.artifactType}`);
  }
  if (row.action !== "approve") {
    throw new Error(`無效的核准事件動作：${row.action}`);
  }
  if (
    row.syncStatus !== "pending" &&
    row.syncStatus !== "synced" &&
    row.syncStatus !== "blocked"
  ) {
    throw new Error(`無效的核准同步狀態：${row.syncStatus}`);
  }
  return {
    ...row,
    artifactType: row.artifactType,
    action: row.action,
    syncStatus: row.syncStatus,
  };
}

type ApprovalStoreDependencies = {
  createId: () => string;
  now: () => string;
};

const defaultDependencies: ApprovalStoreDependencies = {
  createId: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
};

export class ApprovalStore {
  constructor(
    private readonly repository: ApprovalEventRepository,
    private readonly dependencies: ApprovalStoreDependencies = defaultDependencies,
  ) {}

  async list() {
    return this.repository.list();
  }

  async approve(input: ApprovalInput) {
    const existing = await this.repository.findByArtifact(
      input.artifactId,
      input.artifactVersion,
      "approve",
    );
    if (existing) {
      if (existing.artifactHash !== input.artifactHash) {
        throw new Error("同一成果版本的內容雜湊不相符，拒絕沿用既有核准。");
      }
      return existing;
    }

    const event: ApprovalEvent = {
      ...input,
      eventId: this.dependencies.createId(),
      action: "approve",
      createdAt: this.dependencies.now(),
      syncStatus: "pending",
      syncedAt: null,
    };
    if (await this.repository.insert(event)) return event;

    const concurrent = await this.repository.findByArtifact(
      input.artifactId,
      input.artifactVersion,
      "approve",
    );
    if (!concurrent) throw new Error("核准事件寫入失敗，且找不到既有事件。");
    if (concurrent.artifactHash !== input.artifactHash) {
      throw new Error("同一成果版本的內容雜湊不相符，拒絕沿用既有核准。");
    }
    return concurrent;
  }

  async listPendingSync() {
    return (await this.repository.list()).filter(
      (event) => event.syncStatus === "pending",
    );
  }

  async markSynced(eventIds: string[], syncedAt: string) {
    if (eventIds.length === 0) return;
    await this.repository.markSynced(eventIds, syncedAt);
  }
}
