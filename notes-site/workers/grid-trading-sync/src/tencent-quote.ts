export type PremiumRow = {
  code: string;
  date: string;
  premiumRate: number;
  referenceNav?: number;
  price: number;
};

export const symbolOf = (code: string) => (/^[569]/.test(code.trim()) ? 'sh' : 'sz');

export function parseTencentQuoteBody(bytes: ArrayBuffer): PremiumRow[] {
  const text = new TextDecoder('gbk').decode(bytes);
  const rows: PremiumRow[] = [];
  for (const match of text.matchAll(/v_(?:sh|sz)(\d{6})="([^"]*)"/g)) {
    const fields = match[2].split('~');
    const stamp = fields[30] ?? '';
    if (!/^\d{14}$/.test(stamp) || fields[61]?.trim() !== 'ETF' || !fields[77]?.trim() || !Number.isFinite(Number(fields[77])) || !(Number(fields[78]) > 0)) continue;
    rows.push({
      code: match[1],
      date: stamp.slice(0, 8),
      premiumRate: Number(fields[77]),
      referenceNav: Number(fields[78]),
      price: Number(fields[3]),
    });
  }
  return rows;
}
