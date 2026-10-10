import { describe, expect, it } from "vitest";
import { calculateRiskContribution, matchRiskAsset } from "./riskContribution";

const FIVE = [
  { name: "红利低波", weight: 20 },
  { name: "纯债基金", weight: 20 },
  { name: "标普500", weight: 20 },
  { name: "黄金ETF", weight: 20 },
  { name: "恒生科技", weight: 20 },
];

describe("matchRiskAsset", () => {
  it("按名称关键词识别资产，识别不了返回 null", () => {
    expect(matchRiskAsset("中短债/纯债")).toBe("bond");
    expect(matchRiskAsset("A股宽基")).toBe("csi300");
    expect(matchRiskAsset("恒生科技ETF")).toBe("hstech");
    expect(matchRiskAsset("某只个股")).toBeNull();
    expect(matchRiskAsset("")).toBeNull();
  });
});

describe("calculateRiskContribution", () => {
  it("复现书 9.7：五项等权里恒生科技承担约 55% 的波动，组合波动约 10.8%", () => {
    const r = calculateRiskContribution(FIVE);
    const by = Object.fromEntries(r.items.map((i) => [i.name, i.contribution!]));
    expect(by["恒生科技"]).toBeGreaterThan(0.54);
    expect(by["恒生科技"]).toBeLessThan(0.56);
    expect(by["红利低波"]).toBeCloseTo(0.19, 1);
    expect(r.portfolioVol!).toBeCloseTo(0.108, 2);
    expect(r.coverage).toBe(1);
  });

  it("风险贡献合计为 100%，纯债风险占比远小于权重", () => {
    const r = calculateRiskContribution(FIVE);
    const sum = r.items.reduce((s, i) => s + i.contribution!, 0);
    expect(sum).toBeCloseTo(1, 10);
    const bond = r.items.find((i) => i.name === "纯债基金")!;
    expect(bond.multiple!).toBeLessThan(0.1);
  });

  it("未识别的行不参与计算并被列出，覆盖率反映其占比", () => {
    const r = calculateRiskContribution([...FIVE, { name: "某只个股", weight: 20 }]);
    expect(r.unmatched).toEqual(["某只个股"]);
    expect(r.coverage).toBeCloseTo(5 / 6, 10);
    expect(r.items[5].contribution).toBeNull();
  });

  it("权重非正或没有任何可识别资产时不给结果", () => {
    expect(calculateRiskContribution([{ name: "标普500", weight: 0 }]).portfolioVol).toBeNull();
    expect(calculateRiskContribution([{ name: "某只个股", weight: 10 }]).portfolioVol).toBeNull();
    expect(calculateRiskContribution([]).coverage).toBe(0);
  });

  it("单一资产风险贡献为 100%，组合波动等于该资产波动", () => {
    const r = calculateRiskContribution([{ name: "标普500", weight: 1 }]);
    expect(r.items[0].contribution).toBeCloseTo(1, 10);
    expect(r.portfolioVol!).toBeCloseTo(0.1535, 4);
  });

  it("同一类资产两行时相关系数为 1，风险按权重分摊", () => {
    const r = calculateRiskContribution([
      { name: "红利低波A", weight: 10 },
      { name: "红利低波B", weight: 30 },
    ]);
    expect(r.items[0].contribution!).toBeCloseTo(0.25, 10);
    expect(r.items[1].contribution!).toBeCloseTo(0.75, 10);
  });
});
