import Link from "next/link";
import { chatGPTSignOutPath, type ChatGPTUser } from "./chatgpt-auth";

export function DashboardShell({
  user,
  generatedAt,
  children,
}: {
  user: ChatGPTUser;
  generatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-shell">
      <a className="skip-link" href="#main-content">
        跳到主要內容
      </a>
      <header className="site-header">
        <div>
          <p className="site-kicker">私人工作空間</p>
          <p className="site-name">JJ AI Team Dashboard</p>
        </div>
        <nav aria-label="主要導覽">
          <Link href="/">今日總覽</Link>
          <Link href="/employees">AI 員工</Link>
          <Link href="/approvals">待核准中心</Link>
        </nav>
        <div className="account-area">
          <span>{user.email}</span>
          <a href={chatGPTSignOutPath("/")}>登出 ChatGPT</a>
        </div>
      </header>
      <main id="main-content" className="site-main">
        {children}
      </main>
      <footer className="site-footer">
        資料更新時間：<time dateTime={generatedAt}>{generatedAt}</time>
      </footer>
    </div>
  );
}
