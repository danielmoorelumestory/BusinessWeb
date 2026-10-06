import { useState } from "react";
import {
  METHODS,
  SCENARIOS,
  METHOD_LABELS,
  calculateReport,
  calculateSensitivity,
  exportReport,
  saveReport,
} from "../../features/valuation";
import type {
  ValuationReport,
  ScenarioKey,
  ScenarioAssumptions,
} from "../../features/valuation";
const scenarioNames = { bear: "悲观", base: "基准", bull: "乐观" };
const fmt = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
export default function Results({
  report,
  onChange,
}: {
  report: ValuationReport;
  onChange: (report: ValuationReport) => void;
}) {
  const [scenario, setScenario] = useState<ScenarioKey>("base"),
    [notice, setNotice] = useState(""),
    [adjusted, setAdjusted] = useState(false);
  const current = report.assumptions.scenarios[scenario],
    price = report.snapshot.facts.price?.value;
  function edit(key: keyof ScenarioAssumptions, value: string) {
    const assumptions = structuredClone(report.assumptions);
    const entry = assumptions.scenarios[scenario];
    const n = value === "" ? null : Number(value);
    if (n !== null && !Number.isFinite(n)) return;
    (entry as unknown as Record<string, unknown>)[key] = n;
    onChange(calculateReport(report.snapshot, assumptions, report));
    setAdjusted(true);
  }
  function download(format: "json" | "markdown") {
    const blob = new Blob([exportReport(report, format)], {
        type: format === "json" ? "application/json" : "text/markdown",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `${report.snapshot.security.code}-valuation.${format === "json" ? "json" : "md"}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="valuation-results">
      <section className="valuation-card">
        <div className="valuation-section-head">
          <div>
            <span className="valuation-eyebrow">VALUATION RESULTS</span>
            <h2>
              {report.snapshot.security.name}{" "}
              <small>{report.snapshot.security.code}</small>
            </h2>
            <p>
              {report.snapshot.asOf} · {report.snapshot.security.quoteCurrency}{" "}
              · 现价 {fmt(price)} · {report.backend} / {report.requestedModelId}
              {adjusted ? " · 用户调整" : ""}
            </p>
          </div>
          <div className="valuation-actions">
            <button
              onClick={() => {
                const r = saveReport(report);
                setNotice(
                  r.ok ? "报告已保存到本机浏览器" : r.error || "保存失败",
                );
              }}
            >
              保存报告
            </button>
            <button onClick={() => download("json")}>导出 JSON</button>
            <button onClick={() => download("markdown")}>导出 Markdown</button>
          </div>
        </div>
        {notice && <p role="status">{notice}</p>}
        <div className="valuation-table-wrap">
          <table>
            <thead>
              <tr>
                <th>估值方法</th>
                {SCENARIOS.map((k) => (
                  <th key={k}>
                    {scenarioNames[k]} · {report.assumptions.scenarios[k].year}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METHODS.map((m) => (
                <tr key={m}>
                  <th>
                    {METHOD_LABELS[m]}
                    <label>
                      <input
                        type="checkbox"
                        aria-label={METHOD_LABELS[m] + "适用"}
                        checked={
                          report.assumptions.methodSuitability[m].applicable
                        }
                        onChange={(e) => {
                          const assumptions = structuredClone(
                            report.assumptions,
                          );
                          assumptions.methodSuitability[m] = {
                            applicable: e.target.checked,
                            reason:
                              "用户调整适用性；原判断：" +
                              report.assumptions.methodSuitability[
                                m
                              ].reason.replace(/^用户调整适用性；原判断：/, ""),
                          };
                          onChange(
                            calculateReport(
                              report.snapshot,
                              assumptions,
                              report,
                            ),
                          );
                          setAdjusted(true);
                        }}
                      />
                      参与计算
                    </label>
                    <small>
                      {report.assumptions.methodSuitability[m].reason}
                    </small>
                  </th>
                  {SCENARIOS.map((k) => {
                    const r = report.results[k][m];
                    return (
                      <td key={k}>
                        <strong>
                          {r.price === null ? "不可计算" : fmt(r.price)}
                        </strong>
                        {r.price !== null && price != null && price > 0 && (
                          <span>
                            {((r.price / price - 1) * 100).toFixed(1)}% 相对现价
                          </span>
                        )}
                        {r.presentPrice != null && (
                          <span>折现至今日 {fmt(r.presentPrice)}</span>
                        )}
                        <small>{r.reason}</small>
                        {r.terminalShare != null && (
                          <small>
                            终值占比 {(r.terminalShare * 100).toFixed(1)}%
                          </small>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="valuation-muted">
          乘数法显示指定年度预测价格；DCF
          显示估值基准日价值。各方法分别判断，不自动平均。
        </p>
      </section>
      <section className="valuation-card">
        <div className="valuation-section-head">
          <h2>假设与敏感性</h2>
          <select
            aria-label="编辑情景"
            value={scenario}
            onChange={(e) => setScenario(e.target.value as ScenarioKey)}
          >
            {SCENARIOS.map((k) => (
              <option key={k} value={k}>
                {scenarioNames[k]}
              </option>
            ))}
          </select>
        </div>
        <p>{current.rationale}</p>
        <div className="valuation-param-grid">
          {(
            [
              ["eps", "预测 EPS"],
              ["revenue", "预测营收"],
              ["bvps", "预测每股净资产"],
              ["shares", "预测股本"],
              ["growth", "盈利增长率（小数）"],
              ["pe", "目标 P/E"],
              ["peg", "目标 PEG"],
              ["ps", "目标 P/S"],
              ["pb", "目标 P/B"],
              ["requiredReturn", "要求回报率（小数）"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                step="any"
                value={current[key] ?? ""}
                onChange={(e) => edit(key, e.target.value)}
              />
            </label>
          ))}
        </div>
        {(["dcf", "multistage"] as const).map((method) => {
          const d = current[method];
          if (!d) return null;
          return (
            <details key={method}>
              <summary>{METHOD_LABELS[method]} · 折现率与永续增长率</summary>
              <div className="valuation-param-grid">
                {(
                  [
                    "discountRate",
                    "terminalGrowth",
                    "cash",
                    "debt",
                    "shares",
                    "preferred",
                    "minority",
                    "nonOperating",
                    "nonOperatingDiscount",
                  ] as const
                ).map((key) => (
                  <label key={key}>
                    {
                      {
                        discountRate: "折现率（小数）",
                        terminalGrowth: "永续增长率（小数）",
                        cash: "现金",
                        debt: "有息债务",
                        shares: "稀释股本",
                        preferred: "优先股",
                        minority: "少数权益",
                        nonOperating: "非经营资产",
                        nonOperatingDiscount: "非经营资产计入系数（0–1，缺省1）",
                      }[key]
                    }
                    <input
                      type="number"
                      step="any"
                      value={d[key] ?? ""}
                      onChange={(e) => {
                        const assumptions = structuredClone(report.assumptions),
                          target = assumptions.scenarios[scenario][method]!;
                        const value =
                          e.target.value === "" ? null : Number(e.target.value);
                        (target as unknown as Record<string, unknown>)[key] =
                          value;
                        onChange(
                          calculateReport(report.snapshot, assumptions, report),
                        );
                        setAdjusted(true);
                      }}
                    />
                  </label>
                ))}
              </div>
              {d.kind === "fcff" &&
                d.nonOperatingDiscount != null &&
                d.nonOperatingDiscount !== 1 && (
                  <p className="valuation-muted">
                    非经营资产按 {(d.nonOperatingDiscount * 100).toFixed(0)}%
                    计入：账面 {fmt(d.nonOperating)} → 实际生效{" "}
                    {fmt(
                      d.nonOperating != null
                        ? d.nonOperating * d.nonOperatingDiscount
                        : null,
                    )}
                  </p>
                )}
              <p>{d.financingNote}</p>
              <div className="valuation-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>折现率</th>
                      <th>永续增长率</th>
                      <th>每股价值</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculateSensitivity(d).map((cell, i) => (
                      <tr key={i}>
                        <td>{(cell.discountRate * 100).toFixed(1)}%</td>
                        <td>{(cell.terminalGrowth * 100).toFixed(1)}%</td>
                        <td>{fmt(cell.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <details>
                <summary>逐年现金流及建模路径</summary>
                <pre>{JSON.stringify(d, null, 2)}</pre>
              </details>
            </details>
          );
        })}
      </section>
      <section className="valuation-card">
        <h2>多维度分析</h2>
        <div className="valuation-analysis-grid">
          {report.assumptions.analysis.map((a, i) => (
            <article key={i}>
              <h3>{a.dimension}</h3>
              <p>{a.conclusion}</p>
              <small>{a.evidence.join("；")}</small>
              <p className="valuation-muted">证伪条件：{a.falsification}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="valuation-card">
        <h2>数据、口径与来源</h2>
        {report.snapshot.missing.length > 0 && (
          <div className="valuation-warning">
            数据缺口：{report.snapshot.missing.join("；")}
          </div>
        )}
        <div className="valuation-table-wrap">
          <table>
            <thead>
              <tr>
                <th>字段</th>
                <th>值 / 单位</th>
                <th>币种</th>
                <th>期间 / 口径</th>
                <th>来源</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(report.snapshot.facts).map(([key, f]) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>
                    {fmt(f.value)} / {f.unit}
                  </td>
                  <td>{f.currency || "—"}</td>
                  <td>
                    {f.periodEnd} / {f.basis}
                    {(f as { note?: string }).note && (
                      <div className="valuation-muted">
                        {(f as { note?: string }).note}
                      </div>
                    )}
                  </td>
                  <td>{f.sourceId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul>
          {report.snapshot.sources.map((s) => (
            <li key={s.id}>
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.id} · {s.title}
                </a>
              ) : (
                <span>
                  {s.id} · {s.title}
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="valuation-muted">
          实际模型：{report.resolvedModelId || "CLI未返回具体版本"} · CLI版本：
          {report.cliVersion}。未来参数属于研究假设。
        </p>
      </section>
    </div>
  );
}
