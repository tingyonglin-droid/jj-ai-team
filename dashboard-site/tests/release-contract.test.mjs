import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

function dependencyNames(entry) {
  return new Set([
    ...Object.keys(entry.dependencies ?? {}),
    ...Object.keys(entry.devDependencies ?? {}),
    ...Object.keys(entry.optionalDependencies ?? {}),
    ...Object.keys(entry.peerDependencies ?? {}),
  ]);
}

function dependencyPath(packagePath, dependencyName, packages) {
  let parent = packagePath;
  while (true) {
    const candidate = `${parent ? `${parent}/` : ""}node_modules/${dependencyName}`;
    if (packages[candidate]) return candidate;
    if (!parent) return null;
    parent = parent.replace(/(?:^|\/)node_modules\/(?:@[^/]+\/)?[^/]+$/, "");
  }
}

test("標準測試指令涵蓋帳號、快照、頁面與正式輸出驗收", async () => {
  const packageJson = JSON.parse(await readProjectFile("package.json"));
  const testCommand = packageJson.scripts.test;

  assert.match(testCommand, /authorization\.test\.ts/);
  assert.match(testCommand, /dashboard-snapshot\.test\.ts/);
  assert.match(testCommand, /dashboard-routes\.test\.tsx/);
  assert.match(testCommand, /generate-dashboard-data\.test\.mts/);
  assert.match(testCommand, /typecheck/);
  assert.match(testCommand, /npm run build/);
  assert.match(testCommand, /rendered-html\.test\.mjs/);
});

test("正式專案不包含 D1 寫入 starter 或未使用的公開素材", async () => {
  const [packageJsonText, packageLockText, hostingText, viteConfigText] = await Promise.all([
    readProjectFile("package.json"),
    readProjectFile("package-lock.json"),
    readProjectFile(".openai/hosting.json"),
    readProjectFile("vite.config.ts"),
  ]);
  const packageJson = JSON.parse(packageJsonText);
  const hosting = JSON.parse(hostingText);
  const removedPaths = [
    "db/index.ts",
    "db/schema.ts",
    "drizzle.config.ts",
    "drizzle/meta/_journal.json",
    "examples/d1/app/api/notes/route.ts",
    "examples/d1/db/schema.ts",
    "public/file.svg",
    "public/globe.svg",
    "public/window.svg",
  ];

  assert.equal(packageJson.dependencies?.["drizzle-orm"], undefined);
  assert.equal(packageJson.devDependencies?.["drizzle-kit"], undefined);
  assert.equal(packageJson.scripts?.["db:generate"], undefined);
  assert.doesNotMatch(packageLockText, /drizzle/i);
  assert.equal("d1" in hosting, false);
  assert.doesNotMatch(viteConfigText, /d1_databases/i);
  for (const path of removedPaths) {
    await assert.rejects(access(new URL(path, projectRoot)), { code: "ENOENT" });
  }
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

test("lockfile 的每個套件節點都可由根依賴閉包到達", async () => {
  const lockfile = JSON.parse(await readProjectFile("package-lock.json"));
  const packages = lockfile.packages;
  const reachable = new Set([""]);
  const pending = [""];

  while (pending.length > 0) {
    const packagePath = pending.pop();
    for (const dependencyName of dependencyNames(packages[packagePath])) {
      const resolvedPath = dependencyPath(packagePath, dependencyName, packages);
      if (resolvedPath && !reachable.has(resolvedPath)) {
        reachable.add(resolvedPath);
        pending.push(resolvedPath);
      }
    }
  }

  const orphaned = Object.keys(packages).filter((packagePath) => !reachable.has(packagePath));
  assert.deepEqual(orphaned, []);
});

test("響應式與鍵盤可用性規則可由原始碼重現驗收", async () => {
  const [styles, shell, briefComponents] = await Promise.all([
    readProjectFile("app/globals.css"),
    readProjectFile("app/dashboard-shell.tsx"),
    readProjectFile("app/briefs/brief-components.tsx"),
  ]);

  assert.match(styles, /@media\s*\(max-width:\s*720px\)/);
  assert.match(styles, /\.employee-summary-grid,[\s\S]*?grid-template-columns:\s*1fr;/);
  assert.match(styles, /\.brief-archive-grid/);
  assert.match(styles, /\.brief-reader/);
  assert.match(styles, /\.brief-version-nav/);
  assert.match(styles, /\.brief-table-scroll[\s\S]*overflow-x:\s*auto/);
  assert.match(styles, /a:focus-visible,[\s\S]*?outline:\s*3px solid/);
  assert.match(styles, /\.skip-link:focus\s*\{[\s\S]*?transform:\s*translateY\(0\)/);
  assert.match(shell, /<a className="skip-link" href="#main-content">/);
  assert.match(shell, /<nav aria-label="主要導覽">/);
  assert.match(shell, /<Link href="\/briefs">晨報全文<\/Link>/);
  assert.match(shell, /<main id="main-content" className="site-main">/);
  assert.doesNotMatch(briefComponents, /dangerouslySetInnerHTML/);
});
