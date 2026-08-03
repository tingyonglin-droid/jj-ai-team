import Link from "next/link";

import type {
  ApprovalSyncStatus,
  DashboardApprovedThreadsDocument,
  DashboardThreadsArchiveIssue,
} from "../../../lib/dashboard-types";
import { ArtifactContent } from "../../approvals/artifact-content";
import { EmptyState, StatusBadge } from "../../dashboard-components";

function syncLabel(status: ApprovalSyncStatus) {
  if (status === "pending") return "已核准、尚未同步";
  if (status === "blocked") return "核准同步受阻";
  return null;
}

export function selectApprovedThreadsDocument(
  documents: DashboardApprovedThreadsDocument[],
  artifactKey: string,
) {
  return documents.find((document) => document.artifactKey === artifactKey) ?? null;
}

export function ApprovedThreadsArchive({
  documents,
  issues,
}: {
  documents: DashboardApprovedThreadsDocument[];
  issues: DashboardThreadsArchiveIssue[];
}) {
  return (
    <section aria-labelledby="threads-archive-heading" className="threads-archive-section">
      <div className="page-heading">
        <p className="eyebrow">內容</p>
        <h1 id="threads-archive-heading">Threads 歷史</h1>
        <p>只顯示已核准的 Threads 完整草稿；核准不等於發布。</p>
      </div>

      {documents.length > 0 ? (
        <div className="threads-archive-grid">
          {documents.map((document) => {
            const label = syncLabel(document.approvalSyncStatus);
            return (
              <article key={document.artifactKey} className="threads-archive-card">
                <div className="card-heading">
                  <div>
                    <p className="item-meta">
                      {document.date}・{document.versionLabel}
                    </p>
                    <h2>{document.title}</h2>
                  </div>
                  <StatusBadge status="已核准" />
                </div>
                <p>{document.summary}</p>
                <p className="source-line">
                  核准時間：{document.approvedAt}；來源：{document.source}
                </p>
                {label ? <p className="warning-text">{label}</p> : null}
                <Link
                  href={`/content/threads/${encodeURIComponent(document.artifactKey)}`}
                  className="text-link"
                >
                  閱讀全文
                </Link>
              </article>
            );
          })}
        </div>
      ) : issues.length === 0 ? (
        <EmptyState
          title="目前沒有已核准 Threads 草稿"
          description="尚無與核准紀錄完全匹配的 Threads 全文。"
          nextStep="完成 Threads 版本核准後再回到此頁查看。"
        />
      ) : null}

      {issues.length > 0 ? (
        <section aria-labelledby="threads-archive-issues-heading" className="threads-archive-issues">
          <h2 id="threads-archive-issues-heading">資料無法載入</h2>
          <ul className="blocker-list">
            {issues.map((issue) => (
              <li key={issue.eventId} className="threads-archive-issue">
                <div className="card-heading">
                  <h3>{issue.artifactId}</h3>
                  <StatusBadge status="blocker" label="無法閱讀" />
                </div>
                <p>{issue.reason}</p>
                <p className="source-line">
                  版本：v{String(issue.version).padStart(2, "0")}；核准時間：{issue.approvedAt}
                </p>
                {syncLabel(issue.approvalSyncStatus) ? (
                  <p className="warning-text">{syncLabel(issue.approvalSyncStatus)}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

export function ApprovedThreadsReader({
  document,
}: {
  document: DashboardApprovedThreadsDocument;
}) {
  const label = syncLabel(document.approvalSyncStatus);
  return (
    <article aria-labelledby="threads-reader-heading" className="threads-reader">
      <Link href="/content/threads" className="text-link">
        返回 Threads 歷史
      </Link>
      <div className="page-heading">
        <p className="eyebrow">已核准 Threads 全文</p>
        <div className="card-heading">
          <div>
            <p className="item-meta">
              {document.date}・{document.versionLabel}
            </p>
            <h1 id="threads-reader-heading">{document.title}</h1>
          </div>
          <StatusBadge status="已核准" />
        </div>
        <p>核准不等於發布。</p>
        <p className="source-line">
          核准時間：{document.approvedAt}；來源：{document.source}；內容雜湊：
          {document.artifactHash}
        </p>
        {label ? <p className="warning-text">{label}</p> : null}
      </div>
      <div className="brief-content">
        <ArtifactContent blocks={document.blocks} />
      </div>
    </article>
  );
}

export function ThreadsArchiveNotFound() {
  return (
    <section aria-labelledby="threads-not-found-heading">
      <div className="page-heading">
        <p className="eyebrow">Threads 歷史</p>
        <h1 id="threads-not-found-heading">找不到已核准 Threads 全文</h1>
        <p>此網址沒有對應的已核准版本，或該版本目前無法安全載入。</p>
      </div>
      <Link href="/content/threads" className="text-link">
        返回 Threads 歷史
      </Link>
    </section>
  );
}
