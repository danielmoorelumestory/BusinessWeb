"""网格详情页 B20 申赎篮子宽度快照（只用 Python 标准库）。

口径沿用 gupiaoWS 研究「ETF 历史申赎篮子成分宽度」（industry_breadth_audit/protocol_IB.md §1–4、
protocol_amendments_IB.md A3/A3b、b20_top_expansion/protocol_B20TX.md §4，lib_ib.stock/tri 的逻辑在此逐段移植）：

- t 日篮子 = 深交所当日 PCF（ETF{code}{yyyymmdd}.txt）。文件内日期、基金代码、目标指数必须相符，
  解析出的成分数 + 现金占位 159900 必须等于“全部申购赎回组合证券只数”。当日无清单（404）→ 当日留空，不前填、不用其他日的篮子；
  请求失败或核验不通过 → 本次更新失败、不写盘（见下“写盘保护”）。
- N_t = 当日 PCF 中除 159900 以外的全部证券；股数为 0 或“必须”现金替代的仍算成员（单独计数）。
- 个股价格 = 腾讯不复权日线 × 比例事件链因子（后复权方向，因子只用到 ≤t 的事件）。事件链只采用腾讯日线内嵌分红送转
  与东财分红送配明细“实施分配”两源一致的事件；只在一方出现或金额不符 → bad_ev，窗口跨越它即未知。东财空表须巨潮
  “权益分派”类公告中无实施公告才判无事件（A3b）。另加一道本页新增的第三源旁证（qfq_check）：腾讯前复权大体是加法口径，
  非事件日相邻两天的涨跌须与不复权一致，出现明显跳变的日子记为 bad_ev（可能是两源都没记的配股等）；除权日只报告量级偏差、不改判。
- 个股 B20 判定：adj_t 严格大于此前 20 个 A 股交易日（不含 t）adj 的均值；t 与这 20 日任一缺 K 线、或窗口 (t−20, t]
  跨未核实事件 → 未知。不填充停牌，不沿用最后价格。
- 当日 B20 = 真 / (真 + 假)，覆盖率 (真 + 假) / N < 95% 时为空（仍保留计数与原因）。
- 个股 B20 的“严格高于”用 math.fsum 求均值并留 1e-9 相对容差（above_mean），避免十进制价格在浮点下求和产生假站上。
- 原研究严格版：PCF 的 Last-Modified 晚于当日 09:00（北京）的日子，篮子派生值置空。本页沿用并比较到秒（09:00:01 即晚，
  原研究按分钟）；缺 Last-Modified 也留空。Last-Modified 只是服务器元数据，不等于实际发布时间，不能证明历史披露时间。

数据更新：python3 scripts/grid_b20.py update        （收盘后运行；PCF 只抓新增日期，个股行情与分红表每次重取）
         python3 scripts/grid_b20.py build --offline（只用本地缓存重算，不联网）
写盘保护：本次有任何来源 403/429、拉取或解析失败 → 两份产物都不动，退出码 2；过去有数的日期被重算成缺失（疑似不完整数据）→
不动，退出码 3（人工确认后可加 --allow-regress）；新交易日覆盖不足照实写入；页面数据除生成时间外无变化 → 不写盘，退出码 0。
原始文件缓存在 .local/grid-b20/（不入库）；入库的是页面数据 notes-site/public/data/grid-b20/{code}.json
和溯源清单 data-raw/grid-b20/{code}-provenance.json（每份 PCF 的 url/sha256/Last-Modified/抓取时间与当日成员版本，
每只个股的请求 url/sha256/事件链/核对结果）。两份文件总是同一次运行一起写出，彼此一致。
请求节奏：单线程；PCF 间隔 1s，腾讯 1.2s，东财 1.5s，巨潮 3s；HTTP 403/429 立即停止该来源，不重试、不绕过。
"""
from __future__ import annotations

import argparse
import bisect
import datetime as dt
import email.utils
import hashlib
import json
import math
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(os.environ.get("GRID_B20_CACHE", ROOT / ".local" / "grid-b20"))
BJ = dt.timezone(dt.timedelta(hours=8))
UA = {"User-Agent": "Mozilla/5.0"}
STOCK_FROM = "2023-12-01"  # 首个 PCF 日之前至少 20 个交易日
ETFS = {
    "159593": {"name": "中证A50指数ETF", "index": "930050", "listing": "2024-03-12", "symbol": "sz159593"},
}
WINDOW = 20
MIN_COV = 0.95
LM_GATE = "09:00:00"  # 比较到秒：09:00:00 有效，09:00:01 起算晚
REL_EPS = 1e-9      # 严格大于的相对容差：吸收十进制价格在二进制浮点下的求和误差，远小于真实最小价差（约 1e-7）
GAPS = {"pcf": 1.0, "tx": 1.2, "em": 1.5, "cn": 3.0}  # 各来源请求间隔（秒）
BACKOFF = 3.0       # 网络抖动重试退避基数（秒）
PCF_URL = "https://reportdocs.static.szse.cn/files/text/etf/ETF{code}{ymd}.txt"
TX_URL = "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={sym},day,{start},{end},2000,{fq}"
EM_URL = ("https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_SHAREBONUS_DET&columns=SECURITY_CODE,EX_DIVIDEND_DATE,"
          "EQUITY_RECORD_DATE,PRETAX_BONUS_RMB,BONUS_IT_RATIO,ASSIGN_PROGRESS,IMPL_PLAN_PROFILE&filter=(SECURITY_CODE%3D%22{code}%22)&pageSize=200&pageNumber={page}")
CNINFO_QUERY = "http://www.cninfo.com.cn/new/hisAnnouncement/query"
CNINFO_ORG = "http://www.cninfo.com.cn/new/data/szse_stock.json"


def now_iso() -> str:
    return dt.datetime.now(BJ).isoformat(timespec="seconds")


def sha256(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def prefix(code: str) -> str:
    return "sh" if code[0] in "69" else ("bj" if code[0] in "48" else "sz")


# ---------------------------------------------------------------- 取数（限速、403 即停）
class Blocked(Exception):
    pass


class Source:
    def __init__(self, name: str, gap: float):
        self.name, self.gap, self.last, self.blocked = name, gap, 0.0, None

    def get(self, url: str, data: bytes | None = None, retries: int = 3) -> tuple[int, bytes, dict]:
        if self.blocked: raise Blocked(self.blocked)
        err = None
        for k in range(retries + 1):
            wait = self.last + self.gap - time.time()
            if wait > 0: time.sleep(wait)
            self.last = time.time()
            try:
                with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=UA), timeout=30) as r:
                    return r.status, r.read(), dict(r.headers)
            except urllib.error.HTTPError as e:
                e.close()
                if e.code in (403, 429):
                    self.blocked = f"{self.name} HTTP {e.code}：停止该来源，不重试、不绕过"
                    raise Blocked(self.blocked)
                if e.code == 404: return 404, b"", dict(e.headers or {})
                err = repr(e)
            except Exception as e:  # noqa: BLE001 网络抖动退避重试
                err = repr(e)
            if k < retries: time.sleep(BACKOFF * (k + 1))  # 最后一次失败后不再空等
        raise OSError(err)


# ---------------------------------------------------------------- PCF
def parse_szse_pcf(text: str) -> dict:
    """移植自 own_etf_audit/scripts/breadth_data.py:parse_szse_pcf；另取基金代码。"""
    g = lambda k: (re.search(k + r"：\s*(\S+)", text) or [None, None])[1]  # noqa: E731
    comps = []
    for m in re.finditer(r"^\s*(\d{6})\s+(.+?)\s+([\d,]+)\s+(允许|禁止|必须|退补|深市退补|沪市退补)\s+([\d.]+)%\s+([\d.]+)%\s+([\d,.]+)", text, re.M):
        if m.group(1) == "159900": continue  # 申赎现金占位
        comps.append({"code": m.group(1), "name": m.group(2).replace(" ", ""), "qty": float(m.group(3).replace(",", "")), "flag": m.group(4)})
    date = (re.search(r"\(\s*(\d{4}-\d{2}-\d{2})\s*\)", text) or [None, None])[1]
    return {"date": date, "fund_code": g("基金代码"), "target_index": g("目标指数代码"), "n_all": g("全部申购赎回组合证券只数"), "components": comps}


def verify_pcf(x: dict, code: str, index: str, d: str) -> tuple[dict | None, str | None]:
    """返回 (篮子, 问题)。篮子：{codes, declared, qty0, must_cash, names}。"""
    if x["date"] != d: return None, f"日期不符：{x['date']}"
    if x["fund_code"] != code: return None, f"基金代码不符：{x['fund_code']}"
    if x["target_index"] != index: return None, f"目标指数不符：{x['target_index']}"
    m = re.match(r"\d+", x["n_all"] or "")
    if not m: return None, "缺少申明只数"
    comps = x["components"]
    if len(comps) + 1 != int(m.group()): return None, f"只数不符：解析 {len(comps)}+1 ≠ 申明 {m.group()}"
    codes = [c["code"] for c in comps]
    if len(set(codes)) != len(codes): return None, "成分重复"
    return {"codes": sorted(codes), "declared": int(m.group()), "qty0": sum(c["qty"] == 0 for c in comps),
            "must_cash": sum(c["flag"] == "必须" for c in comps), "names": {c["code"]: c["name"] for c in comps}}, None


def lm_beijing(v: str | None) -> str | None:
    if not v: return None
    return email.utils.parsedate_to_datetime(v).astimezone(BJ).strftime("%Y-%m-%d %H:%M:%S")


def lm_gate(lm: str | None, d: str) -> str | None:
    """原研究严格版（EV-A3）：PCF 的 Last-Modified 晚于当日 09:00 → 篮子派生值置空。返回原因或 None。
    比较到秒（lm 形如 'YYYY-MM-DD HH:MM:SS'，北京时间）：09:00:00 有效，09:00:01 即晚。原研究按分钟比较（09:00:59 仍算有效），本页更严。
    Last-Modified 是服务器元数据，不等于实际发布时间。"""
    if lm is None: return "lm_missing"
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}", lm): return "lm_missing"
    return "lm_late" if lm > f"{d} {LM_GATE}" else None


# ---------------------------------------------------------------- 个股：比例事件链（移植 lib_ib.stock，A3/A3b）
def parse_fh(t: str | None) -> tuple[float, float]:
    """'10送2转3派1.5元' → (每股派现, 每股送转)。"""
    def g(k):
        m = re.search(k + r"(?:增|股)?\s*([\d.]+)", t or "")
        return float(m.group(1)) if m else 0.0
    m = re.match(r"\s*(\d+)", t or "")
    base = float(m.group(1)) if m else 10.0
    return g("派") / base, (g("送") + g("转")) / base


def em_events(divs: dict | None, cninfo: list | None) -> tuple[dict | None, str]:
    """东财“实施分配”事件 {除权日: (派现, 送转)}；None 表示口径未知（附原因）。"""
    if divs is None: return None, "东财分红表缺失"
    if not divs.get("success"):
        if divs.get("code") != 9201: return None, "东财分红表请求错误"
        if cninfo is None: return None, "东财空表·巨潮缺失"
        if any("实施" in r["title"] for r in cninfo): return None, "东财空表但巨潮有权益分派实施公告（事件无法定量）"
        return {}, "东财空表·巨潮无实施公告"
    out: dict = {}
    for r in divs["result"]["data"]:
        if r.get("ASSIGN_PROGRESS") != "实施分配" or not r.get("EX_DIVIDEND_DATE"): continue
        d = r["EX_DIVIDEND_DATE"][:10]
        a, b = parse_fh(r.get("IMPL_PLAN_PROFILE"))
        o = out.get(d, (0.0, 0.0)); out[d] = (o[0] + a, o[1] + b)
    return out, "东财分红表"


def tencent_rows(payload: dict, field: str) -> list:
    d = payload.get("data") or {}
    v = next(iter(d.values()), {}) if isinstance(d, dict) else {}
    return (v.get(field) if isinstance(v, dict) else None) or []


def tx_has(payload: dict, field: str) -> bool:
    d = payload.get("data") or {}
    v = next(iter(d.values()), {}) if isinstance(d, dict) else {}
    return isinstance(v, dict) and field in v


def build_stock(raw_rows: list, divs: dict | None, cninfo: list | None, qfq_rows: list | None = None) -> dict:
    rw = {r[0]: float(r[2]) for r in raw_rows}
    rd = sorted(rw)
    tev: dict = {}
    for r in raw_rows:
        if len(r) > 6 and isinstance(r[6], dict) and r[6].get("FHcontent"):
            a, b = parse_fh(r[6]["FHcontent"]); o = tev.get(r[0], (0.0, 0.0)); tev[r[0]] = (o[0] + a, o[1] + b)
    eev, why = em_events(divs, cninfo)
    base = {"raw": rw, "dates": rd, "first": rd[0] if rd else None, "last": rd[-1] if rd else None, "tencent_events": tev}
    if eev is None:
        return {**base, "adj": {}, "good_ev": {}, "bad_ev": [], "adj_source": "unknown:" + why, "qfq_check": None}

    def snap(d):  # 除权日落在停牌日 → 之后第一根 K 线
        k = bisect.bisect_left(rd, d); return rd[k] if k < len(rd) else None
    em: dict = {}
    for d, v in eev.items():
        if rd and rd[0] < d <= rd[-1]:
            s = snap(d); o = em.get(s, (0.0, 0.0)); em[s] = (o[0] + v[0], o[1] + v[1])
    tv = {d: v for d, v in tev.items() if rd and rd[0] < d <= rd[-1]}
    good, bad = {}, []
    for d in sorted(set(em) | set(tv)):
        a, b = em.get(d), tv.get(d)
        if a and b and abs(a[0] - b[0]) < 5e-5 and abs(a[1] - b[1]) < 5e-5: good[d] = a
        else: bad.append(d)
    f, adj = 1.0, {}
    for n, d in enumerate(rd):
        if d in good and n > 0:
            pc = rw[rd[n - 1]]; cash, sz = good[d]; f *= pc / ((pc - cash) / (1 + sz))
        adj[d] = rw[d] * f
    check = qfq_check(rw, rd, good, bad, qfq_rows) if qfq_rows is not None else None
    if check and check["breaks"]:
        bad = sorted(set(bad) | set(check["breaks"]))
    return {**base, "adj": adj, "good_ev": good, "bad_ev": bad, "em_events": em, "qfq_check": check,
            "adj_source": f"event_chain:一致{len(good)}·不一致{len(bad)}"}


def qfq_check(rw: dict, rd: list, good: dict, bad: list, qfq_rows: list, tol: float = 0.0115) -> dict:
    """第三源核对（只用于发现两源都漏记的行动）：腾讯前复权大体是加法口径（600519 的 不复权 − 前复权 在两次除权之间恒定），
    但并不严格：除权日的跳变与派现常差 1%–3%（如 000333 2024-05-15 跳 2.979、派现 3.0），含送转的阶段也不是简单仿射。所以：
    - 非事件日：相邻交易日 (Q_d − Q_p) 与 (R_d − R_p) 之差超过 max(容差, 0.1% × 价) → 断点，并入未核实事件（可能是漏记的配股、派现等）；
    - 除权日：只核“跳了、量级对”：|ΔQ − (R_d − (R_p − 派现))| ≤ 0.02 + 3% × 派现，否则记入 event_mismatch（只报告，不改判，事件已由两源一致确认）；
    - 之后还有送转的日子（前复权斜率 ≠ 1）不核对，计入 skipped。"""
    Q = {r[0]: float(r[2]) for r in qfq_rows}
    days = [d for d in rd if d in Q]
    if len(days) < 2: return {"from": None, "to": None, "pairs": 0, "skipped": 0, "breaks": [], "event_mismatch": [], "max_resid": None}
    bonus = sorted(d for d, v in good.items() if v[1] > 0) + sorted(d for d in bad)  # 未核实事件的送转情况未知，同样不核对其之前的段
    pos = {d: k for k, d in enumerate(rd)}
    breaks, mism, worst, pairs, skipped = [], [], 0.0, 0, 0
    for i in range(1, len(days)):
        p, d = days[i - 1], days[i]
        if pos[d] - pos[p] != 1: continue  # 只核对原始日线上相邻的两天
        if any(e > d for e in bonus): skipped += 1; continue
        if d in bad: skipped += 1; continue
        pairs += 1
        if d in good:
            cash, sz = good[d]
            if sz > 0: skipped += 1; continue
            resid = abs((Q[d] - Q[p]) - (rw[d] - (rw[p] - cash)))
            if resid > 0.02 + 0.03 * cash: mism.append(d)
            continue
        resid = abs((Q[d] - Q[p]) - (rw[d] - rw[p]))
        worst = max(worst, resid)
        if resid > max(tol, 0.001 * rw[d]): breaks.append(d)
    return {"from": days[0], "to": days[-1], "pairs": pairs, "skipped": skipped, "breaks": breaks, "event_mismatch": mism, "max_resid": round(worst, 6)}


# ---------------------------------------------------------------- 宽度（三态）
def member_state(S: dict | None, cal: list, t_idx: int) -> tuple[bool | None, str | None]:
    """返回 (真/假, None) 或 (None, 未知原因)。"""
    if S is None: return None, "kline"
    if t_idx - WINDOW < 0: return None, "kline"
    if not S["adj"]: return None, "adj"
    v = [S["adj"].get(cal[j]) for j in range(t_idx - WINDOW, t_idx + 1)]
    if any(x is None for x in v): return None, "kline"
    a, b = cal[t_idx - WINDOW], cal[t_idx]
    if any(a < d <= b for d in S["bad_ev"]): return None, "adj"
    return above_mean(v[-1], v[:-1]), None


def above_mean(today: float, prev: list) -> bool:
    """严格大于此前均值的稳定比较：math.fsum 求和（无累计舍入），差值须超过 REL_EPS × 量级才算站上。
    二十个相等的十进制价格（如 0.7）的均值在浮点下可能比单值小一个 ulp，直接 > 比较会得到假站上；真实最小价差
    （1 分 ÷ 20 日 ÷ 数千元股价 ≈ 2.5e-7 相对）远大于 1e-9，仍可区分。"""
    mean = math.fsum(prev) / len(prev)
    return today - mean > REL_EPS * max(abs(today), abs(mean))


def breadth_day(codes: list, stocks: dict, cal: list, t_idx: int) -> dict:
    T = F = 0; unk = {"kline": 0, "adj": 0}
    for c in codes:
        st, why = member_state(stocks.get(c), cal, t_idx)
        if st is None: unk[why] += 1
        elif st: T += 1
        else: F += 1
    N = len(codes); K = T + F
    return {"N": N, "T": T, "F": F, "K": K, "cov": K / N if N else None, "unk": unk,
            "value": T / K if N and K and K / N >= MIN_COV else None}


def compute_rows(etf_dates: list, baskets: dict, issues: dict, lm_bj: dict, stocks: dict, cal: list) -> tuple[list, dict]:
    """逐日行 [date, value, above, valid, total, reason, detail]。t 日只取 baskets[t]，缺篮子当日为空，不前填、不用其他日的篮子。"""
    ci = {d: k for k, d in enumerate(cal)}
    rows = []; counts = {"days": len(etf_dates), "basket": 0, "value": 0, "coverage": 0, "lm_late": 0, "lm_missing": 0, "pcf": 0}
    for d in etf_dates:
        codes = baskets.get(d)
        if codes is None or d not in ci:
            rows.append([d, None, None, None, None, "pcf", issues.get(d, "无交易日历")]); counts["pcf"] += 1; continue
        counts["basket"] += 1
        x = breadth_day(codes, stocks, cal, ci[d])
        reason = lm_gate(lm_bj.get(d), d) or ("coverage" if x["value"] is None else None)
        counts[reason or "value"] += 1
        detail = f"未知 {x['N'] - x['K']}（缺K线 {x['unk']['kline']}，复权未核实 {x['unk']['adj']}）" if x["N"] != x["K"] else None
        rows.append([d, None if reason else round(x["value"], 6), x["T"], x["K"], x["N"], reason, detail])
    return rows, counts


# ---------------------------------------------------------------- 主流程
def read_json(p: Path):
    return json.loads(p.read_text("utf-8")) if p.exists() else None


def write_json(p: Path, obj, compact=False) -> bool:
    p.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, ensure_ascii=False, separators=(",", ":")) if compact else json.dumps(obj, ensure_ascii=False, indent=1)
    if p.exists() and p.read_text("utf-8") == text + "\n": return False
    p.write_text(text + "\n", "utf-8"); return True


def outputs(code: str) -> tuple[Path, Path]:
    return ROOT / "notes-site" / "public" / "data" / "grid-b20" / f"{code}.json", ROOT / "data-raw" / "grid-b20" / f"{code}-provenance.json"


def settle_through(cal: list, etf_dates: list, now: dt.datetime) -> str:
    """只算已收盘的交易日：北京时间 16:00 之前不计入当天（腾讯日线盘中会给当日未收盘的 K 线）。"""
    today = now.strftime("%Y-%m-%d")
    done = [d for d in etf_dates if d < today or (d == today and now.strftime("%H:%M") >= "16:00")]
    if not done: raise SystemExit("没有已收盘的交易日")
    return done[-1]


def fetch_tx(src: Source, sym: str, start: str, end: str, fq: str, field: str) -> tuple[list, dict]:
    """腾讯日线；前复权接口每次最多 640 行，向前分页取齐。返回 (行, 溯源)。"""
    rows: dict = {}; metas = []; to = end
    while True:
        url = TX_URL.format(sym=sym, start=start, end=to, fq=fq)
        status, b, _ = src.get(url)
        payload = json.loads(b)
        page, used = tencent_rows(payload, field), field
        if not page and field == "qfqday" and tx_has(payload, "day") and not tx_has(payload, "qfqday"):
            # 从未除权的股票（如 688981）前复权请求只返回 day 键：前复权即不复权，照用并记下实际字段
            page, used = tencent_rows(payload, "day"), "day"
        metas.append({"url": url, "status": status, "bytes": len(b), "sha256": sha256(b), "fetched_at": now_iso(), "rows": len(page), "field": used})
        for r in page: rows.setdefault(r[0], r)
        if len(page) < 640 or not page or page[0][0] <= start: break
        prev = dt.date.fromisoformat(page[0][0]) - dt.timedelta(days=1)
        to = prev.isoformat()
    return [rows[d] for d in sorted(rows)], {"pages": metas}


class UpdateFailed(Exception):
    """来源封锁或明确的拉取 / 解析失败：本次不写盘。"""


def regressions(old: dict | None, new: dict) -> list:
    """过去有数的日期被重算成缺失（或整行消失、截止日后退）→ 视为不完整重算，返回问题列表。新增日期如实标记覆盖不足不算回退。"""
    if not old: return []
    out = []
    if old.get("through", "") > new["through"]: out.append(f"截止日后退：{old['through']} → {new['through']}")
    new_rows = {r[0]: r for r in new["rows"]}
    for r in old.get("rows", []):
        if r[1] is None: continue
        n = new_rows.get(r[0])
        if n is None: out.append(f"{r[0]} 行消失（原值 {r[1]}）")
        elif n[1] is None: out.append(f"{r[0]} 由 {r[1]} 变为缺失（{n[5]}：{n[6] or ''}）")
    return out


def value_changes(old: dict | None, new: dict) -> list:
    """过去有数、重算后仍有数但取值不同的日期（只报告，不阻止）。"""
    if not old: return []
    new_rows = {r[0]: r for r in new["rows"]}
    return [(r[0], r[1], new_rows[r[0]][1], r[2:5], new_rows[r[0]][2:5]) for r in old.get("rows", [])
            if r[1] is not None and r[0] in new_rows and new_rows[r[0]][1] is not None and new_rows[r[0]][1] != r[1]]


def commit_outputs(page_path: Path, prov_path: Path, page: dict, prov_out: dict, failures: list, allow_regress: bool, log=print) -> dict:
    """两层保护后才写盘：① 本次有任何来源封锁 / 拉取或解析失败 → 两份文件都不动；② 过去有数的日期被重算成缺失 → 不动（除非人工确认 allow_regress）。
    页面数据（除生成时间外）没有变化也不写：个股响应里含实时报价，溯源 sha256 每次都变，不值得为此产生提交。"""
    old = read_json(page_path)
    if failures:
        tally: dict = {}
        for failure in failures:
            source = re.split(r"[ ：]", failure, maxsplit=1)[0]
            tally[source] = tally.get(source, 0) + 1
        log(f"不写盘：{len(failures)} 项失败（保留现有两份文件）；按来源 {tally}"); [log(f"  - {f}") for f in failures[:20]]
        return {"written": False, "status": "failed", "failures": failures, "regressions": [], "changes": []}
    reg = regressions(old, page)
    changes = value_changes(old, page)
    for c in changes[:20]: log(f"  取值变化 {c[0]}：{c[1]} → {c[2]}（站上/有效/篮子 {c[3]} → {c[4]}）")
    if reg and not allow_regress:
        log(f"不写盘：{len(reg)} 个过去有数的日期会被改成缺失（疑似不完整重算；确认无误可加 --allow-regress）"); [log(f"  - {r}") for r in reg[:20]]
        return {"written": False, "status": "regressed", "failures": [], "regressions": reg, "changes": changes}
    same = old is not None and {**old, "generatedAt": None} == {**json.loads(json.dumps(page, ensure_ascii=False)), "generatedAt": None}
    if same: return {"written": False, "status": "unchanged", "failures": [], "regressions": reg, "changes": changes}
    write_json(page_path, page, compact=True); write_json(prov_path, prov_out)
    return {"written": True, "status": "written", "failures": [], "regressions": reg, "changes": changes}


def update(code: str, offline: bool, log=print, allow_regress: bool = False) -> dict:
    cfg = ETFS[code]
    page_path, prov_path = outputs(code)
    prov = read_json(prov_path) or {}
    pcf_man: dict = json.loads(json.dumps(prov.get("pcf", {})))  # 副本：失败时不污染已读入的清单
    cdir = CACHE / code
    for sub in ("pcf", "stocks", "divs", "cninfo"): (cdir / sub).mkdir(parents=True, exist_ok=True)
    pcf_src, tx_src, em_src, cn_src = Source("深交所 PCF", GAPS["pcf"]), Source("腾讯日线", GAPS["tx"]), Source("东财分红表", GAPS["em"]), Source("巨潮公告", GAPS["cn"])
    failures: list = []
    now = dt.datetime.now(BJ)

    def cached_tx(name, sym, fq, field):
        """联网时重取并覆盖缓存；离线时读缓存。失败抛 UpdateFailed / Blocked。"""
        p = cdir / f"{name}.json"
        if not offline:
            try:
                rows, meta = fetch_tx(tx_src, sym, STOCK_FROM, now.strftime("%Y-%m-%d"), fq, field)
            except (OSError, json.JSONDecodeError) as e:
                raise UpdateFailed(f"腾讯日线 {sym} {fq or 'raw'}：{e}") from e
            if not rows: raise UpdateFailed(f"腾讯日线 {sym} {fq or 'raw'}：返回空")
            p.write_text(json.dumps({"rows": rows, "meta": meta}, ensure_ascii=False), "utf-8")
        x = read_json(p)
        if x is None: raise UpdateFailed(f"缺少本地缓存 {p}，请先联网运行 update")
        return x["rows"], x["meta"]

    # 1) 日历：沪深300 日线日期 = A 股交易日；ETF 自身日线用于确定上市后的交易日与已收盘日。取不到直接失败。
    try:
        cal_rows, cal_meta = cached_tx("calendar_sh000300", "sh000300", "", "day")
        etf_rows, etf_meta = cached_tx(f"etf_{code}", cfg["symbol"], "", "day")
    except (UpdateFailed, Blocked) as e:
        failures.append(str(e)); log(f"不写盘：日历取数失败 {e}")
        return {"written": False, "status": "failed", "failures": failures, "regressions": [], "changes": []}
    cal = [r[0] for r in cal_rows]
    etf_dates = [r[0] for r in etf_rows if r[0] >= cfg["listing"]]
    through = settle_through(cal, etf_dates, now)
    cal = [d for d in cal if d <= through]
    etf_dates = [d for d in etf_dates if d <= through]
    ci = {d: k for k, d in enumerate(cal)}
    cal_issues = [d for d in etf_dates if d not in ci] + [d for d in cal if cfg["listing"] <= d and d not in set(etf_dates)]
    log(f"日历 {cal[0]}~{cal[-1]}（{len(cal)} 日），ETF 交易日 {len(etf_dates)}，截至 {through}，日历差异 {len(cal_issues)}")

    # 2) PCF：已有 200 的不重取（本地有原文件时核对 sha256）；404 只对最近 5 个交易日重试。
    #    404 是“当日没有清单”，如实留空；封锁、请求错误、sha256 不符、核验失败都算失败。
    baskets: dict = {}; issues: dict = {}
    versions: dict = json.loads(json.dumps(prov.get("baskets", {}))); names: dict = dict(prov.get("names", {}))
    vid_of = {tuple(v): k for k, v in versions.items()}
    recent = set(etf_dates[-5:])
    fetched = 0
    for d in etf_dates:
        ymd = d.replace("-", ""); p = cdir / "pcf" / f"{code}_{ymd}.txt"; rec = pcf_man.get(d)
        need = rec is None or ("error" in rec) or (rec.get("status") == 404 and d in recent)
        if need and offline:
            failures.append(f"PCF {d}：离线模式下没有已核验记录"); continue
        if need and pcf_src.blocked: continue  # 已记过封锁
        if need:
            url = PCF_URL.format(code=code, ymd=ymd)
            try:
                status, b, h = pcf_src.get(url)
                rec = {"url": url, "status": status, "fetched_at": now_iso()}
                if status == 200:
                    p.write_bytes(b); rec.update(bytes=len(b), sha256=sha256(b), last_modified=h.get("Last-Modified"), last_modified_bj=lm_beijing(h.get("Last-Modified")))
                fetched += 1
            except Blocked as e:
                failures.append(str(e)); continue
            except OSError as e:
                failures.append(f"PCF {d} 请求失败：{e}"); continue
            pcf_man[d] = rec
            if fetched % 50 == 0 and fetched: log(f"PCF 已抓 {fetched}，当前 {d}")
        if rec.get("status") == 404: issues[d] = "PCF 404"; continue
        if p.exists():
            b = p.read_bytes()
            if sha256(b) != rec.get("sha256"): failures.append(f"PCF {d}：本地原文与清单 sha256 不符"); continue
            bk, why = verify_pcf(parse_szse_pcf(b.decode("gbk", errors="replace")), code, cfg["index"], d)
            if bk is None: failures.append(f"PCF {d} 核验失败：{why}"); continue
            key = tuple(bk["codes"])
            if key not in vid_of:
                vid = f"v{len(versions) + 1}"; versions[vid] = list(key); vid_of[key] = vid
            rec.update(declared=bk["declared"], qty0=bk["qty0"], must_cash=bk["must_cash"], members=vid_of[key]); rec.pop("issue", None)
            names.update(bk["names"])
            baskets[d] = bk["codes"]
        elif rec.get("members") in versions:
            baskets[d] = versions[rec["members"]]  # 无原文件时用清单里已核验过的成员版本（sha256 可回溯原文）
        else:
            failures.append(f"PCF {d}：缺少原文件与成员记录")
    log(f"PCF 有效 {len(baskets)} / {len(etf_dates)} 日，404 {len(issues)}，本次抓取 {fetched}，失败 {len(failures)}")

    # 3) 成员个股（含调出成员）：腾讯不复权 + 前复权、东财分红表、必要时巨潮。任一失败都记失败，不退回旧缓存。
    union = sorted({c for v in baskets.values() for c in v})
    stocks: dict = {}; stock_meta: dict = {}
    cn_org = None
    for n, c in enumerate(union):
        if failures and not offline:
            # 已有失败，本次注定不写盘：不再请求后续成员，避免对已拒绝的来源继续重试（CI 上腾讯曾在约 80 次请求后连续回 501）
            log(f"已有 {len(failures)} 项失败，停止后续取数（剩 {len(union) - n} 只成员未取）"); break
        sym = prefix(c) + c
        try:
            raw_rows, raw_meta = cached_tx(f"stocks/{c}_raw", sym, "", "day")
            qfq_rows, qfq_meta = cached_tx(f"stocks/{c}_qfq", sym, "qfq", "qfqday")
        except Blocked as e:
            failures.append(str(e)); break
        except UpdateFailed as e:
            failures.append(str(e)); continue
        dp = cdir / "divs" / f"{c}.json"
        if not offline:
            try:
                pages = []; metas = []
                for page in range(1, 6):
                    url = EM_URL.format(code=c, page=page)
                    _, b, _ = em_src.get(url); x = json.loads(b)
                    metas.append({"url": url, "bytes": len(b), "sha256": sha256(b), "fetched_at": now_iso()})
                    pages.append(x)
                    if not x.get("success") or page >= ((x.get("result") or {}).get("pages") or 1): break
                merged = pages[0]
                if merged.get("success"):
                    merged = {**merged, "result": {**merged["result"], "data": [r for x in pages for r in (x.get("result") or {}).get("data") or []]}}
                if not merged.get("success") and merged.get("code") != 9201: raise OSError(f"接口错误 {merged.get('code')}")
                dp.write_text(json.dumps({"payload": merged, "meta": metas}, ensure_ascii=False), "utf-8")
            except Blocked as e:
                failures.append(str(e)); break
            except (OSError, json.JSONDecodeError) as e:
                failures.append(f"东财分红表 {c}：{e}"); continue
        dj = read_json(dp)
        if dj is None: failures.append(f"东财分红表 {c}：没有本地缓存"); continue
        divs, divs_meta = dj["payload"], dj["meta"]
        cninfo = None
        if not divs.get("success") and divs.get("code") == 9201:
            cp = cdir / "cninfo" / f"{c}.json"
            if not offline:
                try:
                    if cn_org is None:
                        _, b, _ = cn_src.get(CNINFO_ORG); cn_org = {a["code"]: a["orgId"] for a in json.loads(b)["stockList"]}
                    if c in cn_org:  # 巨潮股票表里没有该代码：如实按“巨潮缺失”判复权未知，不算失败
                        rows = []
                        for page in range(1, 6):
                            body = urllib.parse.urlencode({"stock": f"{c},{cn_org[c]}", "tabName": "fulltext", "pageSize": 30, "pageNum": page, "column": "sse" if c[0] in "69" else "szse",
                                                           "category": "category_qyfpxzcs_szsh", "seDate": f"2019-01-01~{through}", "isHLtitle": "true"}).encode()
                            _, b, _ = cn_src.get(CNINFO_QUERY, data=body); x = json.loads(b)
                            rows += [{"title": r["announcementTitle"], "time": r["announcementTime"], "id": r["announcementId"]} for r in (x.get("announcements") or [])]
                            if not x.get("hasMore"): break
                        cp.write_text(json.dumps(rows, ensure_ascii=False), "utf-8")
                    elif cp.exists(): cp.unlink()
                except Blocked as e:
                    failures.append(str(e)); break
                except (OSError, json.JSONDecodeError, KeyError) as e:
                    failures.append(f"巨潮 {c}：{e}"); continue
            cninfo = read_json(cp)
        S = build_stock(raw_rows, divs, cninfo, qfq_rows)
        stocks[c] = S
        stock_meta[c] = {"name": names.get(c), "tencent_raw": raw_meta, "tencent_qfq": qfq_meta, "eastmoney_divs": divs_meta,
                         "first": S["first"], "last": S["last"], "adj_source": S["adj_source"],
                         "events": {d: [round(v[0], 6), round(v[1], 6)] for d, v in S["good_ev"].items()}, "bad_events": S["bad_ev"], "qfq_check": S["qfq_check"]}
        if n % 20 == 0: log(f"个股 {n + 1}/{len(union)} {c} {S['adj_source']}")

    # 4) 逐日 B20：每天只用当天篮子
    rows, counts = compute_rows(etf_dates, baskets, issues, {d: (r or {}).get("last_modified_bj") for d, r in pcf_man.items()}, stocks, cal)
    last_valid = next((r for r in reversed(rows) if r[1] is not None), None)
    page = {
        "version": 1, "code": code, "name": cfg["name"], "index": cfg["index"], "through": through, "generatedAt": now_iso(),
        "fields": ["date", "value", "above", "valid", "total", "reason", "detail"],
        "reasons": {"pcf": "当日 PCF 缺失（404）", "coverage": "有效成员覆盖率低于 95%",
                    "lm_late": "PCF 的 Last-Modified 晚于当日 09:00:00（沿用原研究严格版留空；服务器元数据，不等于实际发布时间）",
                    "lm_missing": "PCF 缺 Last-Modified，无法套用可得性门槛"},
        "summary": {**counts, "firstValid": next((r[0] for r in rows if r[1] is not None), None), "lastValid": last_valid[0] if last_valid else None,
                    "members": len(union), "baskets": len(versions)},
        "method": "B20 = 当日官方 PCF 股票成员中，后复权（比例事件链）收盘严格高于此前 20 个交易日（不含当天）均值的成员数 ÷ 有效成员数；"
                  "t 与此前 20 日全部有已核实复权收盘才有效；覆盖率 < 95% 留空；每天只用当天的篮子，不用今天的篮子回填。",
        "rows": rows,
    }
    prov_out = {
        "code": code, "name": cfg["name"], "index": cfg["index"], "through": through, "generatedAt": page["generatedAt"],
        "script": "scripts/grid_b20.py", "lm_gate": f"PCF 的 Last-Modified（北京时间，比较到秒）晚于当日 {LM_GATE} 或缺失 → B20 留空；Last-Modified 是服务器元数据，不是实际发布时间",
        "calendar": {"source": cal_meta, "etf_source": etf_meta, "issues": cal_issues},
        "baskets": versions, "names": dict(sorted(names.items())), "pcf": dict(sorted(pcf_man.items())), "stocks": stock_meta,
    }
    res = commit_outputs(page_path, prov_path, page, prov_out, failures, allow_regress, log)
    log(f"完成：{counts}；末个有效日 {last_valid}；结果 {res['status']}；失败 {len(failures)}；回退 {len(res['regressions'])}；取值变化 {len(res['changes'])}")
    return {**res, "page": page, "stocks": stocks, "baskets": baskets, "cal": cal}


EXIT = {"written": 0, "unchanged": 0, "failed": 2, "regressed": 3}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("command", choices=["update", "build"])
    ap.add_argument("--code", default="159593", choices=sorted(ETFS))
    ap.add_argument("--offline", action="store_true", help="只用本地缓存重算（build 默认离线）")
    ap.add_argument("--allow-regress", action="store_true", help="人工确认后允许过去有数的日期变为缺失")
    a = ap.parse_args(argv)
    res = update(a.code, offline=a.offline or a.command == "build", log=print, allow_regress=a.allow_regress)
    return EXIT[res["status"]]


if __name__ == "__main__":
    sys.exit(main())
