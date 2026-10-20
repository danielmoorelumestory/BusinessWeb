import bondMetricsRaw from '../../../src/data/bondFundMetrics.json';
import {
  BOND_CATALOG_GROUP_ID,
  MONEY_CATALOG_GROUP_ID,
  fundProfileUrl,
  referenceOnlyGroups,
  type CatalogItem,
} from './etf-catalog-seed';
import { extractEtfJudgment, latestInvestmentNote } from '../../../src/utils/etfJudgment';

export type BondFundMetric = {
  asOf: string;
  bondType?: string;
  bondFeature?: string;
  inceptionDate?: string;
  returnSinceInceptionPct?: number | null;
  return1yPct?: number | null;
  return1yPeriodLabel?: string;
  return1yStart?: string;
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

type Escape = (value: unknown) => string;

function analysisHref(code: string, notesBase: string): string | null {
  const note = latestInvestmentNote(code);
  return note ? `${notesBase}${encodeURIComponent(note.slug)}/` : null;
}

function remarkCell(code: string, attr: Escape): string {
  return `<td class="etf-remark-cell" data-remark-code="${attr(code)}"><span class="etf-empty-cell">—</span></td>`;
}

function referenceCell(code: string, sourceUrl: string | undefined, notesBase: string, showGrid: boolean, gridApplicable: boolean | undefined, name: string, escapeHtml: Escape, attr: Escape): string {
  const href = analysisHref(code, notesBase);
  const profile = sourceUrl || fundProfileUrl(code);
  return `<td class="etf-reference-cell">
    ${href ? `<div><a class="etf-ref-link" href="${attr(href)}" target="_blank" rel="noopener">分析报告</a></div>` : ''}
    <a class="etf-ref-link" href="${attr(profile)}" target="_blank" rel="noopener">基金档案</a>
    ${showGrid ? `<div>${gridApplicable === false ? '<span class="etf-empty-cell">不适用</span>' : `<a class="etf-ref-link" href="/note/lab/grid-trading/detail/?code=${attr(code)}&name=${attr(encodeURIComponent(name))}">行情网格</a>`}</div>` : ''}
  </td>`;
}

function moneyRowHtml(item: CatalogItem, notesBase: string, escapeHtml: Escape, attr: Escape): string {
  return `<tr>
    <td class="etf-identity-cell"><div class="etf-name-line">${escapeHtml(item.name)}</div><div class="etf-code-line">${escapeHtml(item.code)}</div></td>
    <td class="etf-subtheme-cell"><strong>${escapeHtml(item.family ?? '')}</strong><div>${escapeHtml(item.category ?? '')}</div><p>${escapeHtml(item.coverage ?? '')}</p></td>
    ${remarkCell(item.code, attr)}
    ${referenceCell(item.code, item.sourceUrl, notesBase, true, item.gridApplicable, item.name, escapeHtml, attr)}
  </tr>`;
}

function pct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function metricCell(valueHtml: string): string {
  return `<td class="bond-fund-metric">${valueHtml}</td>`;
}

function bondRowHtml(item: CatalogItem, notesBase: string, escapeHtml: Escape, attr: Escape): string {
  const data = metrics[item.code];
  const return3yVal = data?.returnPct ?? data?.return3yPct;
  const inceptionVal = data?.returnSinceInceptionPct ?? data?.returnPct;
  const typeClass = data?.bondType === '普通纯债' || data?.bondType === '纯债' ? 'pure' : 'enhanced';
  const oneYear = data?.return1yPct != null
    ? `${escapeHtml(pct(data.return1yPct))}${data.return1yPeriodLabel ? `<small title="${attr(`${data.return1yStart ?? ''}至${data.asOf}`)}">${escapeHtml(data.return1yPeriodLabel)}</small>` : ''}`
    : `<span class="etf-empty-cell">—</span>${data?.return1yPeriodLabel ? `<small>${escapeHtml(data.return1yPeriodLabel)}</small>` : ''}`;
  return `<tr>
    <td class="etf-identity-cell">
      <div class="etf-name-line">${escapeHtml(item.name)}</div>
      <div class="etf-code-line">${escapeHtml(item.code)}</div>
      ${data?.bondType ? `<div class="bond-type-tags"><span class="bond-type-badge bond-type-badge--${typeClass}">${escapeHtml(data.bondType)}</span>${data.bondFeature ? `<span class="bond-feature-badge">${escapeHtml(data.bondFeature)}</span>` : ''}</div>` : ''}
    </td>
    ${metricCell(oneYear)}
    ${metricCell(return3yVal != null ? `${escapeHtml(pct(return3yVal))}${data?.returnPeriodLabel ? `<small title="${attr(`${data.returnStart ?? ''}至${data.asOf}`)}">${escapeHtml(data.returnPeriodLabel)}</small>` : ''}` : '<span class="etf-empty-cell">—</span>')}
    ${metricCell(
      data?.return5yPct != null
        ? `${escapeHtml(pct(data.return5yPct))}${data.return5yPeriodLabel ? `<small>${escapeHtml(data.return5yPeriodLabel)}</small>` : ''}`
        : inceptionVal != null && data?.inceptionDate
          ? `${escapeHtml(pct(inceptionVal))}<small title="${attr(`${data.inceptionDate}成立`)}">${escapeHtml(data.inceptionDate)}</small>`
          : `<span class="etf-empty-cell">—</span>${data?.return5yPeriodLabel ? `<small>${escapeHtml(data.return5yPeriodLabel)}</small>` : ''}`,
    )}
    ${metricCell(`${data?.maxDrawdownPct != null ? escapeHtml(`${data.maxDrawdownPct.toFixed(2)}%`) : '—'}${data?.drawdownPeriodLabel ? `<small title="${attr(`${data.drawdownStart ?? ''}至${data.drawdownEnd ?? data.asOf}`)}">${escapeHtml(data.drawdownPeriodLabel)}</small>` : ''}`)}
    <td class="etf-fee-cell">${data ? `<div class="etf-fee-main"><span class="etf-fee-total">${escapeHtml(data.annualFeePct.toFixed(2))}%<small>/年</small></span><span class="etf-fee-breakdown">管${escapeHtml(data.managementFeePct.toFixed(2))}+托${escapeHtml(data.custodyFeePct.toFixed(2))}</span></div>${data.redemptionTiers || data.redemptionRule ? `<div class="etf-fee-tiers" title="${attr(`赎回费率阶梯：${data.redemptionTiers ?? data.redemptionRule}`)}"><span class="etf-fee-tiers-label">赎回费：</span>${escapeHtml(data.redemptionTiers ?? data.redemptionRule)}</div>` : ''}` : '<span class="etf-empty-cell">—</span>'}</td>
    ${referenceCell(item.code, item.sourceUrl, notesBase, false, undefined, item.name, escapeHtml, attr)}
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

function sortBondItems(items: CatalogItem[]): CatalogItem[] {
  return [...items].sort((a, b) => {
    const typeA = metrics[a.code]?.bondType ?? '';
    const typeB = metrics[b.code]?.bondType ?? '';
    const rankA = BOND_TYPE_ORDER[typeA] ?? 99;
    const rankB = BOND_TYPE_ORDER[typeB] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    const ddA = Math.abs(metrics[a.code]?.maxDrawdownPct ?? 0);
    const ddB = Math.abs(metrics[b.code]?.maxDrawdownPct ?? 0);
    return ddA - ddB || a.code.localeCompare(b.code);
  });
}

function moneySectionHtml(notesBase: string, escapeHtml: Escape, attr: Escape): string {
  const group = referenceOnlyGroups().find(item => item.id === MONEY_CATALOG_GROUP_ID);
  if (!group) return '';
  return `
    <section class="catalog-reference-section" id="money-etf" aria-label="${attr(group.name)}">
      <div class="catalog-reference-card">
        <div class="catalog-reference-header">
          <h2 class="catalog-reference-title">${escapeHtml(group.name)}</h2>
          <span class="catalog-reference-count">${group.items.length} 只</span>
        </div>
        ${group.description ? `<p class="catalog-reference-description">${escapeHtml(group.description)}</p>` : ''}
        <div class="catalog-reference-table-wrap">
          <table class="catalog-reference-table catalog-money-table">
            <colgroup>
              <col style="width:180px" />
              <col style="width:200px" />
              <col />
              <col style="width:120px" />
            </colgroup>
            <thead><tr><th>名称 / 代码</th><th>标的与定位</th><th>备注</th><th class="etf-reference-heading">参考 / 网格</th></tr></thead>
            <tbody>${group.items.map(item => moneyRowHtml(item, notesBase, escapeHtml, attr)).join('')}</tbody>
          </table>
        </div>
      </div>
    </section>`;
}

function bondSectionHtml(notesBase: string, escapeHtml: Escape, attr: Escape): string {
  const group = referenceOnlyGroups().find(item => item.id === BOND_CATALOG_GROUP_ID);
  if (!group) return '';
  const items = sortBondItems(group.items);
  const compareHref = `${notesBase}bond-fund-candidate-comparison-2026-10-14/`;
  return `
    <section class="catalog-reference-section" id="bond-funds" aria-label="${attr(group.name)}">
      <div class="catalog-reference-card">
        <div class="catalog-reference-header">
          <h2 class="catalog-reference-title">${escapeHtml(group.name)}</h2>
          <span class="catalog-reference-count">${items.length} 只</span>
        </div>
        ${ladderHtml()}
        <p class="catalog-reference-description">
          普通纯债2只、一级债基2只、二级债基3只；010011每笔份额最短持有6个月。
          <a class="etf-ref-link" href="${attr(compareHref)}" target="_blank" rel="noopener">查看同类筛选报告</a>
        </p>
        <div class="catalog-reference-table-wrap">
          <table class="catalog-reference-table catalog-bond-table">
            <colgroup>
              <col style="width:220px" />
              <col style="width:120px" /><col style="width:120px" /><col style="width:120px" />
              <col style="width:140px" />
              <col style="width:280px" /><col style="width:100px" />
            </colgroup>
            <thead><tr><th>名称 / 代码</th><th>近一年收益</th><th>三年收益</th><th>五年收益</th><th title="分类内按历史回撤绝对值从小到大排序">历史最大回撤</th><th title="运作管理与托管费及持有期赎回费阶梯">费用</th><th>参考</th></tr></thead>
            <tbody>${items.map(item => bondRowHtml(item, notesBase, escapeHtml, attr)).join('')}</tbody>
          </table>
        </div>
      </div>
    </section>`;
}

/** 货币 + 债基：industry-etf 原样只读区，不参与复盘分组 */
export function referenceSectionsHtml(notesBase: string, escapeHtml: Escape, attr: Escape): string {
  return `<div class="catalog-reference-sections">${moneySectionHtml(notesBase, escapeHtml, attr)}${bondSectionHtml(notesBase, escapeHtml, attr)}</div>`;
}

export function formatRemarkHtml(remark: string, escapeHtml: Escape): string {
  const end = remark.indexOf('。');
  const summary = end < 0 ? remark : remark.slice(0, end);
  const rest = end < 0 ? '' : remark.slice(end);
  const parts = summary.split(/(上升趋势|下降趋势|震荡偏强|震荡偏弱)/);
  const colored = parts.map(part => {
    const direction = part === '上升趋势' ? 'up'
      : part === '下降趋势' ? 'down'
        : part.startsWith('震荡') ? 'sideways' : null;
    return direction
      ? `<span class="etf-trend etf-trend--${direction}">${escapeHtml(part)}</span>`
      : escapeHtml(part);
  }).join('');
  return `${colored}${escapeHtml(rest)}`;
}

export async function fillCatalogRemarks(root: ParentNode, notesBase: string, escapeHtml: Escape): Promise<void> {
  const cells = [...root.querySelectorAll<HTMLElement>('[data-remark-code]')];
  await Promise.all(cells.map(async cell => {
    const code = cell.dataset.remarkCode;
    if (!code) return;
    const note = latestInvestmentNote(code);
    if (!note) {
      cell.innerHTML = '<span class="etf-empty-cell">—</span>';
      return;
    }
    try {
      const response = await fetch(`${notesBase}${encodeURIComponent(note.slug)}.md`, { cache: 'no-cache' });
      if (!response.ok) throw new Error('unavailable');
      const markdown = await response.text();
      const remark = extractEtfJudgment(markdown, note.date);
      cell.innerHTML = remark ? formatRemarkHtml(remark, escapeHtml) : '<span class="etf-empty-cell">—</span>';
    } catch {
      cell.innerHTML = '<span class="etf-empty-cell">—</span>';
    }
  }));
}
