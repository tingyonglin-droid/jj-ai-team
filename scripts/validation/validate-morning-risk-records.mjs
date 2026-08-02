import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

function firstHeading(text) {
  return text.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "";
}

function field(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`^\\s*[-*]\\s*${escaped}[：:]\\s*(.+?)\\s*$`, "m"))?.[1]?.trim() ?? null;
}

function section(text, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^##\\s+${escaped}\\s*$`, "m").exec(text);
  if (!match) return "";
  const start = match.index + match[0].length;
  const next = text.indexOf("\n## ", start);
  return text.slice(start, next === -1 ? text.length : next).trim();
}

function integer(value) {
  if (value === null) return null;
  const match = value.match(/^[+]?(-?\d+)\b/);
  return match ? Number(match[1]) : null;
}

export function validateBrief(text) {
  const errors = [];
  const title = firstHeading(text);
  if (!title || title.includes("請填寫")) errors.push("主標題不得空白或含佔位文字");
  if (title && !/(但|不是|而是|卻|反而)/.test(title)) errors.push("主標題必須點出市場核心矛盾");

  for (const heading of ["今日風險儀表", "五則重要事件", "今日市場一句話", "反方證據與尚未確認資料", "來源"]) {
    if (!section(text, heading)) errors.push(`缺少必要章節：${heading}`);
  }

  const eventMatches = [...text.matchAll(/^###\s+(\d+)｜(.+)$/gm)];
  const numbers = eventMatches.map((match) => Number(match[1]));
  const names = eventMatches.map((match) => match[2].trim());
  if (eventMatches.length !== 5 || numbers.join(",") !== "1,2,3,4,5") {
    errors.push("五則重要事件必須恰好五則並依 1–5 編號");
  }
  if (new Set(names).size !== names.length) errors.push("事件名稱不可重複");

  const requiredHeadings = ["發生什麼事", "關鍵數據", "市場意義", "下行風險判斷", "接下來要看什麼"];
  const requiredFields = ["主要／次要性質", "風險階段", "影響期限", "傳導鏈", "確認訊號", "反方證據", "失效條件"];
  eventMatches.forEach((match, index) => {
    const start = match.index + match[0].length;
    const end = eventMatches[index + 1]?.index ?? text.indexOf("\n## ", start);
    const body = text.slice(start, end === -1 ? text.length : end);
    const name = match[2].trim();
    requiredHeadings.forEach((heading) => {
      if (!new RegExp(`^####\\s+${heading}\\s*$`, "m").test(body)) errors.push(`${name} 缺少章節：${heading}`);
    });
    requiredFields.forEach((label) => {
      const value = field(body, label);
      if (!value || value.includes("請填寫")) errors.push(`${name} 缺少欄位：${label}`);
    });
  });

  const oneLine = section(text, "今日市場一句話");
  if (oneLine && !/今天市場真正交易的不是.+，而是.+[。.]?/.test(oneLine)) {
    errors.push("今日市場一句話必須使用『不是…而是…』格式");
  }
  const sources = section(text, "來源");
  if (sources && (!/^\s*[-*]\s+/m.test(sources) || !/https?:\/\//.test(sources))) {
    errors.push("來源章節至少要有一項含連結的來源");
  }
  return errors;
}

export function validateRiskRecord(text) {
  const errors = [];
  const total = integer(field(text, "市場風險分數"));
  const baseline = integer(field(text, "基準分"));
  const adjustment = integer(field(text, "事件調整"));
  const completeness = integer(field(text, "資料完整度"));
  const confidence = integer(field(text, "AI 判斷信心"));

  const pillarRows = [...text.matchAll(/^\|\s*(景氣與成長|通膨與利率|流動性|信用|市場結構)\s*\|\s*20%\s*\|\s*(\d+)\s*\|/gm)];
  if (pillarRows.length !== 5) errors.push("子指標必須包含五項等權分數");
  const scores = pillarRows.map((match) => Number(match[2]));
  scores.forEach((score) => {
    if (score < 0 || score > 100) errors.push("子指標分數必須介於 0–100");
    if (score % 5 !== 0) errors.push("子指標分數必須以 5 分為刻度");
  });

  const computedBaseline = scores.length === 5 ? scores.reduce((sum, score) => sum + score, 0) / 5 : null;
  if (baseline === null || computedBaseline === null || baseline !== computedBaseline) {
    errors.push("基準分無法由五項等權子指標重算");
  }
  if (adjustment === null || adjustment < -10 || adjustment > 15) {
    errors.push("事件調整必須介於 -10 至 +15");
  }
  if (total === null || total < 0 || total > 100) errors.push("市場風險分數必須介於 0–100");
  if (baseline !== null && adjustment !== null && total !== Math.min(100, Math.max(0, baseline + adjustment))) {
    errors.push("市場風險分數無法重算：必須等於基準分加事件調整並限制在 0–100");
  }
  if (completeness === null || completeness < 0 || completeness > 100) errors.push("資料完整度必須介於 0–100");
  if (confidence === null || confidence < 0 || confidence > 100) errors.push("AI 判斷信心必須介於 0–100");

  const shadow = field(text, "影子運行");
  if (!shadow || !shadow.includes("實驗性指標")) errors.push("影子運行必須標示實驗性指標");
  if (!field(text, "即時風險")) errors.push("缺少即時風險");
  if (!field(text, "結構性風險")) errors.push("缺少結構性風險");
  if ((field(text, "三項主要風險")?.split("、").filter(Boolean).length ?? 0) !== 3) {
    errors.push("三項主要風險必須恰好三項");
  }
  return errors;
}

async function runCli() {
  const [briefPath, riskPath] = process.argv.slice(2);
  if (!briefPath || !riskPath) {
    console.error("用法：node validate-morning-risk-records.mjs <brief-path> <risk-path>");
    process.exitCode = 1;
    return;
  }
  const [briefText, riskText] = await Promise.all([readFile(briefPath, "utf8"), readFile(riskPath, "utf8")]);
  const errors = [
    ...validateBrief(briefText).map((error) => `${briefPath}: ${error}`),
    ...validateRiskRecord(riskText).map((error) => `${riskPath}: ${error}`),
  ];
  if (errors.length > 0) {
    errors.forEach((error) => console.error(`FAIL: ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log("PASS: 晨報與風險紀錄契約有效");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runCli();
