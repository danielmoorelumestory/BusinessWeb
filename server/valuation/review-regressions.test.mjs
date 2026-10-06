import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  validateAssumptions,
  REQUIRED_DIMENSIONS,
} from "./analysis/validate.mjs";
import { createJobStore } from "./jobs.mjs";
import { runProcess } from "./cli/process.mjs";
import { collectSec } from "./data/sec.mjs";
const security = {
  market: "us",
  code: "AAPL",
  name: "Apple",
  exchange: "NASDAQ",
  quoteCurrency: "USD",
};
const dcf = {
  kind: "fcff",
  cashflows: [100],
  discountRate: 0.1,
  terminalGrowth: 0,
  shares: 100,
  cash: 50,
  debt: 0,
  preferred: 0,
  minority: 0,
  nonOperating: 0,
  nonOperatingDiscount: null,
  projections: null,
  financingNote: "",
};
const scenario = {
  year: 2027,
  eps: 1,
  revenue: 100,
  bvps: 1,
  shares: 100,
  growth: 0.1,
  pe: 20,
  peg: 1,
  ps: 2,
  pb: 2,
  requiredReturn: 0.1,
  dcf,
  multistage: null,
  rationale: "test",
  sourceIds: ["sec"],
};
test("missing bridge facts cannot become model invented historical assets", () => {
  const value = {
    schemaVersion: 1,
    security,
    valuationDate: "2026-10-04",
    scenarios: Object.fromEntries(
      ["bear", "base", "bull"].map((k) => [k, structuredClone(scenario)]),
    ),
    methodSuitability: Object.fromEntries(
      ["pe", "peg", "ps", "pb", "dcf", "multistage"].map((k) => [
        k,
        { applicable: true, reason: "test" },
      ]),
    ),
    analysis: REQUIRED_DIMENSIONS.map((dimension) => ({
      dimension,
      conclusion: "test",
      evidence: ["a", "b"],
      sourceIds: ["sec"],
      falsification: "test",
    })),
  };
  const checked = validateAssumptions(value, {
    security,
    asOf: "2026-10-04",
    facts: {},
    sources: [{ id: "sec" }],
  });
  assert.equal(checked.scenarios.base.dcf.cash, null);
  assert.equal(checked.scenarios.base.dcf.debt, null);
});
test("event sequence remains monotonic across bounded replay buffer", async () => {
  const store = createJobStore({
    execute: async (_, { emit }) => {
      for (let i = 0; i < 2010; i++) emit("activity", {});
      return {};
    },
  });
  const j = store.start({});
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(store.events(j.id, 2011).at(-1)?.type, "completed");
  store.close();
});
test("timeout waits for forced termination of SIGTERM ignoring CLI", async () => {
  let pid;
  const p = runProcess(
    process.execPath,
    [
      "-e",
      "process.on('SIGTERM',()=>{});console.log(process.pid);setInterval(()=>{},100)",
    ],
    { timeout: 300, onLine: (l) => (pid = Number(l)) },
  );
  await assert.rejects(p, /超时/);
  assert.ok(pid);
  assert.throws(() => process.kill(pid, 0));
});
test("partial long term debt is not labeled complete interest bearing debt", async () => {
  const original = global.fetch;
  const tag = (val) => ({
    units: { USD: [{ val, end: "2025-12-31", filed: "2026-02-01" }] },
  });
  global.fetch = async () =>
    new Response(
      JSON.stringify({
        entityName: "Apple",
        facts: {
          "us-gaap": {
            LongTermDebtCurrent: tag(10),
            LongTermDebtNoncurrent: tag(90),
            ShortTermBorrowings: tag(30),
            CommercialPaper: tag(20),
          },
        },
      }),
    );
  try {
    const r = await collectSec(security, { asOf: "2026-10-04" });
    assert.equal(r.facts.debt?.value ?? null, null);
    assert.ok(r.missing.some((s) => s.includes("debt")));
  } finally {
    global.fetch = original;
  }
});
test("rejects incomplete analysis dimensions and contradictory scenarios", () => {
  const snapshot = {
    security,
    asOf: "2026-10-04",
    facts: {},
    sources: [{ id: "sec" }],
  };
  const make = () => ({
    schemaVersion: 1,
    security,
    valuationDate: "2026-10-04",
    scenarios: Object.fromEntries(
      ["bear", "base", "bull"].map((k) => [k, structuredClone(scenario)]),
    ),
    methodSuitability: Object.fromEntries(
      ["pe", "peg", "ps", "pb", "dcf", "multistage"].map((k) => [
        k,
        { applicable: true, reason: "test" },
      ]),
    ),
    analysis: REQUIRED_DIMENSIONS.map((dimension) => ({
      dimension,
      conclusion: "test",
      evidence: ["a", "b"],
      sourceIds: ["sec"],
      falsification: "test",
    })),
  });
  const short = make();
  short.analysis.pop();
  assert.throws(() => validateAssumptions(short, snapshot), /缺少维度/);
  const inverted = make();
  inverted.scenarios.bear.eps = 5;
  assert.throws(() => validateAssumptions(inverted, snapshot), /悲观≤基准/);
  const growth = make();
  growth.scenarios.base.dcf.terminalGrowth = 0.095;
  assert.throws(() => validateAssumptions(growth, snapshot), /永续增长/);
});
