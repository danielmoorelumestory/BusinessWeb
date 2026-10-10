import { calculateSheetDcf } from "./engine.ts";
import type { DcfSheetInput } from "./types.ts";

/** 折现率每格步长（百分点）与永续增长率每格步长（百分点），以当前输入为中心各取 ±2 格 */
export const DISCOUNT_STEP = 1;
export const GROWTH_STEP = 0.5;
const HALF = 2;

export interface SensitivityCell {
  discountRate: number;
  perpetualGrowth: number;
  price: number | null;
  /** 相对当前股价的安全边际；缺少现价或该格不可算时为 null */
  mos: number | null;
}

export interface SensitivityMatrix {
  /** 行：折现率（%），自小到大 */
  discountRates: number[];
  /** 列：永续增长率（%），自小到大 */
  perpetualGrowths: number[];
  /** cells[行][列]，与上面两个数组一一对应 */
  cells: SensitivityCell[][];
  /** 可算格子里的最低/最高合理价，全部不可算时为 null */
  minPrice: number | null;
  maxPrice: number | null;
  /** 可算格子中安全边际为正的比例（0~1），无现价时为 null */
  positiveShare: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * WACC × 永续增长率 5×5 敏感性矩阵：其余假设不变，只改折现率与永续增长率。
 * 中心格与 calculateSheetDcf 的结果一致；r ≤ gp 的格子不可算，价格为 null。
 * 当前输入缺数据或不适用时返回 null。
 */
export function calculateSensitivity(
  input: DcfSheetInput,
): SensitivityMatrix | null {
  const centerR = input.discountRate;
  const centerG = input.perpetualGrowth;
  if (centerR == null || centerG == null) return null;
  if (calculateSheetDcf(input).status !== "calculated") return null;

  const offsets = Array.from({ length: 2 * HALF + 1 }, (_, i) => i - HALF);
  const discountRates = offsets.map((k) => round2(centerR + k * DISCOUNT_STEP));
  const perpetualGrowths = offsets.map((k) => round2(centerG + k * GROWTH_STEP));

  const cells = discountRates.map((r) =>
    perpetualGrowths.map((gp): SensitivityCell => {
      const res = calculateSheetDcf({
        ...input,
        discountRate: r,
        perpetualGrowth: gp,
      });
      const ok = res.status === "calculated";
      return {
        discountRate: r,
        perpetualGrowth: gp,
        price: ok ? res.price : null,
        mos: ok ? res.mos : null,
      };
    }),
  );

  const flat = cells.flat();
  const prices = flat.map((c) => c.price).filter((p): p is number => p != null);
  const mosList = flat.map((c) => c.mos).filter((m): m is number => m != null);
  return {
    discountRates,
    perpetualGrowths,
    cells,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    positiveShare: mosList.length
      ? mosList.filter((m) => m > 0).length / mosList.length
      : null,
  };
}
