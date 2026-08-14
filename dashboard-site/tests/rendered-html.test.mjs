import assert from "node:assert/strict";
import test from "node:test";

async function render(path, email) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: {
        accept: "text/html",
        "oai-authenticated-user-email": email,
        "oai-authenticated-user-id": `test-user:${email}`,
      },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the protected dashboard foundation for an allowed user", async () => {
  process.env.ALLOWED_USER_EMAIL = "owner@example.com";
  const response = await render("/", "owner@example.com");

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>JJ AI Team Dashboard<\/title>/i);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1"\s*\/?/i);
  assert.match(html, /JJ AI Team Dashboard/);
  assert.match(html, /今日總覽/);
  assert.match(html, /<meta name="description" content="私人 AI 團隊控制台。"\s*\/?/i);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview/i);
  assert.doesNotMatch(html, /(?:og:image|twitter:image)/i);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/i);
});

test("production home renders the market-risk chart safety boundary without personalized action copy", async () => {
  process.env.ALLOWED_USER_EMAIL = "owner@example.com";
  const response = await render("/", "owner@example.com");

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /未來 1–4 週市場下行風險/);
  assert.match(html, /最近 4 週/);
  assert.match(html, /全部歷史/);
  assert.doesNotMatch(html, /買進|賣出|調整持股|再平衡建議/);
});

test("production market-risk reader remains protected and action-neutral", async () => {
  process.env.ALLOWED_USER_EMAIL = "owner@example.com";
  const response = await render("/market-risk/2026-08-14?version=v01", "owner@example.com");

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /完整市場風險報告/);
  assert.match(html, /市場風險報告｜2026-08-14-v01/);
  assert.doesNotMatch(html, /買進|賣出|調整持股|再平衡建議/);
});

test("does not server-render dashboard content for a non-allowed user", async () => {
  process.env.ALLOWED_USER_EMAIL = "owner@example.com";
  const response = await render("/", "other@example.com");

  assert.equal(response.status, 403);
  const html = await response.text();
  assert.match(html, /沒有存取此儀表板的權限/);
  assert.doesNotMatch(html, /每日投資晨報|records\/daily-briefs|員工動態/);
});

test("server-renders every protected dashboard route for an allowed user", async () => {
  process.env.ALLOWED_USER_EMAIL = "owner@example.com";

  for (const path of [
    "/",
    "/employees",
    "/approvals",
    "/briefs",
    "/briefs/2026-07-30",
    "/market-risk/2026-08-14?version=v01",
    "/content",
    "/content/threads",
  ]) {
    const response = await render(path, "owner@example.com");
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), /登出 ChatGPT/);
  }
});

test("does not render protected pages for a non-allowed user", async () => {
  process.env.ALLOWED_USER_EMAIL = "owner@example.com";

  for (const path of [
    "/employees",
    "/approvals",
    "/briefs",
    "/briefs/2026-07-30",
    "/market-risk/2026-08-14?version=v01",
    "/content",
    "/content/threads",
  ]) {
    const response = await render(path, "other@example.com");
    assert.equal(response.status, 403, path);
    const html = await response.text();
    assert.match(html, /沒有存取此儀表板的權限/);
    assert.doesNotMatch(
      html,
      /每日投資晨報|市場風險報告|7 月 30 日晨報|定稿摘要|records\/(?:daily-briefs|market-risk|content\/threads)|員工動態|完整 Threads 正文/,
    );
  }
});
