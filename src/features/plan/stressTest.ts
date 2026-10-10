import { STRESS_SCENARIOS, type StressScenario } from "../../data/stressScenarios";
import { RISK_ASSETS, matchRiskAsset, type RiskAssetId, type RiskInputRow } from "./riskContribution";

/**
 * 历史情景压力测试：把当前配置“放回”过去的真实窗口，期初按权重买入、窗口内不再平衡。
 * 只使用真实序列；窗口起点之前没有数据的资产不做替代，单独列出并只计算有数据的部分。
 */

export interface StressContributor {
  name: string;
  assetId: RiskAssetId;
  /** 占已覆盖权重的比例 */
  weight: number;
  /** 该资产在窗口内的涨跌 */
  assetReturn: number;
  /** 对组合涨跌的贡献（权重 × 涨跌） */
  contribution: number;
}

export interface StressResult {
  scenario: StressScenario;
  /** 有历史数据的权重占输入权重的比例 0~1 */
  coverage: number;
  /** 有数据部分的组合窗口涨跌；没有任何可算资产时为 null */
  portfolioReturn: number | null;
  /** 有数据部分在窗口内从峰值到谷底的最大回撤（正数，周度采样，会略低估日内回撤） */
  maxDrawdown: number | null;
  contributors: StressContributor[];
  /** 该窗口没有数据的已识别资产名称 */
  noData: string[];
  /** 名称识别不了的资产名称 */
  unmatched: string[];
}

const labelOf = (id: RiskAssetId) => RISK_ASSETS.find((a) => a.id === id)!.label;

export function runStressScenario(
  rows: RiskInputRow[],
  scenario: StressScenario,
): StressResult {
  const live = rows.filter((r) => Number.isFinite(r.weight) && r.weight > 0);
  const total = live.reduce((s, r) => s + r.weight, 0);
  const unmatched: string[] = [];
  const noData: string[] = [];
  const covered: { name: string; assetId: RiskAssetId; weight: number; series: number[] }[] = [];

  for (const r of live) {
    const id = matchRiskAsset(r.name);
    if (id == null) {
      unmatched.push(r.name);
      continue;
    }
    const series = scenario.series[id];
    if (!series) {
      if (!noData.includes(labelOf(id))) noData.push(labelOf(id));
      continue;
    }
    covered.push({ name: r.name, assetId: id, weight: r.weight, series });
  }

  const coveredTotal = covered.reduce((s, c) => s + c.weight, 0);
  const base = {
    scenario,
    coverage: total > 0 ? coveredTotal / total : 0,
    noData,
    unmatched,
  };
  if (coveredTotal <= 0) {
    return { ...base, portfolioReturn: null, maxDrawdown: null, contributors: [] };
  }

  const w = covered.map((c) => c.weight / coveredTotal);
  const steps = scenario.dates.length;
  let peak = 0;
  let maxDrawdown = 0;
  let last = 1;
  for (let t = 0; t < steps; t++) {
    const value = covered.reduce((s, c, i) => s + w[i] * c.series[t], 0);
    peak = Math.max(peak, value);
    maxDrawdown = Math.max(maxDrawdown, peak > 0 ? 1 - value / peak : 0);
    last = value;
  }

  const contributors = covered
    .map((c, i) => {
      const assetReturn = c.series[steps - 1] - 1;
      return { name: c.name, assetId: c.assetId, weight: w[i], assetReturn, contribution: w[i] * assetReturn };
    })
    .sort((a, b) => a.contribution - b.contribution);

  return { ...base, portfolioReturn: last - 1, maxDrawdown, contributors };
}

export function runAllStressScenarios(rows: RiskInputRow[]): StressResult[] {
  return STRESS_SCENARIOS.map((s) => runStressScenario(rows, s));
}
