import type {
  Currency,
  MoneyUnit,
  ShareUnit,
} from "./types.ts";

// A 股财报常以「万元 / 亿元」披露，港美股常以「百万 / 十亿」披露。
// 表单里按所选单位填写，进计算前统一换成基本单位（元 / 股）。
export const MONEY_FACTOR: Record<MoneyUnit, number> = {
  yuan: 1,
  wan: 1e4,
  yi: 1e8,
};
export const SHARE_FACTOR: Record<ShareUnit, number> = {
  share: 1,
  wan: 1e4,
  yi: 1e8,
};

export function toBaseAmount(value: number | null, unit: MoneyUnit): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value * MONEY_FACTOR[unit];
}
export function toBaseShares(value: number | null, unit: ShareUnit): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value * SHARE_FACTOR[unit];
}

/** 表单字符串 → 数字，空串与非数字一律按「未填」返回 null */
export function parseNumber(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** 百分比字符串 → 百分数（"5" → 5，表示 5%） */
export const pct = (value: number | null): number | null =>
  value == null ? null : value / 100;

export function formatPct(value: number | null, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}
export function formatSignedPct(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

/** 大额金额转成「亿 / 万」便于阅读 */
export function formatMoney(value: number | null, currency: Currency): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const symbol =
    currency === "CNY" ? "¥" : currency === "HKD" ? "HK$" : "$";
  const abs = Math.abs(value);
  if (abs >= 1e8) return `${symbol}${(value / 1e8).toFixed(2)} 亿`;
  if (abs >= 1e4) return `${symbol}${(value / 1e4).toFixed(2)} 万`;
  return `${symbol}${value.toFixed(2)}`;
}
/** 每股价格：量级小，直接按币种符号显示 */
export function formatPrice(value: number | null, currency: Currency): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const symbol =
    currency === "CNY" ? "¥" : currency === "HKD" ? "HK$" : "$";
  return `${symbol}${value.toFixed(2)}`;
}
export function formatShares(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1e8) return `${(value / 1e8).toFixed(2)} 亿股`;
  if (Math.abs(value) >= 1e4) return `${(value / 1e4).toFixed(2)} 万股`;
  return `${value.toFixed(0)} 股`;
}
/** 归一化后的提示，例如输入 12.3（亿元）时显示「= 12.3 亿」 */
export function formatScaleHint(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  if (abs >= 1e8) return `= ${(value / 1e8).toFixed(4)} 亿`;
  if (abs >= 1e4) return `= ${(value / 1e4).toFixed(4)} 万`;
  return `= ${value.toLocaleString("zh-CN")}`;
}
