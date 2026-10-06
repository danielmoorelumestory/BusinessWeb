import { assumptionsSchema } from "./schema.mjs";
function check(value, schema, path = "root") {
  if (schema.anyOf) {
    if (
      !schema.anyOf.some((s) => {
        try {
          check(value, s, path);
          return true;
        } catch {
          return false;
        }
      })
    )
      throw new Error(path + ": 结构无效");
    return;
  }
  const types = Array.isArray(schema.type) ? schema.type : [schema.type],
    type =
      value === null
        ? "null"
        : Array.isArray(value)
          ? "array"
          : typeof value === "number" && Number.isInteger(value)
            ? "integer"
            : typeof value;
  if (
    !types.includes(type) &&
    !(type === "integer" && types.includes("number"))
  )
    throw new Error(path + ": 结构类型无效");
  if (typeof value === "number" && !Number.isFinite(value))
    throw new Error(path + ": 非有限数值");
  if (
    (schema.enum && !schema.enum.includes(value)) ||
    (schema.const !== undefined && value !== schema.const)
  )
    throw new Error(path + ": 值无效");
  if (type === "object") {
    for (const key of schema.required || [])
      if (!(key in value)) throw new Error(path + "." + key + ": 结构字段缺失");
    for (const key of Object.keys(value))
      if (schema.properties[key])
        check(value[key], schema.properties[key], path + "." + key);
      else if (schema.additionalProperties === false)
        throw new Error(path + ": 未知字段");
  }
  if (type === "array") {
    if (
      (schema.minItems && value.length < schema.minItems) ||
      (schema.maxItems && value.length > schema.maxItems)
    )
      throw new Error(path + ": 数组长度无效");
    value.forEach((v, i) => check(v, schema.items, path + "." + i));
  }
}
export const REQUIRED_DIMENSIONS = [
  "变异认知",
  "业务与利润结构",
  "增长来源与可持续性",
  "盈利与现金流质量",
  "资产负债与资本配置",
  "护城河与行业位置",
  "估值方法选择",
  "多空交锋",
  "风险与证伪",
  "数据缺口与口径",
];
// 程序化合理性检查：拦截模型给出的自相矛盾或明显失真的假设
function sanityCheck(scenarios) {
  const { bear, base, bull } = scenarios;
  for (const key of ["eps", "revenue"]) {
    const [a, b, c] = [bear[key], base[key], bull[key]];
    if ([a, b, c].every(Number.isFinite) && !(a <= b && b <= c))
      throw new Error(`三情景${key}必须满足悲观≤基准≤乐观`);
  }
  for (const [name, s] of Object.entries(scenarios)) {
    if (!(s.requiredReturn >= 0.03 && s.requiredReturn <= 0.3))
      throw new Error(`${name}情景要求回报率应在3%–30%`);
    for (const key of ["pe", "peg", "ps", "pb"])
      if (s[key] != null && s[key] <= 0)
        throw new Error(`${name}情景${key}必须为正数，无法成立请设null`);
    if (s.growth != null && (s.growth < -0.9 || s.growth > 3))
      throw new Error(`${name}情景growth须为小数且在-90%到300%之间`);
    for (const d of [s.dcf, s.multistage]) {
      if (!d) continue;
      if (!(d.discountRate >= 0.03 && d.discountRate <= 0.3))
        throw new Error(`${name}情景折现率应在3%–30%`);
      if (d.terminalGrowth > 0.05 || d.terminalGrowth < -0.05)
        throw new Error(`${name}情景永续增长率应在-5%–5%`);
      if (d.terminalGrowth >= d.discountRate - 0.01)
        throw new Error(`${name}情景永续增长率必须明显低于折现率`);
      if (
        d.nonOperatingDiscount != null &&
        !(d.nonOperatingDiscount >= 0 && d.nonOperatingDiscount <= 1)
      )
        throw new Error(`${name}情景非经营资产计入系数须在0到1之间，缺省为1`);
    }
  }
  const [bd, sd, ud] = [bear, base, bull].map((s) => s.dcf?.discountRate);
  if ([bd, sd, ud].every(Number.isFinite) && !(bd >= sd && sd >= ud))
    throw new Error("DCF折现率应满足悲观≥基准≥乐观");
}
export function validateAssumptions(value, snapshot) {
  if (
    value?.security?.code !== snapshot.security.code ||
    value?.security?.market !== snapshot.security.market ||
    value?.security?.quoteCurrency !== snapshot.security.quoteCurrency
  )
    throw new Error("估值证券或币种不匹配");
  check(value, assumptionsSchema);
  if (value.valuationDate !== snapshot.asOf) throw new Error("估值日期不匹配");
  const ids = new Set(snapshot.sources.map((s) => s.id)),
    years = [];
  for (const s of Object.values(value.scenarios)) {
    years.push(s.year);
    if (
      s.year < Number(snapshot.asOf.slice(0, 4)) ||
      s.year > Number(snapshot.asOf.slice(0, 4)) + 15
    )
      throw new Error("预测年份无效");
    if (s.sourceIds.some((id) => !ids.has(id)))
      throw new Error("假设引用未知来源");
    for (const d of [s.dcf, s.multistage])
      if (d) {
        if (d.projections === null) delete d.projections;
        if (d.kind === "fcff") {
          // Historical bridge amounts are facts, never model assumptions.
          for (const key of [
            "cash",
            "debt",
            "preferred",
            "minority",
            "nonOperating",
          ]) {
            const fact = snapshot.facts?.[key];
            const fx =
              fact?.currency &&
              fact.currency !== snapshot.security.quoteCurrency
                ? snapshot.facts?.["fx_" + fact.currency]?.value
                : 1;
            d[key] =
              fact?.status === "available" &&
              Number.isFinite(fact.value) &&
              Number.isFinite(fx)
                ? fact.value * fx
                : null;
          }
        }
      }
  }
  sanityCheck(value.scenarios);
  if (new Set(years).size !== 1) throw new Error("三情景预测年份必须一致");
  const covered = new Set(value.analysis.map((i) => i.dimension));
  const missing = REQUIRED_DIMENSIONS.filter((d) => !covered.has(d));
  if (missing.length) throw new Error("分析缺少维度：" + missing.join("、"));
  for (const item of value.analysis)
    if (!item.conclusion.trim() || !item.falsification.trim())
      throw new Error("分析维度“" + item.dimension + "”缺少结论或证伪条件");
  for (const item of value.analysis)
    if (item.sourceIds.some((id) => !ids.has(id)))
      throw new Error("分析引用未知来源");
  return value;
}
