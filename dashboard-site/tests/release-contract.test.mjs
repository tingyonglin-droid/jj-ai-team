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

function cssBlock(styles, expression) {
  const match = expression.exec(styles);
  assert.ok(match, `CSS block not found: ${expression}`);
  const openingBrace = styles.indexOf("{", match.index);
  assert.notEqual(openingBrace, -1);

  let depth = 0;
  for (let index = openingBrace; index < styles.length; index += 1) {
    if (styles[index] === "{") depth += 1;
    if (styles[index] === "}") depth -= 1;
    if (depth === 0) return styles.slice(openingBrace + 1, index);
  }

  assert.fail(`Unclosed CSS block: ${expression}`);
}

test("標準測試指令涵蓋帳號、快照、頁面與正式輸出驗收", async () => {
  const packageJson = JSON.parse(await readProjectFile("package.json"));
  const testCommand = packageJson.scripts.test;

  assert.match(testCommand, /authorization\.test\.ts/);
  assert.match(testCommand, /dashboard-snapshot\.test\.ts/);
  assert.match(testCommand, /dashboard-routes\.test\.tsx/);
  assert.match(testCommand, /brief-content\.test\.ts/);
  assert.match(testCommand, /brief-components\.test\.tsx/);
  assert.match(testCommand, /approval-store\.test\.ts/);
  assert.match(testCommand, /approval-events\.test\.ts/);
  assert.match(testCommand, /approval-handler\.test\.ts/);
  assert.match(testCommand, /runtime-env\.test\.ts/);
  assert.match(testCommand, /generate-dashboard-data\.test\.mts/);
  assert.match(testCommand, /typecheck/);
  assert.match(testCommand, /npm run build/);
  assert.match(testCommand, /rendered-html\.test\.mjs/);
});

test("正式專案封裝核准事件 D1 binding 與 migration", async () => {
  const [packageJsonText, packageLockText, hostingText, viteConfigText, buildPluginText] = await Promise.all([
    readProjectFile("package.json"),
    readProjectFile("package-lock.json"),
    readProjectFile(".openai/hosting.json"),
    readProjectFile("vite.config.ts"),
    readProjectFile("build/sites-vite-plugin.ts"),
  ]);
  const packageJson = JSON.parse(packageJsonText);
  const hosting = JSON.parse(hostingText);
  const requiredPaths = [
    "db/index.ts",
    "db/schema.ts",
    "db/approval-store.ts",
    "drizzle.config.ts",
    "drizzle/meta/_journal.json",
  ];
  const removedStarterPaths = [
    "examples/d1/app/api/notes/route.ts",
    "examples/d1/db/schema.ts",
    "public/file.svg",
    "public/globe.svg",
    "public/window.svg",
  ];

  assert.equal(packageJson.dependencies?.["drizzle-orm"], "0.45.2");
  assert.equal(packageJson.devDependencies?.["drizzle-kit"], "0.31.10");
  assert.equal(packageJson.scripts?.["db:generate"], "drizzle-kit generate");
  assert.match(packageLockText, /drizzle-orm/);
  assert.equal(hosting.d1, "DB");
  assert.match(viteConfigText, /d1_databases/);
  assert.match(buildPluginText, /resolve\(root, "drizzle"\)/);
  for (const path of requiredPaths) {
    await access(new URL(path, projectRoot));
  }
  for (const path of removedStarterPaths) {
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
  const mobileStyles = cssBlock(styles, /@media\s*\(max-width:\s*720px\)/);

  assert.match(styles, /@media\s*\(max-width:\s*720px\)/);
  assert.match(styles, /\.employee-summary-grid,[\s\S]*?grid-template-columns:\s*1fr;/);
  assert.match(styles, /\.brief-archive-grid/);
  assert.match(styles, /\.brief-reader/);
  assert.match(styles, /\.brief-version-nav/);
  assert.match(styles, /\.brief-version-nav\s*>\s*a\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(styles, /\.brief-table-scroll[\s\S]*overflow-x:\s*auto/);
  assert.match(mobileStyles, /\.brief-archive-grid,[\s\S]*?grid-template-columns:\s*1fr;/);
  assert.match(mobileStyles, /\.brief-reader\s*\{[\s\S]*?padding:\s*1rem;/);
  assert.match(styles, /a:focus-visible,[\s\S]*?outline:\s*3px solid/);
  assert.match(styles, /\.skip-link:focus\s*\{[\s\S]*?transform:\s*translateY\(0\)/);
  assert.match(shell, /<a className="skip-link" href="#main-content">/);
  assert.match(shell, /<nav aria-label="主要導覽">/);
  assert.match(shell, /<Link href="\/briefs">晨報全文<\/Link>/);
  assert.match(shell, /<main id="main-content" className="site-main">/);
  assert.doesNotMatch(briefComponents, /dangerouslySetInnerHTML/);
});
