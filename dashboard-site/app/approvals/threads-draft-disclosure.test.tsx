import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ThreadsDraftDisclosure,
  threadsDraftDisclosureReducer,
} from "./threads-draft-disclosure";

test("草稿揭露切換狀態", () => {
  assert.equal(threadsDraftDisclosureReducer(false, "toggle"), true);
  assert.equal(threadsDraftDisclosureReducer(true, "toggle"), false);
});

test("完整草稿預設收合", () => {
  const html = renderToStaticMarkup(
    <ThreadsDraftDisclosure
      artifactId="records/content/threads/example-v01.md"
      blocks={[{ type: "paragraph", content: [{ type: "text", text: "完整正文" }] }]}
      source="records/content/threads/example-v01.md"
    />,
  );

  assert.match(html, /查看完整草稿/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, />完整正文</);
});

test("完整草稿缺失時清楚說明重新產生快照", () => {
  const html = renderToStaticMarkup(
    <ThreadsDraftDisclosure
      artifactId="records/content/threads/missing-v01.md"
      blocks={null}
      source="records/content/threads/missing-v01.md"
    />,
  );

  assert.match(html, /完整草稿無法載入/);
  assert.match(html, /重新產生 Dashboard 快照/);
});
