import Link from "next/link";
import type { DashboardBriefDocument } from "../../lib/dashboard-types";
import { ArtifactContent } from "../approvals/artifact-content";
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

export function BriefReader({
  document,
  versions,
}: {
  document: DashboardBriefDocument;
  versions: DashboardBriefDocument[];
}) {
  return (
    <article aria-labelledby="brief-reader-heading" className="brief-reader">
      <Link href="/briefs" className="text-link">
        返回晨報歷史
      </Link>
      <div className="page-heading">
        <p className="eyebrow">完整晨報</p>
        <div className="card-heading">
          <div>
            <p className="item-meta">
              {document.date}・目前版本：{document.versionLabel}
            </p>
            <h1 id="brief-reader-heading">{document.title}</h1>
          </div>
          <StatusBadge status={document.artifactStatus} />
        </div>
        <p>{document.summary}</p>
        <p className="source-line">資料代表時間：{document.asOf}</p>
      </div>
      <nav aria-label="晨報版本" className="brief-version-nav">
        <span>版本：</span>
        {versions.map((version) =>
          version.versionLabel === document.versionLabel ? (
            <span key={version.id} aria-current="page">
              {version.versionLabel}
            </span>
          ) : (
            <Link
              key={version.id}
              href={`/briefs/${document.date}?version=${encodeURIComponent(version.versionLabel)}`}
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

export function BriefNotFound({
  date,
  version,
}: {
  date: string;
  version?: string;
}) {
  return (
    <section aria-labelledby="brief-not-found-heading">
      <div className="page-heading">
        <p className="eyebrow">晨報全文</p>
        <h1 id="brief-not-found-heading">找不到晨報</h1>
        <p>
          {version
            ? `找不到 ${date} 的 ${version} 晨報。`
            : `找不到 ${date} 的晨報。`}
        </p>
      </div>
      <Link href="/briefs" className="text-link">
        返回晨報歷史
      </Link>
    </section>
  );
}
