import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { artifactContentHash } from "./generate-dashboard-data.mts";

const execFileAsync = promisify(execFile);

export type PendingApprovalEvent = {
  eventId: string;
  artifactId: string;
  artifactType: "晨報" | "市場風險報告";
  artifactVersion: number;
  artifactHash: string;
  action: "approve";
  createdAt: string;
};

export type ApprovalSyncClient = {
  fetchPending(): Promise<PendingApprovalEvent[]>;
  acknowledge(eventIds: string[], syncedAt: string): Promise<void>;
};

type SyncManifest = {
  eventIds: string[];
  decisionPaths: string[];
  createdAt: string;
};

type MaterializeOptions = {
  root: string;
  now?: Date;
};

type AcknowledgeOptions = MaterializeOptions & {
  verifyCommitted?: (root: string, relativePaths: string[]) => Promise<boolean>;
};

const allowedArtifactPatterns = [
  {
    type: "晨報" as const,
    prefix: "daily-brief",
    pattern: /^records\/daily-briefs\/(\d{4}-\d{2}-\d{2})-v(\d{2})\.md$/,
  },
  {
    type: "市場風險報告" as const,
    prefix: "market-risk",
    pattern: /^records\/market-risk\/(\d{4}-\d{2}-\d{2})-v(\d{2})\.md$/,
  },
];

export async function fetchAndMaterialize(
  client: ApprovalSyncClient,
  options: MaterializeOptions,
): Promise<string | null> {
  const now = options.now ?? new Date();
  const events = await client.fetchPending();
  if (events.length === 0) return null;

  const decisions = await Promise.all(
    events.map(async (event) => prepareDecision(options.root, event)),
  );

  for (const decision of decisions) {
    await writeExclusiveOrVerify(
      path.join(options.root, decision.relativePath),
      decision.content,
    );
  }

  const manifest: SyncManifest = {
    eventIds: [...new Set(events.map((event) => event.eventId))],
    decisionPaths: [...new Set(decisions.map((decision) => decision.relativePath))],
    createdAt: now.toISOString(),
  };
  const manifestDirectory = path.join(options.root, ".approval-sync");
  await mkdir(manifestDirectory, { recursive: true });
  const manifestPath = path.join(
    manifestDirectory,
    `${now.toISOString().replace(/[:.]/g, "-")}-manifest.json`,
  );
  await writeExclusiveOrVerify(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifestPath;
}

export async function acknowledgeManifest(
  client: ApprovalSyncClient,
  manifestPath: string,
  options: AcknowledgeOptions,
) {
  const now = options.now ?? new Date();
  const manifest = parseManifest(await readFile(manifestPath, "utf8"));
  const verifyCommitted = options.verifyCommitted ?? decisionsAreCommitted;
  if (!(await verifyCommitted(options.root, manifest.decisionPaths))) {
    throw new Error("同步決策紀錄尚未提交，拒絕 acknowledge。 ");
  }
  await client.acknowledge(manifest.eventIds, now.toISOString());
}

async function prepareDecision(root: string, event: PendingApprovalEvent) {
  const metadata = validateEvent(event);
  const artifactPath = path.join(root, event.artifactId);
  const content = await readFile(artifactPath, "utf8");
  const actualHash = artifactContentHash(content);
  if (actualHash !== event.artifactHash) {
    throw new Error(`內容雜湊不符：${event.artifactId}`);
  }

  const decisionDate = taipeiDate(new Date(event.createdAt));
  const versionLabel = `v${String(event.artifactVersion).padStart(2, "0")}`;
  const relativePath =
    `records/decisions/${decisionDate}-approve-${metadata.prefix}-${metadata.recordDate}-${versionLabel}.md`;
  return {
    relativePath,
    content: `# 核准 ${event.artifactType}｜${metadata.recordDate} ${versionLabel}\n\n` +
      `- 決策日期：${decisionDate}\n` +
      `- 決策者：使用者（Dashboard 已驗證）\n` +
      `- 決定：核准指定成果版本\n` +
      `- 生效日：${decisionDate}\n` +
      `- 適用範圍：僅限 ${event.artifactId} ${versionLabel}\n` +
      `- 來源版本：${event.artifactId}\n` +
      `- 內容雜湊：${event.artifactHash}\n` +
      `- 事件 ID：${event.eventId}\n` +
      `- 狀態：已核准並執行\n\n` +
      `此核准不代表發布、上線、投資、再平衡、持股調整，也不延伸到未來版本。\n`,
  };
}

function validateEvent(event: PendingApprovalEvent) {
  const definition = allowedArtifactPatterns.find(
    (candidate) => candidate.type === event.artifactType,
  );
  const match = definition?.pattern.exec(event.artifactId);
  if (!definition || !match || Number(match[2]) !== event.artifactVersion) {
    throw new Error(`成果路徑或版本不在允許範圍：${event.artifactId}`);
  }
  if (event.action !== "approve") throw new Error("同步事件不是核准動作。");
  if (!/^sha256:[0-9a-f]{64}$/.test(event.artifactHash)) {
    throw new Error("同步事件缺少有效的 SHA-256。");
  }
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(event.eventId)) {
    throw new Error("同步事件 ID 格式不正確。");
  }
  const createdAt = new Date(event.createdAt);
  if (Number.isNaN(createdAt.valueOf()) || createdAt.toISOString() !== event.createdAt) {
    throw new Error("同步事件時間格式不正確。");
  }
  return { prefix: definition.prefix, recordDate: match[1] };
}

async function writeExclusiveOrVerify(filePath: string, content: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
  try {
    await writeFile(filePath, content, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
    if ((await readFile(filePath, "utf8")) !== content) {
      throw new Error(`既有檔案內容衝突：${filePath}`);
    }
  }
}

function parseManifest(text: string): SyncManifest {
  const value = JSON.parse(text) as Partial<SyncManifest>;
  if (
    !Array.isArray(value.eventIds) ||
    value.eventIds.length === 0 ||
    !value.eventIds.every((item) => typeof item === "string") ||
    !Array.isArray(value.decisionPaths) ||
    value.decisionPaths.length === 0 ||
    !value.decisionPaths.every(
      (item) => typeof item === "string" && /^records\/decisions\/[A-Za-z0-9._-]+\.md$/.test(item),
    )
  ) {
    throw new Error("同步 manifest 格式不正確。");
  }
  return value as SyncManifest;
}

async function decisionsAreCommitted(root: string, relativePaths: string[]) {
  for (const relativePath of relativePaths) {
    await access(path.join(root, relativePath), constants.R_OK);
    const { stdout: status } = await execFileAsync("git", ["status", "--porcelain", "--", relativePath], {
      cwd: root,
    });
    if (status.trim()) return false;
    const { stdout: commit } = await execFileAsync("git", ["log", "-1", "--format=%H", "--", relativePath], {
      cwd: root,
    });
    if (!commit.trim()) return false;
  }
  return true;
}

function taipeiDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function createRemoteClient(
  environment: Record<string, string | undefined>,
): ApprovalSyncClient {
  const siteUrl = environment.DASHBOARD_SITE_URL;
  const bypassToken = environment.SITES_BYPASS_TOKEN;
  const syncSecret = environment.APPROVAL_SYNC_SECRET;
  if (!siteUrl || !bypassToken || !syncSecret) {
    throw new Error(
      "缺少 DASHBOARD_SITE_URL、SITES_BYPASS_TOKEN 或 APPROVAL_SYNC_SECRET；同步保持停用。",
    );
  }
  const endpoint = new URL("/api/approval-sync", siteUrl);
  if (endpoint.protocol !== "https:") throw new Error("DASHBOARD_SITE_URL 必須使用 HTTPS。");
  const headers = {
    authorization: `Bearer ${syncSecret}`,
    "OAI-Sites-Authorization": bypassToken,
  };

  return {
    async fetchPending() {
      const response = await fetch(endpoint, { headers });
      const payload = await response.json() as { events?: PendingApprovalEvent[]; error?: string };
      if (!response.ok || !Array.isArray(payload.events)) {
        throw new Error(payload.error ?? `同步匯出失敗（HTTP ${response.status}）。`);
      }
      return payload.events;
    },
    async acknowledge(eventIds, syncedAt) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ eventIds, syncedAt }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? `同步確認失敗（HTTP ${response.status}）。`);
      }
    },
  };
}

async function main() {
  const command = process.argv[2];
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const client = createRemoteClient(process.env);

  if (command === "fetch") {
    const manifestPath = await fetchAndMaterialize(client, { root: repositoryRoot });
    process.stdout.write(
      manifestPath ? `已建立同步 manifest：${manifestPath}\n` : "目前沒有待同步核准事件。\n",
    );
    return;
  }
  if (command === "acknowledge" && process.argv[3]) {
    await acknowledgeManifest(client, path.resolve(process.argv[3]), { root: repositoryRoot });
    process.stdout.write("已回報核准事件同步完成。\n");
    return;
  }
  throw new Error("用法：approvals:sync -- fetch | acknowledge <manifest-path>");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
