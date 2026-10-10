import type {
  DcfSheetInput,
  DcfStatus,
  MultipleBand,
} from "./types.ts";
import { toBaseAmount, toBaseShares } from "./units.ts";

/** 原表 E8/F8/G8 的三档 EBITDA 倍数：Low 5×、Mid 8.5×、High 12× */
export const EBITDA_BANDS: Array<{ label: string; multiple: number }> = [
  { label: "Low", multiple: 5 },
  { label: "Mid", multiple: 8.5 },
  { label: "High", multiple: 12 },
];

/**
 * EBITDA 倍数法：隐含每股价格 = EBITDA × 倍数 ÷ 流通股数。
 * 金融股与亏损公司没有可用的 EBITDA，整块标为不适用，不参与买卖结论。
 */
export function calculateMultiples(
  input: Pick<DcfSheetInput, "ebitda" | "shares" | "moneyUnit" | "shareUnit">,
  bands = EBITDA_BANDS,
): MultipleBand[] {
  const shares = toBaseShares(input.shares, input.shareUnit);
  const ebitda = toBaseAmount(input.ebitda, input.moneyUnit);

  const reasonOf = (status: DcfStatus, reason: string) =>
    bands.map(({ label, multiple }) => ({
      label,
      multiple,
      price: null,
      status,
      reason,
    }));

  if (shares == null || shares <= 0)
    return reasonOf("invalidInput", "流通股数必须为正");
  if (ebitda == null)
    return reasonOf("missingData", "未填写 EBITDA");
  if (ebitda <= 0)
    return reasonOf(
      "notApplicable",
      "EBITDA 为负或为零（金融股、亏损公司），倍数估值不适用",
    );

  return bands.map(({ label, multiple }) => {
    const price = (ebitda * multiple) / shares;
    return {
      label,
      multiple,
      price: Number.isFinite(price) ? price : null,
      status: Number.isFinite(price) ? "calculated" : "invalidInput",
      reason: Number.isFinite(price)
        ? `${multiple}× EBITDA`
        : "计算溢出，请检查金额与股本单位",
    };
  });
}
