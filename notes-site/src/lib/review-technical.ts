import { aggregateBars, technicalState } from '../../../scripts/etf-technical.mjs';
import { describeDailyMaEvents } from '../../../src/utils/etfMaDescription';
import { describeDailyMacdEvents, type DailyMacdDescription, type PeriodUnit } from '../../../src/utils/etfDailyMacdDescription';
import { describeDailyRsiEvents, type RsiCrossDescription, type RsiUnit } from '../../../src/utils/etfDailyRsiDescription';
import type { Period } from '../../../src/utils/etfTechnicalDescription';

export const TECHNICAL_VERSION = 4;
export type ReviewPeriod = 'day' | 'week' | 'month';
export type ReviewCandle = { date: string; open: number; close: number; high: number; low: number };
type PeriodEvents = { ma: ReturnType<typeof describeDailyMaEvents>; macd: DailyMacdDescription; rsi: RsiCrossDescription };
export type ReviewRecord = { applicable: boolean; reason?: string; day?: Period; week?: Period; month?: Period; events?: Record<ReviewPeriod, PeriodEvents> };
export type TechnicalSnapshot = { version: number; record: ReviewRecord; updatedAt: number };

export function calculateReviewTechnical(candles: ReviewCandle[], complete = true): ReviewRecord | null {
  const valid = candles.filter(candle => /^\d{4}-\d{2}-\d{2}$/.test(candle.date) && [candle.open, candle.close, candle.high, candle.low].every(value => Number.isFinite(value) && value > 0)).sort((a, b) => a.date.localeCompare(b.date));
  if (!valid.length) return null;
  const bars = [...new Map(valid.map(candle => [candle.date, [candle.date, candle.open, candle.close, candle.high, candle.low, 0]])).values()];
  const asOf = valid[valid.length - 1].date;
  const date = new Date(`${asOf}T00:00:00Z`);
  const next = new Date(date); next.setUTCDate(next.getUTCDate() + 1);
  const weekly = aggregateBars(bars, 'week'), monthly = aggregateBars(bars, 'month');
  const day = technicalState(bars, complete), week = technicalState(weekly, complete && date.getUTCDay() === 5), month = technicalState(monthly, complete && next.toISOString().slice(0, 7) !== asOf.slice(0, 7));
  if (!day || !week || !month) return null;
  const describe = (series: typeof bars, unit: PeriodUnit): PeriodEvents => {
    const closes = series.map(bar => Number(bar[2]));
    return {
      ma: describeDailyMaEvents(series.map(bar => ({ date: String(bar[0]), close: Number(bar[2]) }))),
      macd: describeDailyMacdEvents(closes, unit),
      rsi: describeDailyRsiEvents(closes, unit),
    };
  };
  const events = { day: describe(bars, '日'), week: describe(weekly, '周'), month: describe(monthly, '月') };
  return { applicable: true, day, week, month, events };
}

/** 盘中每15分钟允许一次更新；收盘后、周末和开盘前复用最近收盘时段的结果。 */
export function technicalRefreshAfter(now = Date.now()): number {
  const date = new Date(now + 8 * 3600_000);
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  const weekday = date.getUTCDay();
  if (weekday === 0 || weekday === 6 || minutes < 570) {
    if (weekday !== 0 && weekday !== 6) date.setUTCDate(date.getUTCDate() - 1);
    while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() - 1);
    date.setUTCHours(15, 10, 0, 0);
  } else if (minutes >= 910) {
    date.setUTCHours(15, 10, 0, 0);
  } else if (minutes >= 690 && minutes < 780) {
    date.setUTCHours(11, 30, 0, 0);
  } else {
    date.setUTCMinutes(Math.floor(date.getUTCMinutes() / 15) * 15, 0, 0);
  }
  return date.getTime() - 8 * 3600_000;
}

/** 结构完整（三周期状态与 MA/MACD/RSI 事件齐全）。 */
function hasSnapshotShape(entry: TechnicalSnapshot | null): entry is TechnicalSnapshot {
  return !!entry && Number.isFinite(entry.updatedAt)
    && entry.record?.applicable === true && ['day', 'week', 'month'].every(period => {
      const key = period as ReviewPeriod;
      const state = entry.record[key], events = entry.record.events?.[key];
      return !!state && /^\d{4}-\d{2}-\d{2}$/.test(state.asOf) && Number.isFinite(state.close) && !!events?.ma && !!events.macd && !!events.rsi;
    });
}

/** 当前版本的快照：只有它才可能是「新鲜」的。 */
export function isTechnicalSnapshot(value: unknown): value is TechnicalSnapshot {
  const entry = value as TechnicalSnapshot | null;
  return !!entry && entry.version === TECHNICAL_VERSION && hasSnapshotShape(entry);
}

/**
 * 可用于显示的快照：当前或更早版本、结构完整即可。旧版本只是缺少新字段（渲染层有回退写法），
 * 数据本身仍是有效的行情结论；它不算新鲜（isTechnicalFresh 仍要求当前版本），所以会照常在后台刷新。
 * 升级版本号时据此保留旧数据显示，避免页面空白、也避免全部标的同时作废并集中请求上游。
 */
export function isUsableSnapshot(value: unknown): value is TechnicalSnapshot {
  const entry = value as TechnicalSnapshot | null;
  return !!entry && Number.isInteger(entry.version) && entry.version >= 1 && entry.version <= TECHNICAL_VERSION && hasSnapshotShape(entry);
}

export function isTechnicalFresh(entry: TechnicalSnapshot | null | undefined, now = Date.now()): boolean {
  return isTechnicalSnapshot(entry) && entry.updatedAt >= technicalRefreshAfter(now) && entry.updatedAt <= now + 60_000;
}
