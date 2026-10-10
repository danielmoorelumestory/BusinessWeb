import type { DcfSheetInput, DcfStatus, WaccResult } from "./types.ts";
import { pct, toBaseAmount } from "./units.ts";

/** 税前利润为负时有效税率按 0 处理，超出这个区间视为数据异常夹取 */
const TAX_RATE_MIN = 0;
const TAX_RATE_MAX = 0.6;

function fail(status: DcfStatus, reason: string, notes: string[] = []): WaccResult {
  return {
    status,
    wacc: null,
    reason,
    debtWeight: null,
    equityWeight: null,
    costOfDebt: null,
    costOfEquity: null,
    taxRate: null,
    notes,
  };
}

/**
 * 原表 C39:C45：
 *   负债比重 = 总负债/(市值+总负债)；股权比重 = 市值/(市值+总负债)
 *   负债成本 = 利息支出/总负债；股权成本 = 无风险利率 + β×(市场回报-无风险利率)
 *   税率     = 所得税/税前收入
 *   WACC     = 负债比重×负债成本×(1-税率) + 股权比重×股权成本
 * 缺项尽量降级而不是整体失败，算不出股权成本才整块失败。
 */
export function calculateWacc(input: DcfSheetInput): WaccResult {
  const notes: string[] = [];
  const marketCap = toBaseAmount(input.marketCap, input.moneyUnit);
  const debt = toBaseAmount(input.debt, input.moneyUnit);
  const interest = toBaseAmount(input.interestExpense, input.moneyUnit);
  const pretax = toBaseAmount(input.pretaxIncome, input.moneyUnit);
  const taxPaid = toBaseAmount(input.taxPaid, input.moneyUnit);
  const rf = pct(input.riskFreeRate);
  const rm = pct(input.marketReturn);

  if (marketCap == null || debt == null)
    return fail("missingData", "请填写市值与总负债以计算资本结构");
  const capital = marketCap + debt;
  if (capital <= 0)
    return fail("missingData", "市值与总负债之和必须为正");

  const debtWeight = debt / capital;
  const equityWeight = marketCap / capital;

  let costOfDebt = 0;
  if (debt > 0) {
    if (interest == null)
      return fail("missingData", "有负债时请填写利息支出以计算负债成本", notes);
    costOfDebt = interest / debt;
    if (!Number.isFinite(costOfDebt))
      return fail("invalidInput", "负债成本计算无效，请检查利息支出与总负债");
  } else {
    notes.push("无有息负债，负债成本按 0 计入");
  }

  if (rf == null || rm == null)
    return fail("missingData", "请填写无风险利率与市场预期回报以计算股权成本", notes);
  let beta = input.beta;
  if (beta == null) {
    beta = 1;
    notes.push("β 值未填，按 1（与市场同幅波动）估算");
  }
  const costOfEquity = rf + beta * (rm - rf);

  let taxRate = 0;
  if (pretax == null || taxPaid == null || pretax <= 0) {
    notes.push("税前收入非正或所得税未填，有效税率按 0 处理");
  } else {
    taxRate = taxPaid / pretax;
    if (!Number.isFinite(taxRate))
      return fail("invalidInput", "税率计算无效，请检查所得税与税前收入", notes);
    if (taxRate < TAX_RATE_MIN || taxRate > TAX_RATE_MAX) {
      const clamped = Math.min(Math.max(taxRate, TAX_RATE_MIN), TAX_RATE_MAX);
      notes.push(
        `算得税率 ${(taxRate * 100).toFixed(1)}% 超出合理区间，已夹取为 ${(clamped * 100).toFixed(1)}%`,
      );
      taxRate = clamped;
    }
  }

  const wacc = debtWeight * costOfDebt * (1 - taxRate) + equityWeight * costOfEquity;
  if (!Number.isFinite(wacc))
    return fail("invalidInput", "WACC 计算溢出，请检查输入量级", notes);

  return {
    status: "calculated",
    wacc: wacc * 100,
    reason: `负债 ${(debtWeight * 100).toFixed(1)}% / 股权 ${(equityWeight * 100).toFixed(1)}%，股权成本 ${(costOfEquity * 100).toFixed(2)}%`,
    debtWeight,
    equityWeight,
    costOfDebt,
    costOfEquity,
    taxRate,
    notes,
  };
}
