import assert from "node:assert/strict";
import test from "node:test";

import { parseMarketRiskRecordPath } from "./market-risk-record.ts";

test("市場風險檔名解析只接受有效日曆日期與兩位數版本", () => {
  assert.deepEqual(parseMarketRiskRecordPath("records/market-risk/2026-08-14-v01.md"), {
    date: "2026-08-14",
    version: 1,
    versionLabel: "v01",
  });

  for (const source of [
    "records/market-risk/2026-08-14.md",
    "records/market-risk/2026-08-14-v1.md",
    "records/market-risk/2026-08-14-v001.md",
    "records/market-risk/2026-02-30-v01.md",
    "records/market-risk/not-a-date-v01.md",
  ]) {
    assert.equal(parseMarketRiskRecordPath(source), null, source);
  }
});
