import bondMetricsRaw from '../../../src/data/bondFundMetrics.json';
import {
  BOND_CATALOG_GROUP_ID,
  MONEY_CATALOG_GROUP_ID,
  catalogGroupDef,
  catalogItemOf,
  fundProfileUrl,
  isIsolatedCatalogGroupId,
  type CatalogItem,
} from './etf-catalog-seed';
import { latestInvestmentNote } from '../../../src/utils/etfJudgment';

export type BondFundMetric = {
  asOf: string;
  bondType?: string;
  bondFeature?: string;
  inceptionDate?: string;
  returnSinceInceptionPct?: number | null;
  return3yPct: number | null;
  returnPct?: number;
  returnStart?: string;
  returnPeriodLabel?: string;
  return5yPct?: number | null;
  return5yPeriodLabel?: string;
  maxDrawdownPct: number;
  drawdownStart?: string;
  drawdownEnd?: string;
  drawdownPeriodLabel?: string;
  managementFeePct: number;
  custodyFeePct: number;
  annualFeePct: number;
  redemptionRule: string;
  redemptionTiers?: string;
};

const metrics = bondMetricsRaw as Record<string, BondFundMetric>;

const BOND_TYPE_ORDER: Record<string, number> = {
  纯债: 1,
  普通纯债: 1,
  一级债基: 2,
  二级债基: 3,
  混合偏债: 4,
};

export const BOND_RISK_LADDER = [
  { type: '纯债', levelClass: 'pure', scope: '不投股票', feature: '只买债券', drawdown: '回撤约 -1%~-2%' },
  { type: '一级债基', levelClass: 'tier1', scope: '不直接买股票', feature: '可投可转债', drawdown: '回撤约 -2%~-3%' },
  { type: '二级债基', levelClass: 'tier2', scope: '可主动买股票', feature: '股票 ≤20%', drawdown: '回撤约 -5%~-10%' },
  { type: '混合偏债', levelClass: 'hybrid', scope: '股票比例更高', feature: '债券+股票均衡', drawdown: '回撤可 >10%' },
] as const;

export { isIsolatedCatalogGroupId, MONEY_CATALOG_GROUP_ID, BOND_CATALOG_GROUP_ID };

export function bondMetricOf(code: string): BondFundMetric | undefined {
  return metrics[code.trim()];
}

export function sortBondCodes(codes: string[]): string[] {
  return [...codes].sort((a, b) => {
    const typeA = metrics[a]?.bondType ?? '';
    const typeB = metrics[b]?.bondType ?? '';
    const rankA = BOND_TYPE_ORDER[typeA] ?? 99;
    const rankB = BOND_TYPE_ORDER[typeB] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    const ddA = Math.abs(metrics[a]?.maxDrawdownPct ?? 0);
    const ddB = Math.abs(metrics[b]?.maxDrawdownPct ?? 0);
    return ddA - ddB || a.localeCompare(b);
  });
}

type Escape = (value: unknown) => string;

function analysisHref(code: string, notesBase: string): string | null {
  const note = latestInvestmentNote(code);
  return note ? `${notesBase}${encodeURIComponent(note.slug)}/` : null;
}

function moneyRowHtml(code: string, item: CatalogItem | undefined, name: string, notesBase: string, escapeHtml: Escape, attr: Escape): string {
  const family = item?.family ?? '';
  const category = item?.category ?? '';
  const coverage = item?.coverage ?? '';
  const href = analysisHref(code, notesBase);
  return `<tr data-code="${attr(code)}">
    <td class="identity-cell"><div class="stock-name">${escapeHtml(name)}</div><div class="code-cell">${escapeHtml(code)}</div></td>
    <td class="catalog-position-cell"><strong>${escapeHtml(family)}</strong><div>${escapeHtml(category)}</div><p>${escapeHtml(coverage)}</p></td>
    <td class="action-cell"><div class="row-actions">
      <button data-action="groups" type="button">编辑分组</button>
      ${href ? `<a href="${attr(href)}" target="_blank" rel="noopener">分析报告</a>` : ''}
      <a href="${attr(fundProfileUrl(code))}" target="_blank" rel="noopener">基金档案</a>
      <span class="muted">网格不适用</span>
      <button class="danger" data-action="remove" type="button">移出标的</button>
    </div></td>
  </tr>`;
}

function pct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function bondRowHtml(code: string, name: string, notesBase: string, escapeHtml: Escape, attr: Escape): string {
  const data = metrics[code];
  const href = analysisHref(code, notesBase);
  const return3yVal = data?.returnPct ?? data?.return3yPct;
  const inceptionVal = data?.returnSinceInceptionPct ?? data?.returnPct;
  const typeClass = data?.bondType === '普通纯债' || data?.bondType === '纯债' ? 'pure' : 'enhanced';
  return `<tr data-code="${attr(code)}">
    <td class="identity-cell">
      <div class="stock-name">${escapeHtml(name)}</div>
      <div class="code-cell">${escapeHtml(code)}</div>
      ${data?.bondType ? `<div class="bond-type-tags"><span class="bond-type-badge bond-type-badge--${typeClass}">${escapeHtml(data.bondType)}</span>${data.bondFeature ? `<span class="bond-feature-badge">${escapeHtml(data.bondFeature)}</span>` : ''}</div>` : ''}
    </td>
    <td class="bond-fund-metric">${return3yVal != null ? `${escapeHtml(pct(return3yVal))}${data?.returnPeriodLabel ? `<small>${escapeHtml(data.returnPeriodLabel)}</small>` : ''}` : '<span class="muted">—</span>'}</td>
    <td class="bond-fund-metric">${
      data?.return5yPct != null
        ? `${escapeHtml(pct(data.return5yPct))}${data.return5yPeriodLabel ? `<small>${escapeHtml(data.return5yPeriodLabel)}</small>` : ''}`
        : inceptionVal != null && data?.inceptionDate
          ? `${escapeHtml(pct(inceptionVal))}<small>${escapeHtml(data.inceptionDate)}</small>`
          : `<span class="muted">—</span>${data?.return5yPeriodLabel ? `<small>${escapeHtml(data.return5yPeriodLabel)}</small>` : ''}`
    }</td>
    <td class="bond-fund-metric">${data?.maxDrawdownPct != null ? escapeHtml(`${data.maxDrawdownPct.toFixed(2)}%`) : '—'}${data?.drawdownPeriodLabel ? `<small>${escapeHtml(data.drawdownPeriodLabel)}</small>` : ''}</td>
    <td class="etf-fee-cell">${data ? `<div class="etf-fee-main"><span class="etf-fee-total">${escapeHtml(data.annualFeePct.toFixed(2))}%<small>/年</small></span><span class="etf-fee-breakdown">管${escapeHtml(data.managementFeePct.toFixed(2))}+托${escapeHtml(data.custodyFeePct.toFixed(2))}</span></div>${data.redemptionTiers || data.redemptionRule ? `<div class="etf-fee-tiers"><span class="etf-fee-tiers-label">赎回费：</span>${escapeHtml(data.redemptionTiers ?? data.redemptionRule)}</div>` : ''}` : '<span class="muted">—</span>'}</td>
    <td class="action-cell"><div class="row-actions">
      <button data-action="groups" type="button">编辑分组</button>
      ${href ? `<a href="${attr(href)}" target="_blank" rel="noopener">分析报告</a>` : ''}
      <a href="${attr(fundProfileUrl(code))}" target="_blank" rel="noopener">基金档案</a>
      <span class="muted">网格不适用</span>
      <button class="danger" data-action="remove" type="button">移出标的</button>
    </div></td>
  </tr>`;
}

function ladderHtml(): string {
  return `<div class="bond-ladder-container">
    <div class="bond-ladder-header">
      <span class="bond-ladder-title">风险 / 收益 由低到高</span>
      <span class="bond-ladder-arrow" aria-hidden="true">低波稳健 ──▶ 股债弹性</span>
    </div>
    <div class="bond-ladder-grid">
      ${BOND_RISK_LADDER.map(item => `
        <div class="bond-ladder-card bond-ladder-card--${item.levelClass}">
          <div class="bond-ladder-type-row">
            <span class="bond-ladder-type-badge bond-ladder-type-badge--${item.levelClass}">${item.type}</span>
            <span class="bond-ladder-drawdown">${item.drawdown}</span>
          </div>
          <div class="bond-ladder-body">
            <div class="bond-ladder-text">${item.scope}</div>
            <div class="bond-ladder-text-sub">${item.feature}</div>
          </div>
        </div>`).join('')}
    </div>
  </div>`;
}

export function isolatedSectionHtml(options: {
  groupId: string;
  title: string;
  codes: string[];
  nameOf: (code: string) => string;
  notesBase: string;
  escapeHtml: Escape;
  attr: Escape;
}): string {
  const { groupId, title, codes, nameOf, notesBase, escapeHtml, attr } = options;
  if (!codes.length || !isIsolatedCatalogGroupId(groupId)) return '';
  const def = catalogGroupDef(groupId);
  const description = def?.description ?? '';

  if (groupId === MONEY_CATALOG_GROUP_ID) {
    return `
      <section class="group-section catalog-special-section catalog-special-section--money" aria-label="${attr(title)}" data-group-id="${attr(groupId)}">
        <div class="group-card catalog-special-card">
          <div class="group-card-header">
            <h2 class="group-heading">${escapeHtml(title)}</h2>
            <span class="group-count">${codes.length} 只</span>
          </div>
          ${description ? `<p class="catalog-special-description">${escapeHtml(description)}</p>` : ''}
          <div class="table-shell">
            <table class="catalog-special-table catalog-money-table">
              <thead><tr><th>名称 / 代码</th><th>标的与定位</th><th>参考</th></tr></thead>
              <tbody>${codes.map(code => moneyRowHtml(code, catalogItemOf(code), nameOf(code), notesBase, escapeHtml, attr)).join('')}</tbody>
            </table>
          </div>
        </div>
      </section>`;
  }

  const ordered = sortBondCodes(codes);
  return `
    <section class="group-section catalog-special-section catalog-special-section--bond" aria-label="${attr(title)}" data-group-id="${attr(groupId)}">
      <div class="group-card catalog-special-card">
        <div class="group-card-header">
          <h2 class="group-heading">${escapeHtml(title)}</h2>
          <span class="group-count">${ordered.length} 只</span>
        </div>
        ${ladderHtml()}
        ${description ? `<p class="catalog-special-description">${escapeHtml(description)}</p>` : ''}
        <div class="table-shell">
          <table class="catalog-special-table catalog-bond-table">
            <thead><tr><th>名称 / 代码</th><th>三年收益</th><th>五年收益</th><th>历史最大回撤</th><th>费用</th><th>参考</th></tr></thead>
            <tbody>${ordered.map(code => bondRowHtml(code, nameOf(code), notesBase, escapeHtml, attr)).join('')}</tbody>
          </table>
        </div>
      </div>
    </section>`;
}
