export type WorkStatus = "尚未開始" | "等待中" | "進行中" | "待核准" | "已完成" | "受阻";

export type ArtifactStatus = "草稿" | "待核准" | "已核准" | "退回修訂" | "已核准並執行";

export type ApprovalType = "晨報" | "Threads" | "IG" | "市場風險報告" | "風險方法" | "App 規格";

export type Freshness = "今日" | "過期";

export interface TraceableRecord {
  source: string;
  asOf: string;
  updatedAt: string;
  dependencies: string[];
}

export interface DashboardTask extends TraceableRecord {
  id: string;
  title: string;
  owner: string;
  ownerId: string;
  status: WorkStatus;
  artifactStatus: ArtifactStatus;
  rawStatus: string | null;
  nextStep: string;
}

export interface DashboardSnapshot {
  generatedAt: string;
  date: string;
  approvals: Array<
    TraceableRecord & {
      id: string;
      title: string;
      type: ApprovalType;
      owner: string;
      status: "待核准";
      artifactStatus: "待核准";
      rawStatus: string;
      summary: string;
      decision: string;
      createdAt: string | null;
      recordDate: string | null;
    }
  >;
  employees: Array<
    TraceableRecord & {
      id: string;
      name: string;
      role: string;
      status: WorkStatus;
      artifactStatus: ArtifactStatus | null;
      rawStatus: string | null;
      currentTask: string;
      progress: string;
      handoff: string;
      blocker: string | null;
      nextStep: string;
    }
  >;
  tasks: DashboardTask[];
  brief:
    | (TraceableRecord & {
        title: string;
        summary: string;
        freshness: Freshness;
        artifactStatus: ArtifactStatus;
        rawStatus: string;
      })
    | null;
  marketRisk:
    | (TraceableRecord & {
        label: string;
        freshness: Freshness;
        artifactStatus: ArtifactStatus;
        rawStatus: string;
        completeness: number | null;
      })
    | null;
  blockers: Array<{
    severity: "warning" | "blocker";
    kind: "missing" | "stale" | "malformed" | "conflict";
    title: string;
    reason: string;
    nextStep: string;
    source: string | null;
    asOf: string | null;
    updatedAt: string | null;
  }>;
}

export const supportedApprovalTypes: ApprovalType[] = [
  "晨報",
  "Threads",
  "IG",
  "市場風險報告",
  "風險方法",
  "App 規格",
];
