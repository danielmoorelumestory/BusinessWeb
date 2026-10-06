import { it, expect } from "vitest";
import { calculateDcf, calculateSensitivity } from "./dcf";
import type { DcfInput } from "../types.ts";
it("discounts terminal value and bridges enterprise to ordinary equity", () => {
  const r = calculateDcf({
    kind: "fcff",
    cashflows: [110],
    discountRate: 0.1,
    terminalGrowth: 0,
    shares: 100,
    cash: 50,
    debt: 150,
    preferred: 0,
    minority: 0,
    nonOperating: 0,
  });
  expect(r.enterpriseValue).toBeCloseTo(1100);
  expect(r.price).toBeCloseTo(10);
});
it("does not deduct debt twice from FCFE and rejects invalid terminal assumptions", () => {
  expect(
    calculateDcf({
      kind: "fcfe",
      cashflows: [110],
      discountRate: 0.1,
      terminalGrowth: 0,
      shares: 100,
      debt: 150,
    }).price,
  ).toBeCloseTo(11);
  expect(
    calculateDcf({
      kind: "fcfe",
      cashflows: [110],
      discountRate: 0.02,
      terminalGrowth: 0.02,
      shares: 100,
    }).status,
  ).toBe("invalidInput");
  expect(
    calculateDcf({
      kind: "fcff",
      cashflows: [110],
      discountRate: 0.1,
      terminalGrowth: 0,
      shares: 100,
    }).status,
  ).toBe("missingData");
});
it("applies scenario-level discount to non-operating assets in the FCFF bridge", () => {
  const base: DcfInput = {
    kind: "fcff",
    cashflows: [110],
    discountRate: 0.1,
    terminalGrowth: 0,
    shares: 100,
    cash: 50,
    debt: 150,
    preferred: 0,
    minority: 0,
    nonOperating: 100,
  };
  const full = calculateDcf(base);
  expect(full.price).toBeCloseTo(11);
  expect(full.nonOperatingEffective).toBe(100);
  expect(full.reason).not.toContain("非经营资产按");
  const discounted = calculateDcf({ ...base, nonOperatingDiscount: 0.7 });
  expect(discounted.price).toBeCloseTo(10.7);
  expect(discounted.nonOperatingEffective).toBeCloseTo(70);
  expect(discounted.reason).toContain("非经营资产按70%计入");
});
it("rejects out-of-range non-operating discount coefficients", () => {
  const base: DcfInput = {
    kind: "fcff",
    cashflows: [110],
    discountRate: 0.1,
    terminalGrowth: 0,
    shares: 100,
    cash: 50,
    debt: 150,
    preferred: 0,
    minority: 0,
    nonOperating: 100,
  };
  for (const nonOperatingDiscount of [-0.1, 1.5, Number.NaN])
    expect(calculateDcf({ ...base, nonOperatingDiscount }).status).toBe(
      "invalidInput",
    );
});
it("returns empty cells for invalid sensitivity combinations", () => {
  const cells = calculateSensitivity({
    kind: "fcfe",
    cashflows: [110],
    discountRate: 0.02,
    terminalGrowth: 0.02,
    shares: 100,
  });
  expect(cells.some((c) => c.price === null)).toBe(true);
});
