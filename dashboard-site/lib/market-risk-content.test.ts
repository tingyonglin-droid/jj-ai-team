import assert from "node:assert/strict";
import test from "node:test";

import type { DashboardMarketRiskDocument } from "./dashboard-types";
import {
  marketRiskDocumentHref,
  marketRiskVersionsForDate,
  selectMarketRiskVersion,
} from "./market-risk-content";

const documents = [
  { id: "v01", date: "2026-08-14", version: 1, versionLabel: "v01", isLatest: false },
  { id: "v02", date: "2026-08-14", version: 2, versionLabel: "v02", isLatest: true },
  { id: "other", date: "2026-08-13", version: 1, versionLabel: "v01", isLatest: true },
] as DashboardMarketRiskDocument[];

test("市場風險 reader URL 固定在私人 route 並安全編碼版本", () => {
  assert.equal(
    marketRiskDocumentHref("2026-08-14", "v 01"),
    "/market-risk/2026-08-14?version=v%2001",
  );
});

test("市場風險 reader 依日期與版本選取文件且不回退不存在版本", () => {
  assert.equal(selectMarketRiskVersion(documents, "2026-08-14")?.id, "v02");
  assert.equal(selectMarketRiskVersion(documents, "2026-08-14", "v01")?.id, "v01");
  assert.equal(selectMarketRiskVersion(documents, "2026-08-14", "v99"), null);
  assert.deepEqual(marketRiskVersionsForDate(documents, "2026-08-14").map((item) => item.id), [
    "v02",
    "v01",
  ]);
});
