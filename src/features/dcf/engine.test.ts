import { describe, expect, it } from "vitest";
import { calculateSheetDcf, PROJECTION_YEARS } from "./engine.ts";
import { sampleInput } from "./fixtures.ts";

// 黄金值：起始FCF 100、g 5%、gp 2%、r 10%、现金 50、负债 200、股本 10、现价 15
const GOLDEN = {
  flows: [105, 110.25, 115.7625, 121.550625, 127.62815625],
  terminalValue: 1627.2589921875,
  enterpriseValue: 1446.211890,
  equityValue: 1296.211890,
  price: 129.621189,
  mos: 7.641413,
};

describe("calculateSheetDcf 表格口径", () => {
  it("基年不折现，只推五年", () => {
    const r = calculateSheetDcf(sampleInput());
    expect(r.status).toBe("calculated");
    expect(r.cashflows).toHaveLength(PROJECTION_YEARS);
    expect(r.cashflows[0]).toBeCloseTo(GOLDEN.flows[0], 8);
    expect(r.cashflows[4]).toBeCloseTo(GOLDEN.flows[4], 8);
    // 基年 100 不能出现在企业价值里
    expect(r.enterpriseValue!).toBeGreaterThan(1000);
    expect(r.enterpriseValue).not.toBeCloseTo(100, 0);
  });

  it("终值在第 5 期与末年现金流一并折现", () => {
    const r = calculateSheetDcf(sampleInput());
    expect(r.terminalValue).toBeCloseTo(GOLDEN.terminalValue, 6);
    // 单独把终值按第 5 期折现加到现金流现值上，应等于 EV
    const i = PROJECTION_YEARS - 1;
    const manual =
      GOLDEN.flows.reduce(
        (sum, f, idx) => sum + f / 1.1 ** (idx + 1),
        0,
      ) + GOLDEN.terminalValue / 1.1 ** (i + 1);
    expect(r.enterpriseValue).toBeCloseTo(manual, 6);
    expect(r.enterpriseValue).toBeCloseTo(GOLDEN.enterpriseValue, 6);
  });

  it("股权桥接、合理价、安全边际与买卖结论", () => {
    const r = calculateSheetDcf(sampleInput());
    expect(r.equityValue).toBeCloseTo(GOLDEN.equityValue, 6);
    expect(r.price).toBeCloseTo(GOLDEN.price, 6);
    expect(r.mos).toBeCloseTo(GOLDEN.mos, 6);
    expect(r.verdict).toBe("BUY");
  });

  it("合理价低于现价时判 SELL，恰好相等也判 SELL", () => {
    expect(calculateSheetDcf(sampleInput({ currentPrice: 200 })).verdict).toBe(
      "SELL",
    );
    expect(
      calculateSheetDcf(sampleInput({ currentPrice: GOLDEN.price })).verdict,
    ).toBe("SELL");
  });

  it("金额与股本单位换算后结果一致", () => {
    const base = calculateSheetDcf(sampleInput());
    const scaled = calculateSheetDcf(
      sampleInput({
        moneyUnit: "yi",
        shareUnit: "yi",
        baseFcf: 100 / 1e8,
        cash: 50 / 1e8,
        debt: 200 / 1e8,
        ebitda: 200 / 1e8,
        shares: 10 / 1e8,
      }),
    );
    expect(scaled.price).toBeCloseTo(base.price!, 6);
  });
});

describe("calculateSheetDcf 边界与降级", () => {
  it("起始自由现金流非正 → 不适用", () => {
    const r = calculateSheetDcf(sampleInput({ baseFcf: 0 }));
    expect(r.status).toBe("notApplicable");
    expect(r.price).toBeNull();
    expect(r.reason).toContain("银行");
  });

  it("折现率小于或等于永续增长率 → 输入无效，不出 Infinity", () => {
    for (const [r0, gp] of [
      [10, 10],
      [8, 10],
    ]) {
      const r = calculateSheetDcf(
        sampleInput({ discountRate: r0, perpetualGrowth: gp }),
      );
      expect(r.status).toBe("invalidInput");
      expect(r.price).toBeNull();
      expect(Number.isFinite(r.enterpriseValue ?? 0)).toBe(true);
    }
  });

  it("增长率或折现率低于 -100% → 输入无效", () => {
    expect(calculateSheetDcf(sampleInput({ growth: -200 })).status).toBe(
      "invalidInput",
    );
    expect(calculateSheetDcf(sampleInput({ discountRate: -120 })).status).toBe(
      "invalidInput",
    );
  });

  it("缺必填项 → 缺数据", () => {
    for (const key of [
      "baseFcf",
      "growth",
      "perpetualGrowth",
      "discountRate",
      "shares",
    ] as const) {
      const r = calculateSheetDcf(sampleInput({ [key]: null }));
      expect(r.status, key).toBe("missingData");
    }
  });

  it("股本非正 → 输入无效", () => {
    expect(calculateSheetDcf(sampleInput({ shares: 0 })).status).toBe(
      "invalidInput",
    );
  });

  it("缺当前股价时价格照算，安全边际为空并给出提示", () => {
    const r = calculateSheetDcf(sampleInput({ currentPrice: null }));
    expect(r.status).toBe("calculated");
    expect(r.price).toBeCloseTo(GOLDEN.price, 6);
    expect(r.mos).toBeNull();
    expect(r.verdict).toBeNull();
    expect(r.warnings.join()).toContain("安全边际");
  });

  it("现金与负债留空按 0 计入并提示", () => {
    const r = calculateSheetDcf(sampleInput({ cash: null, debt: null }));
    expect(r.status).toBe("calculated");
    expect(r.equityValue).toBeCloseTo(GOLDEN.enterpriseValue, 6);
    expect(r.warnings).toHaveLength(2);
  });

  it("负债超过企业价值时结果为负但照常返回", () => {
    const r = calculateSheetDcf(sampleInput({ debt: 9999 }));
    expect(r.status).toBe("calculated");
    expect(r.price!).toBeLessThan(0);
    expect(r.warnings.join()).toContain("股权价值为负");
  });

  it("终值占比过高时给出敏感度提示", () => {
    const r = calculateSheetDcf(sampleInput({ perpetualGrowth: 6 }));
    expect(r.terminalShare!).toBeGreaterThan(0.8);
    expect(r.warnings.join()).toContain("终值");
  });
});
