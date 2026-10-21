// Shared snapshot and descriptions keep the review list aligned with /industry-etf.
import snapshot from '../../../src/data/etfTechnical.json';
import type { Candle } from './grid-trading';
import { describeMa, upgradeLegacyMaSegments } from '../../../src/utils/etfMaDescription';
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
    const maSegments = label === 'MA' && maEvent ? ('segments' in maEvent && maEvent.segments?.length ? maEvent.segments : upgradeLegacyMaSegments(maEvent.description, state)) : null;
    if (maSegments) {
      return `<div><span>MA</span><div class="ma-segments">${maSegments.map(segment => `<strong class="signal-${segment.signal}">${escapeHtml(segment.text)}</strong>`).join('')}</div></div>`;
    }
    return `<div><span>${label}</span><strong class="signal-${color}">${escapeHtml(description)}</strong></div>`;
  }).join('')}</div>${context ? `<small class="analysis-context">${escapeHtml(context)}</small>` : ''}`;
  const slug = latestInvestmentNote(code.trim())?.slug;
  const body = slug ? `<a class="analysis-link" href="${escapeHtml(notesBase + encodeURIComponent(slug) + '/')}" target="_blank" rel="noopener">${content}</a>` : content;
  return `<td class="analysis-cell" data-analysis="${period}" title="${escapeHtml(tip)}">${body}</td>`;
}
