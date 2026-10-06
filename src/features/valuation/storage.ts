import type { ValuationReport } from "./types.ts";
import { METHODS, SCENARIOS } from "./types.ts";
import { validateSnapshot } from "./validation.ts";
const KEY = "businessweb.valuation.v1";
const finite = (n: unknown) => typeof n === "number" && Number.isFinite(n);
const nullable = (n: unknown) => n === null || finite(n);
const strings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");
function validDcf(d: any): boolean {
  return (
    d === null ||
    (!!d &&
      ["fcff", "fcfe"].includes(d.kind) &&
      Array.isArray(d.cashflows) &&
      d.cashflows.length > 0 &&
      d.cashflows.length <= 15 &&
      d.cashflows.every(finite) &&
      finite(d.discountRate) &&
      finite(d.terminalGrowth) &&
      nullable(d.shares) &&
      ["cash", "debt", "preferred", "minority", "nonOperating"].every(
        (k) => d[k] === undefined || nullable(d[k]),
      ) &&
      (d.nonOperatingDiscount === undefined ||
        nullable(d.nonOperatingDiscount)) &&
      (d.financingNote === undefined || typeof d.financingNote === "string") &&
      (d.projections === undefined ||
        (Array.isArray(d.projections) &&
          d.projections.every(
            (p: any) =>
              p &&
              [
                "revenue",
                "ebitMargin",
                "taxRate",
                "da",
                "capex",
                "workingCapitalIncrease",
              ].every((k) => finite(p[k])),
          ))))
  );
}
export function isReport(value: unknown): value is ValuationReport {
  try {
    const v = value as ValuationReport;
    if (
      !v ||
      v.schemaVersion !== 1 ||
      !validateSnapshot(v.snapshot).ok ||
      !v.assumptions ||
      v.assumptions.schemaVersion !== 1 ||
      !v.results ||
      typeof v.createdAt !== "string" ||
      !Number.isFinite(Date.parse(v.createdAt)) ||
      !["pi", "codex", "claude", "opencode"].includes(v.backend) ||
      typeof v.requestedModelId !== "string" ||
      typeof v.cliVersion !== "string" ||
      !(v.resolvedModelId === null || typeof v.resolvedModelId === "string")
    )
      return false;
    const a = v.assumptions,
      ids = new Set(v.snapshot.sources.map((s) => s.id));
    if (
      a.security.code !== v.snapshot.security.code ||
      a.security.market !== v.snapshot.security.market ||
      a.security.quoteCurrency !== v.snapshot.security.quoteCurrency ||
      a.valuationDate !== v.snapshot.asOf ||
      !Array.isArray(a.analysis) ||
      !a.analysis.every(
        (x) =>
          x &&
          typeof x.dimension === "string" &&
          typeof x.conclusion === "string" &&
          typeof x.falsification === "string" &&
          strings(x.evidence) &&
          strings(x.sourceIds) &&
          x.sourceIds.every((id) => ids.has(id)),
      )
    )
      return false;
    return SCENARIOS.every((k) => {
      const s = a.scenarios?.[k];
      return (
        s &&
        typeof s.rationale === "string" &&
        strings(s.sourceIds) &&
        s.sourceIds.every((id) => ids.has(id)) &&
        Number.isInteger(s.year) &&
        finite(s.requiredReturn) &&
        [
          "eps",
          "revenue",
          "bvps",
          "shares",
          "growth",
          "pe",
          "peg",
          "ps",
          "pb",
        ].every((f) => nullable(s[f as keyof typeof s])) &&
        validDcf(s.dcf) &&
        validDcf(s.multistage) &&
        METHODS.every((m) => {
          const r = v.results[k]?.[m],
            suitability = a.methodSuitability?.[m];
          return (
            r &&
            typeof r.reason === "string" &&
            nullable(r.price) &&
            [
              "calculated",
              "notApplicable",
              "missingData",
              "invalidInput",
            ].includes(r.status) &&
            (r.presentPrice === undefined || nullable(r.presentPrice)) &&
            ["enterpriseValue", "equityValue", "terminalShare", "nonOperatingEffective"].every(
              (f) =>
                r[f as keyof typeof r] === undefined ||
                finite(r[f as keyof typeof r]),
            ) &&
            (r.cashflows === undefined ||
              (Array.isArray(r.cashflows) && r.cashflows.every(finite))) &&
            suitability &&
            typeof suitability.applicable === "boolean" &&
            typeof suitability.reason === "string"
          );
        })
      );
    });
  } catch {
    return false;
  }
}
export function loadReports(): ValuationReport[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(value) ? value.filter(isReport) : [];
  } catch {
    return [];
  }
}
export function saveReport(report: ValuationReport): {
  ok: boolean;
  error?: string;
} {
  try {
    if (!isReport(report)) throw new Error("报告结构无效");
    localStorage.setItem(
      KEY,
      JSON.stringify(
        [
          report,
          ...loadReports().filter((r) => r.createdAt !== report.createdAt),
        ].slice(0, 20),
      ),
    );
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "报告未保存：存储不可用或报告格式无效，仍可导出当前结果",
    };
  }
}
export function importReport(text: string): ValuationReport {
  const value = JSON.parse(text);
  if (!isReport(value)) throw new Error("报告格式或版本不支持");
  return value;
}
export function exportReport(
  report: ValuationReport,
  format: "json" | "markdown",
): string {
  if (format === "json") return JSON.stringify(report, null, 2);
  return [
    `# ${report.snapshot.security.name} 估值报告`,
    `${report.snapshot.security.code} · ${report.snapshot.asOf} · ${report.snapshot.security.quoteCurrency}`,
    `CLI: ${report.backend} ${report.cliVersion}；模型: ${report.requestedModelId}；实际返回: ${report.resolvedModelId || "未提供"}`,
    `## 估值情景`,
    ...SCENARIOS.flatMap((k) => [
      `### ${k}`,
      report.assumptions.scenarios[k].rationale,
      ...METHODS.map(
        (m) =>
          `${m}: ${report.results[k][m].price ?? "不可计算"}；${report.results[k][m].reason}`,
      ),
      ...(["dcf", "multistage"] as const).flatMap((m) => {
        const r = report.results[k][m],
          d = report.assumptions.scenarios[k][m];
        if (r?.nonOperatingEffective == null) return [];
        const pct = (((d?.nonOperatingDiscount ?? 1) as number) * 100).toFixed(0);
        return [
          `${m}股权桥接：非经营资产账面 ${d?.nonOperating ?? "—"}，按 ${pct}% 计入，实际生效 ${r.nonOperatingEffective}`,
        ];
      }),
    ]),
    `## 分析`,
    ...report.assumptions.analysis.map(
      (a) =>
        `${a.dimension}: ${a.conclusion}\n依据：${a.evidence.join("；")}\n证伪：${a.falsification}`,
    ),
    `## 数据缺口`,
    ...report.snapshot.missing,
    `## 来源`,
    ...report.snapshot.sources.map((s) => `- ${s.title}: ${s.url}`),
    `## 完整假设`,
    `\`\`\`json`,
    JSON.stringify(report.assumptions, null, 2),
    `\`\`\``,
  ].join("\n\n");
}
