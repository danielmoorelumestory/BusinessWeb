/**
 * 交易前检查单与冷静期：把“规则替代冲动”做成防呆。
 * 只管主动买入与偏离再平衡规则的操作；按规则在检查日做的再平衡不需要走这里。
 */

export const COOLING_HOURS = 48;
export const COOLING_MS = COOLING_HOURS * 3600 * 1000;

export const PRE_TRADE_CHECKS = [
  "今天是预定的检查日，不是因为今天的涨跌临时起意",
  "这个标的已在观察池跟踪超过 1 个月",
  "已写下证伪条件，以及下季度要核查的事项",
  "买入后单一标的仍不超过参考总额的 4%~5%",
] as const;

export type TradeKind = "active-buy" | "off-rule";

export const TRADE_KIND_LABELS: Record<TradeKind, string> = {
  "active-buy": "主动买入",
  "off-rule": "偏离规则调仓",
};

export interface PreTradeEntry {
  id: string;
  symbol: string;
  kind: TradeKind;
  /** 想法产生的时间（ISO），冷静期从这里算起 */
  ideaAt: string;
  /** 与 PRE_TRADE_CHECKS 一一对应 */
  checks: boolean[];
  /** 证伪条件（原文记录，便于日后对照） */
  falsify: string;
  /** 提前执行的理由；非空即表示主动跳过了冷静期或检查单 */
  overrideReason: string;
}

export type PreTradeState = "blocked" | "cooling" | "ready" | "overridden";

export interface PreTradeStatus {
  state: PreTradeState;
  /** 未打勾的检查项原文 */
  missing: string[];
  /** 冷静期剩余毫秒，已结束为 0 */
  remainingMs: number;
}

export function emptyChecks(): boolean[] {
  return PRE_TRADE_CHECKS.map(() => false);
}

export function evaluatePreTrade(entry: PreTradeEntry, now: Date): PreTradeStatus {
  const missing = PRE_TRADE_CHECKS.filter((_, i) => !entry.checks[i]);
  if (!entry.falsify.trim() && !missing.includes(PRE_TRADE_CHECKS[2])) {
    // 勾了“已写证伪条件”却没写内容，等于没写
    missing.push(PRE_TRADE_CHECKS[2]);
  }
  const ideaAt = Date.parse(entry.ideaAt);
  const remainingMs = Number.isFinite(ideaAt)
    ? Math.max(0, ideaAt + COOLING_MS - now.getTime())
    : COOLING_MS;

  if (entry.overrideReason.trim()) {
    return { state: "overridden", missing, remainingMs };
  }
  if (missing.length > 0) return { state: "blocked", missing, remainingMs };
  if (remainingMs > 0) return { state: "cooling", missing, remainingMs };
  return { state: "ready", missing, remainingMs };
}

/** "还剩 1 天 3 小时" / "还剩 5 小时" / "不足 1 小时" */
export function formatRemaining(ms: number): string {
  const hours = Math.ceil(ms / 3600000);
  if (ms <= 0) return "冷静期已结束";
  if (hours <= 1) return "还剩不足 1 小时";
  if (hours < 24) return `还剩 ${hours} 小时`;
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  return h === 0 ? `还剩 ${d} 天` : `还剩 ${d} 天 ${h} 小时`;
}
