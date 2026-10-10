import { describe, expect, it } from "vitest";
import { calculateMultiples, EBITDA_BANDS } from "./multiples.ts";
import { sampleInput } from "./fixtures.ts";

// EBITDA 200、股本 10 → 5× = 100、8.5× = 170、12× = 240
describe("calculateMultiples", () => {
  it("还原表格三档 EBITDA 倍数", () => {
    const bands = calculateMultiples(sampleInput());
    expect(bands.map((b) => b.price)).toEqual([100, 170, 240]);
    expect(bands.map((b) => b.label)).toEqual(["Low", "Mid", "High"]);
    expect(bands.every((b) => b.status === "calculated")).toBe(true);
  });

  it("金额与股本单位换算后结果不变", () => {
    const bands = calculateMultiples(
      sampleInput({ moneyUnit: "yi", shareUnit: "yi", ebitda: 2e-6, shares: 1e-7 }),
    );
    expect(bands[0].price).toBeCloseTo(100, 6);
  });

  it("EBITDA 未填 → 缺数据", () => {
    const bands = calculateMultiples(sampleInput({ ebitda: null }));
    expect(bands.every((b) => b.status === "missingData")).toBe(true);
    expect(bands.every((b) => b.price === null)).toBe(true);
  });

  it("EBITDA 为负（亏损或金融股）→ 不适用", () => {
    const bands = calculateMultiples(sampleInput({ ebitda: -50 }));
    expect(bands).toHaveLength(EBITDA_BANDS.length);
    expect(bands.every((b) => b.status === "notApplicable")).toBe(true);
  });

  it("股本非正 → 输入无效", () => {
    const bands = calculateMultiples(sampleInput({ shares: 0 }));
    expect(bands.every((b) => b.status === "invalidInput")).toBe(true);
  });
});
