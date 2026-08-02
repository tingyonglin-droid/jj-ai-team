import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedEmail } from "./authorization";

test("允許指定帳號且不區分大小寫", () => {
  assert.equal(isAllowedEmail("Owner@Example.com", "owner@example.com"), true);
});

test("拒絕缺少設定及其他帳號", () => {
  assert.equal(isAllowedEmail("owner@example.com", undefined), false);
  assert.equal(isAllowedEmail("other@example.com", "owner@example.com"), false);
});
