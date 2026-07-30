# 私人 AI 員工團隊工作區實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可直接使用、可擴充且具人工核准邊界的私人 AI 員工團隊文件工作區。

**Architecture:** 以 Markdown 文件分離跨團隊政策、角色責任、可執行工作流、長期知識、填寫模板、追加式紀錄與 Dashboard 資料契約。使用單一 POSIX shell 驗證工具檢查必要結構與文件品質，不引入外部套件、排程或服務連線。

**Tech Stack:** Markdown、POSIX shell、Git（僅在既有 Git 專案中顯示差異；本次不提交）

## Global Constraints

- 檔名及資料夾使用簡潔英文，文件內容使用繁體中文。
- 保留所有既有內容，不覆蓋不相關的使用者變更。
- 不登入或抓取 Notion、M 平方、YouTube 或 Threads。
- 不修改 `jj-invest-public` 或「Threads數據分析」。
- 不建立排程、正式 Dashboard、外部資料或社群發布動作。
- 不加入套件或複雜框架。
- AI 不發布內容、不回覆留言或私訊、不提供未核准的個人化投資建議，也不決定 App 上線。
- 市場風險指標採影子運行，不與 Beta、再平衡或操作建議自動連動。
- 歷史市場風險判斷只追加版本，不得覆寫。
- 不自行執行 Git 初始化、提交或推送。

---

### Task 1: 專案入口、政策與長期知識

**Files:**
- Create: `README.md`
- Create: `AGENTS.md`
- Create: `docs/team-design.md`
- Create: `docs/approval-policy.md`
- Create: `docs/research-source-policy.md`
- Create: `docs/risk-score-methodology.md`
- Create: `knowledge/README.md`
- Create: `knowledge/investment-philosophy.md`
- Create: `knowledge/beta-system.md`
- Create: `knowledge/app-product.md`
- Create: `knowledge/writing-style.md`

**Interfaces:**
- Consumes: 已核准的 `docs/superpowers/specs/2026-07-30-ai-team-workspace-design.md`。
- Produces: 全專案共同政策、文件導覽、資料存放規則與經人工確認後才能更新的長期知識入口。

- [ ] **Step 1: 建立專案入口與權威政策**

  `README.md` 說明目的、每日與每週節奏、目錄地圖、人工核准方式及建議試跑順序。四份 `docs/` 文件分別定義團隊設計、核准政策、研究來源與 0–100 風險方法；相同規則只保留一個權威版本。

- [ ] **Step 2: 建立精簡 `AGENTS.md`**

  僅保留工作優先順序、四角色邊界、禁止事項、研究與引用底線、付費內容限制、不可虛構、紀錄不可覆寫、目錄導向、任務路由及完成前驗證；詳細規則使用相對連結導向角色與工作流。

- [ ] **Step 3: 建立長期知識庫**

  四份知識文件使用「已確認內容、尚未提供資訊、更新規則」結構。未知的個人觀點明寫「尚未提供」，不得代填或推測；App 知識只描述現況與規劃邊界。

- [ ] **Step 4: 驗證入口與邊界**

  Run: `test -s README.md && test -s AGENTS.md && find docs knowledge -type f -name '*.md' -size 0 -print`

  Expected: 命令成功，且沒有列出空白 Markdown 文件。

---

### Task 2: 四位 AI 員工角色手冊

**Files:**
- Create: `roles/README.md`
- Create: `roles/commander/ROLE.md`
- Create: `roles/macro-researcher/ROLE.md`
- Create: `roles/social-operator/ROLE.md`
- Create: `roles/app-designer/ROLE.md`

**Interfaces:**
- Consumes: `docs/approval-policy.md`、`docs/research-source-policy.md`、`knowledge/`。
- Produces: 可由工作流引用的四份角色責任契約及角色擴充方法。

- [ ] **Step 1: 建立角色索引**

  `roles/README.md` 列出中文職稱、英文識別碼、使命、主要輸出、上游與下游交接，並說明新增角色的五步程序。

- [ ] **Step 2: 建立四份角色手冊**

  每份 `ROLE.md` 必須具備以下二級標題：`使命`、`輸入`、`輸出`、`可用來源`、`禁止事項`、`驗收標準`、`交接對象`。總經研究員另包含研究分層與外部觀點比較；社群經營員另包含內容支柱與靈感快線；App 設計員另包含既有功能與新增範圍。

- [ ] **Step 3: 驗證角色手冊結構**

  Run: `for f in roles/*/ROLE.md; do for h in 使命 輸入 輸出 可用來源 禁止事項 驗收標準 交接對象; do grep -q "^## $h" "$f" || exit 1; done; done`

  Expected: 命令成功，四份手冊均含完整章節。

---

### Task 3: 七條工作流與可直接填寫模板

**Files:**
- Create: `workflows/README.md`
- Create: `workflows/daily-brief.md`
- Create: `workflows/daily-threads.md`
- Create: `workflows/threads-analysis.md`
- Create: `workflows/weekly-instagram.md`
- Create: `workflows/founder-idea.md`
- Create: `workflows/market-risk.md`
- Create: `workflows/app-planning.md`
- Create: `templates/README.md`
- Create: `templates/daily-brief.md`
- Create: `templates/threads-draft.md`
- Create: `templates/instagram-carousel.md`
- Create: `templates/content-weekly-report.md`
- Create: `templates/market-risk-report.md`
- Create: `templates/app-feature-spec.md`

**Interfaces:**
- Consumes: 角色手冊、權威政策與長期知識。
- Produces: 可按觸發條件執行的流程，以及使用方括號提示文字直接複製填寫的成果格式。

- [ ] **Step 1: 建立工作流索引與節奏**

  索引說明平日五項工作、週一至週五節奏、每週 App 觀察、每月風險復盤，以及重大事件與臨時靈感的插入優先順序。

- [ ] **Step 2: 建立七份工作流**

  每份必須含 `觸發條件`、`負責角色`、`步驟`、`輸入`、`輸出`、`失敗處理`、`人工核准點`。流程中的事實、推論、外部觀點、反證與未確認資料須保持可追溯；外部資料無法取得時不得假裝完成。

- [ ] **Step 3: 建立六份模板**

  模板以 `[請填寫：具體內容]` 表示待填欄位，並包含狀態、來源、核准與版本資訊。風險報告包含日期、分數、子指標、理由、反證、資料完整度、AI 信心、待觀察數據與事後績效；App 規格包含用戶故事、流程、成功指標、非目標及上線核准。

- [ ] **Step 4: 驗證工作流章節與模板可填寫性**

  Run: `for f in workflows/*.md; do [ "$(basename "$f")" = README.md ] && continue; for h in 觸發條件 負責角色 步驟 輸入 輸出 失敗處理 人工核准點; do grep -q "^## $h" "$f" || exit 1; done; done && grep -q '\[請填寫：' templates/market-risk-report.md`

  Expected: 命令成功，七份流程章節完整且模板含明確填寫提示。

---

### Task 4: 追加式紀錄與 Dashboard 資料契約

**Files:**
- Create: `records/README.md`
- Create: `records/market-risk/README.md`
- Create: `records/reviews/README.md`
- Create: `records/decisions/README.md`
- Create: `docs/dashboard-information-architecture.md`
- Create: `dashboard/README.md`
- Create: `dashboard/today.md`
- Create: `dashboard/market-risk.md`
- Create: `dashboard/content.md`
- Create: `dashboard/app.md`
- Create: `dashboard/outcomes.md`

**Interfaces:**
- Consumes: 模板輸出與各工作流的核准狀態。
- Produces: 歷史資料命名及不可覆寫規則，以及五個 Dashboard 分頁的欄位契約。

- [ ] **Step 1: 建立紀錄規則與索引**

  市場風險使用 `YYYY-MM-DD-vNN.md`；復盤與決策使用帶日期的描述性英文檔名。定義原始版本、修正版、勘誤及事後績效如何追加，禁止靜默覆寫。

- [ ] **Step 2: 定義 Dashboard 整體資訊架構**

  說明五分頁導覽、共同狀態欄位、資料新鮮度、人工核准顯示、缺漏與衝突狀態，以及資料來源映射。

- [ ] **Step 3: 定義五個分頁契約**

  每份分頁文件列出用途、使用者問題、必要欄位表、來源、更新頻率、空值處理及禁止行為。內容分頁納入 Threads、IG 與 App 導流；App 分頁只呈現規格和決策，不呈現已上線假象。

- [ ] **Step 4: 驗證資料類型都有存放位置**

  Run: `test -s records/market-risk/README.md && test -s records/reviews/README.md && test -s records/decisions/README.md && test "$(find dashboard -maxdepth 1 -type f -name '*.md' | wc -l | tr -d ' ')" -eq 6`

  Expected: 命令成功，三類紀錄與五分頁加索引皆存在。

---

### Task 5: 腳本邊界、整體驗證與交付

**Files:**
- Create: `scripts/README.md`
- Create: `scripts/notion/README.md`
- Create: `scripts/market-data/README.md`
- Create: `scripts/validation/validate-workspace.sh`
- Modify: preceding files only when verification identifies a concrete defect

**Interfaces:**
- Consumes: 全部已建立文件及使用者驗收條件。
- Produces: 不連線的腳本邊界說明、可重複執行的工作區驗證，以及交付清單。

- [ ] **Step 1: 建立未來腳本邊界文件**

  Notion 與市場資料目錄只說明未來用途、輸入、輸出、憑證與人工核准限制。本次不放連線程式、不保存憑證，也不執行資料抓取。

- [ ] **Step 2: 建立無依賴驗證工具**

  `validate-workspace.sh` 使用 `find`、`grep`、`test` 檢查必要檔案、零位元組文件、禁用佔位詞、角色與工作流章節、`AGENTS.md` 導向、風險欄位和五個 Dashboard 分頁；任何失敗回傳非零狀態。

- [ ] **Step 3: 執行完整驗證**

  Run: `sh scripts/validation/validate-workspace.sh`

  Expected: 顯示所有檢查通過，結束狀態為 0。

- [ ] **Step 4: 檢查內容與範圍**

  Run: `find . -type f -print | sort && rg -n 'TODO|TBD|待補|待定' . --glob '!docs/superpowers/**' || true`

  Expected: 檔案都位於 `jj-ai-team`，且業務文件沒有禁用佔位詞。模板的 `[請填寫：…]` 是可操作欄位，不視為空白模板。

- [ ] **Step 5: 檢查 Git 狀態並交付**

  Run: `git rev-parse --is-inside-work-tree`

  Expected: 若成功，執行 `git status --short` 與 `git diff --stat`；若失敗，交付時說明此目錄不是 Git 專案。不得初始化或提交。

