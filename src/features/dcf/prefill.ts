import type { Currency, Market } from "./types.ts";

/** 公司研究页与 DCF 页之间的链接参数：只带公司身份与当前价，估值假设仍需自己对照财报填写 */
export interface DcfPrefill {
  company: string;
  code: string;
  market: Market;
  currency: Currency;
  currentPrice: number | null;
}

type ResearchMarket = "us" | "cn" | "hk" | "adr" | "ndx";

export function dcfMarketOf(market: ResearchMarket): { market: Market; currency: Currency } {
  if (market === "cn") return { market: "cn", currency: "CNY" };
  if (market === "hk") return { market: "hk", currency: "HKD" };
  return { market: "us", currency: "USD" };
}

export function buildDcfLink(args: {
  company: string;
  code: string;
  researchMarket: ResearchMarket;
  price?: number | null;
}): string {
  const { market, currency } = dcfMarketOf(args.researchMarket);
  const qs = new URLSearchParams({
    company: args.company,
    code: args.code,
    market,
    currency,
  });
  if (args.price != null && Number.isFinite(args.price) && args.price > 0) {
    qs.set("price", String(args.price));
  }
  return `/dcf?${qs.toString()}`;
}

const MARKETS: Market[] = ["cn", "hk", "us", "other"];
const CURRENCIES: Currency[] = ["CNY", "HKD", "USD"];

/** 参数缺失或不合法就忽略，不影响页面正常使用；没有任何可用参数时返回 null */
export function parseDcfPrefill(search: string): DcfPrefill | null {
  const qs = new URLSearchParams(search);
  const company = (qs.get("company") ?? "").trim().slice(0, 60);
  const code = (qs.get("code") ?? "").trim().slice(0, 20);
  if (!company && !code) return null;
  const m = qs.get("market") as Market | null;
  const c = qs.get("currency") as Currency | null;
  const price = Number(qs.get("price"));
  return {
    company,
    code,
    market: m && MARKETS.includes(m) ? m : "cn",
    currency: c && CURRENCIES.includes(c) ? c : "CNY",
    currentPrice: Number.isFinite(price) && price > 0 ? price : null,
  };
}
