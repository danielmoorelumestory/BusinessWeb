export type Market = "cn" | "hk" | "us";
export type Method = "pe" | "peg" | "ps" | "pb" | "dcf" | "multistage";
export type ScenarioKey = "bear" | "base" | "bull";
export type Backend = "pi" | "codex" | "claude" | "opencode";
export interface SecurityIdentity {
  market: Market;
  code: string;
  name: string;
  quoteCurrency: string;
  exchange: string;
  issuerId?: string;
  adrRatio?: number;
}
export interface FinancialFact {
  value: number | null;
  unit: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  basis: "annual" | "quarter" | "ttm" | "estimate" | "spot";
  sourceId: string;
  retrievedAt: string;
  status: "available" | "missing" | "conflict";
}
export interface Source {
  id: string;
  title: string;
  url: string;
}
export interface FinancialSnapshot {
  schemaVersion: 1;
  security: SecurityIdentity;
  asOf: string;
  facts: Record<string, FinancialFact>;
  sources: Source[];
  peers: Array<{
    security: SecurityIdentity;
    facts: Record<string, FinancialFact>;
  }>;
  missing: string[];
}
export interface ModelOption {
  backend: Backend;
  provider: string;
  modelId: string;
  displayName: string;
  version: string | null;
  isDefault: boolean;
  discoverySource: string;
  discoveredAt: string;
  availability: "discovered" | "verified" | "unavailable" | "unknown";
  capabilities: string[];
}
export interface BackendInfo {
  id: Backend;
  installed: boolean;
  cliVersion: string;
  canListModels: boolean;
  error?: string;
}
export interface MethodResult {
  status: "calculated" | "notApplicable" | "missingData" | "invalidInput";
  price: number | null;
  presentPrice?: number | null;
  reason: string;
  enterpriseValue?: number;
  equityValue?: number;
  terminalShare?: number;
  cashflows?: number[];
  nonOperatingEffective?: number;
}
export interface MultipleInput {
  method: "pe" | "peg" | "ps" | "pb";
  metric: number | null;
  multiple: number | null;
  shares?: number | null;
  growth?: number | null;
  years?: number;
  requiredReturn?: number;
}
export interface DcfInput {
  kind: "fcff" | "fcfe";
  cashflows: number[];
  discountRate: number;
  terminalGrowth: number;
  shares: number | null;
  cash?: number | null;
  debt?: number | null;
  preferred?: number | null;
  minority?: number | null;
  nonOperating?: number | null;
  nonOperatingDiscount?: number | null;
  projections?: Array<{
    revenue: number;
    ebitMargin: number;
    taxRate: number;
    da: number;
    capex: number;
    workingCapitalIncrease: number;
  }>;
  financingNote?: string;
}
export interface ScenarioAssumptions {
  year: number;
  eps: number | null;
  revenue: number | null;
  bvps: number | null;
  shares: number | null;
  growth: number | null;
  pe: number | null;
  peg: number | null;
  ps: number | null;
  pb: number | null;
  requiredReturn: number;
  dcf: DcfInput | null;
  multistage: DcfInput | null;
  rationale: string;
  sourceIds: string[];
}
export interface AnalysisItem {
  dimension: string;
  conclusion: string;
  evidence: string[];
  sourceIds: string[];
  falsification: string;
}
export interface ValuationAssumptions {
  schemaVersion: 1;
  security: SecurityIdentity;
  valuationDate: string;
  scenarios: Record<ScenarioKey, ScenarioAssumptions>;
  methodSuitability: Record<Method, { applicable: boolean; reason: string }>;
  analysis: AnalysisItem[];
}
export interface ValuationReport {
  schemaVersion: 1;
  snapshot: FinancialSnapshot;
  assumptions: ValuationAssumptions;
  results: Record<ScenarioKey, Record<Method, MethodResult>>;
  backend: Backend;
  requestedModelId: string;
  resolvedModelId: string | null;
  cliVersion: string;
  createdAt: string;
}
export interface SensitivityCell {
  discountRate: number;
  terminalGrowth: number;
  price: number | null;
}
export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };
export const METHODS: Method[] = ["pe", "peg", "ps", "pb", "dcf", "multistage"];
export const SCENARIOS: ScenarioKey[] = ["bear", "base", "bull"];
export const METHOD_LABELS: Record<Method, string> = {
  pe: "P/E 市盈率",
  peg: "PEG 增长估值",
  ps: "P/S 市销率",
  pb: "P/B 市净率",
  dcf: "DCF 现金流折现",
  multistage: "多阶段 DCF",
};
