import { matchRiskAsset, type RiskAssetId, type RiskInputRow } from "./riskContribution";

/**
 * 币种敞口：不是“用什么币买”，而是“资产背后的价格是用什么币决定的”。
 * 黄金ETF在境内用人民币交易，但金价以美元定价，所以按美元敞口算；
 * 港币与美元联系汇率，这里单列但合并计入外币敞口。
 */
export type ExposureBucket = "cny" | "usd" | "hkd" | "gold";

export const BUCKET_LABELS: Record<ExposureBucket, string> = {
  cny: "人民币资产",
  usd: "美元资产",
  hkd: "港币资产",
  gold: "黄金（美元定价）",
};

const BUCKET_OF: Record<RiskAssetId, ExposureBucket> = {
  dividend: "cny",
  bond: "cny",
  csi300: "cny",
  sp500: "usd",
  hstech: "hkd",
  gold: "gold",
};

export interface CurrencyExposure {
  /** 各桶占已识别权重的比例 0~1，合计 1；没有可识别资产时为 null */
  shares: Record<ExposureBucket, number> | null;
  /** 非人民币定价资产合计占比 0~1 */
  foreignShare: number | null;
  unmatched: string[];
}

export function calculateCurrencyExposure(rows: RiskInputRow[]): CurrencyExposure {
  const live = rows.filter((r) => Number.isFinite(r.weight) && r.weight > 0);
  const sums: Record<ExposureBucket, number> = { cny: 0, usd: 0, hkd: 0, gold: 0 };
  const unmatched: string[] = [];
  for (const r of live) {
    const id = matchRiskAsset(r.name);
    if (id == null) unmatched.push(r.name);
    else sums[BUCKET_OF[id]] += r.weight;
  }
  const total = sums.cny + sums.usd + sums.hkd + sums.gold;
  if (total <= 0) return { shares: null, foreignShare: null, unmatched };
  const shares = {
    cny: sums.cny / total,
    usd: sums.usd / total,
    hkd: sums.hkd / total,
    gold: sums.gold / total,
  };
  return { shares, foreignShare: 1 - shares.cny, unmatched };
}
