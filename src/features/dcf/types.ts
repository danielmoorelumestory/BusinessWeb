// 现金流折现估值模型（含 WACC）
// 口径来自原 Google Sheets 表：五年现金流折现 + 终值 + 股权桥接 + 安全边际，
// 外加 WACC（CAPM）与 EBITDA 倍数三条隐含价格。
export type Currency = "CNY" | "HKD" | "USD";
export type MoneyUnit = "yuan" | "wan" | "yi";
export type ShareUnit = "share" | "wan" | "yi";
export type Market = "cn" | "hk" | "us" | "other";

/** 与原表一致的四种结果状态，沿用既有估值模块的风格 */
export type DcfStatus =
  | "calculated"
  | "notApplicable"
  | "missingData"
  | "invalidInput";

/**
 * WACC 输入块（原表 C30:C37）。
 * 金额字段按 moneyUnit 填写，比率字段按百分数填写（5 表示 5%）。
 * debt 同时用于估值桥接（C19）和资本结构（C32）。
 */
export interface WaccBlock {
  marketCap: number | null;
  beta: number | null;
  debt: number | null;
  interestExpense: number | null;
  pretaxIncome: number | null;
  taxPaid: number | null;
  riskFreeRate: number | null;
  marketReturn: number | null;
}

/** 一次估值需要的全部输入。金额按 moneyUnit、股本按 shareUnit 填写 */
export interface DcfSheetInput extends WaccBlock {
  company: string;
  code: string;
  market: Market;
  currency: Currency;
  moneyUnit: MoneyUnit;
  shareUnit: ShareUnit;
  /** 基年（原表 C10，仅用于展示现金流表头） */
  baseYear: number;
  /** 起始自由现金流（C11，基年，不折现） */
  baseFcf: number | null;
  /** 未来五年成长率（C4），百分数 */
  growth: number | null;
  /** 永续增长率（C5），百分数 */
  perpetualGrowth: number | null;
  /** 期望折现率（C7），百分数 */
  discountRate: number | null;
  /** 现金及其他投资（C18） */
  cash: number | null;
  /** 流通股数（C21） */
  shares: number | null;
  /** 当前股价（C23），每股价格，不随金额单位换算 */
  currentPrice: number | null;
  /** EBITDA（E4），用于倍数估值 */
  ebitda: number | null;
}

export interface DcfSheetResult {
  status: DcfStatus;
  price: number | null;
  reason: string;
  /** 企业价值 EV（C17） */
  enterpriseValue?: number;
  /** 终值（H12），未折现 */
  terminalValue?: number;
  /** 折现后终值占 EV 的比重 */
  terminalShare?: number;
  /** 股权价值（C20） */
  equityValue?: number;
  /** 五年预测现金流（D11:H11） */
  cashflows: number[];
  /** 安全边际（C24） */
  mos: number | null;
  verdict: "BUY" | "SELL" | null;
  /** 降级说明：哪些输入缺失、按什么假设兜底 */
  warnings: string[];
}

export interface WaccResult {
  status: DcfStatus;
  /** 百分数 */
  wacc: number | null;
  reason: string;
  debtWeight: number | null;
  equityWeight: number | null;
  costOfDebt: number | null;
  costOfEquity: number | null;
  taxRate: number | null;
  /** 子项降级说明 */
  notes: string[];
}

export interface MultipleBand {
  label: string;
  multiple: number;
  price: number | null;
  status: DcfStatus;
  reason: string;
}

export interface DcfRecord {
  schemaVersion: 1;
  /** 公司唯一键：按此覆盖旧记录 */
  key: string;
  company: string;
  code: string;
  market: Market;
  savedAt: string;
  input: DcfSheetInput;
  result: DcfSheetResult;
  wacc: WaccResult;
  multiples: MultipleBand[];
}

export const MARKET_LABELS: Record<Market, string> = {
  cn: "A 股",
  hk: "港股",
  us: "美股",
  other: "其他",
};
export const CURRENCY_LABELS: Record<Currency, string> = {
  CNY: "人民币 CNY",
  HKD: "港币 HKD",
  USD: "美元 USD",
};
export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  CNY: "¥",
  HKD: "HK$",
  USD: "$",
};
export const MONEY_UNIT_LABELS: Record<MoneyUnit, string> = {
  yuan: "元",
  wan: "万元",
  yi: "亿元",
};
export const SHARE_UNIT_LABELS: Record<ShareUnit, string> = {
  share: "股",
  wan: "万股",
  yi: "亿股",
};
export const STATUS_LABELS: Record<DcfStatus, string> = {
  calculated: "已计算",
  notApplicable: "不适用",
  missingData: "缺数据",
  invalidInput: "输入无效",
};
