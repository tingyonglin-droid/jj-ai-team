import Link from "next/link";
import type { DashboardBriefDocument } from "../../lib/dashboard-types";
import { EmptyState, StatusBadge } from "../dashboard-components";

export function BriefArchive({
  documents,
}: {
  documents: DashboardBriefDocument[];
}) {
  const latest = documents.filter((document) => document.isLatest);

  return (
    <section aria-labelledby="brief-archive-heading" className="brief-archive-section">
      <div className="page-heading">
        <p className="eyebrow">晨報全文</p>
        <h1 id="brief-archive-heading">晨報歷史</h1>
        <p>僅顯示每個日期最新版本的可追溯晨報。</p>
      </div>
      {latest.length > 0 ? (
        <div className="brief-archive-grid">
          {latest.map((document) => (
            <article key={document.id} className="brief-archive-card">
              <div className="card-heading">
                <div>
                  <p className="item-meta">
                    {document.date}・{document.versionLabel}
                  </p>
                  <h2>{document.title}</h2>
                </div>
                <StatusBadge status={document.artifactStatus} />
              </div>
              <p>{document.summary}</p>
              <p className="source-line">資料代表時間：{document.asOf}</p>
              <Link href={`/briefs/${document.date}`} className="text-link">
                查看全文
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="晨報尚未產出"
          description="目前沒有可追溯的晨報資料。"
          nextStep="依 daily-brief 工作流產出並保存晨報。"
        />
      )}
    </section>
  );
}
