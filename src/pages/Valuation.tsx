import { useEffect, useRef, useState } from "react";
import { PageTitle } from "../components/ui/PageTabs";
import { useSearchParams } from "react-router-dom";
import {
  BarChart3,
  Search,
  RefreshCw,
  Play,
  Square,
  Server,
} from "lucide-react";
import {
  connectValuation,
  fetchBackends,
  fetchModels,
  searchCompanies,
  startValuation,
  subscribeValuation,
  cancelValuation,
  getValuation,
  hostedPage,
} from "../services/valuationApi";
import {
  loadReports,
  METHODS,
  METHOD_LABELS,
  importReport,
  validateSnapshot,
} from "../features/valuation";
import type {
  Backend,
  BackendInfo,
  ModelOption,
  SecurityIdentity,
  ValuationReport,
  FinancialSnapshot,
} from "../features/valuation";
import Results from "../components/valuation/Results";
import {
  STEPS,
  clearLast,
  clearRunning,
  elapsedText,
  loadLast,
  loadRunning,
  saveLast,
  saveRunning,
  stepOf,
} from "../features/valuation/session";
import "../components/valuation/valuation.css";
function preference(backend?: Backend): string {
  try {
    return (
      localStorage.getItem(
        backend ? "valuation-model-" + backend : "valuation-backend",
      ) || ""
    );
  } catch {
    return "";
  }
}
function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Preferences are optional. */
  }
}
export default function Valuation() {
  // 回到页面时：先恢复上一次的结果，正在运行的任务连接服务后再接上
  const [restored] = useState(() => ({ last: loadLast(), running: loadRunning() }));
  const [params] = useSearchParams(),
    [query, setQuery] = useState(
      params.get("code")
        ? (params.get("market") ? params.get("market") + ":" : "") +
            params.get("code")
        : restored.running?.security?.code ||
            restored.last?.snapshot.security.code ||
            "",
    ),
    [connected, setConnected] = useState(false),
    [backends, setBackends] = useState<BackendInfo[]>([]),
    [backend, setBackend] = useState<Backend>("codex"),
    [models, setModels] = useState<ModelOption[]>([]),
    [model, setModel] = useState("default"),
    [manual, setManual] = useState(""),
    [candidates, setCandidates] = useState<SecurityIdentity[]>([]),
    [security, setSecurity] = useState<SecurityIdentity | null>(
      restored.running?.security || restored.last?.snapshot.security || null,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(!!restored.running),
    [status, setStatus] = useState(restored.running ? "正在恢复任务进度…" : ""),
    [stage, setStage] = useState<string>(""),
    [startedAt, setStartedAt] = useState<number | null>(
      restored.running?.startedAt ?? null,
    ),
    [now, setNow] = useState(() => Date.now()),
    [activity, setActivity] = useState<{ chars: number; preview: string } | null>(null),
    [runLog, setRunLog] = useState<{ at: string; text: string }[]>([]),
    [job, setJob] = useState<string | null>(restored.running?.id ?? null),
    [report, setReport] = useState<ValuationReport | null>(restored.last),
    [original, setOriginal] = useState<ValuationReport | null>(restored.last),
    [snapshot, setSnapshot] = useState<FinancialSnapshot | null>(
      restored.last?.snapshot ?? null,
    ),
    [saved, setSaved] = useState(loadReports),
    [searching, setSearching] = useState(false),
    [draft, setDraft] = useState(""),
    [compare, setCompare] = useState<ValuationReport | null>(null);
  const stop = useRef<(() => void) | null>(null),
    modelRequest = useRef(0);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  function finishWith(value: ValuationReport) {
    setReport(value);
    setOriginal(value);
    setSnapshot(value.snapshot);
    setSecurity(value.snapshot.security);
    setQuery(value.snapshot.security.code);
    setBusy(false);
    setStage("completed");
    clearRunning();
    saveLast(value);
  }
  async function connect() {
    setError("");
    try {
      await connectValuation();
      const list = await fetchBackends();
      setBackends(list);
      setConnected(true);
      setBackend(
        list.find((b) => b.id === preference() && b.installed)?.id ||
          list.find((b) => b.id === "codex" && b.installed)?.id ||
          list.find((b) => b.installed)?.id ||
          "codex",
      );
    } catch {
      setConnected(false);
      setError("无法连接本地估值服务");
      if (loadRunning()) {
        // 服务连上后再接着恢复任务（见下方 connected 的 effect）
        setBusy(false);
        setStatus("本地估值服务未连接，连接后会接着显示之前的任务进度");
      }
    }
  }
  useEffect(() => {
    void connect();
    return () => stop.current?.();
  }, []);
  useEffect(() => {
    if (!connected) return;
    let active = true;
    const id = ++modelRequest.current;
    setModels([]);
    setModel("default");
    fetchModels(backend)
      .then((list) => {
        if (active && id === modelRequest.current) {
          setModels(list);
          const remembered = preference(backend);
          if (list.some((m) => m.modelId === remembered)) setModel(remembered);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [connected, backend]);
  async function find() {
    setSearching(true);
    setError("");
    setSecurity(null);
    setSnapshot(null);
    setReport(null);
    setOriginal(null);
    clearLast();
    try {
      const list = await searchCompanies(query);
      setCandidates(list);
      if (!list.length) setError("没有找到匹配证券，请使用股票代码");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  }
  function attach(id: string) {
    stop.current?.();
    // 服务会从头重放事件，先清空，避免重复
    setActivity(null);
    setRunLog([]);
    stop.current = subscribeValuation(
      id,
      (event) => {
        if (event.stage) setStage(event.stage);
        if (event.type === "activity" && typeof event.payload.chars === "number")
          setActivity({ chars: event.payload.chars, preview: event.payload.preview || "" });
        if (event.payload.message) {
          const text = event.payload.message;
          const at = event.at || new Date().toISOString();
          setRunLog((log) => (log[log.length - 1]?.text === text ? log : [...log, { at, text }].slice(-8)));
        }
        if (event.payload.snapshot) setSnapshot(event.payload.snapshot);
        setStatus(
          event.payload.message ||
            (
              {
                collecting: "正在采集财报",
                analyzing: "模型正在分析",
                calculating: "正在计算估值",
                completed: "估值完成",
                cancelled: "已取消",
                failed: "分析失败",
              } as Record<string, string>
            )[event.type] ||
            "模型运行中",
        );
        if (event.type === "completed" && event.payload.report)
          finishWith(event.payload.report);
        if (event.type === "failed" || event.type === "cancelled") {
          setBusy(false);
          setStage("");
          setError(event.payload.error || "");
          clearRunning();
        }
      },
      () => setStatus("连接中断，正在自动重连…"),
    );
  }
  useEffect(() => {
    if (!connected) return;
    const running = loadRunning();
    if (!running) return;
    const id = running.id;
    if (running.backend) setBackend(running.backend);
    getValuation(id)
      .then((value) => {
        setJob(id);
        if (value.report) finishWith(value.report);
        else if (!["cancelled", "failed"].includes(value.state)) {
          setBusy(true);
          setStage(value.state);
          attach(id); // 服务会重放这个任务的全部事件，进度与已采集的财报随之恢复
        } else {
          setBusy(false);
          setStatus(value.state === "cancelled" ? "任务已取消" : "");
          if (value.error) setError(value.error);
          clearRunning();
        }
      })
      .catch(() => {
        setBusy(false);
        setStatus("");
        setError("没能接上之前的任务（本地估值服务可能已重启），请重新开始");
        clearRunning();
      });
  }, [connected]);
  async function start(reuse = false) {
    if (!security) return;
    setError("");
    setBusy(true);
    setStatus("正在启动");
    setStage("queued");
    setReport(null);
    setOriginal(null);
    clearLast();
    const began = Date.now();
    setStartedAt(began);
    setNow(began);
    try {
      const value = await startValuation({
        security,
        backend,
        modelId: model === "manual" ? manual.trim() : model,
        ...(reuse && snapshot ? { snapshot } : {}),
      });
      setJob(value.id);
      saveRunning({ id: value.id, security, backend, model, startedAt: began });
      attach(value.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function refresh() {
    const id = ++modelRequest.current;
    try {
      const list = await fetchModels(backend, true);
      if (id === modelRequest.current) setModels(list);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <main className="valuation-page container animate-fade-in page-shell">
      <div className="valuation-shell">
        <PageTitle desc="六方法三情景估值与报告导出">公司估值工作台</PageTitle>
        <section className="valuation-card">
          <div className="valuation-section-head">
            <h2>开始一次估值</h2>
            <span
              className={connected ? "valuation-connected" : "valuation-muted"}
            >
              <Server size={14} />{" "}
              {connected ? "本地服务已连接" : "本地服务未连接"}
            </span>
          </div>
          {!connected && (
            <div className="valuation-warning">
              {hostedPage ? (
                <p>
                  线上页面会连接你本机的估值服务：在 BusinessWeb 目录运行{" "}
                  <code>npm run valuation:server</code>
                  （无需 <code>npm run dev</code>
                  ），再点“重新连接”。模型调用使用你本机的凭证： 在终端运行{" "}
                  <code>pi</code> 后输入 <code>/login</code>，或使用已登录的
                  codex、claude、opencode。Safari 会拦截访问本机服务，请使用
                  Chrome 或 Edge。
                </p>
              ) : (
                <p>
                  在 BusinessWeb 目录启动 <code>npm run valuation:server</code>
                  ，同时运行 <code>npm run dev</code>。模型调用使用本机凭证：pi
                  （<code>/login</code> 或 API key）或已登录的 CLI。
                </p>
              )}
              <button onClick={connect}>
                <RefreshCw size={14} />
                重新连接
              </button>
            </div>
          )}
          <div className="valuation-form-grid">
            <label className="valuation-company-input">
              公司名称或代码
              <input
                aria-label="公司名称或代码"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSecurity(null);
                  setSnapshot(null);
                  setReport(null);
                  setOriginal(null);
                }}
                placeholder="腾讯 / 600519 / AAPL"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && connected) void find();
                }}
              />
            </label>
            <button
              disabled={!connected || !query.trim() || searching || busy}
              onClick={find}
            >
              <Search size={16} />
              {searching ? "查找中…" : "查找公司"}
            </button>
            <label>
              本地 CLI
              <select
                value={backend}
                disabled={!connected || busy}
                onChange={(e) => {
                  setError("");
                  setBackend(e.target.value as Backend);
                  remember("valuation-backend", e.target.value);
                }}
              >
                {(backends.length
                  ? backends
                  : [{ id: "codex" as Backend, installed: false }]
                ).map((b) => (
                  <option key={b.id} value={b.id} disabled={!b.installed}>
                    {b.id}
                    {b.installed ? "" : "（未安装）"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              模型版本
              <select
                value={model}
                disabled={!connected || busy}
                onChange={(e) => {
                  setModel(e.target.value);
                  if (e.target.value !== "manual")
                    remember("valuation-model-" + backend, e.target.value);
                }}
              >
                {!models.length && (
                  <option value="default">CLI 默认模型（别名）</option>
                )}
                {models.map((m) => (
                  <option key={m.modelId} value={m.modelId}>
                    {m.displayName} ·{" "}
                    {m.availability === "verified"
                      ? "已验证"
                      : m.availability === "unavailable"
                        ? "上次调用失败"
                        : "未验证权限"}
                  </option>
                ))}
                <option value="manual">手动填写模型 ID</option>
              </select>
            </label>
            <button
              aria-label="刷新模型版本"
              disabled={!connected || busy}
              onClick={refresh}
            >
              <RefreshCw size={16} />
            </button>
          </div>
          {model === "manual" && (
            <label className="valuation-manual">
              具体模型 ID
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="填写此 CLI 支持的完整模型 ID"
              />
            </label>
          )}
          {candidates.length > 0 && !security && (
            <div className="valuation-candidates">
              {candidates.map((c) => (
                <button
                  key={c.market + c.code}
                  onClick={() => {
                    setSecurity(c);
                    setCandidates([]);
                  }}
                >
                  {c.name} · {c.code} · {c.market.toUpperCase()} ·{" "}
                  {c.quoteCurrency}
                </button>
              ))}
            </div>
          )}
          {security && (
            <p className="valuation-selection">
              已选择 {security.name} · {security.code} ·{" "}
              {security.quoteCurrency}
            </p>
          )}
          <div className="valuation-actions">
            <button
              className="valuation-primary"
              disabled={
                !connected ||
                !security ||
                busy ||
                (model === "manual" && !manual.trim())
              }
              onClick={() => start()}
            >
              <Play size={15} />
              开始估值
            </button>
            {snapshot && security && (
              <button disabled={busy || !connected} onClick={() => start(true)}>
                使用同一财报，换模型重跑
              </button>
            )}
            {busy && job && (
              <button
                onClick={() =>
                  cancelValuation(job).catch((e) => setError(e.message))
                }
              >
                <Square size={14} />
                取消任务
              </button>
            )}
          </div>
          {busy ? (
            <div className="valuation-run" role="status" aria-live="polite">
              <ol className="valuation-steps" aria-label="估值进度">
                {STEPS.map((label, i) => {
                  const current = stepOf(stage);
                  const state = i < current ? "done" : i === current ? "current" : "todo";
                  return (
                    <li key={label} className={`valuation-step is-${state}`}>
                      <span className="valuation-step__dot" aria-hidden="true">
                        {state === "current" ? <span className="valuation-spinner" /> : state === "done" ? "✓" : i + 1}
                      </span>
                      {label}
                    </li>
                  );
                })}
              </ol>
              <p className="valuation-progress">
                <span>{status || "模型运行中"}</span>
                {startedAt && <span className="valuation-elapsed">已用时 {elapsedText(now - startedAt)}</span>}
              </p>
              {activity && activity.chars > 0 && (
                <div className="valuation-stream">
                  <span className="valuation-muted">模型已输出 {activity.chars.toLocaleString()} 字 · 最新片段</span>
                  {activity.preview && <code>…{activity.preview}</code>}
                </div>
              )}
              {runLog.length > 0 && (
                <ol className="valuation-log" aria-label="运行记录">
                  {runLog.map((e) => (
                    <li key={e.at + e.text}>
                      <time>{new Date(e.at).toLocaleTimeString("zh-CN", { hour12: false })}</time>
                      {e.text}
                    </li>
                  ))}
                </ol>
              )}
              <p className="valuation-muted">可以离开这个页面，回来时会接着显示进度；估值完成后结果会保留在这里。</p>
            </div>
          ) : (
            status && (
              <p role="status" className="valuation-progress">
                {status}
              </p>
            )
          )}
          {error && (
            <p role="alert" className="valuation-error">
              {error}
            </p>
          )}
        </section>
        {snapshot && !report && (
          <section className="valuation-card">
            <h2>已取得的财务资料</h2>
            <p>{Object.keys(snapshot.facts).join(" · ") || "未取得有效指标"}</p>
            <p className="valuation-muted">{snapshot.missing.join("；")}</p>
          </section>
        )}
        <section className="valuation-card valuation-archive">
          <details>
            <summary>历史报告与补充数据</summary>
            <div className="valuation-actions">
              <button onClick={() => setSaved(loadReports())}>
                刷新历史报告
              </button>
              <label>
                导入报告
                <input
                  type="file"
                  accept=".json"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const r = importReport(await file.text());
                      setReport(r);
                      setOriginal(r);
                      setSecurity(r.snapshot.security);
                      setSnapshot(r.snapshot);
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                />
              </label>
            </div>
            {saved.map((r, i) => (
              <button
                key={i}
                onClick={() => {
                  setReport(r);
                  setOriginal(r);
                  setSecurity(r.snapshot.security);
                  setSnapshot(r.snapshot);
                }}
              >
                {r.snapshot.security.name} · {r.requestedModelId} ·{" "}
                {r.createdAt.slice(0, 10)}
              </button>
            ))}
            <p>
              自动数据不足时，可补充带来源的财务快照
              JSON。金额使用基础货币单位，并保留字段期间与来源。
            </p>
            <textarea
              aria-label="补充财务快照"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              placeholder="粘贴 FinancialSnapshot JSON"
            />
            <button
              onClick={() => {
                try {
                  const value = JSON.parse(draft),
                    check = validateSnapshot(value);
                  if (!check.ok) throw new Error(check.errors.join("；"));
                  const sourceId = "userProvided";
                  value.sources.push({
                    id: sourceId,
                    title: "用户补充财务资料",
                    url: "",
                  });
                  Object.values(value.facts).forEach((f) => {
                    (f as { sourceId: string }).sourceId = sourceId;
                  });
                  setSnapshot(value);
                  setSecurity(value.security);
                  setStatus("已加载用户补充财报；选择模型后使用同一财报重跑");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              加载补充资料
            </button>
          </details>
        </section>
        {report ? (
          <>
            <section className="valuation-card">
              <h2>模型结果对比</h2>
              <select
                aria-label="对比历史报告"
                value={compare?.createdAt || ""}
                onChange={(e) =>
                  setCompare(
                    saved.find((r) => r.createdAt === e.target.value) || null,
                  )
                }
              >
                <option value="">选择已保存的同公司报告</option>
                {saved
                  .filter(
                    (r) =>
                      r.snapshot.security.code ===
                        report.snapshot.security.code &&
                      r.snapshot.security.market ===
                        report.snapshot.security.market,
                  )
                  .map((r) => (
                    <option key={r.createdAt} value={r.createdAt}>
                      {r.backend} / {r.requestedModelId} · {r.createdAt}
                    </option>
                  ))}
              </select>
              {compare &&
                compare.snapshot.security.code ===
                  report.snapshot.security.code && (
                  <>
                    <p>
                      {JSON.stringify(compare.snapshot) ===
                      JSON.stringify(report.snapshot)
                        ? "两份报告使用同一财务快照"
                        : "财务快照有差异，请结合数据日期与口径比较"}
                    </p>
                    <div className="valuation-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>基准情景</th>
                            <th>{report.requestedModelId}</th>
                            <th>{compare.requestedModelId}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {METHODS.map((m) => (
                            <tr key={m}>
                              <th>{METHOD_LABELS[m]}</th>
                              <td>
                                {report.results.base[m].price?.toFixed(2) ??
                                  "不可计算"}
                              </td>
                              <td>
                                {compare.results.base[m].price?.toFixed(2) ??
                                  "不可计算"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
            </section>
            <div className="valuation-actions">
              {original && (
                <button onClick={() => setReport(structuredClone(original))}>
                  恢复原始假设
                </button>
              )}
            </div>
            <Results report={report} onChange={setReport} />
          </>
        ) : (
          <section className="valuation-empty">
            <BarChart3 size={36} />
            <h2>一家公司，多种估值视角</h2>
            <p>P/E · PEG · P/S · P/B · DCF · 多阶段 DCF</p>
            <p>每种方法分别呈现适用性、三情景结果和关键假设。</p>
          </section>
        )}
      </div>
    </main>
  );
}
