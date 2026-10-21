// Shared snapshot and descriptions keep the review list aligned with /industry-etf.
import snapshot from '../../../src/data/etfTechnical.json';
import type { Candle } from './grid-trading';
import { arrangementWithMa20, describeMa, upgradeLegacyMaSegments } from '../../../src/utils/etfMaDescription';
import { macdBar, macdOrder } from '../../../src/utils/etfDailyMacdDescription';
import { macdDescription, rsiDescription, tone } from '../../../src/utils/etfTechnicalDescription';
import { latestInvestmentNote } from '../../../src/utils/etfJudgment';

export const REVIEW_ANALYSIS_AS_OF = snapshot.asOf;
export type { ReviewPeriod } from './review-technical';
import { calculateReviewTechnical, type ReviewRecord, type ReviewPeriod } from './review-technical';
const records = snapshot.records as Record<string, ReviewRecord>;
const calculated = new Map<string, ReviewRecord>();
export const needsReviewAnalysis = (code: string) => !records[code.trim()] && !calculated.has(code.trim());
export const canRefreshReviewAnalysis = (code: string) => records[code.trim()]?.applicable !== false;
export function setReviewRecord(code: string, record: ReviewRecord): boolean {
  if (!canRefreshReviewAnalysis(code) || !record.day || !record.week || !record.month) return false;
  const current = calculated.get(code.trim()) ?? records[code.trim()];
  if (current?.day && record.day.asOf < current.day.asOf) return false;
  calculated.set(code.trim(), record);
  return true;
}
export function setReviewCandles(code: string, candles: Candle[], complete = true): boolean {
  const record = calculateReviewTechnical(candles, complete);
  return !!record && setReviewRecord(code, record);
}
/** 最新价是否在指定周期的均线之上；缺数据返回 false。 */
export function isPriceAboveMa(code: string, period: ReviewPeriod, ma: 5 | 10 | 20): boolean {
  const state = (calculated.get(code.trim()) ?? records[code.trim()])?.[period];
  const line = ma === 5 ? state?.ma5 : ma === 10 ? state?.ma10 : state?.ma20;
  return !!state && line != null && Number.isFinite(line) && state.close > line;
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
      // 新快照有分段：RSI6/RSI24/50 顺序、RSI6 箭头、交叉距今（极端时加超买/超卖）；旧快照没有 RSI6/24 数值，沿用旧文案。
      if (rsiEvent.segments?.length) return `<div><span>RSI</span><div class="rsi-segments">${rsiEvent.segments.map(segment => `<strong class="signal-${segment.signal}">${escapeHtml(segment.text)}</strong>`).join('')}</div></div>`;
      return `<div><span>RSI</span><div><strong class="signal-${rsiEvent.signal}">${escapeHtml(rsiEvent.description)}</strong>、<strong class="signal-${rsiTone}">${escapeHtml(rsiDescription(state).replace(/^\d+(?:\.\d+)?\s+/, ''))}</strong></div></div>`;
    }
    if (label === 'MACD' && macdEvent) {
      // 旧快照没有分段：顺序与柱体由快照里的 DIF/DEA/柱值重算，交叉天数旧快照里没有，沿用旧的交叉文案。
      const legacy = state.dif !== null && state.dea !== null ? [macdOrder(state.dif, state.dea), macdBar(2 * (state.dif - state.dea), state.previousHistogram), { text: macdEvent.cross, signal: macdEvent.crossSignal }] : null;
      const segments = macdEvent.segments?.length ? macdEvent.segments : legacy;
      if (segments) return `<div><span>MACD</span><div class="macd-segments">${segments.map(segment => `<strong class="signal-${segment.signal}">${escapeHtml(segment.text)}</strong>`).join('')}</div></div>`;
      return `<div><span>MACD</span><div class="macd-segments"><strong class="signal-${macdEvent.crossSignal}">${escapeHtml(macdEvent.cross)}</strong></div></div>`;
    }
    let maSegments = label === 'MA' && maEvent ? ('segments' in maEvent && maEvent.segments?.length ? maEvent.segments : upgradeLegacyMaSegments(maEvent.description, state)) : null;
    // 周线的顺序段加入 MA20；MA20 来自快照里的周线状态，不依赖快照版本。
    if (maSegments && period === 'week' && state.ma5 != null && state.ma10 != null && state.ma20 != null) maSegments = [arrangementWithMa20(state.close, state.ma5, state.ma10, state.ma20), ...maSegments.slice(1)];
    if (maSegments) {
      return `<div><span>MA</span><div class="ma-segments">${maSegments.map(segment => `<strong class="signal-${segment.signal}">${escapeHtml(segment.text)}</strong>`).join('')}</div></div>`;
    }
    return `<div><span>${label}</span><strong class="signal-${color}">${escapeHtml(description)}</strong></div>`;
  }).join('')}</div>${context ? `<small class="analysis-context">${escapeHtml(context)}</small>` : ''}`;
  const slug = latestInvestmentNote(code.trim())?.slug;
  const body = slug ? `<a class="analysis-link" href="${escapeHtml(notesBase + encodeURIComponent(slug) + '/')}" target="_blank" rel="noopener">${content}</a>` : content;
  return `<td class="analysis-cell" data-analysis="${period}" title="${escapeHtml(tip)}">${body}</td>`;
}
