import { describe, expect, it } from "vitest";
import { calculateCurrencyExposure } from "./currencyExposure";

describe("calculateCurrencyExposure", () => {
  it("五项等权：人民币 40%，美元 20%，港币 20%，黄金 20%，外币合计 60%", () => {
    const r = calculateCurrencyExposure(
      ["红利低波", "纯债基金", "标普500", "黄金ETF", "恒生科技"].map((name) => ({ name, weight: 20 })),
    );
    expect(r.shares!.cny).toBeCloseTo(0.4, 10);
    expect(r.shares!.usd).toBeCloseTo(0.2, 10);
    expect(r.shares!.hkd).toBeCloseTo(0.2, 10);
    expect(r.shares!.gold).toBeCloseTo(0.2, 10);
    expect(r.foreignShare!).toBeCloseTo(0.6, 10);
  });

  it("纯人民币资产没有外币敞口；未识别资产被列出；空输入返回 null", () => {
    const r = calculateCurrencyExposure([{ name: "纯债", weight: 1 }, { name: "某只个股", weight: 1 }]);
    expect(r.foreignShare).toBe(0);
    expect(r.unmatched).toEqual(["某只个股"]);
    expect(calculateCurrencyExposure([]).shares).toBeNull();
  });
});
