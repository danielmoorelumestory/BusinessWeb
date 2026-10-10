import { describe, expect, it } from "vitest";
import { calculateWacc } from "./wacc.ts";
import { sampleInput } from "./fixtures.ts";

// 市值 1000、负债 200、利息 10、税前 300、所得税 75、β 1.2、无风险 3%、市场 8%
// 负债比重 1/6、股权比重 5/6、负债成本 5%、股权成本 9%、税率 25%
// WACC = 1/6×5%×0.75 + 5/6×9% = 8.125%
describe("calculateWacc", () => {
  it("还原表格 C39:C45 的口径", () => {
    const r = calculateWacc(sampleInput());
    expect(r.status).toBe("calculated");
    expect(r.debtWeight).toBeCloseTo(1 / 6, 8);
    expect(r.equityWeight).toBeCloseTo(5 / 6, 8);
    expect(r.costOfDebt).toBeCloseTo(0.05, 8);
    expect(r.costOfEquity).toBeCloseTo(0.09, 8);
    expect(r.taxRate).toBeCloseTo(0.25, 8);
    expect(r.wacc).toBeCloseTo(8.125, 6);
  });

  it("缺市值或总负债 → 缺数据", () => {
    expect(calculateWacc(sampleInput({ marketCap: null })).status).toBe(
      "missingData",
    );
    expect(calculateWacc(sampleInput({ debt: null })).status).toBe(
      "missingData",
    );
  });

  it("无有息负债时负债成本按 0 计入并注明", () => {
    const r = calculateWacc(
      sampleInput({ debt: 0, interestExpense: null }),
    );
    expect(r.status).toBe("calculated");
    expect(r.costOfDebt).toBe(0);
    expect(r.debtWeight).toBe(0);
    expect(r.wacc).toBeCloseTo(9, 6);
    expect(r.notes.join()).toContain("无有息负债");
  });

  it("有负债但缺利息支出 → 缺数据", () => {
    const r = calculateWacc(sampleInput({ interestExpense: null }));
    expect(r.status).toBe("missingData");
    expect(r.reason).toContain("利息支出");
  });

  it("税前收入非正时有效税率按 0 处理", () => {
    const r = calculateWacc(sampleInput({ pretaxIncome: -100, taxPaid: 10 }));
    expect(r.status).toBe("calculated");
    expect(r.taxRate).toBe(0);
    expect(r.notes.join()).toContain("有效税率按 0");
  });

  it("税率超出合理区间时夹取并注明", () => {
    const r = calculateWacc(sampleInput({ pretaxIncome: 100, taxPaid: 300 }));
    expect(r.status).toBe("calculated");
    expect(r.taxRate).toBe(0.6);
    expect(r.notes.join()).toContain("夹取");
  });

  it("β 未填时按 1 估算并注明", () => {
    const r = calculateWacc(sampleInput({ beta: null }));
    expect(r.status).toBe("calculated");
    expect(r.costOfEquity).toBeCloseTo(0.08, 8);
    expect(r.notes.join()).toContain("β");
  });

  it("缺无风险利率或市场回报 → 缺数据", () => {
    expect(calculateWacc(sampleInput({ riskFreeRate: null })).status).toBe(
      "missingData",
    );
    expect(calculateWacc(sampleInput({ marketReturn: null })).status).toBe(
      "missingData",
    );
  });
});
