import { describe, expect, it } from "vitest";
import { buildDcfLink, dcfMarketOf, parseDcfPrefill } from "./prefill.ts";

describe("DCF 预填链接", () => {
  it("研究页市场换算为 DCF 的市场与币种", () => {
    expect(dcfMarketOf("cn")).toEqual({ market: "cn", currency: "CNY" });
    expect(dcfMarketOf("hk")).toEqual({ market: "hk", currency: "HKD" });
    for (const m of ["us", "adr", "ndx"] as const) {
      expect(dcfMarketOf(m)).toEqual({ market: "us", currency: "USD" });
    }
  });

  it("生成的链接能被原样解析回来", () => {
    const link = buildDcfLink({ company: "腾讯控股", code: "0700", researchMarket: "hk", price: 512.5 });
    expect(link.startsWith("/dcf?")).toBe(true);
    expect(parseDcfPrefill(link.slice(link.indexOf("?")))).toEqual({
      company: "腾讯控股",
      code: "0700",
      market: "hk",
      currency: "HKD",
      currentPrice: 512.5,
    });
  });

  it("没有有效价格时不带 price", () => {
    expect(buildDcfLink({ company: "A", code: "1", researchMarket: "us", price: null })).not.toContain("price");
    expect(buildDcfLink({ company: "A", code: "1", researchMarket: "us", price: -3 })).not.toContain("price");
  });

  it("非法或空参数被忽略", () => {
    expect(parseDcfPrefill("")).toBeNull();
    expect(parseDcfPrefill("?price=10")).toBeNull();
    const p = parseDcfPrefill("?company=X&market=zzz&currency=EUR&price=abc")!;
    expect(p.market).toBe("cn");
    expect(p.currency).toBe("CNY");
    expect(p.currentPrice).toBeNull();
  });
});
