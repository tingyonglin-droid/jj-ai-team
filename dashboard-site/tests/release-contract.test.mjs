import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

test("標準測試指令涵蓋帳號、快照、頁面與正式輸出驗收", async () => {
  const packageJson = JSON.parse(await readProjectFile("package.json"));
  const testCommand = packageJson.scripts.test;

  assert.match(testCommand, /authorization\.test\.ts/);
  assert.match(testCommand, /dashboard-snapshot\.test\.ts/);
  assert.match(testCommand, /dashboard-routes\.test\.tsx/);
  assert.match(testCommand, /generate-dashboard-data\.test\.mts/);
  assert.match(testCommand, /npm run build/);
  assert.match(testCommand, /rendered-html\.test\.mjs/);
});

test("正式版套件與 Worker 不保留起始專案身分", async () => {
  const [packageJsonText, packageLockText, workerText] = await Promise.all([
    readProjectFile("package.json"),
    readProjectFile("package-lock.json"),
    readProjectFile("worker/index.ts"),
  ]);

  assert.equal(JSON.parse(packageJsonText).name, "jj-ai-team-dashboard");
  assert.doesNotMatch(packageLockText, /site-creator-vinext-starter/i);
  assert.doesNotMatch(workerText, /vinext-starter template/i);
});

test("響應式與鍵盤可用性規則可由原始碼重現驗收", async () => {
  const [styles, shell] = await Promise.all([
    readProjectFile("app/globals.css"),
    readProjectFile("app/dashboard-shell.tsx"),
  ]);

  assert.match(styles, /@media\s*\(max-width:\s*720px\)/);
  assert.match(styles, /\.employee-summary-grid,[\s\S]*?grid-template-columns:\s*1fr;/);
  assert.match(styles, /a:focus-visible,[\s\S]*?outline:\s*3px solid/);
  assert.match(styles, /\.skip-link:focus\s*\{[\s\S]*?transform:\s*translateY\(0\)/);
  assert.match(shell, /<a className="skip-link" href="#main-content">/);
  assert.match(shell, /<nav aria-label="主要導覽">/);
  assert.match(shell, /<main id="main-content" className="site-main">/);
});
