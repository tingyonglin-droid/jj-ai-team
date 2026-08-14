import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { DashboardMarketRiskDocument } from "../../lib/dashboard-types";
import { MarketRiskNotFound, MarketRiskReader } from "./market-risk-components";

const documents: DashboardMarketRiskDocument[] = [
  {
    id: "records/market-risk/2026-08-14-v02.md",
    date: "2026-08-14",
    version: 2,
    versionLabel: "v02",
    isLatest: true,
    title: "市場風險報告｜2026-08-14-v02",
    artifactStatus: "待核准",
    rawStatus: "待核准",
    artifactHash: "sha256:v02",
    blocks: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "安全內容 <script>alert(1)</script>，參考 " },
          { type: "link", text: "官方來源", href: "https://example.com/source" },
        ],
      },
    ],
    source: "records/market-risk/2026-08-14-v02.md",
    asOf: "2026-08-14 07:00（Asia/Taipei，UTC+8）",
    updatedAt: "2026-08-14T00:00:00.000Z",
    dependencies: [],
  },
  {
    id: "records/market-risk/2026-08-14-v01.md",
    date: "2026-08-14",
    version: 1,
    versionLabel: "v01",
    isLatest: false,
    title: "市場風險報告｜2026-08-14-v01",
    artifactStatus: "已核准",
    rawStatus: "已核准",
    artifactHash: "sha256:v01",
    blocks: [],
    source: "records/market-risk/2026-08-14-v01.md",
    asOf: "2026-08-14 06:00（Asia/Taipei，UTC+8）",
    updatedAt: "2026-08-14T00:00:00.000Z",
    dependencies: [],
  },
];

test("私人市場風險 reader 安全渲染正文並讓同日可讀版本互相切換", () => {
  const html = renderToStaticMarkup(
    <MarketRiskReader document={documents[0]} versions={documents} />,
  );

  assert.match(html, /完整市場風險報告/);
  assert.match(html, /目前版本：v02/);
  assert.match(html, /aria-current="page"[^>]*>v02/);
  assert.match(html, /href="\/market-risk\/2026-08-14\?version=v01"/);
  assert.match(html, /href="https:\/\/example.com\/source" rel="noreferrer"/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /dangerouslySetInnerHTML/);
});

test("找不到市場風險版本時不洩漏其他私人文件", () => {
  const html = renderToStaticMarkup(
    <MarketRiskNotFound date="2026-08-14" version="v99" />,
  );

  assert.match(html, /找不到市場風險報告/);
  assert.match(html, /2026-08-14/);
  assert.match(html, /v99/);
  assert.doesNotMatch(html, /v02|records\/market-risk|安全內容/);
});
