import assert from "node:assert/strict";
import test from "node:test";

async function render(email) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: {
        accept: "text/html",
        "oai-authenticated-user-email": email,
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
  const response = await render("owner@example.com");

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>JJ AI Team Dashboard<\/title>/i);
  assert.match(html, /JJ AI Team Dashboard/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/i);
});

test("does not server-render dashboard content for a non-allowed user", async () => {
  process.env.ALLOWED_USER_EMAIL = "owner@example.com";
  await assert.rejects(render("other@example.com"));
});
