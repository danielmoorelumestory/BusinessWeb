import { describe, expect, it } from "vitest";
import { calculateSheetDcf } from "./engine.ts";
import { sampleInput } from "./fixtures.ts";
import { calculateSensitivity } from "./sensitivity.ts";

describe("calculateSensitivity", () => {
  it("中心格与单点 DCF 结果一致", () => {
    const input = sampleInput();
    const m = calculateSensitivity(input)!;
    expect(m.cells).toHaveLength(5);
    expect(m.cells[0]).toHaveLength(5);
    expect(m.cells[2][2].price).toBeCloseTo(calculateSheetDcf(input).price!, 8);
    expect(m.discountRates).toEqual([8, 9, 10, 11, 12]);
    expect(m.perpetualGrowths).toEqual([1, 1.5, 2, 2.5, 3]);
  });

  it("折现率越高价格越低，永续增长越高价格越高", () => {
    const m = calculateSensitivity(sampleInput())!;
    expect(m.cells[0][2].price!).toBeGreaterThan(m.cells[4][2].price!);
    expect(m.cells[2][4].price!).toBeGreaterThan(m.cells[2][0].price!);
    expect(m.minPrice).toBe(m.cells[4][0].price);
    expect(m.maxPrice).toBe(m.cells[0][4].price);
  });

  it("折现率不高于永续增长率的格子不可算", () => {
    const m = calculateSensitivity(sampleInput({ discountRate: 3, perpetualGrowth: 2 }))!;
    // 折现率 1%、永续 4% 等格子不可算，中心 3% vs 2% 可算
    expect(m.cells[2][2].price).not.toBeNull();
    expect(m.cells[0][4].price).toBeNull();
    expect(m.cells[0][4].mos).toBeNull();
  });

  it("缺数据或不适用时返回 null", () => {
    expect(calculateSensitivity(sampleInput({ baseFcf: null }))).toBeNull();
    expect(calculateSensitivity(sampleInput({ baseFcf: -5 }))).toBeNull();
    expect(calculateSensitivity(sampleInput({ discountRate: null }))).toBeNull();
  });

  it("无现价时不给出正安全边际占比", () => {
    const m = calculateSensitivity(sampleInput({ currentPrice: null }))!;
    expect(m.positiveShare).toBeNull();
    expect(m.cells[2][2].mos).toBeNull();
  });
});
