# 晨間投資風險摘要試跑實作計畫

> **給執行人員：** 必須使用 `superpowers:subagent-driven-development`（建議）或 `superpowers:executing-plans`，逐項執行本計畫。所有步驟使用核取方塊（`- [ ]`）追蹤。

**目標：** 產生可追溯的 `2026-07-30-v02` 五則下行風險晨報與首份實驗性市場風險快照，讓私人 Dashboard 顯示這兩份最新紀錄，並在啟用任何週期排程前停下來交由使用者核准。

**架構：** 在既有的 `dashboard` 工作樹實作試跑版，使來源紀錄、快照產生器、介面、測試與可部署網站維持在同一分支。Markdown 是權威且可閱讀的紀錄；確定性的 Node.js 驗證器檢查五則事件契約與風險算式；Dashboard 產生器把最新有效的 `vNN` 紀錄解析成具型別的顯示欄位。2026-07-30 真實研究只採用公開且可追溯的來源，並以只能新增的 v02／v01 紀錄保存。

**技術組合：** Markdown 紀錄、Node.js `>=22.13.0`、TypeScript 5.9、內建 `node:test`、React 19、Next.js 16／Vinext，以及既有私人 Dashboard 部署。

## 全域限制

- 在 `/Users/jjlin/Library/CloudStorage/SynologyDrive-1/Codex/jj-ai-team/.worktrees/dashboard` 執行實作。
- 保留 `records/daily-briefs/2026-07-30-v01.md`；建立 `2026-07-30-v02.md`，由版本選擇機制只替換 Dashboard 的目前顯示。
- 不覆寫歷史風險紀錄；建立 `records/market-risk/2026-07-30-v01.md`。
- 第一版固定五則事件、不包含圖片，而且只使用合法且可追溯的公開來源。
- 主風險分數代表未來 1–4 週；另行標示 1–3 個交易日的即時風險與 1–2 季的結構性風險。
- 風險分數等於五項等權基準分加上 `-10` 至 `+15` 的事件調整，最終限制在 0–100。
- 每則事件都包含下行傳導鏈、確認訊號、反方證據及失效條件。
- 狀態維持「待核准」；不得對外發布、建議交易、調整 Beta 或啟用週期自動化。
- 不暫存既有的 `dashboard-site/data/dashboard.json` 純檔案權限變更。建置可以為部署重新產生內容，但本試跑版的提交不包含該檔案。
- 優先使用原始來源；二手媒體只能補充背景或交叉查核。
- 部署前完成 `sh scripts/validation/validate-workspace.sh` 與 Dashboard 測試。若工作區驗證仍掃描相依套件或快取檔案，應修正驗證器的掃描範圍，不得刪除無關的使用者檔案或相依套件檔案。

---

### 任務一：讓作業文件與模板符合已核准的試跑規格

**檔案：**
- 修改：`docs/risk-score-methodology.md`
- 修改：`workflows/daily-brief.md`
- 修改：`workflows/market-risk.md`
- 修改：`templates/daily-brief.md`
- 修改：`templates/market-risk-report.md`
- 測試：`scripts/validation/validate-workspace.sh`

**介面：**
- 輸入：`docs/superpowers/specs/2026-07-30-morning-investment-risk-brief-design.md` 的已核准設計。
- 輸出：任務二至任務五使用的權威標題與欄位。

- [ ] **步驟 1：加入預期先失敗的工作區契約檢查**

加入檢查，要求晨報模板包含「今日風險儀表」、「五則重要事件」、「今日市場一句話」及「反方證據與尚未確認資料」；要求風險模板包含「事件調整」、「即時風險」、「結構性風險」及「影子運行」。

```sh
for heading in 今日風險儀表 五則重要事件 今日市場一句話 反方證據與尚未確認資料; do
  grep -q "^## $heading" templates/daily-brief.md || exit 1
done
for phrase in 事件調整 即時風險 結構性風險 影子運行; do
  grep -q "$phrase" templates/market-risk-report.md || exit 1
done
```

- [ ] **步驟 2：執行驗證並確認新檢查會失敗**

執行：`sh scripts/validation/validate-workspace.sh`

預期：失敗，因為既有模板尚未包含已核准試跑版的標題與欄位。

- [ ] **步驟 3：更新方法、工作流與模板**

記錄 06:30 收集、07:10 截止、07:30 交付、公開來源規則、固定五則、因果去重、五分鐘篇幅、五項等權指標、`-10..+15` 事件調整、三種期限、資料完整度、AI 信心，以及 30 個交易日影子運行標籤。保留 Dashboard 來源清單要求的事實、推論、外部觀點及反方證據章節。

晨報模板必須使用編號 1–5，恰好包含五次以下事件結構：

```markdown
### 1｜[請填寫：事件名稱]

#### 發生什麼事

#### 關鍵數據

#### 市場意義

#### 下行風險判斷

- 主要／次要性質：
- 風險階段：
- 影響期限：
- 傳導鏈：

#### 接下來要看什麼

- 確認訊號：
- 反方證據：
- 失效條件：
```

- [ ] **步驟 4：將零位元組檢查限制在權威工作區檔案**

若目前驗證器仍因 `.pnpm-store/`、`.worktrees/` 或 `node_modules/` 失敗，修改其 `find` 表達式以排除這些生成目錄，同時繼續掃描專案擁有的文件與腳本。不得刪除這些目錄或檔案。

- [ ] **步驟 5：執行工作區驗證**

執行：`sh scripts/validation/validate-workspace.sh`

預期：通過。

- [ ] **步驟 6：提交作業契約更新**

```bash
git add docs/risk-score-methodology.md workflows/daily-brief.md workflows/market-risk.md templates/daily-brief.md templates/market-risk-report.md scripts/validation/validate-workspace.sh
git commit -m "docs: align morning brief risk workflow"
```

### 任務二：加入確定性的晨報與風險紀錄驗證器

**檔案：**
- 建立：`scripts/validation/validate-morning-risk-records.mjs`
- 建立：`scripts/validation/validate-morning-risk-records.test.mjs`
- 修改：`scripts/validation/validate-workspace.sh`

**介面：**
- 輸入：一個晨報 Markdown 路徑及一個市場風險 Markdown 路徑。
- 輸出：`validateBrief(text)` 與 `validateRiskRecord(text)`，回傳人類可讀的錯誤陣列；任一紀錄無效時，命令列介面以非零狀態結束。

- [ ] **步驟 1：為晨報契約撰寫預期先失敗的測試**

涵蓋恰好五則有編號的 `### N｜` 事件、不可重複的事件名稱、所有必要的 `####` 子章節、非空白來源章節、點出核心矛盾的標題，以及最後的「今天市場真正交易的不是……而是……」句型。

```js
test("brief requires exactly five complete and unique events", () => {
  const errors = validateBrief(validBrief.replace("### 5｜事件五", "### 4｜事件四"));
  assert.ok(errors.some((error) => error.includes("恰好五則")));
  assert.ok(errors.some((error) => error.includes("事件名稱不可重複")));
});
```

- [ ] **步驟 2：為風險算式與界線撰寫預期先失敗的測試**

涵蓋五個 0–100 且以 5 分為刻度的子分數、等權基準分、事件調整界線、限制後總分、完整度、信心、期限及影子運行狀態。

```js
test("risk total must reproduce from pillars and event adjustment", () => {
  const errors = validateRiskRecord(validRisk.replace("- 市場風險分數：60", "- 市場風險分數：61"));
  assert.ok(errors.some((error) => error.includes("無法重算")));
});
```

- [ ] **步驟 3：執行驗證器測試並確認失敗**

執行：`node --test scripts/validation/validate-morning-risk-records.test.mjs`

預期：失敗，因為驗證器模組尚不存在。

- [ ] **步驟 4：實作最小解析器與命令列介面**

只使用 Node.js 標準函式庫模組。解析有標籤的清單欄位與 Markdown 標題，不推測缺失值。匯出兩個驗證函式並接受以下指令：

```text
node scripts/validation/validate-morning-risk-records.mjs <brief-path> <risk-path>
```

每項錯誤連同檔案標籤一起輸出並以 `1` 結束；有效時輸出 `PASS: 晨報與風險紀錄契約有效` 並以 `0` 結束。

- [ ] **步驟 5：執行聚焦測試**

執行：`node --test scripts/validation/validate-morning-risk-records.test.mjs`

預期：通過。

- [ ] **步驟 6：把驗證器測試加入工作區驗證並同時執行**

執行：`node --test scripts/validation/validate-morning-risk-records.test.mjs && sh scripts/validation/validate-workspace.sh`

預期：通過。

- [ ] **步驟 7：提交確定性驗證器**

```bash
git add scripts/validation/validate-morning-risk-records.mjs scripts/validation/validate-morning-risk-records.test.mjs scripts/validation/validate-workspace.sh
git commit -m "test: validate morning risk records"
```

### 任務三：擴充 Dashboard 快照契約以支援風險優先欄位

**檔案：**
- 修改：`dashboard-site/lib/dashboard-types.ts`
- 修改：`dashboard-site/scripts/generate-dashboard-data.mts`
- 修改：`dashboard-site/scripts/generate-dashboard-data.test.mts`

**介面：**
- 輸入：最新有效的 `records/daily-briefs/*-vNN.md` 與 `records/market-risk/*-vNN.md`。
- 輸出：`DashboardSnapshot.brief.headline`，以及 `DashboardSnapshot.marketRisk` 的 `score`、`baseline`、`eventAdjustment`、`dailyChange`、`label`、`immediateRisk`、`structuralRisk`、`topRisks`、`confidence`、`completeness`、`experimental`。

- [ ] **步驟 1：加入預期先失敗的最新版本測試**

為同一份 2026-07-30 晨報建立 v01 與 v02 測試資料。斷言只有 v02 出現在 `brief`、`tasks` 與 `approvals`，來源為 `records/daily-briefs/2026-07-30-v02.md`。

```ts
assert.equal(snapshot.brief?.source, "records/daily-briefs/2026-07-30-v02.md");
assert.equal(snapshot.approvals.filter((item) => item.type === "晨報").length, 1);
assert.equal(snapshot.approvals[0]?.source, "records/daily-briefs/2026-07-30-v02.md");
```

- [ ] **步驟 2：加入預期先失敗的風險欄位解析測試**

建立完整風險測試資料，並斷言精確的數字與文字欄位：

```ts
assert.equal(snapshot.marketRisk?.score, 65);
assert.equal(snapshot.marketRisk?.baseline, 55);
assert.equal(snapshot.marketRisk?.eventAdjustment, 10);
assert.equal(snapshot.marketRisk?.experimental, true);
assert.deepEqual(snapshot.marketRisk?.topRisks, ["能源衝擊", "長端利率", "市場廣度"]);
```

- [ ] **步驟 3：執行聚焦的產生器測試並確認失敗**

在 `dashboard-site` 執行：`node --import tsx --test scripts/generate-dashboard-data.test.mts`

預期：失敗，因為型別或解析器尚未包含風險優先欄位。

- [ ] **步驟 4：擴充型別並解析明確標籤欄位**

把風險欄位加入 `DashboardSnapshot`。只解析精確的 Markdown 標籤；遇到缺失、格式錯誤、超出範圍或無法重算的算式時，回傳阻擋狀態。不得從敘述文字推導分數。

- [ ] **步驟 5：執行產生器測試與型別檢查**

在 `dashboard-site` 執行：`node --import tsx --test scripts/generate-dashboard-data.test.mts && npm run typecheck`

預期：通過。

- [ ] **步驟 6：提交快照契約**

```bash
git add dashboard-site/lib/dashboard-types.ts dashboard-site/scripts/generate-dashboard-data.mts dashboard-site/scripts/generate-dashboard-data.test.mts
git commit -m "feat: parse daily market risk snapshot"
```

### 任務四：在私人 Dashboard 呈現風險優先試跑版

**檔案：**
- 修改：`dashboard-site/app/dashboard-components.tsx`
- 修改：`dashboard-site/app/dashboard-routes.test.tsx`
- 修改：`dashboard-site/app/globals.css`

**介面：**
- 輸入：任務三的風險優先欄位。
- 輸出：可存取的 Dashboard 卡片，顯示實驗狀態、分數、變動、三種期限、主要風險、完整度、信心與來源。

- [ ] **步驟 1：加入預期先失敗的路由渲染測試**

斷言渲染後首頁包含「實驗性指標」、「1–4 週風險」、「即時風險」、「結構性風險」、「事件調整」、「資料完整度」及可追溯來源路徑。斷言待核准中心只顯示 7/30 晨報的 v02。

- [ ] **步驟 2：執行路由測試並確認失敗**

在 `dashboard-site` 執行：`node --import tsx --test app/dashboard-routes.test.tsx`

預期：失敗，因為目前卡片只顯示風險標籤與完整度。

- [ ] **步驟 3：實作風險優先卡片**

狀態必須以文字呈現，不能只依賴顏色。明顯呈現主分數與單日變動；以文字顯示即時與結構性期限；顯示基準分與事件調整，使總分可以解釋。保留明確的空值、過期與受阻狀態。

- [ ] **步驟 4：加入響應式樣式但不改變既有設計系統**

沿用目前卡片、徽章、網格、間距與焦點樣式。窄螢幕將分數細節改為單欄排列，不建立新的視覺語言。

- [ ] **步驟 5：執行路由測試、型別檢查與程式碼檢查**

在 `dashboard-site` 執行：`node --import tsx --test app/dashboard-routes.test.tsx && npm run typecheck && npm run lint`

預期：通過。

- [ ] **步驟 6：提交 Dashboard 呈現變更**

```bash
git add dashboard-site/app/dashboard-components.tsx dashboard-site/app/dashboard-routes.test.tsx dashboard-site/app/globals.css
git commit -m "feat: show experimental risk brief dashboard"
```

### 任務五：研究並撰寫 2026-07-30 試跑紀錄

**檔案：**
- 建立：`records/daily-briefs/2026-07-30-v02.md`
- 建立：`records/market-risk/2026-07-30-v01.md`
- 保留：`records/daily-briefs/2026-07-30-v01.md`

**介面：**
- 輸入：2026-07-29 美國交易時段的公開原始來源、截至選定 2026-07-30 截止時間可取得的資訊，以及任務一的模板。
- 輸出：一份待核准晨報及一份待核准實驗性風險紀錄，且能通過任務二與任務三。

- [ ] **步驟 1：確定試跑截止時間與候選事件池**

記錄不晚於實際研究時間的截止時間；若試跑版較晚產生，不得宣稱截止於 07:10。優先查找 Fed、美國財政部、BEA／BLS、公司投資人關係／SEC、交易所及其他相關原始來源。建立至少八個候選事件，包含來源、日期、意外程度、受影響資產、下行傳導鏈、迫近度與反方證據。

- [ ] **步驟 2：選出五則因果不同的事件**

依發生機率、下行幅度、影響廣度、持續性與迫近度排序。把未入選候選事件及原因保留在晨報「尚未確認與待觀察」章節或來源附錄的研究筆記中；不得虛構第五則事件。

- [ ] **步驟 3：撰寫 `2026-07-30-v02.md`**

使用已核准的標題、風險儀表、五則事件、反方證據、今日市場一句話及來源格式。保留 Dashboard 來源清單要求的章節：「一分鐘摘要」、「已確認事實」、「AI 推論與初步判斷」、「外部觀點比較」、「最終判斷與反方證據」、「尚未確認與待觀察」及「人工核准」。

Set:

```markdown
- 狀態：待核准
- 版本：v02（下行風險優先試跑版）
```

核准問題必須詢問五則事件選擇、下行風險框架、標題及閱讀篇幅是否適合 30 日影子運行。清楚說明核准不授權公開發布或週期排程。

- [ ] **步驟 4：計算並撰寫首份市場風險紀錄**

依有引用的證據，以 5 分為刻度評估每個子指標；計算等權基準分；只有符合文件條件時才能使用事件調整；最後限制總分。標示為「實驗性指標／影子運行第 1 日」，並記錄三種期限、完整度、信心、三項主要風險、確認訊號、反方證據與失效條件。

- [ ] **步驟 5：驗證兩份紀錄**

執行：

```bash
node scripts/validation/validate-morning-risk-records.mjs records/daily-briefs/2026-07-30-v02.md records/market-risk/2026-07-30-v01.md
sh scripts/validation/validate-workspace.sh
```

預期：兩個指令都通過。

- [ ] **步驟 6：執行研究政策審查**

確認每項可查證事實都有來源名稱、發布日期、代表期間及連結或定位；確認事實、AI 推論、外部觀點、最終判斷、反方證據及未知資料保持分離；確認沒有投資建議或無證據支持的確定結論。

- [ ] **步驟 7：提交試跑紀錄**

```bash
git add records/daily-briefs/2026-07-30-v02.md records/market-risk/2026-07-30-v01.md
git commit -m "feat: add July 30 downside risk brief pilot"
```

### 任務六：驗證最新版本選擇並產生部署快照

**檔案：**
- 僅驗證：`dashboard-site/data/dashboard.json`
- 測試覆蓋需要時修改：`dashboard-site/tests/rendered-html.test.mjs`

**介面：**
- 輸入：任務三至任務五。
- 輸出：選用晨報 v02 與市場風險 v01 的生成快照；晨報 v01 只保留為歷史。

- [ ] **步驟 1：產生 Dashboard 資料**

在 `dashboard-site` 執行：`npm run data:generate`

預期：生成快照引用 `records/daily-briefs/2026-07-30-v02.md` 與 `records/market-risk/2026-07-30-v01.md`。

- [ ] **步驟 2：斷言快照選擇與核准狀態**

執行：

```bash
node -e 'const d=require("./data/dashboard.json"); if(d.brief.source!=="records/daily-briefs/2026-07-30-v02.md"||d.marketRisk.source!=="records/market-risk/2026-07-30-v01.md"||!d.approvals.some(x=>x.source==="records/daily-briefs/2026-07-30-v02.md")||d.approvals.some(x=>x.source==="records/daily-briefs/2026-07-30-v01.md")) process.exit(1)'
```

預期：以 `0` 結束。

- [ ] **步驟 3：執行完整 Dashboard 測試套件**

在 `dashboard-site` 執行：`npm test`

預期：通過，包含資料產生、型別檢查、單元測試、建置及渲染 HTML 測試。

- [ ] **步驟 4：檢查生成變更但不暫存既有權限漂移**

執行：`git diff --summary -- dashboard-site/data/dashboard.json` 及 `git diff -- dashboard-site/data/dashboard.json`。

預期：內容顯示晨報 v02／風險 v01；先前 `100644 -> 100755` 的純權限漂移仍不暫存。除非使用者另行確認要正規化既有權限變更，否則提交不得包含 `dashboard.json`。

- [ ] **步驟 5：只提交額外的測試變更（如有）**

```bash
git add dashboard-site/tests/rendered-html.test.mjs
git commit -m "test: verify latest risk brief rendering"
```

沒有測試檔案變更時略過此提交。

### 任務七：部署私人試跑版並停下等待核准

**檔案：**
- 驗證：`dashboard-site/README.md`
- 不得修改：部署允許名單祕密資料或驗證政策。

**介面：**
- 輸入：已驗證的工作樹及任務六產生的快照。
- 輸出：顯示 v02 與實驗性風險快照的受保護 Dashboard，以及一項使用者核准請求；不建立週期自動化。

- [ ] **步驟 1：確認提交與工作樹範圍**

執行：`git status --short` 及 `git log --oneline -8`。

預期：實作提交都存在；無關的 `.pnpm-store` 與既有 `dashboard.json` 權限變更未被暫存。

- [ ] **步驟 2：透過既有受保護 Dashboard 流程部署**

使用已連結的私人 Dashboard 專案與既有允許名單環境設定。不得輸出或修改被允許的 Email 值。部署必須從工作樹紀錄重新建立資料快照。

- [ ] **步驟 3：驗證受保護的正式環境頁面**

確認 `/`、`/employees` 與 `/approvals` 都要求既有 ChatGPT 身分；確認已授權畫面顯示 v02 來源路徑、風險 v01 來源路徑、「待核准」、「實驗性指標」、分數算式、完整度、信心及更新時間。確認晨報 v01 不是目前待核准項目。

- [ ] **步驟 4：執行最終本機驗證**

在工作樹根目錄執行：`sh scripts/validation/validate-workspace.sh`

在 `dashboard-site` 執行：`npm test`

預期：兩者都通過。

- [ ] **步驟 5：把試跑版交給使用者**

提供受保護 Dashboard 連結、兩份 Markdown 紀錄的直接連結、分數與算式、來源截止時間、已知限制，以及需要使用者決定的明確問題。清楚說明：

```text
目前只完成 7/30 試跑與 Dashboard 更新；每日 07:30 排程尚未啟用。
```

停下並等待下列其中一種回覆：「核准進入 30 日影子運行」、「退回修訂」，或具體修改要求。本計畫不得建立週期自動化。
