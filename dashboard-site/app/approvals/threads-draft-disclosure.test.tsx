import assert from "node:assert/strict";
import test from "node:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ThreadsDraftDisclosure,
  threadsDraftDisclosureReducer,
} from "./threads-draft-disclosure";
import { installTestDom, TestElement, TestMouseEvent } from "./test-dom";

test("草稿揭露切換狀態", () => {
  assert.equal(threadsDraftDisclosureReducer(false, "toggle"), true);
  assert.equal(threadsDraftDisclosureReducer(true, "toggle"), false);
});

test("完整草稿預設收合", () => {
  const html = renderToStaticMarkup(
    <ThreadsDraftDisclosure
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
      blocks={null}
      source="records/content/threads/missing-v01.md"
    />,
  );

  assert.match(html, /完整草稿無法載入/);
  assert.match(html, /重新產生 Dashboard 快照/);
});

test("點擊控制項會展開完整正文並以同一 panel ID 再次收合", async () => {
  const dom = installTestDom();
  const container = dom.document.createElement("div");
  dom.document.body.appendChild(container);
  const root = createRoot(container as unknown as Element);

  try {
    await act(async () => {
      root.render(
        <ThreadsDraftDisclosure
          blocks={[{ type: "paragraph", content: [{ type: "text", text: "完整正文" }] }]}
          source="records/content/threads/example-v01.md"
        />,
      );
    });

    let button = container.queryByTag("button");
    assert.ok(button);
    const panelId = button.getAttribute("aria-controls");
    assert.ok(panelId);
    assert.equal(button.getAttribute("aria-expanded"), "false");
    assert.equal(dom.document.getElementById(panelId), null);

    await act(async () => {
      button?.dispatchEvent(new TestMouseEvent("click", { bubbles: true }));
    });

    button = container.queryByTag("button");
    assert.ok(button);
    assert.equal(button.getAttribute("aria-expanded"), "true");
    assert.equal(button.textContent, "收合草稿");
    const panel = dom.document.getElementById(panelId);
    assert.ok(panel instanceof TestElement);
    assert.equal(panel.textContent, "完整正文");

    await act(async () => {
      button?.dispatchEvent(new TestMouseEvent("click", { bubbles: true }));
    });

    button = container.queryByTag("button");
    assert.equal(button?.getAttribute("aria-expanded"), "false");
    assert.equal(button?.textContent, "查看完整草稿");
    assert.equal(dom.document.getElementById(panelId), null);
  } finally {
    await act(async () => root.unmount());
    dom.restore();
  }
});
