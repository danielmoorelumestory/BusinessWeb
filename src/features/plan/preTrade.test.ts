import { describe, expect, it } from "vitest";
import {
  COOLING_MS,
  PRE_TRADE_CHECKS,
  evaluatePreTrade,
  formatRemaining,
  type PreTradeEntry,
} from "./preTrade";

const T0 = new Date("2026-10-05T08:00:00Z");
const entry = (over: Partial<PreTradeEntry> = {}): PreTradeEntry => ({
  id: "1",
  symbol: "腾讯控股",
  kind: "active-buy",
  ideaAt: T0.toISOString(),
  checks: PRE_TRADE_CHECKS.map(() => true),
  falsify: "云业务毛利率连续两季下滑",
  overrideReason: "",
  ...over,
});
const after = (ms: number) => new Date(T0.getTime() + ms);

describe("evaluatePreTrade", () => {
  it("检查单没勾全：blocked，并列出缺的项", () => {
    const s = evaluatePreTrade(entry({ checks: [true, false, true, false] }), after(COOLING_MS * 2));
    expect(s.state).toBe("blocked");
    expect(s.missing).toEqual([PRE_TRADE_CHECKS[1], PRE_TRADE_CHECKS[3]]);
  });

  it("勾了证伪条件但没写内容，视为没写", () => {
    const s = evaluatePreTrade(entry({ falsify: "  " }), after(COOLING_MS));
    expect(s.state).toBe("blocked");
    expect(s.missing).toEqual([PRE_TRADE_CHECKS[2]]);
  });

  it("勾全但不满 48 小时：cooling，剩余时间随时间递减", () => {
    const s = evaluatePreTrade(entry(), after(COOLING_MS - 5 * 3600000));
    expect(s.state).toBe("cooling");
    expect(s.remainingMs).toBe(5 * 3600000);
  });

  it("勾全且满 48 小时：ready", () => {
    expect(evaluatePreTrade(entry(), after(COOLING_MS)).state).toBe("ready");
    expect(evaluatePreTrade(entry(), after(COOLING_MS + 1)).remainingMs).toBe(0);
  });

  it("写了提前执行理由：overridden，仍保留缺项信息", () => {
    const s = evaluatePreTrade(entry({ checks: [true, true, true, false], overrideReason: "财报后跳空" }), after(1000));
    expect(s.state).toBe("overridden");
    expect(s.missing).toEqual([PRE_TRADE_CHECKS[3]]);
  });

  it("想法时间无效时按冷静期未开始处理", () => {
    expect(evaluatePreTrade(entry({ ideaAt: "bad" }), T0).remainingMs).toBe(COOLING_MS);
  });
});

describe("formatRemaining", () => {
  it("按天/小时展示", () => {
    expect(formatRemaining(0)).toBe("冷静期已结束");
    expect(formatRemaining(30 * 60000)).toBe("还剩不足 1 小时");
    expect(formatRemaining(5 * 3600000)).toBe("还剩 5 小时");
    expect(formatRemaining(48 * 3600000)).toBe("还剩 2 天");
    expect(formatRemaining(27 * 3600000)).toBe("还剩 1 天 3 小时");
  });
});
