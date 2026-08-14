import Link from "next/link";

import type { DashboardMarketRiskDocument } from "../../lib/dashboard-types";
import { marketRiskDocumentHref } from "../../lib/market-risk-content";
import { ArtifactContent } from "../approvals/artifact-content";
import { StatusBadge } from "../dashboard-components";

export function MarketRiskReader({
  document,
  versions,
}: {
  document: DashboardMarketRiskDocument;
  versions: DashboardMarketRiskDocument[];
}) {
  return (
    <article aria-labelledby="market-risk-reader-heading" className="brief-reader market-risk-reader">
      <Link href="/#risk-history-heading" className="text-link">
        返回市場風險歷史
      </Link>
      <div className="page-heading">
        <p className="eyebrow">完整市場風險報告</p>
        <div className="card-heading">
          <div>
            <p className="item-meta">
              {document.date}・目前版本：{document.versionLabel}
            </p>
            <h1 id="market-risk-reader-heading">{document.title}</h1>
          </div>
          <StatusBadge status={document.artifactStatus} />
        </div>
        <p className="source-line">
          資料代表時間：{document.asOf}；來源：{document.source}；更新時間：{document.updatedAt}
        </p>
      </div>
      <nav aria-label={`${document.date} 市場風險版本`} className="brief-version-nav">
        <span>版本：</span>
        {versions.map((version) =>
          version.versionLabel === document.versionLabel ? (
            <span key={version.id} aria-current="page">
              {version.versionLabel}
            </span>
          ) : (
            <Link
              key={version.id}
              href={marketRiskDocumentHref(document.date, version.versionLabel)}
            >
              {version.versionLabel}
            </Link>
          ),
        )}
      </nav>
      <div className="brief-content">
        <ArtifactContent blocks={document.blocks} />
      </div>
    </article>
  );
}

export function MarketRiskNotFound({
  date,
  version,
}: {
  date: string;
  version?: string;
}) {
  return (
    <section aria-labelledby="market-risk-not-found-heading">
      <div className="page-heading">
        <p className="eyebrow">完整市場風險報告</p>
        <h1 id="market-risk-not-found-heading">找不到市場風險報告</h1>
        <p>
          {version
            ? `找不到 ${date} 的 ${version} 市場風險報告。`
            : `找不到 ${date} 的市場風險報告。`}
        </p>
      </div>
      <Link href="/#risk-history-heading" className="text-link">
        返回市場風險歷史
      </Link>
    </section>
  );
}
