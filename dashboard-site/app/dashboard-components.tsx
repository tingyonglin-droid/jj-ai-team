import Link from "next/link";
import {
  supportedApprovalTypes,
  type ArtifactStatus,
  type DashboardSnapshot,
  type Freshness,
  type WorkStatus,
} from "../lib/dashboard-types";
import { ApprovalAction } from "./approvals/approval-action";
import { ThreadsDraftDisclosure } from "./approvals/threads-draft-disclosure";

type Approval = DashboardSnapshot["approvals"][number];
type Employee = DashboardSnapshot["employees"][number];
type DataIssue = DashboardSnapshot["blockers"][number];

function canApproveInDashboard(approval: Approval) {
  if (approval.type === "Threads") {
    return Boolean(approval.fullContent?.blocks.length);
  }
  return approval.type === "晨報" || approval.type === "市場風險報告";
}

function ThreadsDraftReview({ approval }: { approval: Approval }) {
  if (approval.type !== "Threads") return null;
  return (
    <ThreadsDraftDisclosure
      artifactId={approval.id}
      blocks={approval.fullContent?.blocks ?? null}
      source={approval.source}
    />
  );
}

export function StatusBadge({
  status,
  label,
}: {
  status: WorkStatus | ArtifactStatus | Freshness | "資料不足" | "warning" | "blocker";
  label?: string;
}) {
  return (
    <span className="status-badge" data-status={status}>
      {label ?? status}
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

function FreshnessNote({ freshness }: { freshness: Freshness }) {
  if (freshness === "沿用最近交易日") {
    return <p className="carry-forward-text">目前是週末、休市日或交付門檻前，正常沿用最近交易日資料。</p>;
  }
  if (freshness === "待更新") {
    return <p className="warning-text">此為最後有效紀錄，應有交易日資料尚待更新。</p>;
  }
  if (freshness === "受阻") {
    return <p className="error-text">交易日或來源設定受阻，暫不判定為最新資料。</p>;
  }
  return null;
}

function DataIssueList({ issues }: { issues: DataIssue[] }) {
  return (
    <ul className="blocker-list">
      {issues.map((issue) => (
        <li key={`${issue.kind}:${issue.source ?? issue.title}`}>
          <div className="card-heading">
            <h4>{issue.title}</h4>
            <StatusBadge
              status={issue.severity}
              label={issue.severity === "warning" ? "提醒" : "阻擋"}
            />
          </div>
          <p>{issue.reason}</p>
          <p className="source-line">
            來源：{issue.source ?? "尚未產出"}；資料代表時間：{issue.asOf ?? "尚未產出"}；
            更新時間：{issue.updatedAt ?? "尚未產出"}
          </p>
          <p>
            <strong>下一步：</strong>
            {issue.nextStep}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function TodayOverview({ snapshot }: { snapshot: DashboardSnapshot }) {
  const briefDocument = snapshot.brief
    ? snapshot.briefArchive.find((document) => document.source === snapshot.brief?.source)
    : null;
  const warnings = snapshot.blockers.filter((issue) => issue.severity === "warning");
  const blockingIssues = snapshot.blockers.filter((issue) => issue.severity === "blocker");

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
                <div className="decision-content">
                  <p className="item-meta">成果類型：{approval.type}；負責角色：{approval.owner}</p>
                  <h3>{approval.title}</h3>
                  <p>{approval.decision}</p>
                  <p className="source-line">
                    來源：{approval.source}；資料代表時間：{approval.asOf}；更新時間：
                    {approval.updatedAt}
                  </p>
                  <ThreadsDraftReview approval={approval} />
                </div>
                <div className="decision-actions">
                  <StatusBadge status={approval.status} />
                  {canApproveInDashboard(approval) ? (
                    <ApprovalAction
                      artifactId={approval.id}
                      artifactTitle={approval.title}
                      version={approval.version}
                    />
                  ) : null}
                </div>
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
                    <strong>主責角色：</strong>
                    {task.owner}
                  </p>
                  <p>
                    <strong>依賴：</strong>
                    {task.dependencies.length > 0 ? task.dependencies.join("、") : "尚未記載依賴"}
                  </p>
                  <p>
                    <strong>下一步：</strong>
                    {task.nextStep}
                  </p>
                  <p>
                    <strong>成果狀態：</strong>
                    {task.artifactStatus}
                    {task.rawStatus && task.rawStatus !== task.artifactStatus
                      ? `（原始記載：${task.rawStatus}）`
                      : ""}
                  </p>
                  <p className="source-line">
                    來源：{task.source}；資料代表時間：{task.asOf}；更新時間：{task.updatedAt}
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
              <div className="card-heading">
                <p className="item-meta">晨報</p>
                <StatusBadge status={snapshot.brief.freshness} />
              </div>
              <h3>{snapshot.brief.title}</h3>
              <p>{snapshot.brief.summary}</p>
              <FreshnessNote freshness={snapshot.brief.freshness} />
              <p>
                依賴：
                {snapshot.brief.dependencies.length > 0
                  ? snapshot.brief.dependencies.join("、")
                  : "尚未記載依賴"}
              </p>
              <p className="source-line">
                資料代表時間：{snapshot.brief.asOf}；涵蓋美股交易時段：
                {snapshot.brief.coveredSessionDate ?? "無法判定"}；來源：{snapshot.brief.source}；
                更新時間：{snapshot.brief.updatedAt}
              </p>
              {briefDocument ? (
                <Link href={`/briefs/${briefDocument.date}`} className="text-link">
                  查看全文
                </Link>
              ) : null}
            </article>
          ) : (
            <EmptyState
              title="晨報尚未產出"
              description="目前沒有可追溯的晨報資料。"
              nextStep="依 daily-brief 工作流產出並保存晨報。"
            />
          )}
          {snapshot.marketRisk ? (
            <article className="risk-summary-card">
              <div className="card-heading">
                <p className="item-meta">市場風險</p>
                <div className="risk-card-badges">
                  {snapshot.marketRisk.experimental ? (
                    <StatusBadge status="warning" label="實驗性指標" />
                  ) : null}
                  <StatusBadge status={snapshot.marketRisk.freshness} />
                </div>
              </div>
              <h3>{snapshot.marketRisk.label}</h3>
              <FreshnessNote freshness={snapshot.marketRisk.freshness} />
              <div className="risk-score-panel">
                <div>
                  <p className="risk-score-label">1–4 週風險</p>
                  <p className="risk-score-value">{snapshot.marketRisk.score}<span>／100</span></p>
                  <p className="risk-score-change">
                    單日變動：{snapshot.marketRisk.dailyChange === null
                      ? "尚無前值"
                      : `${snapshot.marketRisk.dailyChange >= 0 ? "+" : ""}${snapshot.marketRisk.dailyChange}`}
                  </p>
                </div>
                <dl className="risk-score-details">
                  <div><dt>基準分</dt><dd>{snapshot.marketRisk.baseline}</dd></div>
                  <div><dt>事件調整</dt><dd>{snapshot.marketRisk.eventAdjustment >= 0 ? "+" : ""}{snapshot.marketRisk.eventAdjustment}</dd></div>
                  <div><dt>資料完整度</dt><dd>{snapshot.marketRisk.completeness}%</dd></div>
                  <div><dt>AI 信心</dt><dd>{snapshot.marketRisk.confidence}%</dd></div>
                </dl>
              </div>
              <p><strong>即時風險：</strong>{snapshot.marketRisk.immediateRisk}</p>
              <p><strong>結構性風險：</strong>{snapshot.marketRisk.structuralRisk}</p>
              <p><strong>主要風險：</strong>{snapshot.marketRisk.topRisks.join("、")}</p>
              <p>
                依賴：
                {snapshot.marketRisk.dependencies.length > 0
                  ? snapshot.marketRisk.dependencies.join("、")
                  : "尚未記載依賴"}
              </p>
              <p className="source-line">
                資料代表時間：{snapshot.marketRisk.asOf}；涵蓋美股交易時段：
                {snapshot.marketRisk.coveredSessionDate ?? "無法判定"}；來源：
                {snapshot.marketRisk.source}；更新時間：{snapshot.marketRisk.updatedAt}
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

      <section aria-labelledby="data-status-heading" className="dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">更新與異常</p>
            <h2 id="data-status-heading">資料狀態</h2>
          </div>
        </div>
        {snapshot.blockers.length > 0 ? (
          <div className="data-status-groups">
            {warnings.length > 0 ? (
              <section aria-labelledby="data-warning-heading">
                <h3 id="data-warning-heading">提醒</h3>
                <DataIssueList issues={warnings} />
              </section>
            ) : null}
            {blockingIssues.length > 0 ? (
              <section aria-labelledby="data-blocker-heading">
                <h3 id="data-blocker-heading">阻擋</h3>
                <DataIssueList issues={blockingIssues} />
              </section>
            ) : null}
          </div>
        ) : (
          <EmptyState
            title="目前資料狀態正常"
            description="沒有待更新提醒或阻擋問題。"
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
                <dt>成果狀態</dt>
                <dd>
                  {employee.artifactStatus ?? "尚未產出"}
                  {employee.rawStatus && employee.rawStatus !== employee.artifactStatus
                    ? `（原始記載：${employee.rawStatus}）`
                    : ""}
                </dd>
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
                <dt>資料代表時間</dt>
                <dd>{employee.asOf}</dd>
              </div>
              <div>
                <dt>來源</dt>
                <dd>{employee.source}</dd>
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
      {approvals.length === 0 ? <p className="empty-summary">目前沒有待核准事項。</p> : null}
      <div className="approval-groups">
        {supportedApprovalTypes.map((type) => {
          const group = approvalGroups.get(type) ?? [];
          return (
            <section key={type} aria-labelledby={`approval-type-${type}`} className="approval-group">
              <h2 id={`approval-type-${type}`}>成果類型：{type}</h2>
              {group.length > 0 ? (
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
                      <p>
                        <strong>依賴：</strong>
                        {approval.dependencies.length > 0
                          ? approval.dependencies.join("、")
                          : "尚未記載依賴"}
                      </p>
                      <p className="source-line">
                        {approval.createdAt
                          ? `建立時間：${approval.createdAt}`
                          : approval.recordDate
                            ? `紀錄日期：${approval.recordDate}`
                            : "建立時間未記載"}
                        ；資料代表時間：{approval.asOf}；更新時間：
                        {approval.updatedAt}；來源：{approval.source}
                      </p>
                      <ThreadsDraftReview approval={approval} />
                      {approval.type === "晨報" && approval.recordDate ? (
                        <Link href={`/briefs/${approval.recordDate}`} className="text-link">
                          查看全文
                        </Link>
                      ) : null}
                      {canApproveInDashboard(approval) ? (
                        <ApprovalAction
                          artifactId={approval.id}
                          artifactTitle={approval.title}
                          version={approval.version}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="此類型目前沒有待核准成果"
                  description="沒有對應保存位置中的真實待核准資料。"
                  nextStep="依對應工作流產出成果；不顯示範例。"
                />
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}
