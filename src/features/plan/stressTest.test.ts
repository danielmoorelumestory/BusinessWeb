import { describe, expect, it } from "vitest";
import { STRESS_SCENARIOS } from "../../data/stressScenarios";
import { runAllStressScenarios, runStressScenario } from "./stressTest";

const scenario = (id: string) => STRESS_SCENARIOS.find((s) => s.id === id)!;
const FIVE = [
  { name: "红利低波", weight: 20 },
  { name: "纯债基金", weight: 20 },
  { name: "标普500", weight: 20 },
  { name: "黄金ETF", weight: 20 },
  { name: "恒生科技", weight: 20 },
];

describe("历史情景数据", () => {
  it("每个窗口序列长度一致、起点归一为 1，缺数据的资产为 null", () => {
    for (const s of STRESS_SCENARIOS) {
      for (const series of Object.values(s.series)) {
        if (series == null) continue;
        expect(series).toHaveLength(s.dates.length);
        expect(series[0]).toBe(1);
      }
      expect(s.dates[0]).toBe(s.start);
      expect(s.dates[s.dates.length - 1]).toBe(s.end);
    }
    expect(scenario("gfc2008").series.gold).toBeNull();
    expect(scenario("covid2020").series.hstech).toBeNull();
    expect(scenario("hike2022").series.hstech).not.toBeNull();
  });
});

describe("runStressScenario", () => {
  it("2022 加息：五项等权整体小幅下跌，纯债为正、恒生科技拖累最大", () => {
    const r = runStressScenario(FIVE, scenario("hike2022"));
    expect(r.coverage).toBe(1);
    expect(r.portfolioReturn!).toBeLessThan(0);
    expect(r.portfolioReturn!).toBeGreaterThan(-0.15);
    expect(r.contributors[0].name).toBe("恒生科技");
    expect(r.contributors.find((c) => c.name === "纯债基金")!.assetReturn).toBeGreaterThan(0);
    expect(r.maxDrawdown!).toBeGreaterThanOrEqual(-r.portfolioReturn!);
  });

  it("没有数据的资产不替代，只算有数据的部分并列出", () => {
    const r = runStressScenario(FIVE, scenario("gfc2008"));
    expect(r.noData.sort()).toEqual(["恒生科技", "黄金"].sort());
    expect(r.coverage).toBeCloseTo(0.6, 10);
    expect(r.contributors).toHaveLength(3);
  });

  it("单一资产：组合涨跌等于该资产涨跌，回撤不小于终点跌幅", () => {
    const s = scenario("covid2020");
    const r = runStressScenario([{ name: "标普500", weight: 1 }], s);
    const end = s.series.sp500![s.series.sp500!.length - 1] - 1;
    expect(r.portfolioReturn!).toBeCloseTo(end, 10);
    expect(r.maxDrawdown!).toBeGreaterThanOrEqual(-end - 1e-9);
  });

  it("没有可识别资产或权重为空：不给结果", () => {
    expect(runStressScenario([{ name: "某只个股", weight: 10 }], scenario("hike2022")).portfolioReturn).toBeNull();
    expect(runStressScenario([], scenario("hike2022")).coverage).toBe(0);
  });

  it("未识别资产被列出且降低覆盖率", () => {
    const r = runStressScenario([{ name: "标普500", weight: 50 }, { name: "某只个股", weight: 50 }], scenario("hike2022"));
    expect(r.unmatched).toEqual(["某只个股"]);
    expect(r.coverage).toBeCloseTo(0.5, 10);
  });

  it("runAll 覆盖全部情景", () => {
    expect(runAllStressScenarios(FIVE)).toHaveLength(STRESS_SCENARIOS.length);
  });
});
