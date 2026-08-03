import Link from "next/link";

import { DashboardShell } from "../dashboard-shell";
import { loadAuthorizedDashboardSnapshot } from "../dashboard-snapshot";

export const dynamic = "force-dynamic";

export default async function ContentPage() {
  const { user, snapshot } = await loadAuthorizedDashboardSnapshot("/content");
  return (
    <DashboardShell user={user} generatedAt={snapshot.generatedAt}>
      <section aria-labelledby="content-heading" className="directory-section">
        <div className="page-heading">
          <p className="eyebrow">內容</p>
          <h1 id="content-heading">內容檔案庫</h1>
          <p>第一版提供已核准 Threads 完整草稿；核准不等於發布。</p>
        </div>
        <article className="content-entry-card">
          <h2>Threads 歷史</h2>
          <p>依日期回看與核准紀錄完全匹配的 Threads 全文。</p>
          <Link href="/content/threads" className="text-link">
            查看 Threads 歷史
          </Link>
        </article>
      </section>
    </DashboardShell>
  );
}
