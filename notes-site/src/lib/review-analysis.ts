// Shared snapshot and descriptions keep the review list aligned with /industry-etf.
import snapshot from '../../../src/data/etfTechnical.json';
import { aggregateBars, technicalState } from '../../../scripts/etf-technical.mjs';
import type { Candle } from './grid-trading';
import { describeMa, describeDailyMaEvents } from '../../../src/utils/etfMaDescription';
import { describeDailyMacdEvents, type DailyMacdDescription } from '../../../src/utils/etfDailyMacdDescription';
import { describeDailyRsiEvents, type RsiCrossDescription } from '../../../src/utils/etfDailyRsiDescription';
import { macdDescription, rsiDescription, tone, type Period } from '../../../src/utils/etfTechnicalDescription';
import { latestInvestmentNote } from '../../../src/utils/etfJudgment';

export const REVIEW_ANALYSIS_AS_OF = snapshot.asOf;
export type ReviewPeriod = 'day' | 'week' | 'month';
type PeriodEvents = { ma: ReturnType<typeof describeDailyMaEvents>; macd: DailyMacdDescription; rsi: RsiCrossDescription };
type ReviewRecord = { applicable: boolean; reason?: string; day?: Period; week?: Period; month?: Period; events?: Record<ReviewPeriod, PeriodEvents> };
const records = snapshot.records as Record<string, ReviewRecord>;
const calculated = new Map<string, ReviewRecord>();
export const needsReviewAnalysis = (code: string) => !records[code.trim()] && !calculated.has(code.trim());
export const canRefreshReviewAnalysis = (code: string) => records[code.trim()]?.applicable !== false;
export function setReviewCandles(code: string, candles: Candle[]): boolean {
  if (!canRefreshReviewAnalysis(code)) return false;
  const valid = candles.filter(candle => /^\d{4}-\d{2}-\d{2}$/.test(candle.date) && [candle.open, candle.close, candle.high, candle.low].every(value => Number.isFinite(value) && value > 0)).sort((a, b) => a.date.localeCompare(b.date));
  if (!valid.length) return false;
  const bars = [...new Map(valid.map(candle => [candle.date, [candle.date, candle.open, candle.close, candle.high, candle.low, 0]])).values()];
  const asOf = valid[valid.length - 1].date;
  const current = calculated.get(code.trim()) ?? records[code.trim()];
  if (current?.day && asOf < current.day.asOf) return false;
  const date = new Date(`${asOf}T00:00:00Z`);
  const next = new Date(date); next.setUTCDate(next.getUTCDate() + 1);
  const weekly = aggregateBars(bars, 'week'), monthly = aggregateBars(bars, 'month');
  const day = technicalState(bars), week = technicalState(weekly, date.getUTCDay() === 5), month = technicalState(monthly, next.toISOString().slice(0, 7) !== asOf.slice(0, 7));
  if (!day || !week || !month) return false;
  const describe = (series: typeof bars): PeriodEvents => {
    const closes = series.map(bar => Number(bar[2]));
    return {
      ma: describeDailyMaEvents(series.map(bar => ({ date: String(bar[0]), close: Number(bar[2]) }))),
      macd: describeDailyMacdEvents(closes),
      rsi: describeDailyRsiEvents(closes),
    };
  };
  const events = { day: describe(bars), week: describe(weekly), month: describe(monthly) };
  calculated.set(code.trim(), { applicable: true, day, week, month, events });
  return true;
}
const labels = { day: '日线', week: '周线', month: '月线' };
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));

export function renderReviewAnalysis(code: string, period: ReviewPeriod, notesBase: string, compactSignals = false): string {
  const record = calculated.get(code.trim()) ?? records[code.trim()];
  const state = record?.[period];
  if (!record || !record.applicable || !state) {
    const reason = record?.reason ?? '暂无该标的的多周期指标';
    return `<td class="analysis-cell muted" data-analysis="${period}" title="${escapeHtml(reason)}">${record && !record.applicable ? '不适用' : '—'}</td>`;
  }
  const context = [!state.complete && '未收盘暂态', state.limitedMacdHistory && 'MACD样本较短'].filter(Boolean).join(' · ');
  const tip = `${labels[period]} · 数据基准 ${state.asOf} · ${state.count}期${context ? ' · ' + context : ' · 已收盘'}`;
  const rsiTone = tone(state.rsi !== null && state.rsi >= 45 && state.rsi <= 55 ? '中性' : state.rsiState);
  const maEvent = compactSignals ? record.events?.[period]?.ma ?? { description: '均线状态待行情更新', signal: 'neutral' } : null;
  const macdEvent = compactSignals ? record.events?.[period]?.macd ?? { cross: '交叉状态待行情更新', crossSignal: 'neutral', axis: '', axisSignal: 'neutral', bars: '', barsSignal: 'neutral' } : null;
  const rsiEvent = compactSignals ? record.events?.[period]?.rsi ?? { description: '交叉状态待行情更新', signal: 'neutral' } : null;
  const lines = [
    ['MA', maEvent?.description ?? describeMa(state), maEvent?.signal ?? tone(state.ma)],
    ['MACD', macdDescription(state), tone(state.macd)],
    ['RSI', rsiDescription(state), rsiTone],
  ];
  const content = `<div class="analysis-lines">${lines.map(([label, description, color]) => {
    if (label === 'RSI' && rsiEvent) {
      return `<div><span>RSI</span><div><strong class="signal-${rsiEvent.signal}">${escapeHtml(rsiEvent.description)}</strong>、<strong class="signal-${rsiTone}">${escapeHtml(rsiDescription(state).replace(/^\d+(?:\.\d+)?\s+/, ''))}</strong></div></div>`;
    }
    if (label === 'MACD' && macdEvent) {
      return `<div><span>MACD</span><div class="macd-segments"><strong class="signal-${macdEvent.crossSignal}">${escapeHtml(macdEvent.cross)}</strong>${macdEvent.axis ? `、<strong class="signal-${macdEvent.axisSignal}">${escapeHtml(macdEvent.axis)}</strong>` : ''}${macdEvent.bars ? `、<strong class="signal-${macdEvent.barsSignal}">${escapeHtml(macdEvent.bars)}</strong>` : ''}</div></div>`;
    }
    return `<div><span>${label}</span><strong class="signal-${color}">${escapeHtml(description)}</strong></div>`;
  }).join('')}</div>${context ? `<small class="analysis-context">${escapeHtml(context)}</small>` : ''}`;
  const slug = latestInvestmentNote(code.trim())?.slug;
  const body = slug ? `<a class="analysis-link" href="${escapeHtml(notesBase + encodeURIComponent(slug) + '/')}" target="_blank" rel="noopener">${content}</a>` : content;
  return `<td class="analysis-cell" data-analysis="${period}" title="${escapeHtml(tip)}">${body}</td>`;
}
