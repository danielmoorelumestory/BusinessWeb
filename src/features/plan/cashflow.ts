/**
 * 自由生活覆盖率：资产产生的现金，能覆盖必要生活开支的多少。
 * 两把尺子并列看，避免只盯股息：
 *   股息/利息覆盖率 = 预期年化股息利息 ÷ 年必要开支（不动本金）
 *   4% 提款覆盖率   = 资产 × 4% ÷ 年必要开支（允许动一点本金）
 * 金额单位由调用方统一（页面用万元）；收益率是用户自己查到的当前值，不是预测。
 */

export const WITHDRAWAL_RATE = 0.04;

export interface CashflowAsset {
  amount: number;
  /** 年化股息/利息率（%），未填或非法按 0 */
  yieldPct: number;
}

export interface CashflowInput {
  /** 年必要生活开支 */
  expense: number;
  /** 不投资的备用金 */
  reserve: number;
  assets: CashflowAsset[];
}

export interface CashflowResult {
  totalAssets: number;
  /** 预期年化股息利息合计 */
  income: number;
  /** 加权年化股息率 0~1；总资产为 0 时为 null */
  weightedYield: number | null;
  /** 开支无效（≤0）时以下覆盖率为 null */
  incomeCoverage: number | null;
  withdrawalAmount: number;
  withdrawalCoverage: number | null;
  /** 靠 4% 提款覆盖开支需要的资产规模 = 开支 ÷ 4% */
  requiredAssets: number | null;
  /** 距离 4% 目标还差多少，已达成为 0 */
  gap: number | null;
  /** 备用金可在零收入下支撑的月数 */
  runwayMonths: number | null;
}

const clean = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function calculateCashflow(input: CashflowInput): CashflowResult {
  const expense = clean(input.expense);
  const reserve = clean(input.reserve);
  const assets = input.assets.map((a) => ({ amount: clean(a.amount), yieldPct: clean(a.yieldPct) }));
  const totalAssets = assets.reduce((s, a) => s + a.amount, 0);
  const income = assets.reduce((s, a) => s + (a.amount * a.yieldPct) / 100, 0);
  const withdrawalAmount = totalAssets * WITHDRAWAL_RATE;
  const hasExpense = expense > 0;
  const requiredAssets = hasExpense ? expense / WITHDRAWAL_RATE : null;
  return {
    totalAssets,
    income,
    weightedYield: totalAssets > 0 ? income / totalAssets : null,
    incomeCoverage: hasExpense ? income / expense : null,
    withdrawalAmount,
    withdrawalCoverage: hasExpense ? withdrawalAmount / expense : null,
    requiredAssets,
    gap: requiredAssets == null ? null : Math.max(0, requiredAssets - totalAssets),
    runwayMonths: hasExpense ? reserve / (expense / 12) : null,
  };
}
