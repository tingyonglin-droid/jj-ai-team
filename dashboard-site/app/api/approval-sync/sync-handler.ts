import type { ApprovalEvent, ApprovalStore } from "../../../db/approval-store";

type ApprovalSyncHandlerDependencies = {
  secret: string | undefined;
  store: Pick<ApprovalStore, "listPendingSync" | "markSynced">;
};

const MAX_BODY_BYTES = 16_384;

export function createApprovalSyncHandler(dependencies: ApprovalSyncHandlerDependencies) {
  return async function handleApprovalSync(request: Request) {
    if (!(await hasValidServiceSecret(request, dependencies.secret))) {
      return jsonError(401, "同步服務驗證失敗。");
    }

    if (request.method === "GET") {
      const events = (await dependencies.store.listPendingSync()).map(publicEvent);
      return Response.json(
        { events },
        { headers: { "cache-control": "no-store" } },
      );
    }

    if (request.method === "POST") {
      const input = await readAcknowledgeBody(request);
      if (input instanceof Response) return input;
      await dependencies.store.markSynced(input.eventIds, input.syncedAt);
      return Response.json({ status: "synced", eventIds: input.eventIds });
    }

    return jsonError(405, "同步服務只接受 GET 或 POST。");
  };
}

function publicEvent(event: ApprovalEvent) {
  return {
    eventId: event.eventId,
    artifactId: event.artifactId,
    artifactType: event.artifactType,
    artifactVersion: event.artifactVersion,
    artifactHash: event.artifactHash,
    action: event.action,
    createdAt: event.createdAt,
  };
}

async function hasValidServiceSecret(request: Request, expected: string | undefined) {
  if (!expected || expected.length < 16) return false;
  const authorization = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  const supplied = authorization.startsWith(prefix) ? authorization.slice(prefix.length) : "";
  if (!supplied) return false;

  const [expectedHash, suppliedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(expected)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(supplied)),
  ]);
  const left = new Uint8Array(expectedHash);
  const right = new Uint8Array(suppliedHash);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function readAcknowledgeBody(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return jsonError(415, "同步確認必須使用 JSON。");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return jsonError(413, "同步確認內容過大。");
  }

  try {
    const value = JSON.parse(text) as { eventIds?: unknown; syncedAt?: unknown };
    if (
      !Array.isArray(value.eventIds) ||
      value.eventIds.length === 0 ||
      value.eventIds.length > 100 ||
      !value.eventIds.every(
        (eventId) => typeof eventId === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(eventId),
      ) ||
      typeof value.syncedAt !== "string" ||
      !isCanonicalIsoTime(value.syncedAt)
    ) {
      return jsonError(400, "同步確認缺少有效的事件清單或時間。");
    }
    return {
      eventIds: [...new Set(value.eventIds as string[])],
      syncedAt: value.syncedAt,
    };
  } catch {
    return jsonError(400, "同步確認不是有效 JSON。");
  }
}

function isCanonicalIsoTime(value: string) {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function jsonError(status: number, error: string) {
  return Response.json({ error }, { status, headers: { "cache-control": "no-store" } });
}
