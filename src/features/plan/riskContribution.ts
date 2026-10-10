/**
 * 风险贡献：权重说的是钱放在哪，风险贡献说的是波动来自哪。
 *   RC_i = w_i · (Σw)_i / (wᵀΣw)，各项相加为 100%。
 * 波动率与相关系数取自书第9章 9.7 同一段数据（2020-07-27 至 2026-09-30，74 个月度收益，
 * 红利与标普500为全收益、恒生科技为价格指数、均未计汇率），脚本见
 * book-慢即是快/附件-数据/第十五轮-全收益/tr_risk_contrib.py。
 * 这是历史口径的结构说明，不是对未来波动的预测。
 */

export type RiskAssetId = "dividend" | "bond" | "sp500" | "gold" | "hstech" | "csi300";

export const RISK_SAMPLE = "2020-07 ~ 2026-09，月度收益 74 个";

interface RiskAsset {
  id: RiskAssetId;
  label: string;
  /** 年化波动，小数 */
  vol: number;
  /** 名称里包含任一关键词即视为该资产（越靠前越优先） */
  keywords: string[];
}

export const RISK_ASSETS: RiskAsset[] = [
  { id: "hstech", label: "恒生科技", vol: 0.337877, keywords: ["恒生科技", "恒科", "恒生"] },
  { id: "sp500", label: "标普500", vol: 0.1535, keywords: ["标普", "S&P", "SPX"] },
  { id: "gold", label: "黄金", vol: 0.1582, keywords: ["黄金", "金ETF"] },
  { id: "dividend", label: "红利", vol: 0.1572, keywords: ["红利"] },
  { id: "bond", label: "债券", vol: 0.0104, keywords: ["债", "国债", "货币"] },
  { id: "csi300", label: "A股宽基", vol: 0.174645, keywords: ["宽基", "沪深300", "中证800", "中证500", "A股"] },
];

// 顺序同 RISK_ASSETS 之外的固定矩阵顺序：dividend, bond, sp500, gold, hstech, csi300
const ORDER: RiskAssetId[] = ["dividend", "bond", "sp500", "gold", "hstech", "csi300"];
const CORR: number[][] = [
  [1.0, -0.0231, 0.2202, 0.0679, 0.4365, 0.4924],
  [-0.0231, 1.0, -0.0123, -0.0316, -0.2473, -0.2509],
  [0.2202, -0.0123, 1.0, -0.0001, 0.2067, 0.2217],
  [0.0679, -0.0316, -0.0001, 1.0, 0.201, 0.1084],
  [0.4365, -0.2473, 0.2067, 0.201, 1.0, 0.7472],
  [0.4924, -0.2509, 0.2217, 0.1084, 0.7472, 1.0],
];

export function matchRiskAsset(name: string): RiskAssetId | null {
  const text = name.trim();
  if (!text) return null;
  for (const asset of RISK_ASSETS) {
    if (asset.keywords.some((k) => text.includes(k))) return asset.id;
  }
  return null;
}

export interface RiskInputRow {
  name: string;
  /** 权重（任意正数，内部归一化；金额或目标占比均可） */
  weight: number;
}

export interface RiskItem {
  name: string;
  assetId: RiskAssetId | null;
  /** 在已识别资产中的占比 0~1；未识别时为 null */
  weight: number | null;
  /** 风险贡献 0~1；未识别时为 null */
  contribution: number | null;
  /** 风险贡献 ÷ 权重：>1 说明风险占比大于钱的占比 */
  multiple: number | null;
}

export interface RiskResult {
  items: RiskItem[];
  /** 已识别资产的组合年化波动，小数；无可算资产时为 null */
  portfolioVol: number | null;
  /** 已识别资产占输入权重的比例 0~1 */
  coverage: number;
  unmatched: string[];
}

const index = (id: RiskAssetId) => ORDER.indexOf(id);
const volOf = (id: RiskAssetId) => RISK_ASSETS.find((a) => a.id === id)!.vol;

/**
 * 同一类资产出现多行（如两只红利）时按同一资产处理：协方差里相关系数为 1。
 * 权重非正数的行视为未持有，不参与计算。
 */
export function calculateRiskContribution(rows: RiskInputRow[]): RiskResult {
  const valid = rows.filter((r) => Number.isFinite(r.weight) && r.weight > 0);
  const matched = valid
    .map((r) => ({ ...r, assetId: matchRiskAsset(r.name) }))
    .filter((r): r is typeof r & { assetId: RiskAssetId } => r.assetId != null);
  const unmatched = valid.filter((r) => matchRiskAsset(r.name) == null).map((r) => r.name);
  const totalAll = valid.reduce((s, r) => s + r.weight, 0);
  const totalMatched = matched.reduce((s, r) => s + r.weight, 0);

  const empty: RiskItem[] = rows.map((r) => ({
    name: r.name,
    assetId: matchRiskAsset(r.name),
    weight: null,
    contribution: null,
    multiple: null,
  }));
  if (totalMatched <= 0) {
    return { items: empty, portfolioVol: null, coverage: 0, unmatched };
  }

  const w = matched.map((r) => r.weight / totalMatched);
  const vol = matched.map((r) => volOf(r.assetId));
  const cov = (i: number, j: number) => {
    const same = matched[i].assetId === matched[j].assetId;
    const rho = same ? 1 : CORR[index(matched[i].assetId)][index(matched[j].assetId)];
    return vol[i] * vol[j] * rho;
  };
  const sigmaW = w.map((_, i) => w.reduce((s, wj, j) => s + cov(i, j) * wj, 0));
  const variance = w.reduce((s, wi, i) => s + wi * sigmaW[i], 0);
  const portfolioVol = Math.sqrt(variance);

  let cursor = 0;
  const items: RiskItem[] = rows.map((r) => {
    const id = matchRiskAsset(r.name);
    const live = Number.isFinite(r.weight) && r.weight > 0;
    if (id == null || !live) return { name: r.name, assetId: id, weight: null, contribution: null, multiple: null };
    const i = cursor++;
    const contribution = (w[i] * sigmaW[i]) / variance;
    return { name: r.name, assetId: id, weight: w[i], contribution, multiple: contribution / w[i] };
  });

  return {
    items,
    portfolioVol,
    coverage: totalAll > 0 ? totalMatched / totalAll : 0,
    unmatched,
  };
}
