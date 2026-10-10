import { describe, expect, it } from "vitest";
import { calculateCashflow } from "./cashflow";

describe("calculateCashflow", () => {
  const base = {
    expense: 12,
    reserve: 6,
    assets: [
      { amount: 100, yieldPct: 4 },
      { amount: 100, yieldPct: 2 },
      { amount: 100, yieldPct: 0 },
    ],
  };

  it("股息利息覆盖率、加权股息率", () => {
    const r = calculateCashflow(base);
    expect(r.totalAssets).toBe(300);
    expect(r.income).toBeCloseTo(6, 10);
    expect(r.weightedYield!).toBeCloseTo(0.02, 10);
    expect(r.incomeCoverage!).toBeCloseTo(0.5, 10);
  });

  it("4% 提款覆盖率、所需资产、差额", () => {
    const r = calculateCashflow(base);
    expect(r.withdrawalAmount).toBeCloseTo(12, 10);
    expect(r.withdrawalCoverage!).toBeCloseTo(1, 10);
    expect(r.requiredAssets!).toBeCloseTo(300, 10);
    expect(r.gap).toBe(0);
    expect(calculateCashflow({ ...base, expense: 24 }).gap!).toBeCloseTo(300, 10);
  });

  it("备用金可撑月数 = 备用金 ÷ 月开支", () => {
    expect(calculateCashflow(base).runwayMonths!).toBeCloseTo(6, 10);
  });

  it("开支为空或非法时不给覆盖率；非法金额按 0", () => {
    const r = calculateCashflow({ expense: NaN, reserve: 5, assets: [{ amount: NaN, yieldPct: 3 }, { amount: 10, yieldPct: -1 }] });
    expect(r.incomeCoverage).toBeNull();
    expect(r.requiredAssets).toBeNull();
    expect(r.runwayMonths).toBeNull();
    expect(r.totalAssets).toBe(10);
    expect(r.income).toBe(0);
  });

  it("没有资产时加权股息率为 null", () => {
    expect(calculateCashflow({ expense: 10, reserve: 0, assets: [] }).weightedYield).toBeNull();
  });
});
