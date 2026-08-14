import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseBriefMarkdown } from "../lib/brief-content.ts";
import {
  loadMarketCalendar,
  resolveReportExpectation,
  sessionDateForReportDate,
  type MarketCalendar,
  type ReportExpectation,
} from "../lib/market-calendar.ts";
import { parseMarketRiskRecordPath } from "../lib/market-risk-record.ts";
import type {
  ApprovalType,
  ArtifactStatus,
  DashboardSnapshot,
  DashboardTask,
  WorkStatus,
  Freshness,
  MarketRiskHistoryNode,
  MarketRiskHistoryIssue,
  MarketRiskState,
} from "../lib/dashboard-types.ts";
import { threadsArtifactKey } from "../lib/dashboard-types.ts";

type SourceDefinition = {
  id: string;
  type: ApprovalType;
  directory: string;
  ownerId: string;
  owner: string;
  requiredFields: string[];
  requiredSections: string[];
};

type MarkdownRecord = {
  content: string;
  relativePath: string;
  updatedAt: string;
  sortAt: string;
  definition: SourceDefinition | null;
  identity: string;
  version: number;
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
};

type SourceTimestamps = {
  updatedAt: string;
  sortAt: string;
};

type SourceUpdatedAtResolver = (relativePath: string, content: string) => Promise<SourceTimestamps>;

type ValidRecord = MarkdownRecord & {
  title: string;
  ownerId: string;
  owner: string;
  artifactStatus: ArtifactStatus;
  rawStatus: string | null;
  workStatus: WorkStatus;
  asOf: string;
  representativeDate: string;
  createdAt: string | null;
  recordDate: string | null;
  dependencies: string[];
};

type ValidationResult =
  | { valid: true; record: ValidRecord }
  | {
      valid: false;
      issue: DashboardSnapshot["blockers"][number];
    };

const operationalSources: Record<"reviews" | "decisions", { ownerId: string; owner: string }> = {
  reviews: { ownerId: "social-operator", owner: "社群經營員" },
  decisions: { ownerId: "commander", owner: "總司令" },
};

function normalizeRelativePath(relativePath: string) {
  return relativePath.split(path.sep).join("/");
}

export function artifactContentHash(content: string) {
  const normalized = content.replace(/\r\n?/g, "\n");
  return `sha256:${createHash("sha256").update(normalized, "utf8").digest("hex")}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstHeading(content: string) {
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;
}

function fieldValues(content: string, label: string) {
  const expression = new RegExp(`^\\s*[-*]\\s*${escapeRegExp(label)}[：:]\\s*(.+?)\\s*$`, "gm");
  return [...content.matchAll(expression)].map((match) => match[1]?.trim() ?? "");
}

function field(content: string, label: string) {
  return fieldValues(content, label)[0] ?? null;
}

function sectionText(content: string, heading: string) {
  const match = content.match(
    new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*\\n([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, "m"),
  );
  return match?.[1]?.trim() ?? "";
}

function summaryFrom(content: string) {
  const section = ["一分鐘摘要", "摘要", "主版本", "方法變更", "問題與證據"]
    .map((heading) => sectionText(content, heading))
    .find(Boolean);
  if (!section) return firstHeading(content) ?? "未命名紀錄";

  const bullets = section
    .split("\n")
    .filter((line) => /^\s*[-*]\s+/.test(line))
    .map((line) => line.replace(/^\s*[-*]\s+/, "").trim());
  return bullets.join(" ") || section.split("\n").find((line) => line.trim())?.trim() || "尚未記載摘要";
}

function normalizeArtifactStatus(rawStatus: string | null): ArtifactStatus | null {
  if (!rawStatus) return null;
  if (rawStatus.startsWith("已核准並執行")) return "已核准並執行";
  if (rawStatus.startsWith("已核准")) return "已核准";
  if (rawStatus.startsWith("待核准")) return "待核准";
  if (rawStatus.startsWith("退回修訂")) return "退回修訂";
  if (rawStatus.startsWith("草稿") || rawStatus.startsWith("探索")) return "草稿";
  return null;
}

function toWorkStatus(status: ArtifactStatus): WorkStatus {
  switch (status) {
    case "草稿":
    case "退回修訂":
      return "進行中";
    case "待核准":
      return "待核准";
    case "已核准":
    case "已核准並執行":
      return "已完成";
  }
}

function dateFrom(value: string | null) {
  return value?.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1] ?? null;
}

function filenameDate(relativePath: string) {
  return dateFrom(path.basename(relativePath));
}

function explicitSourceUpdatedAt(content: string) {
  return (
    field(content, "最後更新時間") ??
    field(content, "產製時間") ??
    field(content, "建立時間") ??
    field(content, "更新時間") ??
    field(content, "整理日期") ??
    field(content, "決策日期") ??
    field(content, "日期") ??
    field(content, "文件日期與版本")
  );
}

export function sourceUpdatedAt(
  content: string,
  relativePath: string,
  gitUpdatedAt: string | null,
) {
  return (
    explicitSourceUpdatedAt(content) ??
    gitUpdatedAt ??
    filenameDate(relativePath) ??
    "來源未提供更新時間"
  );
}

function gitOutput(root: string, arguments_: string[]) {
  try {
    return execFileSync("git", ["-C", root, ...arguments_], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim() || null;
  } catch {
    return null;
  }
}

function sourceUpdatedAtResolver(root: string): SourceUpdatedAtResolver {
  const repositoryRoot = gitOutput(root, ["rev-parse", "--show-toplevel"]);
  const canReadGitMetadata =
    repositoryRoot !== null && gitOutput(root, ["rev-parse", "--show-prefix"]) === null;

  if (canReadGitMetadata && gitOutput(root, ["rev-parse", "--is-shallow-repository"]) === "true") {
    throw new Error("產生 Dashboard 快照需要完整 Git 歷史，淺層複本無法可靠判定來源更新順序。");
  }

  return async (relativePath, content) => {
    const explicit = explicitSourceUpdatedAt(content);
    const gitUpdatedAt = canReadGitMetadata
      ? gitOutput(root, ["log", "-1", "--format=%cI", "--", relativePath])
      : null;
    return {
      updatedAt: sourceUpdatedAt(content, relativePath, gitUpdatedAt),
      sortAt: gitUpdatedAt ?? dateFrom(explicit) ?? filenameDate(relativePath) ?? "",
    };
  };
}

function dependenciesFrom(content: string) {
  const raw =
    field(content, "依賴") ??
    field(content, "依賴與待確認") ??
    field(content, "關聯文件") ??
    field(content, "來源研究");
  if (!raw) return [];
  return raw
    .split(/[、，,;；]/)
    .map((dependency) => dependency.trim().replace(/^`+|[`。.]+$/g, ""))
    .filter(Boolean);
}

function identityAndVersion(definitionId: string, relativePath: string) {
  const basename = path.basename(relativePath, ".md");
  const versionMatch = basename.match(/-v(\d+)$/i);
  const version = versionMatch ? Number(versionMatch[1]) : 0;
  const identity = versionMatch ? basename.slice(0, versionMatch.index) : basename;
  return { identity: `${definitionId}:${identity}`, version };
}

async function artifactDefinitions(): Promise<SourceDefinition[]> {
  const text = await readFile(new URL("../data/artifact-sources.json", import.meta.url), "utf8");
  return (JSON.parse(text) as { artifacts: SourceDefinition[] }).artifacts;
}

async function markdownRecords(
  root: string,
  relativeDirectory: string,
  definition: SourceDefinition | null,
  updatedAtFor: SourceUpdatedAtResolver,
): Promise<MarkdownRecord[]> {
  let entries: Dirent<string>[];
  try {
    entries = await readdir(path.join(root, relativeDirectory), { withFileTypes: true });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  return Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
      .map(async (entry) => {
        const relativePath = normalizeRelativePath(path.join(relativeDirectory, entry.name));
        const absolutePath = path.join(root, relativePath);
        const content = await readFile(absolutePath, "utf8");
        const definitionId = definition?.id ?? relativeDirectory;
        const { identity, version } = identityAndVersion(definitionId, relativePath);
        const timestamps = await updatedAtFor(relativePath, content);
        return {
          content,
          relativePath,
          ...timestamps,
          definition,
          identity,
          version,
        };
      }),
  );
}

async function employeesFromRoles(
  root: string,
  updatedAtFor: SourceUpdatedAtResolver,
): Promise<EmployeeSource[]> {
  let entries: Dirent<string>[];
  try {
    entries = await readdir(path.join(root, "roles"), { withFileTypes: true });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const employees = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const relativePath = normalizeRelativePath(path.join("roles", entry.name, "ROLE.md"));
        try {
          const content = await readFile(path.join(root, relativePath), "utf8");
          const timestamps = await updatedAtFor(relativePath, content);
          return {
            id: entry.name,
            name: firstHeading(content) ?? entry.name,
            handoff: sectionText(content, "交接對象") || "尚未記載",
            relativePath,
            updatedAt: timestamps.updatedAt,
          };
        } catch (error: unknown) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
          throw error;
        }
      }),
  );

  return employees
    .filter((employee): employee is EmployeeSource => employee !== null)
    .sort((left, right) => left.id.localeCompare(right.id));
}

async function workflowsFromDocuments(root: string): Promise<WorkflowSource[]> {
  let entries: Dirent<string>[];
  try {
    entries = await readdir(path.join(root, "workflows"), { withFileTypes: true });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  return Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
      .map(async (entry) => {
        const content = await readFile(path.join(root, "workflows", entry.name), "utf8");
        return {
          ownerText: sectionText(content, "負責角色"),
          firstStep: sectionText(content, "步驟").match(/^\s*1\.\s+(.+)$/m)?.[1]?.trim() ?? null,
        };
      }),
  );
}

function workflowForEmployee(workflows: WorkflowSource[], employee: EmployeeSource) {
  return workflows.find(
    (workflow) =>
      workflow.ownerText.includes(`${employee.name}主責`) ||
      workflow.ownerText.includes(`主責：${employee.name}`) ||
      workflow.ownerText.includes(`主責:${employee.name}`),
  );
}

function issueFor(
  record: MarkdownRecord,
  kind: "missing" | "malformed" | "conflict",
  reason: string,
): DashboardSnapshot["blockers"][number] {
  return {
    severity: "blocker",
    kind,
    title: `來源無法使用：${firstHeading(record.content) ?? path.basename(record.relativePath)}`,
    reason,
    nextStep: "依對應模板補齊或更正來源，建立新版本後重新產生快照。",
    source: record.relativePath,
    asOf: representativeTime(record.content, record.relativePath),
    updatedAt: record.updatedAt,
  };
}

function representativeTime(content: string, relativePath: string) {
  return (
    field(content, "資料截止") ??
    field(content, "最後更新時間") ??
    field(content, "文件日期與版本") ??
    field(content, "生效日") ??
    field(content, "決策日期") ??
    field(content, "整理日期") ??
    field(content, "日期") ??
    filenameDate(relativePath) ??
    ""
  );
}

function validateRecord(record: MarkdownRecord): ValidationResult {
  if (
    record.definition?.id === "market-risk-report" &&
    !parseMarketRiskRecordPath(record.relativePath)
  ) {
    return {
      valid: false,
      issue: issueFor(
        record,
        "malformed",
        "市場風險檔名日期必須有效、版本至少為 v01，且檔名符合 YYYY-MM-DD-vNN.md。",
      ),
    };
  }

  const title = firstHeading(record.content);
  if (!title || title.includes("請填寫")) {
    return { valid: false, issue: issueFor(record, "missing", "缺少有效的一級標題。") };
  }

  if (record.definition) {
    const conflictingFields = record.definition.requiredFields.filter((label) => {
      const values = [...new Set(fieldValues(record.content, label))];
      return values.length > 1;
    });
    if (conflictingFields.length > 0) {
      return {
        valid: false,
        issue: issueFor(record, "conflict", `同一來源的欄位互相衝突：${conflictingFields.join("、")}。`),
      };
    }

    const missingFields = record.definition.requiredFields.filter((label) => {
      const value = field(record.content, label);
      return !value || value.includes("請填寫");
    });
    const missingSections = record.definition.requiredSections.filter(
      (heading) => !sectionText(record.content, heading) || sectionText(record.content, heading).includes("請填寫"),
    );
    if (missingFields.length > 0 || missingSections.length > 0) {
      const details = [
        missingFields.length > 0 ? `缺欄位：${missingFields.join("、")}` : null,
        missingSections.length > 0 ? `缺必要章節：${missingSections.join("、")}` : null,
      ].filter(Boolean);
      return { valid: false, issue: issueFor(record, "missing", `${details.join("；")}。`) };
    }
  }

  const operationalKind = record.relativePath.startsWith("records/decisions/")
    ? "decisions"
    : record.relativePath.startsWith("records/reviews/")
      ? "reviews"
      : null;
  const rawStatus = field(record.content, "狀態");
  let artifactStatus = normalizeArtifactStatus(rawStatus);
  if (operationalKind === "decisions") {
    const missingDecisionFields = ["決策日期", "決策者", "決定", "生效日"].filter(
      (label) => !field(record.content, label),
    );
    if (missingDecisionFields.length > 0) {
      return {
        valid: false,
        issue: issueFor(record, "missing", `決策紀錄缺欄位：${missingDecisionFields.join("、")}。`),
      };
    }
    artifactStatus = "已核准";
  }
  if (!artifactStatus) {
    return {
      valid: false,
      issue: issueFor(record, "malformed", rawStatus ? `無法辨識成果狀態：${rawStatus}。` : "缺少可映射的成果狀態。"),
    };
  }

  const asOf = representativeTime(record.content, record.relativePath);
  const representativeDate = dateFrom(asOf) ?? filenameDate(record.relativePath);
  if (!asOf || !representativeDate) {
    return { valid: false, issue: issueFor(record, "missing", "缺少可辨識的資料代表時間或日期。") };
  }

  const owner = record.definition
    ? { ownerId: record.definition.ownerId, owner: record.definition.owner }
    : operationalKind
      ? operationalSources[operationalKind]
      : operationalSources.decisions;

  return {
    valid: true,
    record: {
      ...record,
      title,
      ...owner,
      artifactStatus,
      rawStatus,
      workStatus: toWorkStatus(artifactStatus),
      asOf,
      representativeDate,
      createdAt: null,
      recordDate: filenameDate(record.relativePath) ?? representativeDate,
      dependencies: dependenciesFrom(record.content),
    },
  };
}

function newestVersionFirst(left: MarkdownRecord, right: MarkdownRecord) {
  return (
    right.version - left.version ||
    right.relativePath.localeCompare(left.relativePath)
  );
}

function selectLatestEffective(records: MarkdownRecord[]) {
  const grouped = Map.groupBy(records, (record) => record.identity);
  const validRecords: ValidRecord[] = [];
  const issues: DashboardSnapshot["blockers"] = [];

  for (const versions of grouped.values()) {
    const sorted = [...versions].sort(newestVersionFirst);
    const newestValidation = validateRecord(sorted[0]);
    if (!newestValidation.valid) issues.push(newestValidation.issue);

    for (const version of sorted) {
      const validation = validateRecord(version);
      if (validation.valid) {
        validRecords.push(validation.record);
        break;
      }
    }
  }

  return { validRecords, issues };
}

export function freshnessFor(
  recordDate: string,
  expectation: ReportExpectation,
  isHistorical = false,
): Freshness {
  if (isHistorical) return "歷史版本";
  if (expectation.phase === "blocked") return "受阻";
  if (expectation.phase === "before_cutoff" && recordDate === expectation.dashboardDate) {
    return "最新";
  }
  if (recordDate !== expectation.expectedReportDate) return "待更新";
  return expectation.phase === "carry_forward" || expectation.phase === "before_cutoff"
    ? "沿用最近交易日"
    : "最新";
}

function buildBriefArchive(
  records: MarkdownRecord[],
  expectation: ReportExpectation,
  calendar: MarketCalendar,
): DashboardSnapshot["briefArchive"] {
  const validRecords = records.flatMap((record) => {
    const validation = validateRecord(record);
    return validation.valid ? [validation.record] : [];
  });
  const latestVersionByDate = new Map<string, number>();
  const latestRecordDate = validRecords.reduce(
    (latest, record) => record.representativeDate > latest ? record.representativeDate : latest,
    "",
  );

  for (const record of validRecords) {
    const latestVersion = latestVersionByDate.get(record.representativeDate);
    if (latestVersion === undefined || record.version > latestVersion) {
      latestVersionByDate.set(record.representativeDate, record.version);
    }
  }

  return validRecords
    .map((record): DashboardSnapshot["briefArchive"][number] => ({
      id: record.relativePath,
      date: record.representativeDate,
      version: record.version,
      versionLabel: `v${String(record.version).padStart(2, "0")}`,
      isLatest: record.version === latestVersionByDate.get(record.representativeDate),
      title: record.title,
      summary: summaryFrom(record.content),
      freshness: freshnessFor(
        record.representativeDate,
        expectation,
        record.representativeDate !== latestRecordDate ||
          record.version !== latestVersionByDate.get(record.representativeDate),
      ),
      artifactStatus: record.artifactStatus,
      rawStatus: record.rawStatus ?? record.artifactStatus,
      artifactHash: artifactContentHash(record.content),
      coveredSessionDate: sessionDateForReportDate(record.representativeDate, calendar),
      blocks: parseBriefMarkdown(record.content),
      source: record.relativePath,
      asOf: record.asOf,
      updatedAt: record.updatedAt,
      dependencies: record.dependencies,
    }))
    .sort(
      (left, right) =>
        right.date.localeCompare(left.date) ||
        right.version - left.version ||
        right.source.localeCompare(left.source),
    );
}

function buildThreadsDocuments(
  records: MarkdownRecord[],
): DashboardSnapshot["threadsDocuments"] {
  return records
    .flatMap((record) => {
      const validation = validateRecord(record);
      if (!validation.valid) return [];
      const valid = validation.record;
      const artifactHash = artifactContentHash(valid.content);
      return [{
        id: valid.relativePath,
        artifactKey: threadsArtifactKey(valid.relativePath, valid.version, artifactHash),
        date: valid.recordDate ?? valid.representativeDate,
        version: valid.version,
        versionLabel: `v${String(valid.version).padStart(2, "0")}`,
        title: valid.title,
        summary: summaryFrom(valid.content),
        rawStatus: valid.rawStatus ?? valid.artifactStatus,
        artifactHash,
        blocks: parseBriefMarkdown(valid.content),
        source: valid.relativePath,
        asOf: valid.asOf,
        updatedAt: valid.updatedAt,
        dependencies: valid.dependencies,
      } satisfies DashboardSnapshot["threadsDocuments"][number]];
    })
    .sort((left, right) =>
      right.date.localeCompare(left.date) ||
      right.version - left.version ||
      right.source.localeCompare(left.source),
    );
}

function newestWorkFirst(left: ValidRecord, right: ValidRecord) {
  return (
    right.representativeDate.localeCompare(left.representativeDate) ||
    right.version - left.version ||
    right.sortAt.localeCompare(left.sortAt) ||
    right.relativePath.localeCompare(left.relativePath)
  );
}

function nextStepFor(record: ValidRecord) {
  switch (record.artifactStatus) {
    case "待核准":
      return "等待使用者核准";
    case "退回修訂":
      return "依退回意見修訂並建立新版本";
    case "草稿":
      return "依工作流完成查核與提交";
    case "已核准":
    case "已核准並執行":
      return "依紀錄保留結果並追蹤後續";
  }
}

function taskFromRecord(record: ValidRecord): DashboardTask {
  return {
    id: record.relativePath,
    title: record.title,
    owner: record.owner,
    ownerId: record.ownerId,
    status: record.workStatus,
    artifactStatus: record.artifactStatus,
    rawStatus: record.rawStatus,
    nextStep: nextStepFor(record),
    dependencies: record.dependencies,
    source: record.relativePath,
    asOf: record.asOf,
    updatedAt: record.updatedAt,
  };
}

function decisionFrom(record: ValidRecord) {
  const approvalSections = ["人工核准", "核准", "圖說與核准", "風險、依賴與核准"];
  for (const section of approvalSections) {
    const content = sectionText(record.content, section);
    const value = field(content, "待核准事項") ?? field(content, "上線決策") ?? field(content, "核准紀錄");
    if (value) return value;
  }
  return "等待使用者決定";
}

function numericField(content: string, label: string) {
  const value = field(content, label);
  return value && /^[+-]?\d+$/.test(value) ? Number(value) : null;
}

function requiredSingleLineField(content: string, label: string) {
  const expression = new RegExp(
    `^[\\t ]*[-*][\\t ]*${escapeRegExp(label)}[：:][\\t ]*([^\\r\\n]*\\S[^\\r\\n]*)[\\t ]*$`,
    "m",
  );
  return content.match(expression)?.[1]?.trim() ?? null;
}

function riskDetails(record: ValidRecord) {
  const score = numericField(record.content, "市場風險分數");
  const baseline = numericField(record.content, "基準分");
  const eventAdjustment = numericField(record.content, "事件調整");
  const completeness = numericField(record.content, "資料完整度");
  const confidence = numericField(record.content, "AI 判斷信心");
  const dailyChange = numericField(record.content, "單日變動");
  const immediateRisk = field(record.content, "即時風險");
  const structuralRisk = field(record.content, "結構性風險");
  const shadow = field(record.content, "影子運行");
  const topRisks = field(record.content, "三項主要風險")?.split("、").map((item) => item.trim()).filter(Boolean) ?? [];
  const pillarScores = [...record.content.matchAll(
    /^\|\s*(?:景氣與成長|通膨與利率|流動性|信用|市場結構)\s*\|\s*20%\s*\|\s*(\d+)\s*\|/gm,
  )].map((match) => Number(match[1]));

  if (
    score === null || baseline === null || eventAdjustment === null || completeness === null || confidence === null ||
    !immediateRisk || !structuralRisk || !shadow?.includes("實驗性指標") || topRisks.length !== 3 ||
    pillarScores.length !== 5 || pillarScores.some((value) => value < 0 || value > 100 || value % 5 !== 0) ||
    baseline !== pillarScores.reduce((sum, value) => sum + value, 0) / 5 ||
    eventAdjustment < -10 || eventAdjustment > 15 || score !== Math.min(100, Math.max(0, baseline + eventAdjustment)) ||
    completeness < 0 || completeness > 100 || confidence < 0 || confidence > 100
  ) {
    return null;
  }

  return {
    score,
    baseline,
    eventAdjustment,
    dailyChange,
    immediateRisk,
    structuralRisk,
    topRisks,
    confidence,
    completeness,
    experimental: true,
  };
}

function riskState(score: number, content: string): MarketRiskState | null {
  void content;
  if (score >= 0 && score <= 20) return "低";
  if (score >= 21 && score <= 24) return "保留區間";
  if (score >= 25 && score <= 40) return "偏低";
  if (score >= 41 && score <= 44) return "保留區間";
  if (score >= 45 && score <= 60) return "中性";
  if (score >= 61 && score <= 64) return "保留區間";
  if (score >= 65 && score <= 80) return "偏高";
  if (score >= 81 && score <= 84) return "保留區間";
  if (score >= 85 && score <= 100) return "高";
  return null;
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function marketRiskHistoryNode(
  record: ValidRecord,
): Omit<MarketRiskHistoryNode, "versions"> | null {
  const score = numericField(record.content, "市場風險分數");
  const dailyChange = numericField(record.content, "單日變動");
  const changeReasons = requiredSingleLineField(record.content, "調整事件");
  const topRisks = requiredSingleLineField(record.content, "三項主要風險")
    ?.split("、")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
  const supportingEvidence = requiredSingleLineField(record.content, "支持證據");
  const counterEvidence = requiredSingleLineField(record.content, "反方證據");
  const confidence = numericField(record.content, "AI 判斷信心");
  const completeness = numericField(record.content, "資料完整度");
  const state = score === null ? null : riskState(score, record.content);

  if (
    score === null || !state || changeReasons === null || topRisks.length !== 3 ||
    supportingEvidence === null || counterEvidence === null || confidence === null || completeness === null ||
    !isIsoDate(record.representativeDate) ||
    score < 0 || score > 100 || confidence < 0 || confidence > 100 ||
    completeness < 0 || completeness > 100
  ) {
    return null;
  }

  return {
    id: record.relativePath,
    date: record.representativeDate,
    version: record.version,
    versionLabel: `v${String(record.version).padStart(2, "0")}`,
    artifactHash: artifactContentHash(record.content),
    artifactStatus: record.artifactStatus,
    rawStatus: record.rawStatus ?? record.artifactStatus,
    asOf: record.asOf,
    updatedAt: record.updatedAt,
    source: record.relativePath,
    score,
    state,
    dailyChange,
    changeReasons,
    topRisks,
    supportingEvidence,
    counterEvidence,
    confidence,
    completeness,
    lowCompleteness: completeness < 70,
    dependencies: record.dependencies,
  };
}

function buildMarketRiskArchive(
  records: MarkdownRecord[],
): DashboardSnapshot["marketRiskArchive"] {
  const filenameRecords = records.flatMap((record) => {
    const filename = parseMarketRiskRecordPath(record.relativePath);
    return filename ? [{ record, filename }] : [];
  });
  const latestVersionByDate = new Map<string, number>();

  for (const { filename } of filenameRecords) {
    const latestVersion = latestVersionByDate.get(filename.date);
    if (latestVersion === undefined || filename.version > latestVersion) {
      latestVersionByDate.set(filename.date, filename.version);
    }
  }

  const readableRecords = filenameRecords.flatMap(({ record, filename }) => {
    const validation = validateRecord(record);
    if (!validation.valid) return [];
    const node = marketRiskHistoryNode(validation.record);
    return node && filename.date === node.date
      ? [{ record: validation.record, filename }]
      : [];
  });

  return readableRecords
    .map(({ record, filename }): DashboardSnapshot["marketRiskArchive"][number] => ({
      id: record.relativePath,
      date: filename.date,
      version: filename.version,
      versionLabel: filename.versionLabel,
      isLatest: filename.version === latestVersionByDate.get(filename.date),
      title: record.title,
      artifactStatus: record.artifactStatus,
      rawStatus: record.rawStatus ?? record.artifactStatus,
      artifactHash: artifactContentHash(record.content),
      blocks: parseBriefMarkdown(record.content),
      source: record.relativePath,
      asOf: record.asOf,
      updatedAt: record.updatedAt,
      dependencies: record.dependencies,
    }))
    .sort(
      (left, right) =>
        right.date.localeCompare(left.date) ||
        right.version - left.version ||
        right.source.localeCompare(left.source),
    );
}

function marketRiskHistoryIssue(record: MarkdownRecord, reason: string): MarketRiskHistoryIssue {
  return {
    date: filenameDate(record.relativePath) ?? "",
    source: record.relativePath,
    version: record.version,
    reason,
  };
}

function buildMarketRiskHistory(records: MarkdownRecord[]): DashboardSnapshot["marketRiskHistory"] {
  const marketRiskRecords = records.filter(
    (record) => record.definition?.id === "market-risk-report",
  );
  const parsedRecords = marketRiskRecords.flatMap((record) => {
    const filename = parseMarketRiskRecordPath(record.relativePath);
    return filename ? [{ record, filename }] : [];
  });
  const grouped = Map.groupBy(
    parsedRecords,
    ({ filename }) => filename.date,
  );
  const nodes: MarketRiskHistoryNode[] = [];
  const issues: MarketRiskHistoryIssue[] = marketRiskRecords.flatMap((record) =>
    parseMarketRiskRecordPath(record.relativePath)
      ? []
      : [marketRiskHistoryIssue(
          record,
          "檔名日期必須有效且檔名符合 YYYY-MM-DD-vNN.md，無法建立市場風險歷史節點。",
        )],
  );

  for (const [filenameDateValue, versions] of grouped) {
    const sorted = [...versions].sort(
      (left, right) =>
        right.filename.version - left.filename.version ||
        right.record.relativePath.localeCompare(left.record.relativePath),
    );
    const latest = sorted[0]!;
    const latestRecord = latest.record;
    const latestValidation = validateRecord(latestRecord);
    const latestNode = latestValidation.valid ? marketRiskHistoryNode(latestValidation.record) : null;
    const versionEntries = sorted.map(({ record, filename }) => {
      const validation = validateRecord(record);
      const node = validation.valid ? marketRiskHistoryNode(validation.record) : null;
      const readable = node !== null && node.date === filenameDateValue;
      return {
        id: record.relativePath,
        version: filename.version,
        versionLabel: filename.versionLabel,
        source: record.relativePath,
        readable,
      };
    });

    if (!latestNode) {
      const reason = latestValidation.valid
        ? "最高版本缺少市場風險歷史所需的有效分數、證據或品質欄位。"
        : latestValidation.issue.reason;
      issues.push(marketRiskHistoryIssue(latestRecord, reason));
      continue;
    }
    if (latestNode.date !== filenameDateValue) {
      issues.push(marketRiskHistoryIssue(latestRecord, "檔名日期與資料代表日期不符，無法建立市場風險歷史節點。"));
      continue;
    }

    nodes.push({ ...latestNode, versions: versionEntries });
  }

  return {
    nodes: nodes.sort((left, right) => left.date.localeCompare(right.date)),
    issues: issues.sort((left, right) => left.date.localeCompare(right.date) || left.source.localeCompare(right.source)),
  };
}

function missingSummaryIssue(
  title: string,
  directory: string,
  nextStep: string,
): DashboardSnapshot["blockers"][number] {
  return {
    severity: "blocker",
    kind: "missing",
    title,
    reason: `${directory}/ 沒有可用的有效紀錄。`,
    nextStep,
    source: null,
    asOf: null,
    updatedAt: null,
  };
}

function pendingUpdateIssue(
  label: string,
  record: ValidRecord,
  expectation: ReportExpectation,
): DashboardSnapshot["blockers"][number] {
  return {
    severity: "warning",
    kind: "pending_update",
    title: `${label}待更新`,
    reason: `目前應有報告日為 ${expectation.expectedReportDate ?? "無法判定"}，最後有效資料日期為 ${record.representativeDate}。`,
    nextStep: "依對應工作流產生應有交易日紀錄。",
    source: record.relativePath,
    asOf: record.asOf,
    updatedAt: record.updatedAt,
  };
}

export async function generateDashboardSnapshot(root: string, now: Date): Promise<DashboardSnapshot> {
  const definitions = await artifactDefinitions();
  const updatedAtFor = sourceUpdatedAtResolver(root);
  const [employees, workflows, artifactRecordSets, reviews, decisions] = await Promise.all([
    employeesFromRoles(root, updatedAtFor),
    workflowsFromDocuments(root),
    Promise.all(
      definitions.map((definition) =>
        markdownRecords(root, definition.directory, definition, updatedAtFor),
      ),
    ),
    markdownRecords(root, "records/reviews", null, updatedAtFor),
    markdownRecords(root, "records/decisions", null, updatedAtFor),
  ]);
  const calendar = loadMarketCalendar();
  const expectation = resolveReportExpectation(now, calendar);
  const dashboardDate = expectation.dashboardDate;
  const dailyBriefIndex = definitions.findIndex((definition) => definition.id === "daily-brief");
  const briefArchive = buildBriefArchive(
    dailyBriefIndex >= 0 ? artifactRecordSets[dailyBriefIndex] : [],
    expectation,
    calendar,
  );
  const threadsIndex = definitions.findIndex((definition) => definition.id === "threads");
  const threadsDocuments = buildThreadsDocuments(
    threadsIndex >= 0 ? artifactRecordSets[threadsIndex] : [],
  );
  const riskDefinitionIndex = definitions.findIndex((definition) => definition.id === "market-risk-report");
  const marketRiskHistory = buildMarketRiskHistory(
    riskDefinitionIndex >= 0 ? artifactRecordSets[riskDefinitionIndex] : [],
  );
  const marketRiskArchive = buildMarketRiskArchive(
    riskDefinitionIndex >= 0 ? artifactRecordSets[riskDefinitionIndex] : [],
  );
  const allRecords = [...artifactRecordSets.flat(), ...reviews, ...decisions];
  const { validRecords, issues } = selectLatestEffective(allRecords);
  const sortedValidRecords = [...validRecords].sort(newestWorkFirst);
  const tasksForEmployees = sortedValidRecords.map(taskFromRecord);
  const currentTasks = tasksForEmployees.filter(
    (task) =>
      dateFrom(task.asOf) === dashboardDate ||
      task.status === "進行中" ||
      task.status === "待核准" ||
      task.status === "受阻",
  );

  const latestTaskByOwner = new Map<string, DashboardTask>();
  for (const task of tasksForEmployees) {
    if (!latestTaskByOwner.has(task.ownerId)) latestTaskByOwner.set(task.ownerId, task);
  }

  const employeeSnapshots = employees.map((employee) => {
    const task = latestTaskByOwner.get(employee.id);
    const workflow = workflowForEmployee(workflows, employee);
    return {
      id: employee.id,
      name: employee.name,
      role: employee.name,
      status: task?.status ?? ("尚未開始" as const),
      artifactStatus: task?.artifactStatus ?? null,
      rawStatus: task?.rawStatus ?? null,
      currentTask: task?.title ?? "尚未產出",
      progress:
        task?.status === "待核准"
          ? "等待人工核准"
          : task
            ? `工作狀態：${task.status}`
            : "尚未產出",
      dependencies: task?.dependencies ?? [],
      handoff: employee.handoff,
      blocker: task?.status === "受阻" ? "紀錄標示此任務受阻" : null,
      nextStep: task?.nextStep ?? workflow?.firstStep ?? "等待工作流或紀錄產出",
      source: task?.source ?? employee.relativePath,
      asOf: task?.asOf ?? "尚未產出",
      updatedAt: task?.updatedAt ?? employee.updatedAt,
    };
  });

  const approvals = sortedValidRecords
    .filter(
      (record): record is ValidRecord & { definition: SourceDefinition } =>
        record.artifactStatus === "待核准" && record.definition !== null,
    )
    .map((record) => ({
      id: record.relativePath,
      title: record.title,
      type: record.definition.type,
      owner: record.owner,
      status: "待核准" as const,
      artifactStatus: "待核准" as const,
      rawStatus: record.rawStatus ?? "待核准",
      summary: summaryFrom(record.content),
      fullContent:
        record.definition.type === "Threads"
          ? { format: "structured-markdown" as const, blocks: parseBriefMarkdown(record.content) }
          : null,
      decision: decisionFrom(record),
      source: record.relativePath,
      asOf: record.asOf,
      createdAt: record.createdAt,
      recordDate: record.recordDate,
      version: record.version,
      artifactHash: artifactContentHash(record.content),
      updatedAt: record.updatedAt,
      dependencies: record.dependencies,
    }));

  const briefRecord = sortedValidRecords.find((record) => record.definition?.id === "daily-brief") ?? null;
  const riskRecord = sortedValidRecords.find((record) => record.definition?.id === "market-risk-report") ?? null;
  const parsedRisk = riskRecord ? riskDetails(riskRecord) : null;
  const blockers = [...issues];

  if (expectation.phase === "blocked") {
    blockers.push({
      severity: "blocker",
      kind: "calendar",
      title: "交易日曆設定受阻",
      reason: expectation.reason,
      nextStep: "以 NYSE 官方日曆新增涵蓋年度並重新產生 Dashboard。",
      source: "dashboard-site/data/nyse-market-calendar.json",
      asOf: expectation.dashboardDate,
      updatedAt: calendar.sources[0]?.checkedAt ?? null,
    });
  }

  if (!briefRecord) {
    blockers.push(
      missingSummaryIssue("晨報尚未產出", "records/daily-briefs", "依 daily-brief 工作流產出並保存晨報。"),
    );
  } else if (freshnessFor(briefRecord.representativeDate, expectation) === "待更新") {
    blockers.push(pendingUpdateIssue("晨報", briefRecord, expectation));
  }

  if (!riskRecord) {
    blockers.push(
      missingSummaryIssue(
        "市場風險資料尚未產出",
        "records/market-risk",
        "依 market-risk 工作流建立可追溯的市場風險紀錄。",
      ),
    );
  } else if (freshnessFor(riskRecord.representativeDate, expectation) === "待更新") {
    blockers.push(pendingUpdateIssue("市場風險資料", riskRecord, expectation));
  }
  if (riskRecord && !parsedRisk) {
    blockers.push(issueFor(riskRecord, "malformed", "風險分數、期限或計算欄位無法重現。"));
  }

  return {
    generatedAt: now.toISOString(),
    date: dashboardDate,
    expectation,
    approvals,
    employees: employeeSnapshots,
    tasks: currentTasks,
    briefArchive,
    threadsDocuments,
    approvedThreadsArchive: [],
    threadsArchiveIssues: [],
    brief: briefRecord
      ? {
          title: briefRecord.title,
          headline: briefRecord.title,
          summary: summaryFrom(briefRecord.content),
          freshness: freshnessFor(briefRecord.representativeDate, expectation),
          artifactStatus: briefRecord.artifactStatus,
          rawStatus: briefRecord.rawStatus ?? briefRecord.artifactStatus,
          version: briefRecord.version,
          artifactHash: artifactContentHash(briefRecord.content),
          coveredSessionDate: sessionDateForReportDate(briefRecord.representativeDate, calendar),
          asOf: briefRecord.asOf,
          source: briefRecord.relativePath,
          updatedAt: briefRecord.updatedAt,
          dependencies: briefRecord.dependencies,
        }
      : null,
    marketRisk: riskRecord && parsedRisk
      ? {
          label: riskRecord.title,
          freshness: freshnessFor(riskRecord.representativeDate, expectation),
          artifactStatus: riskRecord.artifactStatus,
          rawStatus: riskRecord.rawStatus ?? riskRecord.artifactStatus,
          version: riskRecord.version,
          artifactHash: artifactContentHash(riskRecord.content),
          coveredSessionDate: sessionDateForReportDate(riskRecord.representativeDate, calendar),
          asOf: riskRecord.asOf,
          source: riskRecord.relativePath,
          updatedAt: riskRecord.updatedAt,
          dependencies: riskRecord.dependencies,
          ...parsedRisk,
        }
      : null,
    marketRiskHistory,
    marketRiskArchive,
    blockers: blockers.sort((left, right) => {
      if (left.severity !== right.severity) return left.severity === "blocker" ? -1 : 1;
      return left.title.localeCompare(right.title);
    }),
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
