const object = (properties) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const nullable = { type: ["number", "null"] },
  number = { type: "number" },
  string = { type: "string" },
  strings = { type: "array", items: string };
const security = object({
  market: { type: "string", enum: ["cn", "hk", "us"] },
  code: string,
  name: string,
  quoteCurrency: string,
  exchange: string,
});
const projection = object({
  revenue: number,
  ebitMargin: number,
  taxRate: number,
  da: number,
  capex: number,
  workingCapitalIncrease: number,
});
const dcf = {
  anyOf: [
    { type: "null" },
    object({
      kind: { type: "string", enum: ["fcff", "fcfe"] },
      cashflows: { type: "array", items: number, minItems: 1, maxItems: 15 },
      discountRate: number,
      terminalGrowth: number,
      shares: nullable,
      cash: nullable,
      debt: nullable,
      preferred: nullable,
      minority: nullable,
      nonOperating: nullable,
      nonOperatingDiscount: nullable,
      projections: {
        anyOf: [
          { type: "null" },
          { type: "array", items: projection, minItems: 1, maxItems: 15 },
        ],
      },
      financingNote: string,
    }),
  ],
};
const scenario = object({
  year: { type: "integer" },
  eps: nullable,
  revenue: nullable,
  bvps: nullable,
  shares: nullable,
  growth: nullable,
  pe: nullable,
  peg: nullable,
  ps: nullable,
  pb: nullable,
  requiredReturn: number,
  dcf,
  multistage: dcf,
  rationale: string,
  sourceIds: strings,
});
const methods = ["pe", "peg", "ps", "pb", "dcf", "multistage"];
export const assumptionsSchema = object({
  schemaVersion: { type: "integer", const: 1 },
  security,
  valuationDate: string,
  scenarios: object({ bear: scenario, base: scenario, bull: scenario }),
  methodSuitability: object(
    Object.fromEntries(
      methods.map((m) => [
        m,
        object({ applicable: { type: "boolean" }, reason: string }),
      ]),
    ),
  ),
  analysis: {
    type: "array",
    items: object({
      dimension: string,
      conclusion: string,
      evidence: strings,
      sourceIds: strings,
      falsification: string,
    }),
  },
});
