import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ApprovalAction,
  approvalActionReducer,
  initialApprovalActionState,
  submitApproval,
} from "./approval-action";

test("核准按鍵必須經過確認步驟才能送出", () => {
  const confirming = approvalActionReducer(initialApprovalActionState, { type: "request" });
  assert.equal(confirming.phase, "confirming");

  const submitting = approvalActionReducer(confirming, { type: "submit" });
  assert.equal(submitting.phase, "submitting");

  const completed = approvalActionReducer(submitting, { type: "success" });
  assert.equal(completed.phase, "success");

  const failed = approvalActionReducer(submitting, {
    type: "failure",
    message: "核准資料庫暫時無法使用。",
  });
  assert.deepEqual(failed, {
    phase: "error",
    message: "核准資料庫暫時無法使用。",
  });

  assert.deepEqual(
    approvalActionReducer(confirming, { type: "cancel" }),
    initialApprovalActionState,
  );
});

test("送出核准時只傳成果 ID 與版本", async () => {
  let capturedInput: RequestInfo | URL | null = null;
  let capturedInit: RequestInit | undefined;
  const result = await submitApproval(
    "records/daily-briefs/2026-07-31-v01.md",
    1,
    async (input, init) => {
      capturedInput = input;
      capturedInit = init;
      return Response.json({
        eventId: "approval-1",
        artifactId: "records/daily-briefs/2026-07-31-v01.md",
        status: "approved",
      });
    },
  );

  assert.equal(capturedInput, "/api/approvals");
  assert.equal(capturedInit?.method, "POST");
  assert.deepEqual(capturedInit?.headers, { "content-type": "application/json" });
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
    artifactId: "records/daily-briefs/2026-07-31-v01.md",
    version: 1,
  });
  assert.equal(result.status, "approved");
});

test("初始畫面只顯示第一段核准按鍵", () => {
  const html = renderToStaticMarkup(
    <ApprovalAction
      artifactId="records/market-risk/2026-07-31-v01.md"
      artifactTitle="市場風險報告｜2026-07-31"
      version={1}
    />,
  );

  assert.match(html, />核准此版本</);
  assert.doesNotMatch(html, /確認核准/);
  assert.doesNotMatch(html, /role="alertdialog"/);
});
