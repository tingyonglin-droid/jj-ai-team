import assert from "node:assert/strict";
import test from "node:test";

import { getRuntimeEnv, runWithRuntimeEnv } from "./runtime-env.ts";

test("同時請求各自取得自己的 Worker 環境", async () => {
  const [first, second] = await Promise.all([
    runWithRuntimeEnv({ marker: "first" }, async () => {
      await Promise.resolve();
      return getRuntimeEnv().marker;
    }),
    runWithRuntimeEnv({ marker: "second" }, async () => {
      await Promise.resolve();
      return getRuntimeEnv().marker;
    }),
  ]);

  assert.deepEqual([first, second], ["first", "second"]);
});

test("請求範圍外不能取得 Worker 環境", () => {
  assert.throws(() => getRuntimeEnv(), /Worker 執行環境尚未注入/);
});
