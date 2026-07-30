import Link from "next/link";
import type { DashboardSnapshot, WorkStatus } from "../lib/dashboard-types";

type Approval = DashboardSnapshot["approvals"][number];
type Employee = DashboardSnapshot["employees"][number];

export function StatusBadge({ status }: { status: WorkStatus | "資料不足" }) {
  return (
    <span className="status-badge" data-status={status}>
      {status}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  nextStep,
}: {
  title: string;
  description: string;
  nextStep: string;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      <p>
        <strong>下一步：</strong>
        {nextStep}
      </p>
    </div>
  );
}

export function TodayOverview({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <div className="dashboard-sections">
      <div className="page-heading">
        <p className="eyebrow">今日工作</p>
        <h1>今日總覽</h1>
        <p>先處理需要你決定的事項，再查看團隊與資料狀態。</p>
      </div>
      <section aria-labelledby="decisions-heading" className="dashboard-section decision-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">決策優先</p>
            <h2 id="decisions-heading">需要你決定</h2>
          </div>
          <span className="section-count">{snapshot.approvals.length} 項</span>
        </div>
        {snapshot.approvals.length > 0 ? (
          <ul className="decision-list">
            {snapshot.approvals.map((approval) => (
              <li key={approval.id}>
                <div>
                  <p className="item-meta">{approval.type}</p>
                  <h3>{approval.title}</h3>
                  <p>{approval.decision}</p>
                </div>
                <StatusBadge status={approval.status} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="目前沒有待核准事項"
            description="尚無可供你決定的真實成果。"
            nextStep="等待工作流產出需要人工核准的成果。"
          />
        )}
      </section>

      <section aria-labelledby="employees-heading" className="dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">團隊狀態</p>
            <h2 id="employees-heading">員工動態</h2>
          </div>
          <Link href="/employees" className="text-link">
            查看全部
          </Link>
        </div>
        <ul className="employee-summary-grid">
          {snapshot.employees.map((employee) => (
            <li key={employee.id}>
              <div>
                <h3>{employee.name}</h3>
                <p>{employee.currentTask}</p>
              </div>
              <StatusBadge status={employee.status} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="tasks-heading" className="dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">工作流</p>
            <h2 id="tasks-heading">今日工作</h2>
          </div>
        </div>
        {snapshot.tasks.length > 0 ? (
          <ul className="task-list">
            {snapshot.tasks.map((task) => (
              <li key={task.id}>
                <div>
                  <h3>{task.title}</h3>
                  <p>
                    <strong>下一步：</strong>
                    {task.nextStep}
                  </p>
                </div>
                <StatusBadge status={task.status} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="今日尚無工作紀錄"
            description="目前沒有可呈現的任務資料。"
            nextStep="依既定工作流建立並保存紀錄。"
          />
        )}
      </section>

      <section aria-labelledby="summary-heading" className="dashboard-section summary-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">來源摘要</p>
            <h2 id="summary-heading">今日摘要</h2>
          </div>
        </div>
        <div className="summary-grid">
          {snapshot.brief ? (
            <article>
              <p className="item-meta">晨報</p>
              <h3>{snapshot.brief.title}</h3>
              <p>{snapshot.brief.summary}</p>
              <p className="source-line">資料截止：{snapshot.brief.asOf}</p>
            </article>
          ) : (
            <EmptyState
              title="晨報尚未產出"
              description="目前沒有可追溯的晨報資料。"
              nextStep="依 daily-brief 工作流產出並保存晨報。"
            />
          )}
          {snapshot.marketRisk ? (
            <article>
              <p className="item-meta">市場風險</p>
              <h3>{snapshot.marketRisk.label}</h3>
              <p>資料截止：{snapshot.marketRisk.asOf}</p>
              <p>
                資料完整度：
                {snapshot.marketRisk.completeness === null
                  ? "尚未記載"
                  : `${snapshot.marketRisk.completeness}%`}
              </p>
            </article>
          ) : (
            <EmptyState
              title="市場風險資料尚未產出"
              description="尚無可追溯的市場風險資料，因此不顯示分數或完整度。"
              nextStep="依 market-risk 工作流建立可追溯的市場風險紀錄。"
            />
          )}
        </div>
      </section>

      <section aria-labelledby="blockers-heading" className="dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">需要處理</p>
            <h2 id="blockers-heading">受阻項目</h2>
          </div>
        </div>
        {snapshot.blockers.length > 0 ? (
          <ul className="blocker-list">
            {snapshot.blockers.map((blocker) => (
              <li key={blocker.title}>
                <h3>{blocker.title}</h3>
                <p>{blocker.reason}</p>
                <p>
                  <strong>下一步：</strong>
                  {blocker.nextStep}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="目前沒有受阻項目"
            description="目前的工作紀錄沒有標示阻礙。"
            nextStep="持續依工作流更新進度。"
          />
        )}
      </section>
    </div>
  );
}

export function EmployeeDirectory({ employees }: { employees: Employee[] }) {
  return (
    <section aria-labelledby="employees-directory-heading" className="directory-section">
      <div className="page-heading">
        <p className="eyebrow">AI 員工</p>
        <h1 id="employees-directory-heading">團隊目前進度</h1>
        <p>以下內容來自最新工作紀錄；沒有紀錄的欄位會如實標示。</p>
      </div>
      <div className="employee-directory">
        {employees.map((employee) => (
          <article key={employee.id} className="employee-card">
            <div className="card-heading">
              <div>
                <p className="item-meta">{employee.role}</p>
                <h2>{employee.name}</h2>
              </div>
              <StatusBadge status={employee.status} />
            </div>
            <dl>
              <div>
                <dt>目前任務</dt>
                <dd>{employee.currentTask}</dd>
              </div>
              <div>
                <dt>進度</dt>
                <dd>{employee.progress}</dd>
              </div>
              <div>
                <dt>依賴與交接</dt>
                <dd>
                  {employee.dependencies.length > 0 ? employee.dependencies.join("、") : "尚未記載依賴"}
                  <br />
                  {employee.handoff}
                </dd>
              </div>
              <div>
                <dt>卡點</dt>
                <dd>{employee.blocker ?? "目前未記載卡點"}</dd>
              </div>
              <div>
                <dt>下一步</dt>
                <dd>{employee.nextStep}</dd>
              </div>
              <div>
                <dt>更新時間</dt>
                <dd>
                  <time dateTime={employee.updatedAt}>{employee.updatedAt}</time>
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ApprovalCenter({ approvals }: { approvals: Approval[] }) {
  const approvalGroups = Map.groupBy(approvals, (approval) => approval.type);

  return (
    <section aria-labelledby="approval-heading" className="approval-section">
      <div className="page-heading">
        <p className="eyebrow">人工核准</p>
        <h1 id="approval-heading">待你決定</h1>
        <p>這裡只列出已保存、且狀態為待核准的真實成果。</p>
      </div>
      {approvals.length === 0 ? (
        <EmptyState
          title="目前沒有待核准事項"
          description="目前沒有已保存的待核准成果。"
          nextStep="等待團隊依工作流提交成果。"
        />
      ) : (
        <div className="approval-groups">
          {[...approvalGroups].map(([type, group]) => (
            <section key={type} aria-labelledby={`approval-type-${type}`} className="approval-group">
              <h2 id={`approval-type-${type}`}>成果類型：{type}</h2>
              <ul>
                {group.map((approval) => (
                  <li key={approval.id}>
                    <div className="card-heading">
                      <div>
                        <h3>{approval.title}</h3>
                        <p className="item-meta">負責角色：{approval.owner}</p>
                      </div>
                      <StatusBadge status={approval.status} />
                    </div>
                    <p>{approval.summary}</p>
                    <p>
                      <strong>待決定：</strong>
                      {approval.decision}
                    </p>
                    <p className="source-line">
                      來源：{approval.source}；更新時間：{approval.updatedAt}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
