import test from "node:test";
import assert from "node:assert/strict";
import { validateAssumptions } from "./analysis/validate.mjs";
import { REQUIRED_DIMENSIONS } from "./analysis/validate.mjs";
test("rejects wrong security and invented evidence references", () => {
  const snapshot = {
    security: { market: "us", code: "AAPL", quoteCurrency: "USD" },
    asOf: "2026-10-04",
    sources: [{ id: "sec" }],
  };
  assert.throws(
    () =>
      validateAssumptions(
        {
          schemaVersion: 1,
          security: { market: "us", code: "MSFT" },
          scenarios: {},
        },
        snapshot,
      ),
    /证券/,
  );
  assert.throws(
    () =>
      validateAssumptions(
        {
          schemaVersion: 1,
          security: snapshot.security,
          valuationDate: snapshot.asOf,
          scenarios: { bear: { sourceIds: ["invented"] }, base: {}, bull: {} },
          analysis: [],
        },
        snapshot,
      ),
    /来源|结构/,
  );
});

const fact = (value) => ({
  value,
  unit: "HKD",
  currency: "HKD",
  periodStart: "2025-01-01",
  periodEnd: "2025-12-31",
  basis: "annual",
  sourceId: "s1",
  retrievedAt: "2026-10-04T00:00:00.000Z",
  status: "available",
});
const bridgeSnapshot = () => ({
  security: { market: "hk", code: "00700", name: "腾讯", quoteCurrency: "HKD", exchange: "HKEX" },
  asOf: "2026-10-04",
  sources: [{ id: "s1", title: "年报", url: "https://example.com" }],
  facts: {
    cash: fact(1000),
    debt: fact(500),
    preferred: fact(0),
    minority: fact(10),
    nonOperating: fact(200),
  },
});
const dcf = (discountRate, nonOperatingDiscount) => ({
  kind: "fcff",
  cashflows: [100],
  discountRate,
  terminalGrowth: 0.02,
  shares: 100,
  cash: 999999,
  debt: 999999,
  preferred: 999999,
  minority: 999999,
  nonOperating: 999999,
  nonOperatingDiscount,
  projections: null,
  financingNote: "",
});
const bridgeAssumptions = (bearDiscount) => ({
  schemaVersion: 1,
  security: bridgeSnapshot().security,
  valuationDate: "2026-10-04",
  scenarios: {
    bear: scenario(10, 0.12, dcf(0.12, bearDiscount)),
    base: scenario(20, 0.1, dcf(0.1, null)),
    bull: scenario(30, 0.09, dcf(0.09, null)),
  },
  methodSuitability: Object.fromEntries(
    ["pe", "peg", "ps", "pb", "dcf", "multistage"].map((m) => [
      m,
      { applicable: true, reason: "x" },
    ]),
  ),
  analysis: REQUIRED_DIMENSIONS.map((dimension) => ({
    dimension,
    conclusion: "结论",
    evidence: ["依据"],
    sourceIds: ["s1"],
    falsification: "证伪",
  })),
});
function scenario(eps, requiredReturn, d) {
  return {
    year: 2027,
    eps,
    revenue: null,
    bvps: null,
    shares: 100,
    growth: null,
    pe: null,
    peg: null,
    ps: null,
    pb: null,
    requiredReturn,
    dcf: d,
    multistage: null,
    rationale: "假设",
    sourceIds: ["s1"],
  };
}
test("forces bridge amounts from facts while keeping scenario non-operating discount", () => {
  const value = validateAssumptions(bridgeAssumptions(0.7), bridgeSnapshot());
  const bear = value.scenarios.bear.dcf;
  assert.equal(bear.cash, 1000);
  assert.equal(bear.debt, 500);
  assert.equal(bear.nonOperating, 200);
  assert.equal(bear.nonOperatingDiscount, 0.7);
  assert.equal(value.scenarios.base.dcf.nonOperatingDiscount, null);
});
test("rejects non-operating discount outside 0–1", () => {
  assert.throws(
    () => validateAssumptions(bridgeAssumptions(1.5), bridgeSnapshot()),
    /非经营资产计入系数/,
  );
  assert.throws(
    () => validateAssumptions(bridgeAssumptions(-0.2), bridgeSnapshot()),
    /非经营资产计入系数/,
  );
});
