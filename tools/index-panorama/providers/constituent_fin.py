#!/usr/bin/env python3
"""成分股自算 provider：用公开的成分股财报按整体法汇总指数 ROE 与归母净利润合计（TTM）。

只用于“没有任何公开指数级 ROE 来源”的指数（TARGETS），只提供 ``roe`` 与 ``np`` 两个字段。

数据路径（全部公开、无需登录/token）：
  * 成分与权重：中证指数官网 closeweight 文件（``<code>closeweight.xls``，官网“成分及权重”下载）。
  * 归母净利润（报告期累计值）：东方财富数据中心 RPT_LICO_FN_CPD（业绩报表）。
  * 归属于母公司股东权益合计：东方财富 F10 资产负债表接口（zcfzbAjaxNew，TOTAL_PARENT_EQUITY）。

口径：
  * 单家 TTM 净利润 = 本期累计 + 上年年报 − 上年同期累计（年报期直接取年报）。
  * 单家平均净资产 = (期末 + 上年同期末) / 2。
  * 指数 ROE（整体法）= Σ TTM 归母净利润 / Σ 平均归母净资产 × 100；np = Σ TTM 归母净利润 / 1e8（亿元）。
    按公司全口径相加，不按自由流通比例或指数权重调整。
  * 成分股只用“当前”名单回看历史（公开渠道拿不到历年调样），存在幸存者偏差；某报告期数据齐全的成分股
    按当前权重合计不足 MIN_COVER 时，该期不出数。
  * 日期：报告期末（3-31/6-30/9-30/12-31）对齐到当日或之前最近的交易日（以本指数行情存储为日历）。
    这是“报告期”而非“可得日”：财报在期末后 1~4 个月才陆续披露。
  * 不从点位或 PE 反推任何值。

raw 缓存（入库，脱敏，只有数值）：``data/providers/constituent_fin_raw/``
  * ``cons_<csi>.json``：最近一次成功下载的成分与权重；
  * ``stocks.json``：每只股票各报告期的 np（累计归母净利润，元）与 eq（归母净资产，元）。
    在线运行时 np 每次整份重取（1 个请求/只），eq 只补缺失的报告期。

接口：``collect(indices, as_of, offline=False) -> dict``；CLI：``python3 providers/constituent_fin.py [--offline]``。
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import gzip
import json
import math
import os
import sys
import tempfile
import time
import urllib.request

NAME = "constituent_fin"
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(HERE, "data", "providers", "constituent_fin_raw")
STOCKS_PATH = os.path.join(RAW_DIR, "stocks.json")
OUT_PATH = os.path.join(HERE, "data", "providers", "constituent_fin.json")
STORE_DIR = os.path.join(HERE, "data", "store")

# 本地代码 → 中证代码；只放“已核对无公开指数级 ROE 来源”的指数
TARGETS = {"931719.CSI": "931719"}
START_PERIOD = "2014-12-31"   # 输出的最早报告期（931719 基日）
FETCH_FROM = "2013-12-31"     # 需要上年同期数据，往前多取一年
MIN_COVER = 90.0              # 数据齐全成分股的当前权重合计（%）下限
UA = {"User-Agent": "Mozilla/5.0"}

CW_URL = "https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/file/autofile/closeweight/{csi}closeweight.xls"
CSI_PAGE = "https://www.csindex.com.cn/#/indices/family/detail?indexCode={csi}"
NP_URL = ("https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_LICO_FN_CPD"
          "&columns=REPORTDATE,PARENT_NETPROFIT&filter=(SECURITY_CODE%3D%22{code}%22)"
          "&pageSize=200&sortColumns=REPORTDATE&sortTypes=-1")
EQ_URL = ("https://emweb.securities.eastmoney.com/PC_HSF10/NewFinanceAnalysis/zcfzbAjaxNew"
          "?companyType=4&reportDateType=0&reportType=1&dates={dates}&code={mkt}{code}")
SOURCE_LABEL = "成分股财报自算（中证成分权重 + 东方财富财报）"
SOURCE_URL = "https://data.eastmoney.com/bbsj/yjbb/"


def log(msg: str) -> None:
    print(f"[{NAME}] {msg}", file=sys.stderr, flush=True)


def http_get(url: str, timeout: float = 20.0, retries: int = 3) -> bytes:
    err: Exception | None = None
    for i in range(retries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                b = r.read()
            return gzip.decompress(b) if b[:2] == b"\x1f\x8b" else b
        except Exception as e:  # noqa: BLE001
            err = e
            time.sleep(1.5 * (i + 1))
    raise err  # type: ignore[misc]


def market(code: str) -> str:
    if code.startswith(("6", "9")) and not code.startswith("92"):
        return "SH"
    if code.startswith(("4", "8", "92")):
        return "BJ"
    return "SZ"


def quarter_ends(start: str, end: str) -> list[str]:
    out = []
    for y in range(int(start[:4]), int(end[:4]) + 1):
        for md in ("03-31", "06-30", "09-30", "12-31"):
            p = f"{y}-{md}"
            if start <= p <= end:
                out.append(p)
    return out


def prev_year(p: str) -> str:
    return f"{int(p[:4]) - 1}{p[4:]}"


def is_num(x) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


# ---------------------------------------------------------------------------
# 读写 raw
# ---------------------------------------------------------------------------

def read_json(path: str, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def write_json(path: str, obj, indent: int | None = None) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=indent, sort_keys=True)
    os.replace(tmp, path)


def cons_path(csi: str) -> str:
    return os.path.join(RAW_DIR, f"cons_{csi}.json")


def parse_closeweight(content: bytes, csi: str) -> dict:
    import xlrd  # requirements-ci 已有
    sh = xlrd.open_workbook(file_contents=content).sheet_by_index(0)
    head = [str(x) for x in sh.row_values(0)]
    try:
        i_date = next(i for i, h in enumerate(head) if h.startswith("日期"))
        i_code = next(i for i, h in enumerate(head) if h.startswith("成份券代码"))
        i_name = next(i for i, h in enumerate(head) if h.startswith("成份券名称"))
        i_w = next(i for i, h in enumerate(head) if h.startswith("权重"))
    except StopIteration:
        raise ValueError(f"closeweight 表头不符：{head}")
    rows, day = [], None
    for r in range(1, sh.nrows):
        v = sh.row_values(r)
        code = str(v[i_code]).split(".")[0].zfill(6)
        w = v[i_w]
        if not code.isdigit() or not is_num(w):
            raise ValueError(f"closeweight 第 {r} 行异常：{v}")
        rows.append({"code": code, "name": str(v[i_name]), "weight": float(w)})
        day = str(v[i_date]).split(".")[0]
    if not rows:
        raise ValueError("closeweight 无成分")
    tot = sum(x["weight"] for x in rows)
    if not 95 <= tot <= 105:
        raise ValueError(f"closeweight 权重合计 {tot:.2f}% 异常")
    return {"csi": csi, "date": f"{day[:4]}-{day[4:6]}-{day[6:8]}", "constituents": rows,
            "url": CW_URL.format(csi=csi)}


def fetch_np(code: str) -> dict:
    d = json.loads(http_get(NP_URL.format(code=code)))
    rows = ((d.get("result") or {}).get("data")) or []
    out = {}
    for r in rows:
        p, v = str(r.get("REPORTDATE") or "")[:10], r.get("PARENT_NETPROFIT")
        if len(p) == 10 and p >= FETCH_FROM and is_num(v):
            out[p] = float(v)
    return out


def fetch_eq(code: str, periods: list[str]) -> dict:
    out = {}
    for i in range(0, len(periods), 5):  # 接口一次最多 5 期
        chunk = periods[i:i + 5]
        d = json.loads(http_get(EQ_URL.format(dates=",".join(chunk), mkt=market(code), code=code)))
        got = {}
        for r in d.get("data") or []:
            p, v = str(r.get("REPORT_DATE") or "")[:10], r.get("TOTAL_PARENT_EQUITY")
            if is_num(v):
                got[p] = float(v)
        for p in chunk:
            out[p] = got.get(p)  # None = 已查询但接口未给
        time.sleep(0.2)
    return out


def refresh_stocks(codes: list[str], stocks: dict, as_of: str, errors: list[str]) -> dict:
    """在线：np 整份重取；eq 只补缺失期（以及近一年内上次未取到的期）。失败沿用旧 raw。"""
    recent = (dt.date.fromisoformat(as_of) - dt.timedelta(days=400)).isoformat()
    for k, code in enumerate(codes, 1):
        node = stocks.setdefault(code, {"np": {}, "eq": {}})
        try:
            npv = fetch_np(code)
            if npv:
                node["np"] = npv
            need = sorted(p for p in node["np"]
                          if p not in node["eq"] or (node["eq"][p] is None and p >= recent))
            # 也要上年同期的净资产（算平均）
            need = sorted(set(need) | {prev_year(p) for p in need if prev_year(p) >= FETCH_FROM
                                        and prev_year(p) not in node["eq"]})
            if need:
                node["eq"].update(fetch_eq(code, need))
            node["fetchedAt"] = as_of
        except Exception as e:  # noqa: BLE001
            errors.append(f"{code}: {type(e).__name__}: {e}（沿用旧 raw）")
        if k % 10 == 0:
            write_json(STOCKS_PATH, stocks)  # 分批落盘：中途中断时已取到的不丢
            log(f"已处理 {k}/{len(codes)}")
    return stocks


# ---------------------------------------------------------------------------
# 计算
# ---------------------------------------------------------------------------

def ttm_np(npd: dict, p: str):
    cur = npd.get(p)
    if not is_num(cur):
        return None
    if p.endswith("12-31"):
        return cur
    ann, last = npd.get(f"{int(p[:4]) - 1}-12-31"), npd.get(prev_year(p))
    if not is_num(ann) or not is_num(last):
        return None
    return cur + ann - last


def avg_eq(eqd: dict, p: str):
    a, b = eqd.get(p), eqd.get(prev_year(p))
    if not is_num(a) or not is_num(b) or a <= 0 or b <= 0:
        return None
    return (a + b) / 2


def load_calendar(code: str) -> list[str]:
    path = os.path.join(STORE_DIR, "csi_" + code.replace(".", "_") + ".csv")
    try:
        with open(path, encoding="utf-8") as f:
            return sorted(r["date"] for r in csv.DictReader(f) if r.get("date"))
    except OSError:
        return []


def snap(p: str, cal: list[str]) -> str | None:
    """报告期末 → 当日或之前最近的交易日；无日历时退到工作日。"""
    if cal:
        import bisect
        i = bisect.bisect_right(cal, p) - 1
        if i < 0 or (dt.date.fromisoformat(p) - dt.date.fromisoformat(cal[i])).days > 10:
            return None
        return cal[i]
    d = dt.date.fromisoformat(p)
    while d.weekday() >= 5:
        d -= dt.timedelta(days=1)
    return d.isoformat()


def compute(cons: dict, stocks: dict, as_of: str, cal: list[str]) -> tuple[list[dict], list[str]]:
    """逐报告期汇总。返回 [{period, date, roe, np, cover, n, total}] 与被丢弃期的说明。"""
    rows, dropped = [], []
    members = cons["constituents"]
    for p in quarter_ends(START_PERIOD, as_of):
        s_np = s_eq = cover = 0.0
        n = 0
        for m in members:
            node = stocks.get(m["code"]) or {}
            t, e = ttm_np(node.get("np") or {}, p), avg_eq(node.get("eq") or {}, p)
            if t is None or e is None:
                continue
            s_np += t
            s_eq += e
            cover += m["weight"]
            n += 1
        if n == 0:
            continue
        if cover < MIN_COVER:
            dropped.append(f"{p} 覆盖 {cover:.1f}%")
            continue
        day = snap(p, cal)
        if day is None or day > as_of:
            dropped.append(f"{p} 无对应交易日")
            continue
        rows.append({"period": p, "date": day, "roe": round(s_np / s_eq * 100, 4),
                     "np": round(s_np / 1e8, 4), "cover": round(cover, 2), "n": n, "total": len(members),
                     "yoy": same_sample_yoy(members, stocks, p)})
    return rows, dropped


def same_sample_yoy(members: list[dict], stocks: dict, p: str):
    """同口径同比：只用本期与上年同期 TTM 净利润都有的成分股；覆盖不足或上年合计 ≤0 时不给。"""
    cur = last = cover = 0.0
    q = prev_year(p)
    for m in members:
        npd = (stocks.get(m["code"]) or {}).get("np") or {}
        a, b = ttm_np(npd, p), ttm_np(npd, q)
        if a is None or b is None:
            continue
        cur += a
        last += b
        cover += m["weight"]
    if cover < MIN_COVER or last <= 0:
        return None
    return round((cur / last - 1) * 100, 2)


def unavailable(field: str, reason: str) -> dict:
    unit = "%" if field == "roe" else "亿元"
    return {"d": [], "v": [], "status": "unavailable", "reason": reason, "frequency": "",
            "source": {"label": SOURCE_LABEL, "url": SOURCE_URL, "unit": unit, "method": ""}}


def build_fields(code: str, csi: str, cons: dict, rows: list[dict], dropped: list[str]) -> dict:
    if not rows:
        why = "成分股财报自算：没有达到覆盖门槛的报告期" + (f"（{'; '.join(dropped[-3:])}）" if dropped else "")
        return {"roe": unavailable("roe", why), "np": unavailable("np", why)}
    first, last = rows[0], rows[-1]
    common = (f"成分：中证官网 {csi}closeweight（{cons['date']}，{len(cons['constituents'])} 只，当前名单回看历史，"
              f"存在幸存者偏差）；财报：东方财富业绩报表（归母净利润累计值）与 F10 资产负债表（归属于母公司股东权益合计）。"
              f"单家 TTM 净利润 = 本期累计 + 上年年报 − 上年同期累计；平均净资产 = (期末 + 上年同期末)/2；"
              f"按公司全口径相加，不按自由流通或指数权重调整。数据齐全成分股的当前权重合计 < {MIN_COVER:.0f}% 的报告期不出数"
              f"（最新期 {last['period']} 覆盖 {last['cover']}%、{last['n']}/{last['total']} 只）。次新股上市前缺季报，"
              f"各期纳入只数不同（{min(r['n'] for r in rows)}~{max(r['n'] for r in rows)} 只），合计额跨期不完全可比；"
              f"同比（periods[].yoy）只用两期都有数据的成分股计算。"
              f"日期为报告期末对齐到当日或之前最近交易日，是报告期而非可得日（财报在期末后 1~4 个月才披露）。"
              f"不从点位或 PE 反推。")
    periods = [{"period": r["period"], "date": r["date"], "cover": r["cover"], "n": r["n"], "yoy": r.get("yoy")}
               for r in rows]
    base = {"label": SOURCE_LABEL, "url": SOURCE_URL, "page": CSI_PAGE.format(csi=csi),
            "constituentsDate": cons["date"], "constituentsUrl": cons["url"],
            "survivorBias": True, "periods": periods, "calcVerified": True}
    return {
        "roe": {"d": [r["date"] for r in rows], "v": [r["roe"] for r in rows], "status": "ok", "reason": "",
                "frequency": "quarterly",
                "source": dict(base, unit="%", method="整体法 ROE = Σ TTM 归母净利润 / Σ 平均归母净资产 × 100。" + common)},
        "np": {"d": [r["date"] for r in rows], "v": [r["np"] for r in rows], "status": "ok", "reason": "",
               "frequency": "quarterly",
               "source": dict(base, unit="亿元", method="成分股 TTM 归母净利润合计（亿元）。" + common)},
    }


def collect(indices: list[dict] | None, as_of: str, offline: bool = False) -> dict:
    codes = [m["code"] for m in indices] if indices else list(TARGETS)
    stocks = read_json(STOCKS_PATH, {})
    errors: list[str] = []
    series = {}
    for code in codes:
        csi = TARGETS.get(code)
        if not csi:
            continue  # 非目标指数不输出，避免给其他指数添加“自算”候选
        cons = read_json(cons_path(csi), None)
        if not offline:
            try:
                cons = parse_closeweight(http_get(CW_URL.format(csi=csi)), csi)
                write_json(cons_path(csi), cons, indent=1)
            except Exception as e:  # noqa: BLE001
                errors.append(f"{code}: 成分权重下载失败 {type(e).__name__}: {e}（沿用旧成分）")
        if not cons:
            series[code] = {"fields": {f: unavailable(f, "成分权重不可用") for f in ("roe", "np")}}
            continue
        if not offline:
            refresh_stocks([m["code"] for m in cons["constituents"]], stocks, as_of, errors)
            write_json(STOCKS_PATH, stocks)
        rows, dropped = compute(cons, stocks, as_of, load_calendar(code))
        series[code] = {"fields": build_fields(code, csi, cons, rows, dropped)}
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    payload = {"provider": NAME, "retrievedAt": now, "builtAt": now, "asOf": as_of,
               "mode": "cache" if offline else "online", "sourceLabel": SOURCE_LABEL, "sourceUrl": SOURCE_URL,
               "series": series, "errors": errors}
    write_json(OUT_PATH, payload, indent=1)
    return payload


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="成分股财报自算 ROE / 净利润合计 → data/providers/constituent_fin.json")
    ap.add_argument("--as-of", default=dt.date.today().isoformat())
    ap.add_argument("--offline", action="store_true", help="不联网，只用 raw 缓存重算")
    args = ap.parse_args(argv)
    p = collect(None, args.as_of, offline=args.offline)
    for code, node in p["series"].items():
        r = node["fields"]["roe"]
        tail = f"{r['d'][-1]} ROE {r['v'][-1]:.2f}% · {len(r['d'])} 期" if r["status"] == "ok" else r["reason"]
        log(f"{code}: {tail}")
    if p["errors"]:
        log(f"errors={p['errors']}")
    ok = all(n["fields"]["roe"]["status"] == "ok" for n in p["series"].values())
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
