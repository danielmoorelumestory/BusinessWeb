import type { DcfSheetInput } from "./types.ts";

/** 测试与页面共用的样例输入：起始 FCF 100、成长 5%、永续 2%、折现 10% */
export function sampleInput(
  overrides: Partial<DcfSheetInput> = {},
): DcfSheetInput {
  return {
    company: "样例公司",
    code: "600519",
    market: "cn",
    currency: "CNY",
    moneyUnit: "yuan",
    shareUnit: "share",
    baseYear: 2025,
    baseFcf: 100,
    growth: 5,
    perpetualGrowth: 2,
    discountRate: 10,
    cash: 50,
    debt: 200,
    shares: 10,
    currentPrice: 15,
    ebitda: 200,
    marketCap: 1000,
    beta: 1.2,
    interestExpense: 10,
    pretaxIncome: 300,
    taxPaid: 75,
    riskFreeRate: 3,
    marketReturn: 8,
    ...overrides,
  };
}
