import { it, expect, vi } from "vitest";
import { loadReports, saveReport, exportReport, importReport } from "./storage";
it("ignores unknown report versions without crashing", () => {
  localStorage.setItem(
    "businessweb.valuation.v1",
    JSON.stringify([{ schemaVersion: 99 }]),
  );
  expect(loadReports()).toEqual([]);
  localStorage.clear();
});
it("reports storage errors instead of claiming a save succeeded", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("full");
  });
  expect(saveReport({ schemaVersion: 1 } as never).ok).toBe(false);
  vi.restoreAllMocks();
});

import fixture from "./report.fixture.json";
it("rejects malformed nested analysis and DCF in imported reports", () => {
  const valid = importReport(JSON.stringify(fixture));
  expect(valid.snapshot.security.code).toBe("AAPL");
  const badAnalysis = structuredClone(fixture);
  (badAnalysis.assumptions as unknown as { analysis: unknown[] }).analysis = [
    {},
  ];
  expect(() => importReport(JSON.stringify(badAnalysis))).toThrow(/报告格式/);
  const badDcf = structuredClone(fixture);
  (badDcf.assumptions.scenarios.base as unknown as { dcf: unknown }).dcf = {};
  expect(() => importReport(JSON.stringify(badDcf))).toThrow(/报告格式/);
});
it("accepts non-operating discount and shows the effective bridge amount in markdown", () => {
  const report = structuredClone(fixture);
  const dcf = {
    kind: "fcff",
    cashflows: [100],
    discountRate: 0.1,
    terminalGrowth: 0.02,
    shares: 100,
    cash: 1000,
    debt: 500,
    preferred: 0,
    minority: 10,
    nonOperating: 200,
    nonOperatingDiscount: 0.7,
    financingNote: "",
  };
  (report.assumptions.scenarios.base as unknown as { dcf: unknown }).dcf = dcf;
  (report.results.base as unknown as { dcf: unknown }).dcf = {
    status: "calculated",
    price: 15,
    reason: "FCFF / 1年；估值基准日价值；非经营资产按70%计入",
    equityValue: 1500,
    nonOperatingEffective: 140,
  };
  const imported = importReport(JSON.stringify(report));
  const markdown = exportReport(imported, "markdown");
  expect(markdown).toContain("非经营资产按70%计入");
  expect(markdown).toContain("实际生效 140");
});
