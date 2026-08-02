import type { ApprovalStore } from "../../../db/approval-store";
import type { DashboardSnapshot } from "../../../lib/dashboard-types";
import type { ChatGPTUser } from "../../chatgpt-auth";

type ApprovalHandlerDependencies = {
  requireUser: (returnTo: string) => Promise<ChatGPTUser>;
  loadSnapshot: () => Promise<DashboardSnapshot>;
  store: Pick<ApprovalStore, "approve">;
};

type ApprovalRequestBody = {
  artifactId: string;
  version: number;
};

const MAX_BODY_BYTES = 2048;

export function createApprovalHandler(dependencies: ApprovalHandlerDependencies) {
  return async function handleApproval(request: Request) {
    if (request.method !== "POST") {
      return jsonError(405, "只接受 POST 核准請求。");
    }
    if (!isSameOrigin(request)) {
      return jsonError(403, "核准請求來源不符。");
    }

    const input = await readApprovalBody(request);
    if (input instanceof Response) return input;

    const user = await dependencies.requireUser("/approvals");
    const snapshot = await dependencies.loadSnapshot();
    const artifact = snapshot.approvals.find(
      (approval) =>
        approval.id === input.artifactId && approval.version === input.version,
    );
    if (
      !artifact ||
      (artifact.type !== "晨報" && artifact.type !== "市場風險報告")
    ) {
      return jsonError(409, "此版本已不是可核准狀態。");
    }

    try {
      const event = await dependencies.store.approve({
        artifactId: artifact.id,
        artifactType: artifact.type,
        artifactVersion: artifact.version,
        artifactHash: artifact.artifactHash,
        actorUserId: user.id,
      });
      return Response.json({
        eventId: event.eventId,
        artifactId: event.artifactId,
        status: "approved",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "核准寫入失敗。";
      return jsonError(409, message);
    }
  };
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function readApprovalBody(
  request: Request,
): Promise<ApprovalRequestBody | Response> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return jsonError(415, "核准請求必須使用 JSON。");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return jsonError(413, "核准請求內容過大。");
  }
  try {
    const value = JSON.parse(text) as Partial<ApprovalRequestBody>;
    if (
      typeof value.artifactId !== "string" ||
      value.artifactId.length === 0 ||
      value.artifactId.length > 512 ||
      !Number.isInteger(value.version) ||
      Number(value.version) < 1
    ) {
      return jsonError(400, "核准請求缺少有效的成果 ID 或版本。");
    }
    return { artifactId: value.artifactId, version: Number(value.version) };
  } catch {
    return jsonError(400, "核准請求不是有效 JSON。");
  }
}

function jsonError(status: number, error: string) {
  return Response.json({ error }, { status });
}
