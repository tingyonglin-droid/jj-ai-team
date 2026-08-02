import calendarData from "../data/nyse-market-calendar.json" with { type: "json" };

export type MarketCalendar = {
  timeZone: "Asia/Taipei";
  deliveryCutoff: string;
  coverageYears: number[];
  fullCloseDates: string[];
  earlyCloseDates: string[];
  sources: Array<{
    name: string;
    url: string;
    checkedAt: string;
  }>;
  reviewBy: string;
};

export type ReportExpectation = {
  dashboardDate: string;
  expectedReportDate: string | null;
  coveredSessionDate: string | null;
  phase: "before_cutoff" | "due" | "carry_forward" | "blocked";
  reason: string;
};

type TaipeiClock = {
  date: string;
  year: number;
  hour: number;
  minute: number;
};

export function loadMarketCalendar(): MarketCalendar {
  return calendarData as MarketCalendar;
}

export function resolveReportExpectation(
  now: Date,
  calendar: MarketCalendar,
): ReportExpectation {
  const taipei = taipeiClock(now, calendar.timeZone);
  if (!calendar.coverageYears.includes(taipei.year)) {
    return {
      dashboardDate: taipei.date,
      expectedReportDate: null,
      coveredSessionDate: null,
      phase: "blocked",
      reason: `NYSE 交易日曆未涵蓋 ${taipei.year} 年，無法判定應有晨報。`,
    };
  }

  const weekday = weekdayFor(taipei.date);
  if (weekday === 0 || weekday === 6) {
    return carryForwardExpectation(
      taipei.date,
      calendar,
      "週末不產生例行晨報，沿用最近一個應有報告日。",
    );
  }

  if (isBeforeCutoff(taipei, calendar.deliveryCutoff)) {
    const previous = previousEligibleReport(taipei.date, calendar);
    return {
      dashboardDate: taipei.date,
      expectedReportDate: previous.reportDate,
      coveredSessionDate: previous.sessionDate,
      phase: "before_cutoff",
      reason: "尚未到 07:30 交付門檻，沿用前一個應有報告日。",
    };
  }

  const coveredSessionDate = sessionForReportDate(taipei.date, calendar);
  if (coveredSessionDate) {
    return {
      dashboardDate: taipei.date,
      expectedReportDate: taipei.date,
      coveredSessionDate,
      phase: "due",
      reason: "已到 07:30 交付門檻，今日應有新的例行晨報。",
    };
  }

  return carryForwardExpectation(
    taipei.date,
    calendar,
    "前一個美國工作日為 NYSE 完整休市，不建立新的例行晨報。",
  );
}

function taipeiClock(now: Date, timeZone: string): TaipeiClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = `${values.year}-${values.month}-${values.day}`;
  return {
    date,
    year: Number(values.year),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function isBeforeCutoff(clock: TaipeiClock, cutoff: string) {
  const [hour, minute] = cutoff.split(":").map(Number);
  return clock.hour * 60 + clock.minute < hour * 60 + minute;
}

function carryForwardExpectation(
  dashboardDate: string,
  calendar: MarketCalendar,
  reason: string,
): ReportExpectation {
  const previous = previousEligibleReport(dashboardDate, calendar);
  return {
    dashboardDate,
    expectedReportDate: previous.reportDate,
    coveredSessionDate: previous.sessionDate,
    phase: "carry_forward",
    reason,
  };
}

function previousEligibleReport(beforeDate: string, calendar: MarketCalendar) {
  let reportDate = addDays(beforeDate, -1);
  for (let attempts = 0; attempts < 14; attempts += 1) {
    const sessionDate = sessionForReportDate(reportDate, calendar);
    if (sessionDate) return { reportDate, sessionDate };
    reportDate = addDays(reportDate, -1);
  }
  throw new Error(`找不到 ${beforeDate} 前 14 天內的有效晨報日。`);
}

function sessionForReportDate(reportDate: string, calendar: MarketCalendar) {
  const weekday = weekdayFor(reportDate);
  if (weekday === 0 || weekday === 6) return null;
  const candidateSessionDate = addDays(reportDate, weekday === 1 ? -3 : -1);
  if (calendar.fullCloseDates.includes(candidateSessionDate)) return null;
  return candidateSessionDate;
}

function weekdayFor(date: string) {
  return parseIsoDate(date).getUTCDay();
}

function addDays(date: string, days: number) {
  const value = parseIsoDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function parseIsoDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`無效的 ISO 日期：${date}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}
