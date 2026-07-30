export type WorkStatus = "尚未開始" | "等待中" | "進行中" | "待核准" | "已完成" | "受阻";

export interface DashboardSnapshot {
  generatedAt: string;
  date: string;
  approvals: Array<{
    id: string;
    title: string;
    type: string;
    owner: string;
    status: "待核准";
    summary: string;
    decision: string;
    source: string;
    updatedAt: string;
  }>;
  employees: Array<{
    id: string;
    name: string;
    role: string;
    status: WorkStatus;
    currentTask: string;
    progress: string;
    dependencies: string[];
    handoff: string;
    blocker: string | null;
    nextStep: string;
    updatedAt: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    owner: string;
    status: WorkStatus;
    nextStep: string;
  }>;
  brief: { title: string; summary: string; asOf: string; source: string } | null;
  marketRisk: { label: string; asOf: string; source: string; completeness: number | null } | null;
  blockers: Array<{ title: string; reason: string; nextStep: string }>;
}
