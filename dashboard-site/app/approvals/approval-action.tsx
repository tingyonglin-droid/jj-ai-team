"use client";

import { useId, useReducer } from "react";

export type ApprovalActionState =
  | { phase: "idle" }
  | { phase: "confirming" }
  | { phase: "submitting" }
  | { phase: "success" }
  | { phase: "error"; message: string };

export type ApprovalActionEvent =
  | { type: "request" }
  | { type: "cancel" }
  | { type: "submit" }
  | { type: "success" }
  | { type: "failure"; message: string };

export const initialApprovalActionState: ApprovalActionState = { phase: "idle" };

export function approvalActionReducer(
  state: ApprovalActionState,
  event: ApprovalActionEvent,
): ApprovalActionState {
  switch (event.type) {
    case "request":
      return state.phase === "submitting" ? state : { phase: "confirming" };
    case "cancel":
      return state.phase === "submitting" ? state : initialApprovalActionState;
    case "submit":
      return state.phase === "confirming" || state.phase === "error"
        ? { phase: "submitting" }
        : state;
    case "success":
      return state.phase === "submitting" ? { phase: "success" } : state;
    case "failure":
      return state.phase === "submitting"
        ? { phase: "error", message: event.message }
        : state;
  }
}

type ApprovalResult = {
  eventId: string;
  artifactId: string;
  status: "approved";
};

export async function submitApproval(
  artifactId: string,
  version: number,
  fetchImplementation: typeof fetch = fetch,
): Promise<ApprovalResult> {
  const response = await fetchImplementation("/api/approvals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ artifactId, version }),
  });
  const payload = (await response.json().catch(() => null)) as
    | ApprovalResult
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload && "error" in payload && payload.error
      ? payload.error
      : "核准寫入失敗，請稍後再試。");
  }
  if (!payload || !("status" in payload) || payload.status !== "approved") {
    throw new Error("核准回應格式不正確，請重新整理後再試。");
  }

  return payload;
}

export function ApprovalAction({
  artifactId,
  artifactTitle,
  version,
}: {
  artifactId: string;
  artifactTitle: string;
  version: number;
}) {
  const [state, dispatch] = useReducer(approvalActionReducer, initialApprovalActionState);
  const titleId = useId();
  const isConfirming = state.phase === "confirming" || state.phase === "submitting" || state.phase === "error";

  async function approve() {
    dispatch({ type: "submit" });
    try {
      await submitApproval(artifactId, version);
      dispatch({ type: "success" });
      window.location.reload();
    } catch (error) {
      dispatch({
        type: "failure",
        message: error instanceof Error ? error.message : "核准寫入失敗，請稍後再試。",
      });
    }
  }

  if (state.phase === "success") {
    return <p className="approval-success" role="status">核准已記錄，正在更新 Dashboard。</p>;
  }

  if (!isConfirming) {
    return (
      <div className="approval-action">
        <button type="button" className="approval-primary-button" onClick={() => dispatch({ type: "request" })}>
          核准此版本
        </button>
      </div>
    );
  }

  return (
    <div className="approval-confirmation" role="alertdialog" aria-labelledby={titleId}>
      <p id={titleId}>
        確認核准「{artifactTitle}」v{String(version).padStart(2, "0")}？
      </p>
      <p>核准只代表接受這個版本，不會發布內容、下單或核准未來版本。</p>
      {state.phase === "error" ? <p className="error-text" role="alert">{state.message}</p> : null}
      <div className="approval-confirmation-actions">
        <button
          type="button"
          className="approval-primary-button"
          disabled={state.phase === "submitting"}
          onClick={approve}
        >
          {state.phase === "submitting" ? "記錄中…" : "確認核准"}
        </button>
        <button
          type="button"
          className="approval-secondary-button"
          disabled={state.phase === "submitting"}
          onClick={() => dispatch({ type: "cancel" })}
        >
          取消
        </button>
      </div>
    </div>
  );
}
