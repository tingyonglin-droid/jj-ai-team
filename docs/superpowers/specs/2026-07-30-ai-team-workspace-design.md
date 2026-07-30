# 私人 AI 員工團隊工作區設計

## 目標

建立一套以總司令為中樞、由使用者半自動核准的私人 AI 員工工作區，支援財經研究、Threads 與 Instagram 內容、內容成效分析，以及 `jj-invest-public` 的 App 功能規格規劃。本專案只保存規則、知識、流程、模板、研究判斷與決策紀錄，不直接發布內容、不回覆社群訊息，也不修改外部 App 專案。

## 設計原則

- 英文路徑搭配繁體中文內容。
- 角色、工作流、長期知識、產出模板與歷史紀錄彼此分離。
- `AGENTS.md` 只保存每次任務都必須遵守的規則與導向，不重複詳細手冊。
- 權威政策只維護一份；角色與工作流文件引用政策，不複製整段規則。
- 市場風險判斷採追加式保存，已發布的歷史版本不得覆寫。
- 第一階段使用 Markdown 與簡單本機驗證，不加入外部套件、排程或複雜框架。
- 資料不足、來源衝突或查核未完成時，明確標示狀態並停止做出確定結論。

## 資訊架構

```text
jj-ai-team/
├── README.md
├── AGENTS.md
├── docs/
│   ├── team-design.md
│   ├── approval-policy.md
│   ├── research-source-policy.md
│   ├── risk-score-methodology.md
│   └── dashboard-information-architecture.md
├── roles/
│   ├── README.md
│   ├── commander/ROLE.md
│   ├── macro-researcher/ROLE.md
│   ├── social-operator/ROLE.md
│   └── app-designer/ROLE.md
├── workflows/
│   ├── README.md
│   ├── daily-brief.md
│   ├── daily-threads.md
│   ├── threads-analysis.md
│   ├── weekly-instagram.md
│   ├── founder-idea.md
│   ├── market-risk.md
│   └── app-planning.md
├── knowledge/
│   ├── README.md
│   ├── investment-philosophy.md
│   ├── beta-system.md
│   ├── app-product.md
│   └── writing-style.md
├── templates/
│   ├── README.md
│   ├── daily-brief.md
│   ├── threads-draft.md
│   ├── instagram-carousel.md
│   ├── content-weekly-report.md
│   ├── market-risk-report.md
│   └── app-feature-spec.md
├── records/
│   ├── README.md
│   ├── market-risk/README.md
│   ├── reviews/README.md
│   └── decisions/README.md
├── dashboard/
│   ├── README.md
│   ├── today.md
│   ├── market-risk.md
│   ├── content.md
│   ├── app.md
│   └── outcomes.md
└── scripts/
    ├── README.md
    ├── notion/README.md
    ├── market-data/README.md
    └── validation/validate-workspace.sh
```

`docs/superpowers/` 僅保存本次經核准的設計與實作計畫，不屬於日常業務資料。

## 角色設計

每位 AI 員工使用獨立角色目錄，核心手冊固定命名為 `ROLE.md`。每份手冊包含使命、輸入、輸出、可用來源、禁止事項、驗收標準與交接對象。日後新增員工時，只需新增角色目錄、更新 `roles/README.md` 的登記資料，再將角色加入相關工作流。

- 總司令：拆解、排序、分派、驗收、摘要、復盤與整理待核准事項。
- 總經研究員：原始數據研究、外部觀點比較、晨報、風險指標與歷史復盤。
- 社群經營員：Threads 草稿、成效分析、IG 規劃與創辦人靈感整理。
- App 設計員：現有產品分析、升級路徑及功能規格；不得修改或上線 `jj-invest-public`。

## 工作流設計

工作流以「可獨立驗收的成果」為單位，不綁死單一角色。每份文件包含觸發條件、負責與協作角色、步驟、輸入、輸出、失敗處理及人工核准點。初期一條工作流使用一份文件；只有當流程出現多個可獨立核准階段、多人交接或文件過長時，才改成同名目錄並拆分子流程。

第一階段涵蓋每日投資晨報、每日 Threads、Threads 成效分析、每週 IG、創辦人靈感快線、市場風險指標及 App 產品規劃。每日與每週節奏由文件定義，本次不建立自動排程。

## 知識與資料邊界

`knowledge/` 保存經使用者確認、可跨任務重用的穩定知識：投資理念、Beta 系統、App 產品知識及寫作風格。尚未取得的個人資訊標記為「尚未提供」，AI 不得自行補造。每日成果、當期研究與決策不寫回長期知識庫，分別保存到模板產出位置與 `records/`。

`records/market-risk/` 保存帶日期與版本的風險紀錄，至少包含日期、總分、子指標、理由、反證、資料完整度、AI 信心、待觀察條件及事後績效欄位。修正只能建立新版本或勘誤紀錄，不得覆寫當時判斷。

## 研究與人工核准

研究先使用原始資料形成初步判斷，再參考游庭皓財經速解讀及使用者已登入的財經 M 平方內容作外部驗證。外部來源不是標準答案，成果必須分開標示已確認事實、AI 推論、外部觀點、最終判斷、反方證據與尚未確認資料。

付費會員資料僅供使用者授權範圍內的研究與摘要，不大量複製、不轉散原文、不繞過存取控制，紀錄時以結論、必要短摘與來源定位為主。本次不登入或抓取任何外部服務。

所有 Threads、Instagram、留言、私訊、個人化投資建議與 App 上線決策均保留人工核准。市場風險指標第一階段只提供影子分數與研究看法，不和 Beta、再平衡或操作建議自動連動。

## Dashboard 資料契約

Dashboard 文件定義五個分頁：今日總覽、市場風險、內容、App、成果。每個分頁會列出用途、必要欄位、資料來源、更新頻率、空值與錯誤狀態，以及人工核准狀態。本次只產出資訊架構與資料契約，不建立前端程式。

## 驗證策略

本機驗證工具不得依賴額外套件，並檢查：

1. 所有必要檔案存在且非空白。
2. 文件不存在 `TODO`、`TBD` 或空白模板欄位。
3. 四份角色手冊與七份工作流具備要求章節。
4. `AGENTS.md` 維持精簡，且能導向角色、工作流、政策與知識文件。
5. 每種資料均有明確存放位置。
6. 禁止事項、人工核准與風險紀錄不可覆寫規則沒有互相矛盾。
7. 工作區異動只發生在 `jj-ai-team` 目錄內。

若初始化時仍不是 Git 專案，交付時明確說明無法提供 Git 差異；不為了取得差異而自行執行 Git 初始化。

## 未來擴充方式

新增角色時建立新的 `roles/<role-name>/ROLE.md`，更新角色索引並把角色加入必要工作流。拆分任務時保留原工作流入口，將細節移至同名目錄的獨立子流程。新增穩定知識時先確認歸屬領域與人工核准狀態，避免把短期產出混入 `knowledge/`。只有在實際出現機器交換需求後，才考慮增加 YAML 或 JSON 設定；第一階段不預先建立註冊系統。

