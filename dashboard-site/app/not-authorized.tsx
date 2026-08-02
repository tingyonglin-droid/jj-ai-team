export function NotAuthorized() {
  return (
    <main className="access-message">
      <p className="eyebrow">受保護工作空間</p>
      <h1>你沒有存取此儀表板的權限</h1>
      <p>請使用已授權的 ChatGPT 帳號登入；若仍無法存取，請聯絡工作空間管理者。</p>
    </main>
  );
}
