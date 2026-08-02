import assert from "node:assert/strict";
import test from "node:test";

import {
  validateBrief,
  validateRiskRecord,
} from "./validate-morning-risk-records.mjs";

const event = (number, name) => `### ${number}｜${name}

#### 發生什麼事

已確認事件內容。

#### 關鍵數據

數值、期間與來源。

#### 市場意義

市場正在重新評估風險。

#### 下行風險判斷

- 主要／次要性質：D 風險變化
- 風險階段：升溫
- 影響期限：1–4 週
- 傳導鏈：事件 → 利率 → 估值

#### 接下來要看什麼

- 確認訊號：殖利率上升
- 反方證據：通膨降溫
- 失效條件：殖利率回落
`;

const validBrief = `# Fed 沒升息，但長端利率正在改寫科技股估值

- 狀態：待核准
- 資料截止：2026-07-30 17:30（Asia/Taipei，UTC+8）

## 一分鐘摘要

- 五則風險摘要。

## 今日風險儀表

- 1–4 週風險分數：60

## 五則重要事件

${event(1, "事件一")}
${event(2, "事件二")}
${event(3, "事件三")}
${event(4, "事件四")}
${event(5, "事件五")}

## 今日市場一句話

今天市場真正交易的不是 Fed 沒升息，而是長端利率重新定價。

## 反方證據與尚未確認資料

- 反方證據：經濟仍有韌性。

## 來源

- Federal Reserve，2026-07-29，會議聲明，https://www.federalreserve.gov/
`;

const validRisk = `# 市場風險報告｜2026-07-30-v01

- 狀態：待核准
- 資料截止：2026-07-30 17:30（Asia/Taipei，UTC+8）
- 方法版本：v2.0
- 影子運行：實驗性指標／第 1 個交易日
- 觀察期：主分數為 1–4 週

## 總覽

- 市場風險分數：60
- 基準分：50
- 事件調整：+10
- 單日變動：尚無前值
- 5 日趨勢：尚無資料
- 20 日趨勢：尚無資料
- 風險狀態及趨勢：中性；尚無趨勢
- 即時風險：1–3 個交易日內留意能源與殖利率
- 結構性風險：1–2 季留意資本支出回報
- 三項主要風險：能源衝擊、長端利率、市場廣度
- AI 判斷信心：70
- 資料完整度：80

## 子指標

| 子指標 | 權重 | 分數 | 趨勢 | 理由 | 來源 |
|---|---:|---:|---|---|---|
| 景氣與成長 | 20% | 40 | 持平 | 測試 | 官方來源 |
| 通膨與利率 | 20% | 70 | 上升 | 測試 | 官方來源 |
| 流動性 | 20% | 45 | 持平 | 測試 | 官方來源 |
| 信用 | 20% | 35 | 持平 | 測試 | 官方來源 |
| 市場結構 | 20% | 60 | 上升 | 測試 | 市場資料 |

## 事件調整

- 調整事件：能源衝擊
- 失效條件：油價回落

## 證據與限制

- 支持證據：官方來源。

## 核准

- 待核准事項：是否接受試跑內容。
`;

test("晨報必須恰好包含五則完整且不重複的事件", () => {
  const invalid = validBrief.replace("### 5｜事件五", "### 4｜事件四");
  const errors = validateBrief(invalid);

  assert.ok(errors.some((error) => error.includes("恰好五則")));
  assert.ok(errors.some((error) => error.includes("事件名稱不可重複")));
});

test("晨報缺少事件必要欄位時會明確指出事件與欄位", () => {
  const invalid = validBrief.replace("- 失效條件：殖利率回落", "");
  const errors = validateBrief(invalid);

  assert.ok(errors.some((error) => error.includes("事件一") && error.includes("失效條件")));
});

test("完整晨報不產生契約錯誤", () => {
  assert.deepEqual(validateBrief(validBrief), []);
});

test("風險總分必須能由五項子分數與事件調整重算", () => {
  const invalid = validRisk.replace("- 市場風險分數：60", "- 市場風險分數：61");
  const errors = validateRiskRecord(invalid);

  assert.ok(errors.some((error) => error.includes("無法重算")));
});

test("風險分數限制、刻度與事件調整都必須有效", () => {
  const invalid = validRisk
    .replace("| 景氣與成長 | 20% | 40 |", "| 景氣與成長 | 20% | 41 |")
    .replace("- 事件調整：+10", "- 事件調整：+20")
    .replace("- 資料完整度：80", "- 資料完整度：101");
  const errors = validateRiskRecord(invalid);

  assert.ok(errors.some((error) => error.includes("5 分為刻度")));
  assert.ok(errors.some((error) => error.includes("事件調整")));
  assert.ok(errors.some((error) => error.includes("資料完整度")));
});

test("完整風險紀錄不產生契約錯誤", () => {
  assert.deepEqual(validateRiskRecord(validRisk), []);
});
