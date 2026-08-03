import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { DashboardApprovedThreadsDocument } from "../../../lib/dashboard-types";
import {
  ApprovedThreadsArchive,
  ApprovedThreadsReader,
  selectApprovedThreadsDocument,
} from "./threads-components.tsx";

const document: DashboardApprovedThreadsDocument = {
  id: "records/content/threads/2026-08-03-market-v01.md",
  artifactKey: "stable-key",
  date: "2026-08-03",
  version: 1,
  versionLabel: "v01",
  title: "Threads 草稿｜市場觀察",
  summary: "市場高檔時的三個觀察。",
  rawStatus: "待核准",
  artifactHash: "sha256:threads-v01",
  approvedAt: "2026-08-03T02:32:00.000Z",
  approvalSyncStatus: "pending",
  blocks: [
    { type: "paragraph", content: [{ type: "text", text: "完整 Threads 正文" }] },
  ],
  source: "records/content/threads/2026-08-03-market-v01.md",
  asOf: "2026-08-03",
  updatedAt: "2026-08-03",
  dependencies: [],
};

test("歷史列表呈現核准文件、同步狀態及全文入口", () => {
  const html = renderToStaticMarkup(
    <ApprovedThreadsArchive documents={[document]} issues={[]} />,
  );

  assert.match(html, /Threads 草稿｜市場觀察/);
  assert.match(html, /2026-08-03/);
  assert.match(html, /v01/);
  assert.match(html, /已核准、尚未同步/);
  assert.match(html, /\/content\/threads\/stable-key/);
  assert.doesNotMatch(html, /核准此版本|發布內容|編輯|刪除/);
});

test("全文頁顯示完整內容與核准追溯資訊", () => {
  const html = renderToStaticMarkup(<ApprovedThreadsReader document={document} />);

  assert.match(html, /完整 Threads 正文/);
  assert.match(html, /2026-08-03T02:32:00.000Z/);
  assert.match(html, /sha256:threads-v01/);
  assert.match(html, /records\/content\/threads/);
  assert.doesNotMatch(html, /核准此版本|發布內容|編輯|刪除/);
});

test("只依穩定 artifactKey 選擇全文", () => {
  assert.equal(selectApprovedThreadsDocument([document], "stable-key"), document);
  assert.equal(selectApprovedThreadsDocument([document], "unknown"), null);
});

test("無法配對的核准只顯示錯誤且沒有全文連結", () => {
  const html = renderToStaticMarkup(
    <ApprovedThreadsArchive
      documents={[]}
      issues={[
        {
          eventId: "event-missing",
          artifactId: "records/content/threads/missing-v01.md",
          version: 1,
          artifactHash: "sha256:missing",
          approvedAt: "2026-08-03T03:00:00.000Z",
          approvalSyncStatus: "blocked",
          reason: "找不到核准紀錄對應的 Threads 全文，已停止顯示正文。",
        },
      ]}
    />,
  );

  assert.match(html, /資料無法載入/);
  assert.match(html, /找不到核准紀錄對應的 Threads 全文/);
  assert.doesNotMatch(html, /閱讀全文/);
});
