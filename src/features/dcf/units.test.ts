import { describe, expect, it } from "vitest";
import {
  formatMoney,
  formatPct,
  formatScaleHint,
  formatShares,
  parseNumber,
  pct,
  toBaseAmount,
  toBaseShares,
} from "./units.ts";

describe("单位换算", () => {
  it("金额按元/万/亿换算", () => {
    expect(toBaseAmount(1, "yuan")).toBe(1);
    expect(toBaseAmount(1, "wan")).toBe(1e4);
    expect(toBaseAmount(1, "yi")).toBe(1e8);
    expect(toBaseAmount(null, "yi")).toBeNull();
  });

  it("股本按股/万/亿换算", () => {
    expect(toBaseShares(1, "share")).toBe(1);
    expect(toBaseShares(1, "wan")).toBe(1e4);
    expect(toBaseShares(12.3, "yi")).toBeCloseTo(1.23e9, 4);
  });

  it("百分比输入除以 100", () => {
    expect(pct(5)).toBeCloseTo(0.05, 10);
    expect(pct(null)).toBeNull();
  });

  it("非数字输入按未填处理", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("  ")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber(" 12.5 ")).toBe(12.5);
  });
});

describe("格式化", () => {
  it("大额金额按亿/万展示", () => {
    expect(formatMoney(1.23e8, "CNY")).toBe("¥1.23 亿");
    expect(formatMoney(4.5e4, "USD")).toBe("$4.50 万");
    expect(formatMoney(null, "CNY")).toBe("—");
  });

  it("股数按亿/万展示", () => {
    expect(formatShares(1.23e8)).toBe("1.23 亿股");
    expect(formatShares(4.5e4)).toBe("4.50 万股");
  });

  it("归一化提示", () => {
    expect(formatScaleHint(1.23e8)).toContain("亿");
    expect(formatScaleHint(null)).toBe("");
  });

  it("百分比", () => {
    expect(formatPct(8.125)).toBe("8.13%");
    expect(formatPct(null)).toBe("—");
  });
});
