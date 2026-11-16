#!/usr/bin/env python3
"""指数全景无人值守刷新 runner（Linux GitHub Actions / 本机均可；不需要 Claude、Orca 或 MCP）。

一次刷新 = 在隔离 staging 目录里完整跑一遍，验证通过后才备份并原子替换生产数据：

  S1 行情/中证：   fetch_data.py --no-csi --providers ""，再 --only <生产已有中证 store 的指数>
                   （联网刷新 data/store；不新建中证 store，避免改变既有选源；staging 内临时包不发布）
  S2 domestic：    providers/domestic.py --as-of <A股最新交易日>  （联网；结果不合格 → staging 恢复旧缓存）
  S3 supplemental：providers/supplemental.py --as-of <同上>     （同上）
  S4 原站 EPS：    Playwright Chromium 正常打开 https://lishenqi.vip/#/panorama，page.evaluate 现有
                   providers/original_eps_capture.js（页面自身匿名只读 PANO_IX.series，顺序、1.5s 间隔、遇错即停）
                   → 门禁 → providers/original_eps.py 离线解析；失败 → 保留旧 raw/缓存
  S5 最终包：      fetch_data.py --enrich-only                （默认 domestic,supplemental,original_eps 三个 provider）
  S6 门禁：        结构/指数不减少（清单见 fetch_data.INDICES，2026-11-16 起 63 只）/逐字段不丢观测、末日不回退、选源不切换、EPS 与 raw 一一对应、manager_audit（有 node 时）
  S7 发布：        备份将被覆盖的生产文件 → 逐文件原子替换（data-bundle.js 最后）→ 任一失败全部回滚

说明：fetch_data.py --collect-providers 在进程内调用 domestic.collect(out_path=None)，不会写 domestic.json，
随后的 --enrich-only 会读到旧缓存，所以这里改为直接运行两个 provider 的 CLI（都会持久化），再统一 --enrich-only。

退出码：0 全部成功并发布；10 部分成功（有来源回退旧缓存）但验证通过并已发布；20 失败、生产数据未改动；
3 另一刷新正在进行（锁存在）；2 参数错误。无论成败都写 reports/refresh/last-refresh.{md,json}。

常用：
  python refresh_runner.py --mode online                  # 远端/本机正式刷新
  python refresh_runner.py --mode offline --skip-eps      # 不联网全流程演练（只用现有缓存）
  python refresh_runner.py --eps-smoke 000001.SH,399006.SZ  # 只抓两只 EPS 冒烟，不发布
  python refresh_runner.py --print-commit-paths           # 可提交 Git 的应用数据路径（不含大 raw）
  python refresh_runner.py --print-cache-paths            # 建议 actions/cache 的可重下 raw 路径
"""
from __future__ import annotations

import argparse
import datetime as dt
import fnmatch
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import traceback

APP = os.path.dirname(os.path.abspath(__file__))
EPS_URL = "https://lishenqi.vip/#/panorama"
SINCE = "2005-01-01"
FIELDS = ["price", "chg", "pe", "pb", "dy", "mcap", "amt", "turn", "eps", "roe", "bps", "volume"]
HEAD_TRIM_MIN_RATIO = 0.9  # 上游滚动窗口：只允许裁掉最早端，且保留 ≥90% 观测
EXIT_OK, EXIT_PARTIAL, EXIT_FAILED, EXIT_LOCKED = 0, 10, 20, 3

# 复制进 staging 的代码与只读输入（相对应用目录）
CODE_FILES = ["fetch_data.py", "analytics.js", "providers", "reports/manager_audit.py", "reports/round2-baseline.json"]
# staging → 生产的发布范围（相对应用目录）；data/ 下排除 runner 自身工作目录
PUBLISH_FILES = ["data-bundle.js", "reports/round2-coverage.json"]
PUBLISH_TREES = ["data"]
DATA_EXCLUDE = ["data/refresh-work", "data/refresh-backups", "data/.refresh-runner.lock", "data/last_run.log",
                "data/.tmp_*"]
# 远端 Git 只提交这些（应用数据 + 累积型状态 + 报告）；大且可重下的 raw 走 actions/cache
COMMIT_PATTERNS = [
    "data-bundle.js", "data/manifest.json", "data/store/*.csv",
    "data/providers/domestic.json", "data/providers/supplemental.json", "data/providers/original_eps.json",
    "data/providers/original_eps_raw/capture.json",
    "data/providers/domestic_raw/accum_*.json",
    "data/providers/supplemental_raw/_last_online.json",
    "data/providers/supplemental_raw/cnindex/*", "data/providers/supplemental_raw/csi_feature/*",
    "data/providers/supplemental_raw/ecb/*", "data/providers/supplemental_raw/hsi/*",
    "data/providers/supplemental_raw/hsi/idx/*", "data/providers/supplemental_raw/nasdaq/*",
    "data/providers/supplemental_raw/wsj/*",
    "reports/round2-coverage.json", "reports/refresh/last-refresh.md", "reports/refresh/last-refresh.json",
]
CACHE_PATHS = ["data/providers/domestic_raw", "data/providers/supplemental_raw/shiller"]


# ---------------------------------------------------------------------------
# 小工具
# ---------------------------------------------------------------------------

def utcnow() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def bjnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone(dt.timedelta(hours=8)))


def read_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def atomic_write_bytes(path: str, data: bytes) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path) or ".", prefix=".tmp_runner_")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def atomic_write_json(path: str, obj) -> None:
    atomic_write_bytes(path, json.dumps(obj, ensure_ascii=False, indent=1).encode("utf-8"))


def read_bundle(path: str) -> dict | None:
    try:
        with open(path, encoding="utf-8") as f:
            txt = f.read()
        return json.loads(txt.split("window.PANO_DATA=", 1)[1].rstrip().rstrip(";"))
    except (OSError, IndexError, ValueError):
        return None


def excluded(rel: str) -> bool:
    rel = rel.replace(os.sep, "/")
    return any(rel == p or rel.startswith(p + "/") or fnmatch.fnmatch(rel, p) for p in DATA_EXCLUDE)


def walk_rel(root: str, sub: str) -> list[str]:
    out = []
    base = os.path.join(root, sub)
    if os.path.isfile(base):
        return [sub]
    for dp, dns, fns in os.walk(base):
        for fn in fns:
            rel = os.path.relpath(os.path.join(dp, fn), root).replace(os.sep, "/")
            if not excluded(rel) and "__pycache__" not in rel:
                out.append(rel)
    return sorted(out)


def copy_rel(src_root: str, dst_root: str, rel: str) -> None:
    s, d = os.path.join(src_root, rel), os.path.join(dst_root, rel)
    if os.path.isdir(s):
        for r in walk_rel(src_root, rel):
            copy_rel(src_root, dst_root, r)
        return
    os.makedirs(os.path.dirname(d), exist_ok=True)
    shutil.copy2(s, d)


def _match(rel: str, pat: str) -> bool:
    """glob 匹配，但 * 不跨目录（data/store/*.csv 不匹配子目录）。"""
    import re
    rx = "^" + "".join("[^/]*" if ch == "*" else re.escape(ch) for ch in pat) + "$"
    return re.match(rx, rel) is not None


def commit_paths(app: str = APP) -> list[str]:
    """--print-commit-paths：按白名单列出实际存在的文件（相对应用目录）。"""
    cands = walk_rel(app, "data") + [p for p in ("data-bundle.js", "reports/round2-coverage.json",
                                                 "reports/refresh/last-refresh.md", "reports/refresh/last-refresh.json")
                                     if os.path.exists(os.path.join(app, p))]
    return sorted({rel for rel in cands if any(_match(rel, pat) for pat in COMMIT_PATTERNS)})


# ---------------------------------------------------------------------------
# 门禁（纯函数，可单测）
# ---------------------------------------------------------------------------

# 蛋卷 index_eva/{pe,pb,roe}_history：周网格 + 一个“最新交易日”滚动尾点（值与同源 detail 相同）。
# 2026-11-16 实测：17:09 时尾点为 11-13（周五），18:32 蛋卷生成 11-16 后，11-13 被 11-16 取代（样本数不变）。
# 这种“旧尾点被更新的尾点取代”不是丢数据，但按通用规则会被判为区间内丢失、整份 domestic 回退旧缓存。
# 网格日：本地 47 列（A股/港股/美股）2026-10-19 以来 188 个网格点全部是周一；但更早的节假日周会顺延到
# 周二~周四（个别为周六），所以只放行“非周一”的旧末日，周一末日按网格点保护、被删即拒收；
# 另限新末日比旧末日晚不超过 ROLLING_TAIL_MAX_DAYS 天（尾点按交易日前移，长假也不超过两周）。
DANJUAN_HISTORY_MARK = "danjuanfunds.com/djapi/index_eva/"
ROLLING_TAIL_MAX_DAYS = 14


def is_replaceable_tail(old_last: str, new_last: str) -> bool:
    """旧末日可视为临时尾点：非周一（周一是网格日），且新末日更晚、相距不超过 ROLLING_TAIL_MAX_DAYS 天。"""
    o, n = dt.date.fromisoformat(old_last), dt.date.fromisoformat(new_last)
    return o.weekday() != 0 and 0 < (n - o).days <= ROLLING_TAIL_MAX_DAYS


def is_rolling_tail_source(src: dict | None) -> bool:
    """蛋卷估值历史（周频 + 滚动尾点）才适用尾点替换规则；detail 单期累积、其他来源都不适用。"""
    url = (src or {}).get("url") or ""
    return DANJUAN_HISTORY_MARK in url and "_history/" in url


def _series_diff(old: dict, new: dict, rolling_tail: bool = False) -> dict:
    """old/new: {date: value}（非空观测）。返回丢失/裁头/回退/修订信息。

    rolling_tail=True（蛋卷周频历史）：旧序列的最后一个观测若不在新序列里、且是可替换的临时尾点
    （is_replaceable_tail：非周一、新末日更晚且相距≤14天），记为 tailReplaced，不算 lostInside；
    只放行这一个日期。周一末日（网格点）被删仍算丢失。"""
    res = {"oldCount": len(old), "newCount": len(new), "oldLast": max(old) if old else None,
           "newLast": max(new) if new else None, "lostInside": [], "headTrim": [], "revised": [],
           "tailReplaced": [], "_old": sorted(old)[:1], "_new": sorted(new)[:1]}
    if not old:
        return res
    if not new:
        res["lostInside"] = sorted(old)
        return res
    nf, nl = min(new), max(new)
    for d in sorted(old):
        if d in new:
            if new[d] != old[d]:
                res["revised"].append((d, old[d], new[d]))
        elif d < nf:
            res["headTrim"].append(d)
        elif rolling_tail and d == res["oldLast"] and is_replaceable_tail(d, nl):
            res["tailReplaced"].append((d, old[d]))
        elif d <= nl:
            res["lostInside"].append(d)
    return res


def judge_diff(diff: dict) -> list[str]:
    """把 _series_diff 结果变成拒收原因（空列表 = 通过）。修订（同日值变化）不拒收，只记录。"""
    why = []
    if diff["oldCount"] and not diff["newCount"]:
        return [f"整列消失（原 {diff['oldCount']} 个观测）"]
    if diff["oldLast"] and diff["newLast"] and diff["newLast"] < diff["oldLast"]:
        why.append(f"末日回退 {diff['oldLast']} → {diff['newLast']}")
    if diff["lostInside"]:
        why.append(f"区间内丢失 {len(diff['lostInside'])} 个旧观测（如 {diff['lostInside'][:3]}）")
    if diff["headTrim"] and diff["newCount"] < HEAD_TRIM_MIN_RATIO * diff["oldCount"]:
        why.append(f"最早端被裁 {len(diff['headTrim'])} 个且新样本 {diff['newCount']} < 原 {diff['oldCount']} 的 90%")
    return why


def judge_resampled(diff: dict) -> list[str]:
    """原站 EPS 专用：服务端每 5 个交易日取 1 点且以最新交易日为锚，网格每天整体平移
    （2026-11-16 在线冒烟实测：上证新旧两次抓取 0 个日期重合）。所以不能按“旧日期必须仍在”判断，
    改为：不得整列消失、末日不回退、样本数不减少超过 2、最早日不晚于原最早日 14 天以上。"""
    if diff["oldCount"] and not diff["newCount"]:
        return [f"整列消失（原 {diff['oldCount']} 个观测）"]
    if not diff["oldCount"]:
        return []
    why = []
    if diff["newLast"] < diff["oldLast"]:
        why.append(f"末日回退 {diff['oldLast']} → {diff['newLast']}")
    if diff["newCount"] < diff["oldCount"] - 2:
        why.append(f"样本数减少 {diff['oldCount']} → {diff['newCount']}")
    first_old = min(diff["_old"]) if diff.get("_old") else None
    first_new = min(diff["_new"]) if diff.get("_new") else None
    if first_old and first_new:
        def _d(x):
            x = x.replace("-", "")
            return dt.date(int(x[:4]), int(x[4:6]), int(x[6:8]))
        if (_d(first_new) - _d(first_old)).days > 14:
            why.append(f"最早日由 {first_old} 推迟到 {first_new}")
    return why


def _provider_maps(payload: dict) -> dict:
    out = {}
    for code, node in ((payload or {}).get("series") or {}).items():
        for f, fld in ((node or {}).get("fields") or {}).items():
            if isinstance(fld, dict) and fld.get("status") == "ok":
                out[(code, f)] = {d: v for d, v in zip(fld.get("d") or [], fld.get("v") or []) if v is not None}
    return out


def _provider_rolling(payload: dict) -> set:
    """新旧缓存里来源都是蛋卷周频历史的 (code, field)。"""
    out = set()
    for code, node in ((payload or {}).get("series") or {}).items():
        for f, fld in ((node or {}).get("fields") or {}).items():
            if isinstance(fld, dict) and is_rolling_tail_source(fld.get("source")):
                out.add((code, f))
    return out


def provider_gate(old_payload: dict | None, new_payload: dict | None) -> dict:
    """provider 新缓存与生产旧缓存比：旧 ok 字段不得消失/丢观测/末日回退。"""
    if not isinstance(new_payload, dict) or not isinstance(new_payload.get("series"), dict):
        return {"ok": False, "problems": ["新缓存缺失或结构无效"], "revised": 0, "headTrim": [], "newFields": 0}
    om, nm = _provider_maps(old_payload), _provider_maps(new_payload)
    rolling = _provider_rolling(old_payload) & _provider_rolling(new_payload)
    problems, revised, head, tail = [], 0, [], []
    for key, old in om.items():
        diff = _series_diff(old, nm.get(key, {}), rolling_tail=key in rolling)
        for w in judge_diff(diff):
            problems.append(f"{key[0]}.{key[1]}: {w}")
        revised += len(diff["revised"])
        if diff["headTrim"]:
            head.append(f"{key[0]}.{key[1]} 裁头 {len(diff['headTrim'])}")
        for d, v in diff["tailReplaced"]:
            tail.append({"code": key[0], "field": key[1], "replaced": [d, v], "newLast": diff["newLast"]})
    return {"ok": not problems, "problems": problems, "revised": revised, "headTrim": head, "tailReplaced": tail,
            "newFields": len([k for k in nm if k not in om]), "errors": list(new_payload.get("errors") or [])[:20]}


def eps_capture_gate(old_raw: dict | None, new_raw: dict, *, subset: list[str] | None = None) -> dict:
    """原站 EPS 新抓取与旧 raw 比。subset=None 表示正式全量抓取（不得带 onlyCodes）。"""
    problems = []
    if new_raw.get("errors"):
        problems.append(f"原站返回 errors：{new_raw['errors'][:3]}")
    if subset is None and new_raw.get("onlyCodes"):
        problems.append("这是子集抓取（onlyCodes），不能作为全量发布")
    if new_raw.get("range") != "all":
        problems.append(f"range={new_raw.get('range')!r}，只接受 'all'")
    if new_raw.get("unitEps") != "yuan":
        problems.append(f"单位 u.eps={new_raw.get('unitEps')!r}，与已核对的 yuan 不符")
    old_series = (old_raw or {}).get("series") or {}
    new_series = new_raw.get("series") or {}
    codes = subset if subset is not None else sorted(old_series)
    revised, detail = 0, {}
    for code in codes:
        o, n = old_series.get(code), new_series.get(code)
        if n is None:
            if o is not None and any(v is not None for v in o.get("eps") or []):
                problems.append(f"{code}: 旧 raw 有 EPS，本次缺失")
            elif subset is not None:
                problems.append(f"{code}: 本次未抓到")
            continue
        if n.get("freq") != "week" or n.get("step") != 5:
            problems.append(f"{code}: 采样 freq={n.get('freq')!r} step={n.get('step')!r} 与 'all' 周采样不符")
        nm = {d: v for d, v in zip(n.get("d") or [], n.get("eps") or []) if v is not None}
        om = {d: v for d, v in zip((o or {}).get("d") or [], (o or {}).get("eps") or []) if v is not None}
        diff = _series_diff(om, nm)
        for w in judge_resampled(diff):
            problems.append(f"{code}: {w}")
        revised += len(diff["revised"])
        detail[code] = {"count": len(nm), "first": min(nm) if nm else None, "last": max(nm) if nm else None,
                        "oldCount": len(om), "oldLast": max(om) if om else None, "revised": len(diff["revised"])}
    return {"ok": not problems, "problems": problems, "revised": revised, "detail": detail}


def bundle_maps(bundle: dict) -> dict:
    return {s["code"]: s for s in (bundle or {}).get("indices", [])}


def bundle_gate(old: dict | None, new: dict | None, fd, eps_raw: dict | None) -> dict:
    """最终包与生产包比较。fd 为 fetch_data 模块（用其 validate_bundle/INDICES）。"""
    problems, revisions, head, switched_ok, tails = [], [], [], [], []
    if not new:
        return {"ok": False, "problems": ["新数据包不可读"], "revisions": [], "headTrim": [], "tailReplaced": []}
    problems += [f"validate_bundle: {e}" for e in fd.validate_bundle(new)[:20]]
    O, N = bundle_maps(old), bundle_maps(new)
    if old and set(O) - set(N):
        problems.append(f"指数减少：{sorted(set(O) - set(N))}")
    for code, n in N.items():
        o = O.get(code)
        if not o:
            continue
        for f in FIELDS:
            om = {d: v for d, v in zip(o["d"], o[f]) if v is not None}
            nm = {d: v for d, v in zip(n["d"], n[f]) if v is not None}
            rolling = (is_rolling_tail_source((o.get("sources") or {}).get(f))
                       and is_rolling_tail_source((n.get("sources") or {}).get(f)))
            diff = _series_diff(om, nm, rolling_tail=rolling)
            for d, v in diff["tailReplaced"]:
                tails.append({"code": code, "field": f, "replaced": [d, v], "newLast": diff["newLast"]})
            for w in (judge_resampled(diff) if f == "eps" else judge_diff(diff)):
                problems.append(f"{code}.{f}: {w}")
            if f == "eps":
                diff["headTrim"] = []  # 重采样平移不算裁头
            if diff["revised"]:
                revisions.append({"code": code, "field": f, "count": len(diff["revised"]),
                                  "samples": diff["revised"][:3]})
            if diff["headTrim"]:
                head.append(f"{code}.{f} 最早端裁掉 {len(diff['headTrim'])} 个（{diff['headTrim'][0]}~{diff['headTrim'][-1]}）")
            op = ((o.get("availability") or {}).get(f) or {}).get("provider")
            np_ = ((n.get("availability") or {}).get(f) or {}).get("provider")
            if om and op != np_:
                problems.append(f"{code}.{f}: 来源切换 {op} → {np_}")
        if o.get("componentNum") is not None and n.get("componentNum") is None:
            problems.append(f"{code}.componentNum: 原有披露消失")
    # EPS 与 raw 一一对应（只按 since/floor 裁剪）
    if eps_raw is not None:
        floors = {m["code"]: max(m["floor"], SINCE) for m in fd.INDICES}
        for code, n in N.items():
            got = {d: v for d, v in zip(n["d"], n["eps"]) if v is not None}
            node = (eps_raw.get("series") or {}).get(code)
            exp = {}
            if node:
                for d8, v in zip(node.get("d") or [], node.get("eps") or []):
                    iso = f"{d8[:4]}-{d8[4:6]}-{d8[6:]}"
                    if v is not None and iso >= floors.get(code, SINCE):
                        exp[iso] = v
            if got != exp:
                problems.append(f"{code}.eps: 与原站 raw 不一一对应（包 {len(got)} / raw {len(exp)}）")
            if got and (n.get("sources", {}).get("eps") or {}).get("provider") != "original_eps":
                problems.append(f"{code}.eps: 来源不是 original_eps")
    return {"ok": not problems, "problems": problems, "revisions": revisions, "headTrim": head,
            "tailReplaced": tails}


def field_summary(bundle: dict | None) -> list[dict]:
    rows = []
    for s in (bundle or {}).get("indices", []):
        av = s.get("availability") or {}
        row = {"code": s["code"], "name": s["name"]}
        for f in ("price", "pe", "pb", "dy", "eps", "roe", "amt"):
            a = av.get(f) or {}
            row[f] = {"last": a.get("last"), "count": a.get("count", 0), "provider": a.get("provider"),
                      "frequency": a.get("frequency")}
        rows.append(row)
    return rows


# ---------------------------------------------------------------------------
# 原站 EPS 抓取（Playwright Chromium，页面自身只读链）
# ---------------------------------------------------------------------------

def capture_eps(js_path: str, only_codes: list[str] | None = None, *, timeout_s: int = 300) -> dict:
    """正常打开原站页面，等待页面自己完成匿名初始化后，执行现有抓取脚本。

    不读写 cookie/storage、不拦截或改写请求、不改浏览器安全设置；页面需要用户交互（如强制登录）时
    PANO_IX 不会就绪，等待超时即失败。"""
    from playwright.sync_api import sync_playwright  # 延迟导入：离线流程与单测不需要
    with open(js_path, encoding="utf-8") as f:
        src = f.read()
    fn = src[src.index("async ("):]  # 去掉文件头注释，保留函数表达式
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            ctx = browser.new_context(locale="zh-CN", timezone_id="Asia/Shanghai")
            page = ctx.new_page()
            page.set_default_timeout(timeout_s * 1000)
            page.goto(EPS_URL, wait_until="domcontentloaded", timeout=90_000)
            page.wait_for_function(
                "() => !!(window.PANO_IX && typeof window.PANO_IX.series === 'function'"
                " && typeof window.PANO_IX.panel === 'function')", timeout=90_000)
            return page.evaluate(fn, only_codes or None)
        finally:
            browser.close()


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

class Runner:
    def __init__(self, app: str, mode: str, skip_eps: bool, work_root: str | None = None, keep_work: bool = False,
                 capture=capture_eps, python: str = sys.executable, keep_backups: int = 5,
                 step_timeout: int = 1500, bundle_out: str | None = None):
        self.app, self.mode, self.skip_eps = app, mode, skip_eps
        # 额外发布位置（如 BusinessWeb public/index-panorama/data-bundle.js）；与应用内 data-bundle.js 同一份
        self.bundle_out = os.path.abspath(bundle_out) if bundle_out else None
        self.ts = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        self.work = os.path.join(work_root or os.path.join(app, "data", "refresh-work"), self.ts)
        self.stage = os.path.join(self.work, "app")
        self.keep_work, self.capture, self.python = keep_work, capture, python
        self.keep_backups, self.step_timeout = keep_backups, step_timeout
        self.steps: list[dict] = []
        self.report: dict = {"startedAt": utcnow(), "startedAtBeijing": bjnow().isoformat(timespec="seconds"),
                             "mode": mode, "steps": self.steps, "published": False}
        self.lock = os.path.join(app, "data", ".refresh-runner.lock")
        self.fd = None

    # ---- 基础 ----
    def log(self, msg: str) -> None:
        line = f"[{utcnow()}] {msg}"
        print(line, flush=True)
        try:
            os.makedirs(self.work, exist_ok=True)
            with open(os.path.join(self.work, "runner.log"), "a", encoding="utf-8") as f:
                f.write(line + "\n")
        except OSError:
            pass

    def step(self, name: str, status: str, detail: str = "", t0: float | None = None, **extra) -> dict:
        rec = {"name": name, "status": status, "detail": detail,
               "seconds": round(time.time() - t0, 1) if t0 else None, **extra}
        self.steps.append(rec)
        self.log(f"{name}: {status} {detail}")
        return rec

    def run_cmd(self, args: list[str], name: str, timeout: int | None = None) -> tuple[int, str]:
        logf = os.path.join(self.work, f"{name}.log")
        env = dict(os.environ, PYTHONUNBUFFERED="1", PYTHONDONTWRITEBYTECODE="1")
        try:
            with open(logf, "w", encoding="utf-8") as out:
                rc = subprocess.run([self.python, *args], cwd=self.stage, stdout=out, stderr=subprocess.STDOUT,
                                    timeout=timeout or self.step_timeout, env=env).returncode
        except subprocess.TimeoutExpired:
            rc = 124
        with open(logf, encoding="utf-8", errors="replace") as f:
            tail = f.read()[-1500:]
        return rc, tail

    def prod(self, rel: str) -> str:
        return os.path.join(self.app, rel)

    def stg(self, rel: str) -> str:
        return os.path.join(self.stage, rel)

    def load_fd(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location("fetch_data_stage", self.stg("fetch_data.py"))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod

    # ---- 锁 ----
    def acquire(self) -> bool:
        try:
            os.makedirs(os.path.dirname(self.lock), exist_ok=True)
            os.mkdir(self.lock)
        except FileExistsError:
            return False
        with open(os.path.join(self.lock, "owner.json"), "w", encoding="utf-8") as f:
            json.dump({"pid": os.getpid(), "startedAt": self.report["startedAt"], "work": self.work}, f)
        return True

    def release(self) -> None:
        shutil.rmtree(self.lock, ignore_errors=True)

    # ---- staging ----
    def prepare(self) -> None:
        os.makedirs(self.stage, exist_ok=True)
        for rel in CODE_FILES + PUBLISH_FILES:
            if os.path.exists(self.prod(rel)):
                copy_rel(self.app, self.stage, rel)
        for rel in walk_rel(self.app, "data"):
            copy_rel(self.app, self.stage, rel)

    def restore_stage(self, rels: list[str]) -> None:
        """staging 中某来源不合格：把它的缓存恢复为生产旧版（目录整体替换）。"""
        for rel in rels:
            s = self.stg(rel)
            if os.path.isdir(s):
                shutil.rmtree(s)
            elif os.path.exists(s):
                os.unlink(s)
            if os.path.exists(self.prod(rel)):
                copy_rel(self.app, self.stage, rel)

    def a_calendar_last(self) -> str:
        path = self.stg("data/store/price_000001_SH.csv")
        last = None
        with open(path, encoding="utf-8") as f:
            next(f, None)
            for line in f:
                d = line.split(",", 1)[0].strip()
                if len(d) == 10:
                    last = d if last is None or d > last else last
        return last or bjnow().date().isoformat()

    # ---- 步骤 ----
    # 生产包的选源格局：A 股 PE/股息率由 domestic（中证官网 peg / indicator）整列提供，data/store 里没有
    # csi_*/indicator_*（只有中证2000 的 csi 点位）。若直接跑完整在线 fetch_data，会新建 27 份中证 store，
    # select_column 随之把 50 余列切到 csi/csi_indicator（2026-11-16 在线演练实测，被门禁拦下）。
    # 为不改变既有来源优先级：只为“生产中已存在的中证 store”刷新中证，其余指数 --no-csi。
    # 腾讯无日K的指数（中证2000 及 2026-11-16 新增的 19 只 93xxxx/H3xxxx/990001）以 data/store/csi_*.csv 初始化，
    # 因而自动落在此名单里持续刷新点位/成交额/PE，不依赖外部研究目录缓存。
    def csi_codes_in_prod(self) -> list[str]:
        fd = self.load_fd()
        out = []
        for m in fd.INDICES:
            if not m.get("csi"):
                continue
            tag = m["code"].replace(".", "_")
            if any(os.path.exists(self.prod(f"data/store/{k}_{tag}.csv")) for k in ("csi", "indicator")):
                out.append(m["code"])
        return out

    def s1_market(self) -> bool:
        t0 = time.time()
        if self.mode == "offline":
            passes = [("s1_market", ["fetch_data.py", "--offline", "--providers", "", "--coverage-report", ""])]
        else:
            passes = [("s1_tencent", ["fetch_data.py", "--no-csi", "--providers", "", "--coverage-report", ""])]
            csi = self.csi_codes_in_prod()
            if csi:
                passes.append(("s1_csi", ["fetch_data.py", "--only", ",".join(csi), "--providers", "",
                                          "--coverage-report", ""]))
        fails = []
        for name, args in passes:
            rc, tail = self.run_cmd(args, name)
            if rc != 0:
                self.step("行情/中证 fetch_data", "failed", f"{name} 退出码 {rc}：{tail[-300:]}", t0)
                return False
            man = read_json(self.stg("data/manifest.json"))
            for code, node in (man.get("indices") or {}).items():
                for w in node.get("warnings") or []:
                    if "失败" in w or "返回空" in w:
                        fails.append(f"{name} {code}: {w}")
        new_csi = [r for r in walk_rel(self.stage, "data/store")
                   if os.path.basename(r).startswith(("csi_", "indicator_")) and not os.path.exists(self.prod(r))]
        for r in new_csi:  # 生产没有的中证 store 一律丢弃（如 --only 时顺带下载的 indicator），保持既有选源
            os.unlink(self.stg(r))
        if new_csi:
            fails_note = f"；丢弃生产中不存在的新中证 store {new_csi}（保持既有选源）"
        else:
            fails_note = ""
        if self.mode == "offline":
            self.step("行情/中证 fetch_data", "cache", "离线模式：未联网，只用 data/store", t0)
        elif fails:
            self.step("行情/中证 fetch_data", "fallback", f"{len(fails)} 处失败已保留旧数据{fails_note}", t0,
                      failures=fails[:30])
        else:
            self.step("行情/中证 fetch_data", "ok",
                      f"腾讯行情在线刷新；中证仅刷新生产已有中证 store 的指数（选源不变）{fails_note}", t0)
        return True

    def provider_step(self, name: str, as_of: str) -> None:
        t0 = time.time()
        rel_json = f"data/providers/{name}.json"
        rel_raw = f"data/providers/{name}_raw"
        old = read_json(self.prod(rel_json)) if os.path.exists(self.prod(rel_json)) else None
        args = [f"providers/{name}.py", "--as-of", as_of] + (["--offline"] if self.mode == "offline" else [])
        rc, tail = self.run_cmd(args, f"provider_{name}")
        new = read_json(self.stg(rel_json)) if os.path.exists(self.stg(rel_json)) else None
        gate = provider_gate(old, new) if rc == 0 else {"ok": False, "problems": [f"退出码 {rc}：{tail[-300:]}"]}
        if not gate["ok"]:
            self.restore_stage([rel_json, rel_raw])
            self.step(f"provider {name}", "fallback", "新结果不合格，staging 已恢复为生产旧缓存", t0,
                      problems=gate["problems"][:30])
            return
        errs = gate.get("errors") or []
        status = "cache" if self.mode == "offline" else ("partial" if errs else "ok")
        detail = (f"修订 {gate['revised']} 个旧观测值；新字段 {gate['newFields']}；"
                  f"{len(errs)} 个请求错误（这些接口沿用上一份有效 raw）")
        if gate.get("tailReplaced"):
            detail += f"；蛋卷滚动尾点被更新尾点取代 {len(gate['tailReplaced'])} 列（已记入报告，非丢数据）"
        self.step(f"provider {name}", status, detail, t0, headTrim=gate["headTrim"][:20],
                  tailReplaced=gate.get("tailReplaced", [])[:200],
                  errors=[e if isinstance(e, str) else json.dumps(e, ensure_ascii=False) for e in errs[:20]])

    def s4_eps(self, as_of: str) -> None:
        t0 = time.time()
        rel_raw = "data/providers/original_eps_raw/capture.json"
        if self.skip_eps or self.mode == "offline":
            self.step("原站 EPS", "skipped", "本次未在线抓取，沿用已有 raw/缓存（数据日期见 raw capturedAt）", t0)
            return
        old = read_json(self.prod(rel_raw)) if os.path.exists(self.prod(rel_raw)) else None
        try:
            new = self.capture(self.stg("providers/original_eps_capture.js"))
        except Exception as e:  # noqa: BLE001  浏览器/网络/页面任何异常都只让 EPS 回退
            self.step("原站 EPS", "fallback", f"抓取失败，保留旧 raw：{type(e).__name__}: {str(e)[:300]}", t0)
            return
        gate = eps_capture_gate(old, new)
        tmp = os.path.join(self.work, "eps_capture_candidate.json")
        atomic_write_json(tmp, new)
        try:  # 复用 provider 的脱敏/结构校验
            sys.path.insert(0, self.stage)
            from providers import original_eps as oe  # type: ignore
            oe.load_raw(tmp)
        except Exception as e:  # noqa: BLE001
            gate["ok"] = False
            gate["problems"].append(f"raw 校验失败：{e}")
        finally:
            if self.stage in sys.path:
                sys.path.remove(self.stage)
            sys.modules.pop("providers.original_eps", None)
            sys.modules.pop("providers", None)
        if not gate["ok"]:
            self.step("原站 EPS", "fallback", "新抓取未通过门禁，保留旧 raw", t0, problems=gate["problems"][:30])
            return
        atomic_write_json(self.stg(rel_raw), new)
        rc, tail = self.run_cmd(["providers/original_eps.py", "--as-of", as_of], "provider_original_eps")
        if rc != 0:
            self.restore_stage([rel_raw, "data/providers/original_eps.json"])
            self.step("原站 EPS", "fallback", f"解析退出码 {rc}，恢复旧 raw：{tail[-300:]}", t0)
            return
        self.step("原站 EPS", "ok", f"抓取 {new.get('capturedAt')}，原站面板日 {new.get('panelDay')}，"
                                     f"修订 {gate['revised']} 个旧值", t0, detail_by_code=gate["detail"])

    def s5_final(self) -> bool:
        t0 = time.time()
        rc, tail = self.run_cmd(["fetch_data.py", "--enrich-only"], "s5_final")
        if rc != 0:
            self.step("最终数据包 enrich-only", "failed", f"退出码 {rc}：{tail[-300:]}", t0)
            return False
        self.step("最终数据包 enrich-only", "ok", "三 provider 缓存统一生成", t0)
        return True

    def s6_verify(self) -> bool:
        t0 = time.time()
        fd = self.load_fd()
        old = read_bundle(self.prod("data-bundle.js"))
        new = read_bundle(self.stg("data-bundle.js"))
        raw_p = self.stg("data/providers/original_eps_raw/capture.json")
        eps_raw = read_json(raw_p) if os.path.exists(raw_p) else None
        gate = bundle_gate(old, new, fd, eps_raw)
        self.report["revisions"] = gate["revisions"][:200]
        self.report["headTrim"] = gate["headTrim"][:200]
        self.report["tailReplaced"] = gate.get("tailReplaced", [])[:200]
        self.report["fields"] = field_summary(new)
        self.report["dataAsOf"] = (new or {}).get("asOf")
        self.report["previousAsOf"] = (old or {}).get("asOf")
        if not gate["ok"]:
            self.step("数据包门禁", "failed", f"{len(gate['problems'])} 个问题，未发布", t0, problems=gate["problems"][:50])
            return False
        audit = "跳过（无 node）"
        if shutil.which("node"):
            try:
                r = subprocess.run([self.python, "reports/manager_audit.py"], cwd=self.stage, capture_output=True,
                                   text=True, timeout=900)
            except subprocess.TimeoutExpired:
                r = None
            if r is None or r.returncode != 0:
                self.step("数据包门禁", "failed", "manager_audit 复算未通过，未发布", t0,
                          problems=[((r.stdout + r.stderr)[-800:] if r else "超时")])
                return False
            audit = "manager_audit 通过"
        self.step("数据包门禁", "ok", f"结构/观测/末日/选源/EPS 一一对应通过；{audit}；"
                                     f"修订 {sum(x['count'] for x in gate['revisions'])} 个旧值", t0)
        return True

    # ---- 发布 ----
    def publish_list(self) -> list[str]:
        rels = [r for r in PUBLISH_FILES if os.path.exists(self.stg(r))]
        for t in PUBLISH_TREES:
            rels += walk_rel(self.stage, t)
        rels = [r for r in dict.fromkeys(rels) if not excluded(r)]
        # data-bundle.js 最后替换：前端读的是它，其余文件先就位
        rels.sort(key=lambda r: (r == "data-bundle.js", r))
        out = []
        for r in rels:
            p = self.prod(r)
            if not os.path.exists(p):
                out.append(r)
                continue
            with open(p, "rb") as a, open(self.stg(r), "rb") as b:
                if a.read() != b.read():
                    out.append(r)
        return out

    def publish(self) -> bool:
        t0 = time.time()
        changed = self.publish_list()
        bdir = os.path.join(self.app, "data", "refresh-backups", self.ts)
        done, created = [], []
        try:
            for r in changed:
                if os.path.exists(self.prod(r)):
                    copy_rel(self.app, bdir, r)
            for r in changed:
                existed = os.path.exists(self.prod(r))
                with open(self.stg(r), "rb") as f:
                    atomic_write_bytes(self.prod(r), f.read())
                (done if existed else created).append(r)
            if self.bundle_out:
                ext_backup = os.path.join(bdir, "_bundle_out", "data-bundle.js")
                if os.path.exists(self.bundle_out):
                    os.makedirs(os.path.dirname(ext_backup), exist_ok=True)
                    shutil.copy2(self.bundle_out, ext_backup)
                with open(self.stg("data-bundle.js"), "rb") as f:
                    atomic_write_bytes(self.bundle_out, f.read())
                changed = changed + [self.bundle_out]
        except BaseException as e:  # noqa: BLE001  含 SIGTERM→SystemExit：先回滚再结束
            for r in done:
                with open(os.path.join(bdir, r), "rb") as f:
                    atomic_write_bytes(self.prod(r), f.read())
            for r in created:
                if os.path.exists(self.prod(r)):
                    os.unlink(self.prod(r))
            ext_backup = os.path.join(bdir, "_bundle_out", "data-bundle.js")
            if self.bundle_out and os.path.exists(ext_backup):
                with open(ext_backup, "rb") as f:
                    atomic_write_bytes(self.bundle_out, f.read())
            self.step("发布", "failed", f"替换中出错已回滚：{type(e).__name__}: {e}", t0)
            return False
        self.report["published"] = True
        self.report["backup"] = os.path.relpath(bdir, self.app) if changed else None
        self.step("发布", "ok", f"原子替换 {len(changed)} 个文件；备份 {os.path.relpath(bdir, self.app)}", t0,
                  files=changed[:60] + (["…"] if len(changed) > 60 else []))
        self.prune_backups()
        return True

    def prune_backups(self) -> None:
        root = os.path.join(self.app, "data", "refresh-backups")
        dirs = sorted(d for d in os.listdir(root) if os.path.isdir(os.path.join(root, d))) if os.path.isdir(root) else []
        for d in dirs[:-self.keep_backups]:
            shutil.rmtree(os.path.join(root, d), ignore_errors=True)

    # ---- 报告 ----
    def finalize(self, code: int) -> int:
        self.report["endedAt"] = utcnow()
        self.report["endedAtBeijing"] = bjnow().isoformat(timespec="seconds")
        self.report["status"] = {EXIT_OK: "success", EXIT_PARTIAL: "partial", EXIT_FAILED: "failed",
                                 EXIT_LOCKED: "locked"}.get(code, str(code))
        self.report["exitCode"] = code
        self.report["workDir"] = os.path.relpath(self.work, self.app) if os.path.exists(self.work) else None
        rdir = self.prod("reports/refresh")
        atomic_write_json(os.path.join(rdir, "last-refresh.json"), self.report)
        atomic_write_bytes(os.path.join(rdir, "last-refresh.md"), render_md(self.report).encode("utf-8"))
        if code in (EXIT_OK, EXIT_PARTIAL) and not self.keep_work:
            shutil.rmtree(self.work, ignore_errors=True)
            self.report["workDir"] = None
        return code

    def run(self) -> int:
        if not self.acquire():
            self.step("锁", "skipped", f"{os.path.relpath(self.lock, self.app)} 已存在：另一刷新进行中，本次跳过（不删除未知锁）")
            self.report["endedAt"] = utcnow()
            print(json.dumps({"status": "locked"}, ensure_ascii=False))
            return EXIT_LOCKED
        try:
            self.prepare()
            if not self.s1_market():
                return self.finalize(EXIT_FAILED)
            as_of = self.a_calendar_last()
            self.report["providerAsOf"] = as_of
            self.provider_step("domestic", as_of)
            self.provider_step("supplemental", as_of)
            self.s4_eps(as_of)
            if not self.s5_final() or not self.s6_verify():
                return self.finalize(EXIT_FAILED)
            if not self.publish():
                return self.finalize(EXIT_FAILED)
            degraded = [s for s in self.steps if s["status"] in ("fallback", "partial")]
            if self.mode == "offline" or self.skip_eps:
                degraded = degraded or [s for s in self.steps if s["status"] in ("cache", "skipped")]
            return self.finalize(EXIT_PARTIAL if degraded else EXIT_OK)
        except (Exception, SystemExit, KeyboardInterrupt) as e:  # noqa: BLE001  中断也写失败报告；发布阶段自有回滚
            self.step("runner", "failed", f"{type(e).__name__}: {e}", trace=traceback.format_exc()[-2000:])
            return self.finalize(EXIT_FAILED)
        finally:
            self.release()


STATUS_CN = {"ok": "成功", "fallback": "失败→沿用旧缓存", "partial": "部分成功", "failed": "失败",
             "cache": "仅缓存（未联网）", "skipped": "跳过"}


def render_md(r: dict) -> str:
    head = {"success": "成功：全部来源在线刷新并通过验证，已发布",
            "partial": "部分成功：验证通过并已发布，但有来源沿用旧缓存或未联网（见下表），不代表全部最新",
            "failed": "失败：生产数据未改动（仍为上一次成功版本）",
            "locked": "跳过：另一刷新进行中"}.get(r.get("status"), r.get("status"))
    lines = [f"# 指数全景刷新报告", "",
             f"- 结果：**{head}**（退出码 {r.get('exitCode')}）",
             f"- 模式：{r.get('mode')}；开始 {r.get('startedAt')}（北京 {r.get('startedAtBeijing')}），结束 {r.get('endedAt')}",
             f"- 数据包 asOf：{r.get('dataAsOf')}（上一版 {r.get('previousAsOf')}）。**生成时间不等于数据时间**，各字段日期见下表",
             f"- 已发布：{'是' if r.get('published') else '否'}；备份：{r.get('backup') or '—'}；失败现场：{r.get('workDir') or '—'}",
             "", "## 各步骤", "", "| 步骤 | 状态 | 说明 | 秒 |", "|---|---|---|---|"]
    for s in r.get("steps", []):
        lines.append(f"| {s['name']} | {STATUS_CN.get(s['status'], s['status'])} | {str(s.get('detail', '')).replace('|', '/')} | {s.get('seconds') or ''} |")
    probs = [(s["name"], p) for s in r.get("steps", []) for p in (s.get("problems") or s.get("failures") or [])]
    if probs:
        lines += ["", "## 问题明细（前 40 条）", ""] + [f"- {n}: {str(p)[:300]}" for n, p in probs[:40]]
    if r.get("fields"):
        lines += ["", "## 各指数字段真实最新日期（样本数·来源）", "",
                  "| 代码 | 名称 | 价格 | PE | PB | 股息率 | EPS | ROE |", "|---|---|---|---|---|---|---|---|"]
        for row in r["fields"]:
            def c(f):
                x = row[f]
                return f"{x['last']}（{x['count']}·{x['provider']}）" if x["count"] else "—"
            lines.append(f"| {row['code']} | {row['name']} | {c('price')} | {c('pe')} | {c('pb')} | {c('dy')} | {c('eps')} | {c('roe')} |")
    rev = r.get("revisions") or []
    lines += ["", "## 历史修订（上游改了旧日期的值；不拒收，只列出）", ""]
    lines += [f"- {x['code']}.{x['field']}: {x['count']} 处，如 {x['samples'][:2]}" for x in rev[:60]] or ["- 无"]
    if r.get("tailReplaced"):
        lines += ["", "## 蛋卷滚动尾点替换（周一网格 + 最新交易日尾点；旧尾点被更新尾点取代，不是丢数据）", ""]
        lines += [f"- {x['code']}.{x['field']}: {x['replaced'][0]}={x['replaced'][1]} → 新末日 {x['newLast']}"
                  for x in r["tailReplaced"][:60]]
    if r.get("headTrim"):
        lines += ["", "## 最早端裁剪（上游滚动窗口，新样本≥原 90%）", ""] + [f"- {x}" for x in r["headTrim"][:60]]
    lines += ["", "口径：EPS 唯一来源为李神奇数据网（计算口径未核实，元/每股，每 5 个交易日取 1 点）；与 PE 来源不同、不可互相换算。"]
    return "\n".join(lines) + "\n"


def eps_smoke(app: str, codes: list[str], out_dir: str, capture=capture_eps) -> int:
    """只抓几只 EPS 做在线冒烟：不发布、不改生产文件，结果写 out_dir。"""
    t0 = time.time()
    os.makedirs(out_dir, exist_ok=True)
    old_p = os.path.join(app, "data/providers/original_eps_raw/capture.json")
    old = read_json(old_p) if os.path.exists(old_p) else None
    try:
        new = capture(os.path.join(app, "providers/original_eps_capture.js"), codes)
    except Exception as e:  # noqa: BLE001
        res = {"ok": False, "problems": [f"{type(e).__name__}: {str(e)[:500]}"]}
    else:
        res = eps_capture_gate(old, new, subset=codes)
        res["capture"] = {k: new.get(k) for k in ("capturedAt", "page", "range", "panelDay", "unitEps", "onlyCodes", "errors")}
        atomic_write_json(os.path.join(out_dir, "eps-smoke-capture.json"), new)
    res["seconds"] = round(time.time() - t0, 1)
    res["codes"] = codes
    atomic_write_json(os.path.join(out_dir, "eps-smoke-result.json"), res)
    print(json.dumps(res, ensure_ascii=False, indent=1))
    return EXIT_OK if res["ok"] else EXIT_FAILED


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="指数全景无人值守刷新（staging + 门禁 + 原子发布）")
    ap.add_argument("--mode", choices=["online", "offline"], default="online")
    ap.add_argument("--skip-eps", action="store_true", help="不在线抓原站 EPS，沿用已有 raw")
    ap.add_argument("--work-root", default=None, help="staging 根目录（默认 data/refresh-work）")
    ap.add_argument("--keep-work", action="store_true", help="成功也保留 staging 现场")
    ap.add_argument("--bundle-out", default=None, help="验证通过后另把 data-bundle.js 原子发布到此路径（如前端 public 目录）")
    ap.add_argument("--eps-smoke", default="", help="逗号分隔本地代码：只抓这些 EPS 做冒烟，不发布")
    ap.add_argument("--print-commit-paths", action="store_true")
    ap.add_argument("--print-cache-paths", action="store_true")
    a = ap.parse_args(argv)
    if a.print_commit_paths:
        print("\n".join(commit_paths(APP)))
        return 0
    if a.print_cache_paths:
        print("\n".join(CACHE_PATHS))
        return 0
    if a.eps_smoke:
        codes = [c.strip() for c in a.eps_smoke.split(",") if c.strip()]
        return eps_smoke(APP, codes, os.path.join(a.work_root or os.path.join(APP, "data", "refresh-work"), "eps-smoke"))
    import signal
    # CI 超时/取消发 SIGTERM：转成 SystemExit，让 finally 释放锁、subprocess.run 杀掉子进程；未发布的 staging 不影响生产
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(143))
    r = Runner(APP, a.mode, a.skip_eps, a.work_root, a.keep_work, bundle_out=a.bundle_out)
    code = r.run()
    print(json.dumps({"status": r.report.get("status"), "exitCode": code, "dataAsOf": r.report.get("dataAsOf"),
                      "published": r.report.get("published")}, ensure_ascii=False))
    return code


if __name__ == "__main__":
    sys.exit(main())
