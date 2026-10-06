import type { DcfInput, MethodResult, SensitivityCell } from "../types.ts";
export function calculateDcf(input: DcfInput): MethodResult {
  const fail = (
    status: MethodResult["status"],
    reason: string,
  ): MethodResult => ({ status, price: null, reason });
  const { discountRate: r, terminalGrowth: g, shares } = input;
  if (shares == null) return fail("missingData", "缺少稀释股本");
  if (
    !["fcff", "fcfe"].includes(input.kind) ||
    !Number.isFinite(r) ||
    !Number.isFinite(g) ||
    r <= 0 ||
    g <= -1 ||
    r <= g ||
    !Number.isFinite(shares) ||
    shares <= 0
  )
    return fail("invalidInput", "要求折现率>永续增长率，股本与折现率必须为正");
  let flows = input.cashflows;
  if (input.projections) {
    if (input.kind !== "fcff")
      return fail("invalidInput", "经营预测路径仅适用于FCFF");
    flows = input.projections.map(
      (p) =>
        p.revenue * p.ebitMargin * (p.ebitMargin > 0 ? 1 - p.taxRate : 1) +
        p.da -
        p.capex -
        p.workingCapitalIncrease,
    );
  }
  if (
    !Array.isArray(flows) ||
    !flows.length ||
    flows.length > 15 ||
    flows.some((f) => !Number.isFinite(f))
  )
    return fail("invalidInput", "需要1–15年有效现金流");
  if (flows[flows.length - 1] <= 0)
    return fail("notApplicable", "稳态末年现金流必须为正");
  const terminal =
    (flows[flows.length - 1] * (1 + g)) / (r - g) / (1 + r) ** flows.length;
  const pv = flows.reduce((sum, f, i) => sum + f / (1 + r) ** (i + 1), 0),
    enterprise = pv + terminal;
  let equity = enterprise,
    discount = 1,
    nonOperatingEffective: number | undefined;
  if (input.kind === "fcff") {
    const fields = [
      input.cash,
      input.debt,
      input.preferred,
      input.minority,
      input.nonOperating,
    ];
    if (fields.some((v) => v == null))
      return fail(
        "missingData",
        "缺少现金/债务/优先股/少数权益/非经营资产桥接，确认零值后方可计算",
      );
    if (fields.some((v) => !Number.isFinite(v) || v! < 0))
      return fail("invalidInput", "股权价值桥接金额必须有限且非负");
    discount = input.nonOperatingDiscount ?? 1;
    if (!Number.isFinite(discount) || discount < 0 || discount > 1)
      return fail("invalidInput", "非经营资产计入系数必须在0到1之间");
    nonOperatingEffective = input.nonOperating! * discount;
    equity =
      enterprise +
      input.cash! +
      nonOperatingEffective -
      input.debt! -
      input.preferred! -
      input.minority!;
  }
  const price = equity / shares;
  if (!Number.isFinite(price)) return fail("invalidInput", "计算溢出");
  return {
    status: "calculated",
    price,
    enterpriseValue: input.kind === "fcff" ? enterprise : undefined,
    equityValue: equity,
    terminalShare: enterprise !== 0 ? terminal / enterprise : undefined,
    cashflows: flows,
    nonOperatingEffective,
    reason: `${input.kind.toUpperCase()} / ${flows.length}年；估值基准日价值${
      input.kind === "fcff" && discount !== 1
        ? `；非经营资产按${(discount * 100).toFixed(0)}%计入`
        : ""
    }`,
  };
}
export function calculateSensitivity(input: DcfInput): SensitivityCell[] {
  return [-0.02, -0.01, 0, 0.01, 0.02].flatMap((dr) =>
    [-0.01, 0, 0.01].map((dg) => {
      const discountRate = input.discountRate + dr,
        terminalGrowth = input.terminalGrowth + dg;
      return {
        discountRate,
        terminalGrowth,
        price: calculateDcf({ ...input, discountRate, terminalGrowth }).price,
      };
    }),
  );
}
