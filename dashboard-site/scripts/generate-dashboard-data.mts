import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { DashboardSnapshot, WorkStatus } from "../lib/dashboard-types.ts";

type MarkdownRecord = {
  content: string;
  relativePath: string;
  updatedAt: string;
};

type EmployeeSource = {
  id: string;
  name: string;
  handoff: string;
  relativePath: string;
  updatedAt: string;
};

type WorkflowSource = {
  ownerText: string;
  firstStep: string | null;
  relativePath: string;
};

const statusValues: WorkStatus[] = ["尚未開始", "等待中", "進行中", "待核准", "已完成", "受阻"];

function normalizeRelativePath(relativePath: string) {
  return relativePath.split(path.sep).join("/");
}

function firstHeading(content: string) {
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "未命名紀錄";
}

function field(content: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return content.match(new RegExp(`^\\s*[-*]\\s*${escaped}[：:]\\s*(.+?)\\s*$`, "m"))?.[1]?.trim() ?? null;
}

function sectionText(content: string, heading: string) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`^##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, "m"));
  return match?.[1]?.trim() ?? "";
}

function summaryFrom(content: string) {
  const section = sectionText(content, "一分鐘摘要");
  const bullets = section
    .split("\n")
    .filter((line) => /^\s*[-*]\s+/.test(line))
    .map((line) => line.replace(/^\s*[-*]\s+/, "").trim());
  return bullets.join(" ") || firstHeading(content);
}

function toWorkStatus(rawStatus: string | null): WorkStatus {
  return rawStatus && statusValues.includes(rawStatus as WorkStatus) ? (rawStatus as WorkStatus) : "尚未開始";
}

function ownerForPath(relativePath: string) {
  if (relativePath.startsWith("records/daily-briefs/") || relativePath.startsWith("records/market-risk/")) {
    return "macro-researcher";
  }
  if (relativePath.startsWith("records/reviews/")) return "social-operator";
  if (relativePath.startsWith("records/decisions/")) return "commander";
  return "commander";
}

function newestRecordFirst(left: MarkdownRecord, right: MarkdownRecord) {
  const filenameComparison = path.basename(right.relativePath).localeCompare(path.basename(left.relativePath));
  return filenameComparison || right.relativePath.localeCompare(left.relativePath);
}

async function markdownRecords(root: string, relativeDirectory: string): Promise<MarkdownRecord[]> {
  const absoluteDirectory = path.join(root, relativeDirectory);
  let entries: Dirent<string>[];
  try {
    entries = await readdir(absoluteDirectory, { withFileTypes: true });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const records = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
      .map(async (entry) => {
        const relativePath = normalizeRelativePath(path.join(relativeDirectory, entry.name));
        const absolutePath = path.join(root, relativePath);
        const [content, metadata] = await Promise.all([readFile(absolutePath, "utf8"), stat(absolutePath)]);
        return { content, relativePath, updatedAt: metadata.mtime.toISOString() };
      }),
  );

  return records.sort(newestRecordFirst);
}

async function employeesFromRoles(root: string): Promise<EmployeeSource[]> {
  const rolesDirectory = path.join(root, "roles");
  let entries: Dirent<string>[];
  try {
    entries = await readdir(rolesDirectory, { withFileTypes: true });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const employees = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const relativePath = normalizeRelativePath(path.join("roles", entry.name, "ROLE.md"));
        const absolutePath = path.join(root, relativePath);
        try {
          const [content, metadata] = await Promise.all([readFile(absolutePath, "utf8"), stat(absolutePath)]);
          return {
            id: entry.name,
            name: firstHeading(content),
            handoff: sectionText(content, "交接對象") || "尚未記載",
            relativePath,
            updatedAt: metadata.mtime.toISOString(),
          };
        } catch (error: unknown) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
          throw error;
        }
      }),
  );

  return employees.filter((employee): employee is EmployeeSource => employee !== null).sort((left, right) => left.id.localeCompare(right.id));
}

async function workflowsFromDocuments(root: string): Promise<WorkflowSource[]> {
  const relativeDirectory = "workflows";
  const absoluteDirectory = path.join(root, relativeDirectory);
  let entries: Dirent<string>[];
  try {
    entries = await readdir(absoluteDirectory, { withFileTypes: true });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const workflows = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
      .map(async (entry) => {
        const relativePath = normalizeRelativePath(path.join(relativeDirectory, entry.name));
        const content = await readFile(path.join(root, relativePath), "utf8");
        return {
          ownerText: sectionText(content, "負責角色"),
          firstStep: sectionText(content, "步驟").match(/^\s*1\.\s+(.+)$/m)?.[1]?.trim() ?? null,
          relativePath,
        };
      }),
  );

  return workflows.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function workflowForEmployee(workflows: WorkflowSource[], employee: EmployeeSource) {
  return workflows.find(
    (workflow) =>
      workflow.ownerText.includes(`${employee.name}主責`) ||
      workflow.ownerText.includes(`主責：${employee.name}`) ||
      workflow.ownerText.includes(`主責:${employee.name}`),
  );
}

function taskFromRecord(record: MarkdownRecord, owner: string) {
  const status = toWorkStatus(field(record.content, "狀態"));
  return {
    id: record.relativePath,
    title: firstHeading(record.content),
    owner,
    status,
    nextStep: status === "待核准" ? "等待使用者核准" : "依紀錄所列下一步執行",
  };
}

export async function generateDashboardSnapshot(root: string, now: Date): Promise<DashboardSnapshot> {
  const [employees, workflows, briefs, risks, reviews, decisions] = await Promise.all([
    employeesFromRoles(root),
    workflowsFromDocuments(root),
    markdownRecords(root, "records/daily-briefs"),
    markdownRecords(root, "records/market-risk"),
    markdownRecords(root, "records/reviews"),
    markdownRecords(root, "records/decisions"),
  ]);
  const allRecords = [...briefs, ...risks, ...reviews, ...decisions];
  const newestBrief = briefs[0] ?? null;
  const newestRisk = risks[0] ?? null;

  const approvals = allRecords
    .filter((record) => field(record.content, "狀態") === "待核准")
    .sort((left, right) => right.relativePath.localeCompare(left.relativePath))
    .map((record) => ({
      id: record.relativePath,
      title: firstHeading(record.content),
      type: record.relativePath.split("/")[1] ?? "record",
      owner: ownerForPath(record.relativePath),
      status: "待核准" as const,
      summary: summaryFrom(record.content),
      decision: field(sectionText(record.content, "人工核准"), "待核准事項") ?? "等待使用者決定",
      source: record.relativePath,
      updatedAt: record.updatedAt,
    }));

  const recordTasks = allRecords
    .filter((record) => statusValues.includes(field(record.content, "狀態") as WorkStatus))
    .sort(newestRecordFirst)
    .map((record) => taskFromRecord(record, ownerForPath(record.relativePath)))
  const latestTaskByOwner = new Map<string, (typeof recordTasks)[number]>();
  for (const task of recordTasks) {
    if (!latestTaskByOwner.has(task.owner)) latestTaskByOwner.set(task.owner, task);
  }

  const employeeSnapshots = employees.map((employee) => {
    const task = latestTaskByOwner.get(employee.id);
    const workflow = workflowForEmployee(workflows, employee);
    const status = task?.status ?? "尚未開始";
    return {
      id: employee.id,
      name: employee.name,
      role: employee.name,
      status,
      currentTask: task?.title ?? "尚未產出",
      progress: status === "待核准" ? "等待人工核准" : task ? "已記錄工作狀態" : "尚未產出",
      dependencies: [],
      handoff: employee.handoff,
      blocker: null,
      nextStep: task?.nextStep ?? workflow?.firstStep ?? "等待工作流或紀錄產出",
      updatedAt: employee.updatedAt,
    };
  });

  const blockers: DashboardSnapshot["blockers"] = [];
  if (!newestBrief) {
    blockers.push({
      title: "晨報尚未產出",
      reason: "records/daily-briefs/ 沒有可用的晨報紀錄。",
      nextStep: "依 daily-brief 工作流產出並保存晨報。",
    });
  }
  if (!newestRisk) {
    blockers.push({
      title: "市場風險資料尚未產出",
      reason: "records/market-risk/ 尚未產出可用資料，無法顯示分數或完整度。",
      nextStep: "依 market-risk 工作流建立可追溯的市場風險紀錄。",
    });
  }

  return {
    generatedAt: now.toISOString(),
    date: now.toISOString().slice(0, 10),
    approvals,
    employees: employeeSnapshots,
    tasks: recordTasks,
    brief: newestBrief
      ? {
          title: firstHeading(newestBrief.content),
          summary: summaryFrom(newestBrief.content),
          asOf: field(newestBrief.content, "資料截止") ?? newestBrief.updatedAt,
          source: newestBrief.relativePath,
        }
      : null,
    marketRisk: newestRisk
      ? {
          label: firstHeading(newestRisk.content),
          asOf: field(newestRisk.content, "資料截止") ?? newestRisk.updatedAt,
          source: newestRisk.relativePath,
          completeness: (() => {
            const value = field(newestRisk.content, "資料完整度")?.match(/^(\d{1,3})\s*(?:%|\/100)?$/)?.[1];
            const completeness = value ? Number(value) : null;
            return completeness !== null && completeness >= 0 && completeness <= 100 ? completeness : null;
          })(),
        }
      : null,
    blockers,
  };
}

async function main() {
  const root = path.resolve(process.argv[2] ?? "..");
  const snapshot = await generateDashboardSnapshot(root, new Date());
  const destination = path.resolve(process.cwd(), "data/dashboard.json");
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
