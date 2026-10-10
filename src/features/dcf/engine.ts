import type { DcfSheetInput, DcfSheetResult, DcfStatus } from "./types.ts";
import { pct, toBaseAmount, toBaseShares } from "./units.ts";

/** 原表固定预测五年（D~H 列），基年（C 列）不折现也不计入企业价值 */
export const PROJECTION_YEARS = 5;

function fail(
  status: DcfStatus,
  reason: string,
  warnings: string[] = [],
): DcfSheetResult {
  return {
    status,
    price: null,
    reason,
    cashflows: [],
    mos: null,
    verdict: null,
    warnings,
  };
}

/**
 * 按原表口径计算：
 *   flows[t] = 起始FCF * (1+g)^t        (D11..H11，t=1..5)
 *   终值 TV  = flows[5] * (1+gp)/(r-gp) (H12)
 *   EV       = NPV(r, D13:H13)          (C17，终值在第 5 期一并折现)
 *   股权价值 = EV + 现金 - 总负债        (C20)
 *   合理价   = 股权价值 / 流通股数       (C22)
 *   安全边际 = (合理价 - 现价) / 现价    (C24)
 */
export function calculateSheetDcf(input: DcfSheetInput): DcfSheetResult {
  const warnings: string[] = [];
  const g = pct(input.growth);
  const gp = pct(input.perpetualGrowth);
  const r = pct(input.discountRate);
  const fcf = toBaseAmount(input.baseFcf, input.moneyUnit);
  const shares = toBaseShares(input.shares, input.shareUnit);

  if (fcf == null) return fail("missingData", "请填写起始自由现金流");
  if (g == null) return fail("missingData", "请填写未来五年成长率");
  if (gp == null) return fail("missingData", "请填写永续增长率");
  if (r == null) return fail("missingData", "请填写期望折现率");
  if (shares == null) return fail("missingData", "请填写流通股数");

  if (g <= -1 || gp <= -1 || r <= -1)
    return fail("invalidInput", "增长率与折现率必须大于 -100%");
  if (r <= gp)
    return fail("invalidInput", "折现率必须大于永续增长率，否则终值无意义");
  if (shares <= 0) return fail("invalidInput", "流通股数必须为正");
  if (fcf <= 0)
    return fail(
      "notApplicable",
      "起始自由现金流必须为正；银行、保险及自由现金流为负的公司不适用 DCF",
    );

  const flows = Array.from(
    { length: PROJECTION_YEARS },
    (_, i) => fcf * (1 + g) ** (i + 1),
  );
  const terminalValue = (flows[PROJECTION_YEARS - 1] * (1 + gp)) / (r - gp);
  const last = PROJECTION_YEARS - 1;
  const enterpriseValue = flows.reduce(
    (sum, flow, i) =>
      sum + (i === last ? flow + terminalValue : flow) / (1 + r) ** (i + 1),
    0,
  );
  if (!Number.isFinite(enterpriseValue) || !Number.isFinite(terminalValue))
    return fail("invalidInput", "参数量级过大导致计算溢出，请检查金额单位");

  let cash = toBaseAmount(input.cash, input.moneyUnit);
  let debt = toBaseAmount(input.debt, input.moneyUnit);
  if (cash == null) {
    cash = 0;
    warnings.push("现金及其他投资未填，按 0 计入");
  }
  if (debt == null) {
    debt = 0;
    warnings.push("总负债未填，按 0 计入");
  }

  const equityValue = enterpriseValue + cash - debt;
  const price = equityValue / shares;
  if (!Number.isFinite(price))
    return fail("invalidInput", "计算溢出，请检查股本与金额单位");

  if (equityValue <= 0)
    warnings.push("股权价值为负（负债超过企业价值），结果仅供参考");

  const pvTerminal = terminalValue / (1 + r) ** PROJECTION_YEARS;
  const terminalShare =
    enterpriseValue !== 0 ? pvTerminal / enterpriseValue : undefined;
  if (terminalShare != null && terminalShare > 0.8)
    warnings.push("终值占企业价值八成以上，估值对永续假设非常敏感");

  const currentPrice = input.currentPrice;
  const mos =
    currentPrice != null && currentPrice > 0
      ? (price - currentPrice) / currentPrice
      : null;
  if (mos == null) warnings.push("缺少有效当前股价，无法计算安全边际");

  return {
    status: "calculated",
    price,
    reason: `${PROJECTION_YEARS} 年现金流折现，折现率 ${(r * 100).toFixed(2)}%、永续增长 ${(gp * 100).toFixed(2)}%`,
    enterpriseValue,
    terminalValue,
    terminalShare,
    equityValue,
    cashflows: flows,
    mos,
    verdict: mos == null ? null : mos > 0 ? "BUY" : "SELL",
    warnings,
  };
}
