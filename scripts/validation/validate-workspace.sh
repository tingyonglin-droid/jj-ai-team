#!/bin/sh

set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$PROJECT_ROOT"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

pass() {
  printf 'PASS: %s\n' "$1"
}

required_files='README.md
AGENTS.md
docs/team-design.md
docs/approval-policy.md
docs/research-source-policy.md
docs/risk-score-methodology.md
docs/dashboard-information-architecture.md
roles/README.md
roles/commander/ROLE.md
roles/macro-researcher/ROLE.md
roles/social-operator/ROLE.md
roles/app-designer/ROLE.md
workflows/README.md
workflows/daily-brief.md
workflows/daily-threads.md
workflows/threads-analysis.md
workflows/weekly-instagram.md
workflows/founder-idea.md
workflows/market-risk.md
workflows/app-planning.md
knowledge/README.md
knowledge/investment-philosophy.md
knowledge/beta-system.md
knowledge/app-product.md
knowledge/writing-style.md
templates/README.md
templates/daily-brief.md
templates/threads-draft.md
templates/instagram-carousel.md
templates/content-weekly-report.md
templates/market-risk-report.md
templates/app-feature-spec.md
records/README.md
records/market-risk/README.md
records/reviews/README.md
records/decisions/README.md
dashboard/README.md
dashboard/today.md
dashboard/market-risk.md
dashboard/content.md
dashboard/app.md
dashboard/outcomes.md
scripts/README.md
scripts/notion/README.md
scripts/market-data/README.md'

printf '%s\n' "$required_files" | while IFS= read -r file; do
  [ -s "$file" ] || fail "必要檔案缺失或空白：$file"
done
pass '必要檔案均存在且非空白'

empty_files=$(find . \
  \( -type d \( \
    -name .git -o \
    -name .next -o \
    -name .superpowers -o \
    -name .vinext -o \
    -name .worktrees -o \
    -name .wrangler -o \
    -name coverage -o \
    -name dist -o \
    -name node_modules -o \
    -name outputs -o \
    -name tmp -o \
    -name work \
  \) -prune \) -o \
  \( -type f -size 0 -print \))
[ -z "$empty_files" ] || fail "發現零位元組檔案：$empty_files"
pass '沒有零位元組檔案'

if grep -R -n -E 'TODO|TBD|待補|待定' README.md AGENTS.md docs roles workflows knowledge templates records dashboard scripts \
  --exclude='validate-workspace.sh' --exclude-dir='superpowers' >/dev/null 2>&1; then
  fail '業務文件含禁用佔位詞'
fi
pass '沒有禁用佔位詞'

for file in roles/*/ROLE.md; do
  for heading in 使命 輸入 輸出 可用來源 禁止事項 驗收標準 交接對象; do
    grep -q "^## $heading" "$file" || fail "$file 缺少章節：$heading"
  done
done
role_count=$(find roles -mindepth 2 -maxdepth 2 -name ROLE.md | wc -l | tr -d ' ')
[ "$role_count" -eq 4 ] || fail '角色手冊數量不是四份'
pass '四份角色手冊章節完整'

workflow_count=0
for file in workflows/*.md; do
  [ "$(basename "$file")" = 'README.md' ] && continue
  workflow_count=$((workflow_count + 1))
  for heading in 觸發條件 負責角色 步驟 輸入 輸出 失敗處理 人工核准點; do
    grep -q "^## $heading" "$file" || fail "$file 缺少章節：$heading"
  done
done
[ "$workflow_count" -eq 7 ] || fail '工作流數量不是七份'
pass '七份工作流章節完整'

for target in roles/README.md workflows/README.md docs/approval-policy.md docs/research-source-policy.md knowledge/README.md scripts/validation/validate-workspace.sh; do
  grep -q "$target" AGENTS.md || fail "AGENTS.md 未導向：$target"
done
[ "$(wc -l < AGENTS.md | tr -d ' ')" -le 80 ] || fail 'AGENTS.md 超過 80 行，不夠精簡'
pass 'AGENTS.md 精簡且導向完整'

for phrase in 日期 分數 子指標 理由 反方證據 資料完整度 事後績效; do
  grep -q "$phrase" templates/market-risk-report.md || fail "市場風險模板缺少：$phrase"
done
pass '市場風險模板必要欄位完整'

for file in templates/daily-brief.md templates/threads-draft.md templates/instagram-carousel.md templates/content-weekly-report.md templates/market-risk-report.md templates/app-feature-spec.md; do
  grep -q '\[請填寫：' "$file" || fail "$file 沒有可直接填寫欄位"
done
pass '六份模板可直接填寫'

dashboard_count=$(find dashboard -maxdepth 1 -type f -name '*.md' | wc -l | tr -d ' ')
[ "$dashboard_count" -eq 6 ] || fail 'Dashboard 應有五分頁加一份索引'
for page in today market-risk content app outcomes; do
  [ -s "dashboard/$page.md" ] || fail "Dashboard 分頁缺失：$page"
done
pass 'Dashboard 五分頁資料契約完整'

for directory in knowledge templates records/market-risk records/reviews records/decisions dashboard scripts/notion scripts/market-data; do
  [ -d "$directory" ] || fail "資料目錄缺失：$directory"
done
pass '各資料類型有明確目錄'

grep -q '不得覆寫' AGENTS.md || fail 'AGENTS.md 缺少風險紀錄不可覆寫規則'
grep -q '不修改.*jj-invest-public\|不得.*jj-invest-public' AGENTS.md || fail 'AGENTS.md 缺少外部 App 禁止修改規則'
grep -q '資料缺失.*來源衝突.*停止做出確定結論' AGENTS.md || fail 'AGENTS.md 缺少資料缺失與衝突停止條件'
pass '核心安全規則存在'

printf 'ALL CHECKS PASSED\n'
