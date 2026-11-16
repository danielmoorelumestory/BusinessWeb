#!/usr/bin/env python3
"""ROUND2 supplemental provider：港美估值/成交额 + 全体指数市值/换手/盈利/成分股数。

负责范围（见 ROUND2.md）：
  * 6 只港美指数（market HK/US）：pe / pb / dy / amt / volume
  * 全部 35 只指数：mcap / turn / eps / roe / bps 及 componentNum

接口：``collect(indices, as_of, offline=False) -> dict``，返回值与
``data/providers/supplemental.json`` 同构。CLI：``python3 providers/supplemental.py [--offline] [--as-of D]``。

设计：在线阶段只“下载原始文件到 supplemental_raw/”，解析阶段只读 raw 目录重建输出。
因此 offline 与 online 走同一解析路径；某来源本次下载失败不会删除既有 raw，旧数据保留；
每日快照类来源（中证 index-feature、国证 indexList、WSJ、Nasdaq）随运行逐日累积真实观测。

来源（均为公开页面/官方文件/页面自身调用的匿名接口，无登录、无收费、无凭据）：
  1. 中证指数官网 index-feature（官网“指数特征”卡片）：consNum 样本数、calMkvSum——官网前端
     标注为“指数自由流通市值（亿元）”。只返回最新一个交易日。
  2. 国证指数官网 cnindex indexList：samplesize 样本数、freeMarketValue/totalMarketValue（元）。
     响应不带日期，用同站 hq.cnindex 日行情的收盘点位精确匹配 closeingPoint 来确定日期；
     匹配不唯一/不成功则不入库。
  3. 恒生指数公司官网：每日报告 idx_*.csv（股息率%、市盈率倍，仅 HSI/HSCEI 等系列提供）、
     Index Performance Summary *.xls（指数成交额，百万港元）、成分股 rt 接口（成分股数）、
     月末加权 PE/DY xlsx（仅作 extras）。官网只保留约 30 个交易日日报，逐次运行累积。
  4. WSJ Market Data “P/Es & Yields on Major Indexes”（页面免登录）：DJIA、S&P 500 的
     trailing 12 个月 as-reported P/E 与股息率；页面无 Nasdaq Composite（只有 Nasdaq 100，
     不得替代）。
  5. Nasdaq Global Indexes 官方指数页：Nasdaq Composite “# of Components”。
  6. Robert Shiller 公开数据集 ie_data.xls（Yale）：S&P Composite 月度 P/D/E，仅放 extras，
     其 E 为“指数点位口径盈利”，按 ROUND2 不写入每股 eps 字段。

只用标准库；读取 .xls 需要项目已装 xlrd（缺失时该来源记 error，不影响其他来源）。
"""
from __future__ import annotations

import argparse
import datetime as dt
import glob
import io
import json
import math
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from typing import Callable

NAME = "supplemental"
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(HERE, "data", "providers", "supplemental.json")
RAW_DIR = os.path.join(HERE, "data", "providers", "supplemental_raw")

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124 Safari/537.36")

OWNED_ALL = ["mcap", "turn", "eps", "roe", "bps"]
OWNED_XB = ["pe", "pb", "dy", "amt", "volume"]  # 仅港美

CSI_FEATURE_URL = "https://www.csindex.com.cn/csindex-home/indexInfo/index-feature/{code}"
CSI_FEATURE_PAGE = "https://www.csindex.com.cn/#/indices/family/detail?indexCode={code}"
CNI_LIST_URL = "https://www.cnindex.com.cn/index/indexList?channelCode=-1&rows=2000&pageNum=1"
CNI_DAILY_URL = ("https://hq.cnindex.com.cn/market/market/getIndexDailyDataWithDataFormat"
                 "?indexCode={code}&startDate={start}&endDate={end}&frequency=day")
CNI_PAGE = "https://www.cnindex.com.cn/module/index-detail.html?act_menu=1&indexCode={code}"
HSI_API = "https://www.hsi.com.hk/api/wsit-hsi-ddoc-ea-public-website-proxy/v1"
HSI_DAILY_REPORT_URL = HSI_API + "/product-data/pub/series/metadata/v2?data=dailyReport&seriesCode={s}"
HSI_CONS_URL = HSI_API + "/product-data/pub/constituent/metadata/v2?data=rt&seriesCode={s}&language=en-hk"
HSI_GCS_URL = HSI_API + "/content/gcs/download?resource={path}"
HSI_MONTHLY_URL = ("https://www.hsi.com.hk/content/dam/wpb/hsil/index_operation/historical_{k}/"
                   "en_hk/{s}/{s}.xlsx")
HSI_PAGE = "https://www.hsi.com.hk/en-hk/indexes/all-indexes/index-details/?seriesCode={s}"
WSJ_URL = "https://www.wsj.com/market-data/stocks/peyields"
NASDAQ_OVERVIEW_URL = "https://indexes.nasdaqomx.com/Index/Overview/{sym}"
SHILLER_URL = "http://www.econ.yale.edu/~shiller/data/ie_data.xls"
ECB_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml"
ECB_PAGE = "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html"

# 港股：本项目 code -> (恒生系列代码, 官方指数代码, 报告中的英文全名)
HSI_MAP = {
    "HSI.HK": ("hsi", "00001.00", "Hang Seng Index"),
    "HSTECH.HK": ("hstech", "02083.00", "Hang Seng TECH Index"),
    "HSCEI.HK": ("hscei", "00014.00", "Hang Seng China Enterprises Index"),
}
# 美股：本项目 code -> WSJ peyields ticker（None 表示页面不提供该指数）
WSJ_MAP = {"SPX.US": "INX", "DJI.US": "DJI", "IXIC.US": None}
NASDAQ_MAP = {"IXIC.US": "COMP"}


class FetchError(Exception):
    pass


# ---------------------------------------------------------------------------
# 基础工具
# ---------------------------------------------------------------------------

def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def to_float(v) -> float | None:
    """有限数或 None；空串/'-'/'--'/NaN/inf 一律 None，绝不当 0。"""
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        f = float(v)
    else:
        s = str(v).strip().replace(",", "")
        if s in ("", "-", "--", "None", "null", "nan", "NaN", "NA", "N/A"):
            return None
        try:
            f = float(s)
        except ValueError:
            return None
    return f if math.isfinite(f) else None


def norm_date(s) -> str | None:
    if s is None:
        return None
    t = str(s).strip().replace("/", "-")
    if len(t) == 8 and t.isdigit():
        t = f"{t[:4]}-{t[4:6]}-{t[6:]}"
    t = t[:10]
    try:
        return dt.date.fromisoformat(t).isoformat()
    except ValueError:
        return None


def atomic_write_bytes(path: str, data: bytes) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".tmp_")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        os.chmod(tmp, 0o644)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def write_json(path: str, obj) -> None:
    atomic_write_bytes(path, (json.dumps(obj, ensure_ascii=False, indent=1, sort_keys=False) + "\n").encode("utf-8"))


def read_bytes(path: str) -> bytes:
    with open(path, "rb") as f:
        return f.read()


def read_json(path: str):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def http_get(url: str, timeout: float = 25.0, retries: int = 2, referer: str | None = None) -> bytes:
    last = None
    for attempt in range(retries + 1):
        try:
            headers = {"User-Agent": UA, "Accept": "*/*"}
            if referer:
                headers["Referer"] = referer
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                if resp.status != 200:
                    raise FetchError(f"HTTP {resp.status}")
                # urllib 会跟随 302；恒生把不存在文件 302 到 /errors/404/，需要识别
                final = resp.geturl()
                if "/errors/404" in final:
                    raise FetchError(f"重定向到错误页 {final}")
                return resp.read()
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (401, 403, 404):  # 受限/不存在：不重试、不绕过
                break
        except (urllib.error.URLError, OSError, FetchError, ValueError) as e:
            last = e
        if attempt < retries:
            time.sleep(1.2 * (attempt + 1))
    raise FetchError(f"{type(last).__name__}: {last}")


def field_obj(d=None, v=None, *, label="", url="", unit="", method="", frequency="", status=None, reason="",
              basis=None, extra_source=None):
    d, v = list(d or []), list(v or [])
    ok = bool(d)
    src = {"label": label, "url": url, "unit": unit, "method": method}
    if basis:
        src["marketCapBasis"] = basis
    if extra_source:
        src.update(extra_source)
    return {
        "d": d, "v": v,
        "source": src,
        "frequency": frequency if ok else (frequency or ""),
        "status": status or ("ok" if ok else "unavailable"),
        "reason": "" if ok else reason,
    }


def series_from_points(points: dict[str, float], as_of: str | None) -> tuple[list, list]:
    """{date: value} -> 升序去重、过滤非有限值与晚于 as_of 的日期。"""
    out = []
    for d, v in points.items():
        nd = norm_date(d)
        fv = to_float(v)
        if nd is None or fv is None:
            continue
        if as_of and nd > as_of:
            continue
        out.append((nd, fv))
    out.sort()
    return [d for d, _ in out], [v for _, v in out]


def unavailable(reason: str, *, label="", url="", unit="", method="") -> dict:
    return field_obj(label=label, url=url, unit=unit, method=method, reason=reason)


def component_obj(value=None, date=None, *, label="", url="", method="", reason="") -> dict:
    ok = value is not None and date is not None
    return {
        "value": int(value) if ok and float(value).is_integer() else (value if ok else None),
        "date": date if ok else None,
        "source": {"label": label, "url": url, "method": method},
        "status": "ok" if ok else "unavailable",
        "reason": "" if ok else reason,
    }


# ---------------------------------------------------------------------------
# 下载阶段（online）：只把原始/最小必要原文写到 RAW_DIR，失败记 errors，不删旧缓存
# ---------------------------------------------------------------------------

class Downloader:
    def __init__(self, raw_dir: str, get: Callable[..., bytes] = http_get):
        self.raw, self.get, self.errors = raw_dir, get, []

    def err(self, source: str, url: str, e: Exception | str):
        self.errors.append({"source": source, "url": url, "error": str(e)})

    def p(self, *parts) -> str:
        return os.path.join(self.raw, *parts)

    # -- 中证 index-feature -------------------------------------------------
    def csi_feature(self, code: str) -> None:
        url = CSI_FEATURE_URL.format(code=code)
        try:
            body = self.get(url, referer="https://www.csindex.com.cn/")
            js = json.loads(body.decode("utf-8"))
        except Exception as e:  # noqa: BLE001
            return self.err("csi_feature", url, e)
        data = js.get("data") or {}
        td = norm_date(data.get("tradeDate"))
        if str(js.get("code")) != "200" or not td:
            return self.err("csi_feature", url, f"响应无有效tradeDate/data（code={js.get('code')}，data.indexCode={data.get('indexCode')}）")
        atomic_write_bytes(self.p("csi_feature", f"{code}_{td}.json"), body)

    # -- 国证 indexList + 日行情匹配日期 --------------------------------------
    def cnindex(self, codes: list[str], as_of: str) -> None:
        if not codes:
            return
        try:
            body = self.get(CNI_LIST_URL, referer="https://www.cnindex.com.cn/")
            rows = json.loads(body.decode("utf-8"))["data"]["rows"]
        except Exception as e:  # noqa: BLE001
            return self.err("cnindex_list", CNI_LIST_URL, e)
        byc = {r.get("indexcode"): r for r in rows}
        end = dt.date.fromisoformat(as_of)
        start = end - dt.timedelta(days=20)
        for code in codes:
            row = byc.get(code)
            if not row:
                self.err("cnindex_list", CNI_LIST_URL, f"列表中无 {code}")
                continue
            durl = CNI_DAILY_URL.format(code=code, start=start.isoformat(), end=end.isoformat())
            try:
                dj = json.loads(self.get(durl, referer="https://www.cnindex.com.cn/").decode("utf-8"))
                items, data = dj["data"]["item"], dj["data"]["data"]
            except Exception as e:  # noqa: BLE001
                self.err("cnindex_daily", durl, e)
                continue
            date = match_cnindex_date(row, items, data)
            if not date:
                self.err("cnindex_daily", durl, f"{code} 列表收盘点位 {row.get('closeingPoint')} 未唯一匹配近20日日行情，无法确定日期，不入库")
                continue
            atomic_write_bytes(self.p("cnindex", f"{code}_{date}.json"), json.dumps({
                "note": "cnindex indexList 原响应中该指数的整行（未改动字段）；日期由同站日行情收盘点位匹配得到",
                "listUrl": CNI_LIST_URL, "dailyUrl": durl, "retrievedAt": utc_now(),
                "matchedDate": date, "listRow": row,
                "dailyRow": dict(zip(items, next(r for r in data if norm_date(r[0]) == date))),
            }, ensure_ascii=False, indent=1).encode("utf-8"))

    # -- 恒生 ----------------------------------------------------------------
    def hsi(self, series_codes: list[str]) -> None:
        ips_done = set(os.path.basename(f)[:10] for f in glob.glob(self.p("hsi", "ips", "*.json")))
        for s in series_codes:
            url = HSI_DAILY_REPORT_URL.format(s=s)
            try:
                body = self.get(url, referer="https://www.hsi.com.hk/")
                lst = json.loads(body.decode("utf-8"))
                if not (isinstance(lst, list) and lst and isinstance(lst[0], dict) and "reportList" in lst[0]):
                    raise FetchError("dailyReport 响应结构无效（非列表/缺 reportList），不覆盖缓存")
                atomic_write_bytes(self.p("hsi", f"dailyReport_{s}.json"), body)
            except Exception as e:  # noqa: BLE001
                self.err("hsi_dailyReport", url, e)
                lst = []
            for blk in lst if isinstance(lst, list) else []:
                for rep in blk.get("reportList", []):
                    for it in rep.get("reportDate", []):
                        d = norm_date(it.get("date"))
                        path = it.get("url") or ""
                        if not d or not path:
                            continue
                        gurl = HSI_GCS_URL.format(path=path)
                        if rep.get("reportType") == "idx":
                            dst = self.p("hsi", "idx", f"{s}_{d}.csv")
                            if os.path.exists(dst) and valid_hsi_idx(read_bytes(dst), d):
                                continue
                            try:
                                body = self.get(gurl, referer="https://www.hsi.com.hk/")
                                if not valid_hsi_idx(body, d):
                                    raise FetchError("HTTP 200 但内容不是该日 UTF-16 恒生日报 CSV，不落盘")
                                atomic_write_bytes(dst, body)
                            except Exception as e:  # noqa: BLE001
                                self.err("hsi_idx_csv", gurl, e)
                        elif rep.get("reportType") == "ips" and d not in ips_done:
                            try:
                                rows = extract_ips_rows(self.get(gurl, referer="https://www.hsi.com.hk/"))
                                if len(rows) < 2 or not any("Index Turnover" in str(h) for h in rows[0]) \
                                        or not all(norm_date(r[0]) == d for r in rows[1:]):
                                    raise FetchError("IPS xls 缺表头/目标行或交易日与列表日期不符，不落盘")
                            except Exception as e:  # noqa: BLE001
                                self.err("hsi_ips_xls", gurl, e)
                                continue
                            atomic_write_bytes(self.p("hsi", "ips", f"{d}.json"), json.dumps({
                                "note": "Index Performance Summary 原 xls 中目标指数价格指数行的原样单元格（未改动）",
                                "url": gurl, "retrievedAt": utc_now(), "rows": rows,
                            }, ensure_ascii=False, indent=1).encode("utf-8"))
                            ips_done.add(d)
            curl = HSI_CONS_URL.format(s=s)
            try:
                cj = json.loads(self.get(curl, referer="https://www.hsi.com.hk/").decode("utf-8"))
                data = cj.get("data") or {}
                stamps = sorted({str(x.get("dateTime"))[:10] for v in (data.get("viewConsDetail") or {}).values()
                                 for x in v if x.get("dateTime")})
                d = norm_date(stamps[-1]) if stamps else None
                if not d or not data.get("numOfConsList"):
                    raise FetchError("响应缺 numOfConsList 或 dateTime")
                atomic_write_bytes(self.p("hsi", "cons", f"{s}_{d}.json"), json.dumps({
                    "note": "成分股 rt 接口原响应中的 numOfConsList（原样）与成分股 dateTime 去重集合",
                    "url": curl, "retrievedAt": utc_now(), "numOfConsList": data["numOfConsList"],
                    "dateTimes": stamps,
                }, ensure_ascii=False, indent=1).encode("utf-8"))
            except Exception as e:  # noqa: BLE001
                self.err("hsi_constituents", curl, e)
            for k in ("pe", "dy"):
                murl = HSI_MONTHLY_URL.format(k=k, s=s)
                try:
                    body = self.get(murl, referer="https://www.hsi.com.hk/", retries=0)
                    try:
                        _t, pts = parse_hsi_monthly(body)
                    except Exception as pe_:  # noqa: BLE001
                        raise FetchError(f"不是有效 xlsx：{pe_}")
                    if not pts:
                        raise FetchError("xlsx 中无月末数据，不落盘")
                    atomic_write_bytes(self.p("hsi", "monthly", f"{k}_{s}.xlsx"), body)
                except Exception as e:  # noqa: BLE001
                    self.err("hsi_monthly_xlsx", murl, e)

    # -- WSJ -----------------------------------------------------------------
    def wsj(self) -> None:
        try:
            html = self.get(WSJ_URL).decode("utf-8", errors="replace")
        except Exception as e:  # noqa: BLE001
            return self.err("wsj_peyields", WSJ_URL, e)
        blocks = extract_wsj_blocks(html)
        if not blocks:
            return self.err("wsj_peyields", WSJ_URL, "页面中未找到 mdc_peAndYields 数据块")
        foot = re.search(r'content="(P/E data[^"]*)"', html)
        for b in blocks:
            d = norm_date(b.get("tradeDate"))
            if not d:
                continue
            tag = "_".join(sorted(x.get("ticker") or "" for x in b.get("instruments", [])))
            atomic_write_bytes(self.p("wsj", f"{d}_{tag}.json"), json.dumps({
                "note": "WSJ peyields 页面内嵌 mdc_peAndYields 数据块（原样）",
                "url": WSJ_URL, "retrievedAt": utc_now(),
                "footnote": foot.group(1) if foot else None, "block": b,
            }, ensure_ascii=False, indent=1).encode("utf-8"))

    # -- Nasdaq --------------------------------------------------------------
    def nasdaq(self, syms: list[str]) -> None:
        for sym in syms:
            url = NASDAQ_OVERVIEW_URL.format(sym=sym)
            try:
                html = self.get(url).decode("utf-8", errors="replace")
            except Exception as e:  # noqa: BLE001
                self.err("nasdaq_overview", url, e)
                continue
            got = parse_nasdaq_overview(html, sym)
            if not got:
                self.err("nasdaq_overview", url, "未解析到 # of Components 与日期")
                continue
            atomic_write_bytes(self.p("nasdaq", f"{sym}_{got['date']}.json"), json.dumps({
                "note": "Nasdaq 指数页 Quick Facts 文本片段（原样）", "url": url,
                "retrievedAt": utc_now(), **got}, ensure_ascii=False, indent=1).encode("utf-8"))

    # -- Shiller -------------------------------------------------------------
    def shiller(self) -> None:
        try:
            body = self.get(SHILLER_URL, timeout=60)
            try:
                ok = bool(parse_shiller(body)["E"])
            except Exception as pe_:  # noqa: BLE001
                raise FetchError(f"不是有效 Shiller xls：{pe_}")
            if not ok:
                raise FetchError("Shiller xls 无 E 列数据，不落盘")
            atomic_write_bytes(self.p("shiller", "ie_data.xls"), body)
        except Exception as e:  # noqa: BLE001
            self.err("shiller", SHILLER_URL, e)

    # -- ECB 欧元参考汇率（港元→人民币派生换算用）--------------------------------
    def ecb(self) -> None:
        try:
            body = self.get(ECB_URL, timeout=40)
            rates = parse_ecb(body)
            if not rates:
                raise FetchError("XML 中无同时含 HKD 与 CNY 的日期，不落盘")
            atomic_write_bytes(self.p("ecb", f"eurofxref-hist-90d_{max(rates)}.xml"), body)
        except Exception as e:  # noqa: BLE001
            self.err("ecb_eurofxref", ECB_URL, e)


# ---------------------------------------------------------------------------
# 解析工具（纯函数，便于测试）
# ---------------------------------------------------------------------------

def match_cnindex_date(row: dict, items: list, data: list) -> str | None:
    """indexList 行不带日期：在日行情里找收盘点位完全一致（4位小数）的唯一交易日。"""
    cp = to_float(row.get("closeingPoint"))
    if cp is None or "close" not in items or "timestamp" not in items:
        return None
    ci, ti = items.index("close"), items.index("timestamp")
    hits = sorted({norm_date(r[ti]) for r in data if to_float(r[ci]) is not None
                   and round(to_float(r[ci]), 4) == round(cp, 4)} - {None})
    return hits[-1] if len(hits) == 1 else None


def valid_hsi_idx(raw: bytes, date: str) -> bool:
    """HTTP 200 也可能是错误页 HTML：必须是 UTF-16 TSV、含英文表头、且含该日行。"""
    try:
        text = raw.decode("utf-16")
    except UnicodeError:
        return False
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if len(lines) < 3 or '"Trade Date"' not in lines[1]:
        return False
    return any(norm_date(ln.split("\t")[0].strip().strip('"')) == date for ln in lines[2:])


def parse_ecb(raw: bytes) -> dict[str, dict[str, float]]:
    """ECB eurofxref XML -> {date: {"HKD": 港元/欧元, "CNY": 人民币/欧元}}；只收两币都有的日期。"""
    root = ET.fromstring(raw)  # 非 XML（如 HTML 错误页）直接抛错
    out = {}
    for cube in root.iter():
        t = cube.get("time")
        if not t or norm_date(t) is None:
            continue
        r = {c.get("currency"): to_float(c.get("rate")) for c in cube}
        if r.get("HKD") and r.get("CNY"):
            out[norm_date(t)] = {"HKD": r["HKD"], "CNY": r["CNY"]}
    return out


def extract_wsj_blocks(html: str) -> list[dict]:
    dec, out, seen = json.JSONDecoder(), [], set()
    for m in re.finditer(r'"type":"mdc_peAndYields","data":', html):
        try:
            obj, _ = dec.raw_decode(html, m.end())
        except ValueError:
            continue
        key = json.dumps(obj, sort_keys=True)
        if key not in seen and isinstance(obj.get("instruments"), list):
            seen.add(key)
            out.append(obj)
    return out


def parse_nasdaq_overview(html: str, sym: str) -> dict | None:
    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html))
    m = re.search(r"# of Components\s+([\d,]+)", text)
    dm = re.search(re.escape(sym) + r"\s+[A-Za-z0-9 &;\-]{0,60}?\s(\d{1,2}/\d{1,2}/\d{4})", text)
    if not m or not dm:
        return None
    mm, dd, yy = dm.group(1).split("/")
    return {"components": int(m.group(1).replace(",", "")),
            "date": dt.date(int(yy), int(mm), int(dd)).isoformat(),
            "snippet": text[max(0, m.start() - 160): m.end() + 40]}


def extract_ips_rows(xls_bytes: bytes) -> list[list]:
    import xlrd  # 项目 .venv 已装 xlrd==2.0.1
    sh = xlrd.open_workbook(file_contents=xls_bytes).sheet_by_index(0)
    header = [str(sh.cell_value(1, c)) for c in range(sh.ncols)]
    targets = {v[2] for v in HSI_MAP.values()}
    rows = [header]
    for r in range(2, sh.nrows):
        if str(sh.cell_value(r, 1)) in targets:
            rows.append([sh.cell_value(r, c) for c in range(sh.ncols)])
    return rows


def parse_hsi_idx_csv(raw: bytes, english_name: str) -> dict | None:
    """恒生日报 idx_*.csv（UTF-16 TSV，第1行中文表头、第2行英文表头）。返回目标指数(HKD)一行。"""
    text = raw.decode("utf-16")
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if len(lines) < 3:
        return None
    rd = lambda ln: [c.strip().strip('"') for c in ln.split("\t")]  # noqa: E731
    head = rd(lines[1])
    for ln in lines[2:]:
        cells = rd(ln)
        row = dict(zip(head, cells + [""] * (len(head) - len(cells))))
        name = re.sub(r"\s*[㐀-鿿].*$", "", row.get("Index", "")).strip()
        if name == english_name and row.get("Index Currency") == "HKD":
            return row
    return None


def read_xlsx_first_sheet(raw: bytes) -> list[dict]:
    """最小 xlsx 读取（zipfile+xml）：返回 [{col_letter: (value, type)}]。"""
    ns = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    z = zipfile.ZipFile(io.BytesIO(raw))
    ss = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(ns + "si"):
            ss.append("".join(t.text or "" for t in si.iter(ns + "t")))
    rows = []
    for r in ET.fromstring(z.read("xl/worksheets/sheet1.xml")).iter(ns + "row"):
        row = {}
        for c in r.findall(ns + "c"):
            v = c.find(ns + "v")
            val, t = (None if v is None else v.text), c.get("t")
            if t == "s" and val is not None:
                val = ss[int(val)]
            row[re.sub(r"\d", "", c.get("r", ""))] = (val, t)
        rows.append(row)
    return rows


def parse_hsi_monthly(raw: bytes) -> tuple[str, dict[str, float]]:
    """月末加权 PE/DY xlsx：A 列 Excel 序列日期、B 列目标指数值。返回(标题, {date: v})。"""
    rows = read_xlsx_first_sheet(raw)
    title = (rows[0].get("A") or (None, None))[0] if rows else ""
    pts = {}
    for row in rows:
        a, b = row.get("A", (None, None)), row.get("B", (None, None))
        if a[0] and a[1] is None and to_float(b[0]) is not None:
            try:
                d = (dt.date(1899, 12, 30) + dt.timedelta(days=int(float(a[0])))).isoformat()
            except (ValueError, OverflowError):
                continue
            pts[d] = to_float(b[0])
    return title or "", pts


def parse_shiller(raw: bytes) -> dict[str, dict[str, float]]:
    import xlrd
    sh = xlrd.open_workbook(file_contents=raw).sheet_by_name("Data")
    head = [str(sh.cell_value(7, c)).strip() for c in range(sh.ncols)]
    ip, idv, ie = head.index("P"), head.index("D"), head.index("E")
    out = {"P": {}, "D": {}, "E": {}}
    for r in range(8, sh.nrows):
        dv = sh.cell_value(r, 0)
        if not isinstance(dv, float):
            continue
        y, mth = int(dv), int(round((dv - int(dv)) * 100))
        if not 1 <= mth <= 12:
            continue
        d = dt.date(y, mth, 1).isoformat()
        for k, i in (("P", ip), ("D", idv), ("E", ie)):
            f = to_float(sh.cell_value(r, i))
            if f is not None:
                out[k][d] = f
    return out


# ---------------------------------------------------------------------------
# 解析阶段：只读 RAW_DIR 重建输出
# ---------------------------------------------------------------------------

def _glob(raw: str, *parts) -> list[str]:
    return sorted(glob.glob(os.path.join(raw, *parts)))


def build_a_share(meta: dict, raw: str, as_of: str) -> tuple[dict, dict, dict]:
    code6 = meta["code"].split(".")[0]
    fields, extras = {}, {}
    comp = None
    feat = _glob(raw, "csi_feature", f"{code6}_*.json")
    cni = _glob(raw, "cnindex", f"{code6}_*.json")
    if feat:
        pts, cons = {}, {}
        for f in feat:
            d = read_json(f).get("data") or {}
            td = norm_date(d.get("tradeDate"))
            if td:
                pts[td] = d.get("calMkvSum")
                cons[td] = d.get("consNum")
        dd, vv = series_from_points(pts, as_of)
        url = CSI_FEATURE_URL.format(code=code6)
        fields["mcap"] = field_obj(dd, vv, label="中证指数官网·指数特征", url=url, unit="亿元",
                                   method="官网“指数特征”calMkvSum，前端标注为“指数自由流通市值（亿元）”，非总市值；"
                                          "接口仅给最新交易日，本 provider 逐次运行累积真实快照",
                                   frequency="snapshot", basis="free_float",
                                   reason="中证 index-feature 缓存中无不晚于 as_of 的观测")
        cd, cv = series_from_points(cons, as_of)
        if cd:
            comp = component_obj(cv[-1], cd[-1], label="中证指数官网·指数特征", url=url,
                                 method="index-feature consNum（官网“样本数量”）")
    elif cni:
        pts, tot, cons = {}, {}, {}
        for f in cni:
            j = read_json(f)
            d, r = j.get("matchedDate"), j.get("listRow") or {}
            fm, tm = to_float(r.get("freeMarketValue")), to_float(r.get("totalMarketValue"))
            pts[d] = None if fm is None else round(fm / 1e8, 2)
            tot[d] = None if tm is None else round(tm / 1e8, 2)
            cons[d] = r.get("samplesize")
        td, tv = series_from_points(tot, as_of)
        fields["mcap"] = field_obj(td, tv, label="国证指数官网·指数列表", url=CNI_LIST_URL, unit="亿元",
                                   method="cnindex indexList totalMarketValue（元）÷1e8＝样本总市值（亿元），非自由流通；"
                                          "自由流通市值另存 extras.mcapFreeFloat；响应无日期，以同站日行情收盘点位精确匹配定日；逐次运行累积",
                                   frequency="snapshot", basis="total", reason="国证缓存中无不晚于 as_of 的总市值观测")
        dd, vv = series_from_points(pts, as_of)
        if dd:
            extras["mcapFreeFloat"] = field_obj(dd, vv, label="国证指数官网·指数列表", url=CNI_LIST_URL, unit="亿元",
                                                method="cnindex indexList freeMarketValue（元）÷1e8，自由流通市值",
                                                frequency="snapshot", basis="free_float")
        cd, cv = series_from_points(cons, as_of)
        if cd:
            comp = component_obj(cv[-1], cd[-1], label="国证指数官网·指数列表", url=CNI_PAGE.format(code=code6),
                                 method="cnindex indexList samplesize（样本数）；日期由日行情收盘点位匹配")
    else:
        src = "国证 cnindex indexList" if meta["code"].startswith("399") and not meta.get("csi") else "中证 index-feature"
        fields["mcap"] = unavailable(f"{src} 无缓存（本次未取到或 offline 无 raw）")
    if comp is None:
        comp = component_obj(reason="中证 index-feature / 国证 indexList 均无该指数有日期的样本数缓存")
    fields.update(a_share_gaps())
    return fields, extras, comp


def a_share_gaps() -> dict:
    return {
        "turn": unavailable(
            "已查中证 index-perf/index-feature/indicator.xls、国证 indexList/日行情：均无指数换手率字段；"
            "腾讯/东财行情列无公开口径文档，按 ROUND2 不猜测；用成交额÷自由流通市值自行合成不是官方定义，未做（可由 manager 决定是否作为派生指标另列）",
            unit="%"),
        "eps": unavailable("中证/国证公开接口与官方文件只披露 PE/PB/股息率，不披露指数每股收益；禁止由点位/PE反推", unit="来源原定义"),
        "bps": unavailable("中证/国证公开接口与官方文件不披露指数每股净资产；禁止由点位/PB反推", unit="来源原定义"),
        "roe": unavailable("中证/国证公开接口未披露指数 ROE；禁止用 PB/PE 合成", unit="%"),
    }


def build_hk(meta: dict, raw: str, as_of: str) -> tuple[dict, dict, dict]:
    s, _icode, ename = HSI_MAP[meta["code"]]
    fields, extras = {}, {}
    pe, dy = {}, {}
    for f in _glob(raw, "hsi", "idx", f"{s}_*.csv"):
        fdate = os.path.basename(f)[len(s) + 1: len(s) + 11]
        with open(f, "rb") as fh:
            row = parse_hsi_idx_csv(fh.read(), ename)
        if not row or norm_date(row.get("Trade Date")) != fdate:
            continue
        if "PE Ratio (times)" in row:
            pe[fdate] = row.get("PE Ratio (times)")
        if "Dividend Yield (%)" in row:
            dy[fdate] = row.get("Dividend Yield (%)")
    idx_url = HSI_PAGE.format(s=s)
    hsi_label = "恒生指数公司官网·每日指数报告 idx_*.csv"
    for k, pts, unit, meth in (("pe", pe, "倍", "官方日报“PE Ratio (times)”（加权平均市盈率，恒生口径）"),
                               ("dy", dy, "%", "官方日报“Dividend Yield (%)”（加权平均股息率，恒生口径）")):
        dd, vv = series_from_points(pts, as_of)
        why = (f"恒生官方 {s} 日报 idx csv 不含 PE/股息率列（仅点位/涨跌），月末 PE/DY xlsx 官网返回 302→404；"
               "其他公开来源未找到 HSTECH 官方估值" if not dd and s == "hstech"
               else f"恒生官方 {s} 日报 idx csv 无缓存或无该列")
        fields[k] = field_obj(dd, vv, label=hsi_label, url=idx_url, unit=unit,
                              method=meth + "；官网仅保留约30个交易日，逐次运行累积", frequency="daily", reason=why)
    amt = {}
    for f in _glob(raw, "hsi", "ips", "*.json"):
        j = read_json(f)
        rows = j.get("rows") or []
        if not rows:
            continue
        head = rows[0]
        try:
            ti = next(i for i, h in enumerate(head) if "Index Turnover" in h)
            ci = head.index("Index Currency")
        except (StopIteration, ValueError):
            continue
        for r in rows[1:]:
            if r[1] == ename and r[ci] == "HKD" and norm_date(r[0]) == os.path.basename(f)[:10]:
                v = to_float(r[ti])
                amt[norm_date(r[0])] = None if v is None else round(v / 100.0, 2)
    dd, vv = series_from_points(amt, as_of)
    if dd:
        extras["amtHKD"] = field_obj(dd, vv, label="恒生指数公司官网·Index Performance Summary", url=idx_url, unit="亿港元",
                                     method="官方“Index Turnover (Mn)”（指数成份股成交额，百万港元）÷100＝亿港元，原币原值",
                                     frequency="daily")
    rates = load_ecb(raw)
    cny, missing = {}, []
    for d, hkd_yi in zip(dd, vv):
        r = rates.get(d)
        if r is None:
            missing.append(d)  # 汇率缺日：不前填、不造数
            continue
        cny[d] = round(hkd_yi * r["CNY"] / r["HKD"], 2)
    cd, cv = series_from_points(cny, as_of)
    if not dd:
        why = "恒生 Index Performance Summary 无缓存"
    elif not rates:
        why = "ECB 参考汇率无缓存（下载失败或 offline 无 raw），不做换算、不强塞数；原币值见 extras.amtHKD"
    else:
        why = "恒生成交额日期与 ECB 参考汇率日期均无精确匹配，不前填；原币值见 extras.amtHKD"
    fields["amt"] = field_obj(cd, cv, label="恒生指数公司官网 × 欧洲央行参考汇率（派生换算）", url=idx_url, unit="亿元",
                              method="派生：恒生官方“Index Turnover (Mn)”港元金额÷100（亿港元）× 同日 ECB 欧元参考汇率 CNY/EUR ÷ HKD/EUR"
                                     "（＝每港元人民币）＝人民币亿元。ECB 参考汇率为欧洲央行约 14:10 CET 的参考时点报价，"
                                     "与港股 16:00 HKT 收市不同时点；只用日期精确匹配的 ECB 汇率，缺日不前填。原币见 extras.amtHKD",
                              frequency="daily", reason=why,
                              extra_source={"fxSource": {"label": "European Central Bank euro foreign exchange reference rates",
                                                         "url": ECB_URL, "page": ECB_PAGE,
                                                         "formula": "CNY_per_HKD = rate(CNY)/rate(HKD), both per 1 EUR",
                                                         "referenceTime": "约 14:10 CET（ECB 每日参考时点）",
                                                         "unmatchedDates": missing}})
    fields["volume"] = unavailable("恒生官方日报/IPS 只给成交额不给成交股数；腾讯港股指数成交量单位无文档（fetch_data 已置 null），不猜测", unit="股")
    fields["pb"] = unavailable("恒生官网日报与月末文件只披露 PE 与股息率，无 PB；未找到其他有口径说明的公开免费来源", unit="倍")
    fields["mcap"] = unavailable("恒生官网公开接口/日报不含指数市值（factsheet PDF 有月末数据但非结构化，本轮未解析）", unit="亿元")
    fields["turn"] = unavailable("恒生官方报告无指数换手率；第三方行情列无口径文档，不猜测", unit="%")
    fields["eps"] = unavailable("恒生官方只披露 PE/股息率，不披露指数每股收益；禁止由点位/PE反推", unit="来源原定义")
    fields["bps"] = unavailable("恒生官方未披露指数每股净资产", unit="来源原定义")
    fields["roe"] = unavailable("恒生官方未披露指数 ROE；禁止用 PB/PE 合成", unit="%")
    for k in ("pe", "dy"):
        f = os.path.join(raw, "hsi", "monthly", f"{k}_{s}.xlsx")
        if os.path.exists(f):
            with open(f, "rb") as fh:
                title, pts = parse_hsi_monthly(fh.read())
            dd, vv = series_from_points(pts, as_of)
            if dd:
                extras[f"{k}Monthly"] = field_obj(dd, vv, label="恒生指数公司官网·Historical " + ("PE Ratio" if k == "pe" else "Dividend Yield"),
                                                  url=HSI_MONTHLY_URL.format(k=k, s=s), unit="倍" if k == "pe" else "%",
                                                  method=f"官方月末文件“{title}”，仅最近12个月；与日报同口径但不同频率，未拼接进主字段",
                                                  frequency="monthly")
    comp = None
    for f in _glob(raw, "hsi", "cons", f"{s}_*.json"):
        j = read_json(f)
        d = norm_date(os.path.basename(f)[len(s) + 1: len(s) + 11])
        for x in j.get("numOfConsList") or []:
            if x.get("indexName") == ename and to_float(x.get("count")) is not None and (not as_of or d <= as_of):
                comp = component_obj(int(x["count"]), d, label="恒生指数公司官网·成分股", url=HSI_PAGE.format(s=s),
                                     method="官网成分股 rt 接口 numOfConsList.count；日期为成分股数据 dateTime")
    if comp is None:
        comp = component_obj(reason="恒生成分股接口无缓存")
    return fields, extras, comp


def build_us(meta: dict, raw: str, as_of: str) -> tuple[dict, dict, dict]:
    code = meta["code"]
    fields, extras = {}, {}
    tick = WSJ_MAP.get(code)
    pe, dy, foot = {}, {}, ""
    if tick:
        for f in _glob(raw, "wsj", "*.json"):
            j = read_json(f)
            b = j.get("block") or {}
            d = norm_date(b.get("tradeDate"))
            foot = j.get("footnote") or foot
            for x in b.get("instruments", []):
                if x.get("ticker") == tick and d:
                    pe[d] = x.get("priceEarningsRatio")
                    dy[d] = x.get("yield")
    for k, pts, unit, meth in (("pe", pe, "倍", "WSJ“P/E RATIO”当日列（trailing 12 months，as-reported earnings）"),
                               ("dy", dy, "%", "WSJ“DIV YIELD”当日列（trailing 12 months）")):
        dd, vv = series_from_points(pts, as_of)
        why = ("WSJ peyields 页面只有 Nasdaq 100，没有 Nasdaq Composite，不能替代；Nasdaq 官方指数页无估值；未找到其他免费公开的 COMP 估值"
               if tick is None else "WSJ peyields 无缓存")
        fields[k] = field_obj(dd, vv, label="WSJ Market Data · P/Es & Yields on Major Indexes", url=WSJ_URL, unit=unit,
                              method=meth + (f"；页面注：{foot}" if foot else "") + "；单期快照，逐次运行累积，不能据此给长期分位",
                              frequency="snapshot", reason=why)
    fields["pb"] = unavailable("WSJ/Nasdaq 公开页不提供指数 PB；S&P DJI 官网与 eps 表 403（不绕过）", unit="倍")
    fields["amt"] = unavailable("美股指数无官方‘指数成交额’；Nasdaq 官方历史接口 volume 为“--”；交易所总成交额是市场总数，不能替代", unit="亿元")
    fields["volume"] = unavailable("Nasdaq 官方历史接口指数 volume 为“--”；腾讯美股指数成交量单位无文档；不以市场总量替代", unit="股")
    fields["mcap"] = unavailable("S&P DJI 指数页/factsheet 403（不绕过）；Nasdaq 官方指数页未给总市值", unit="亿元")
    fields["turn"] = unavailable("无公开有口径的指数换手率来源", unit="%")
    fields["eps"] = unavailable("未找到每股口径的官方免费 EPS；Shiller 数据集 E 为指数点位口径盈利且止于历史，已放 extras.earningsPts 供 manager 决定 schema，不塞入 eps", unit="来源原定义")
    fields["bps"] = unavailable("未找到官方免费指数每股净资产", unit="来源原定义")
    fields["roe"] = unavailable("未找到官方免费指数 ROE；禁止用 PB/PE 合成", unit="%")
    if code == "SPX.US":
        f = os.path.join(raw, "shiller", "ie_data.xls")
        if os.path.exists(f):
            with open(f, "rb") as fh:
                sd = parse_shiller(fh.read())
            meth = "Shiller ie_data.xls（S&P Composite，1957年起即S&P 500）月度；P为月内日收盘均值"
            dd, vv = series_from_points(sd["E"], as_of)
            if dd:
                extras["earningsPts"] = field_obj(dd, vv, label="Robert Shiller 公开数据集", url=SHILLER_URL, unit="指数点位",
                                                  method=meth + "；E=过去12个月每股（指数单位）收益，单位为指数点，非个股式每股EPS；"
                                                         "建议 manager 新增字段名 earningsPts 而非 eps", frequency="monthly")
            pts = {d: sd["P"][d] / sd["E"][d] for d in sd["E"] if d in sd["P"] and sd["E"][d] > 0}
            dd, vv = series_from_points(pts, as_of)
            if dd:
                extras["peShillerMonthly"] = field_obj(dd, [round(x, 4) for x in vv], label="Robert Shiller 公开数据集", url=SHILLER_URL,
                                                       unit="倍", method=meth + "；P÷E（数据集原列），与 WSJ 口径不同，不拼接", frequency="monthly")
            pts = {d: sd["D"][d] / sd["P"][d] * 100 for d in sd["D"] if d in sd["P"] and sd["P"][d] > 0}
            dd, vv = series_from_points(pts, as_of)
            if dd:
                extras["dyShillerMonthly"] = field_obj(dd, [round(x, 4) for x in vv], label="Robert Shiller 公开数据集", url=SHILLER_URL,
                                                       unit="%", method=meth + "；D÷P×100（数据集原列）", frequency="monthly")
    comp = None
    sym = NASDAQ_MAP.get(code)
    if sym:
        for f in _glob(raw, "nasdaq", f"{sym}_*.json"):
            j = read_json(f)
            if not as_of or j["date"] <= as_of:
                comp = component_obj(j["components"], j["date"], label="Nasdaq Global Indexes 官方指数页",
                                     url=NASDAQ_OVERVIEW_URL.format(sym=sym), method="Quick Facts “# of Components”")
    if comp is None:
        comp = component_obj(reason=("Nasdaq 官方指数页无缓存" if sym else
                                     "S&P DJI 官网 403（不绕过），未找到其他带日期的官方成分数披露"))
    return fields, extras, comp


def load_ecb(raw: str) -> dict[str, dict[str, float]]:
    """合并所有已校验落盘的 ECB XML（每次下载按最新日期存一份）；同日以较新文件为准。"""
    out = {}
    for f in _glob(raw, "ecb", "*.xml"):
        try:
            with open(f, "rb") as fh:
                out.update(parse_ecb(fh.read()))
        except (ET.ParseError, OSError):
            continue
    return out


def build(indices: list[dict], as_of: str, raw: str = RAW_DIR, errors: list | None = None) -> dict:
    series = {}
    for m in indices:
        mk = m.get("market")
        if mk == "A":
            fields, extras, comp = build_a_share(m, raw, as_of)
        elif mk == "HK" and m["code"] in HSI_MAP:
            fields, extras, comp = build_hk(m, raw, as_of)
        elif mk == "US":
            fields, extras, comp = build_us(m, raw, as_of)
        else:
            owned = OWNED_ALL + (OWNED_XB if mk in ("HK", "US") else [])
            fields = {k: unavailable("本 provider 无该指数来源映射") for k in owned}
            extras, comp = {}, component_obj(reason="本 provider 无该指数来源映射")
        owned = OWNED_ALL + (OWNED_XB if mk in ("HK", "US") else [])
        entry = {"fields": {k: fields[k] for k in owned}, "componentNum": comp}
        if extras:
            entry["extras"] = extras
        series[m["code"]] = entry
    return {"provider": NAME, "retrievedAt": None, "builtAt": utc_now(), "asOf": as_of, "series": series,
            "errors": list(errors or [])}


def collect(indices: list[dict], as_of: str, offline: bool = False, raw_dir: str = RAW_DIR,
            out_path: str | None = OUT_PATH, get: Callable[..., bytes] = http_get,
            only: set[str] | None = None) -> dict:
    """在线：下载到 raw_dir 后解析；offline：只读 raw_dir，不联网。结果写 out_path（None 不写）。

    only（完整代码集合，如 {"H30184.CSI"}）：只为这些指数联网下载（新增指数首次初始化用，不重复刷新其余指数、
    不改 _last_online.json），解析仍覆盖全部 indices（其余只读已有 raw）。"""
    errors: list = []
    marker = os.path.join(raw_dir, "_last_online.json")
    if not offline:
        started = utc_now()
        dl = Downloader(raw_dir, get)
        dl_indices = [m for m in indices if only is None or m["code"] in only]
        a_meta = [m for m in dl_indices if m.get("market") == "A"]
        a_codes = [m["code"].split(".")[0] for m in a_meta]
        cni_codes = [c for c, m in zip(a_codes, a_meta) if c.startswith("399") and not m.get("csi")]
        csi_codes = [c for c in a_codes if c not in cni_codes]
        with ThreadPoolExecutor(max_workers=4) as ex:
            list(ex.map(dl.csi_feature, csi_codes))
        dl.cnindex(cni_codes, as_of)
        dl.hsi([HSI_MAP[m["code"]][0] for m in dl_indices if m["code"] in HSI_MAP])
        if any(m["code"] in WSJ_MAP for m in dl_indices):
            dl.wsj()
        dl.nasdaq([NASDAQ_MAP[m["code"]] for m in dl_indices if m["code"] in NASDAQ_MAP])
        if any(m["code"] == "SPX.US" for m in dl_indices):
            dl.shiller()
        if any(m["code"] in HSI_MAP for m in dl_indices):
            dl.ecb()
        errors = dl.errors
        if only is None:
            last = {"retrievedAt": started, "finishedAt": utc_now(), "errorCount": len(errors)}
            write_json(marker, last)
        else:  # 子集初始化不冒充全量在线采集
            try:
                last = read_json(marker)
            except (OSError, ValueError):
                last = {}
    else:
        try:
            last = read_json(marker)
        except (OSError, ValueError):
            last = {}
    result = build(indices, as_of, raw_dir, errors)
    result["mode"] = "offline" if offline else "online"
    # retrievedAt＝最近一次真实联网采集开始时间（offline 重建不会刷新它）；builtAt＝本次解析重建时间
    result["retrievedAt"] = last.get("retrievedAt")
    result["lastOnline"] = last or None
    if out_path:
        write_json(out_path, result)
    return result


def summarize(result: dict) -> list[str]:
    lines = []
    for code, e in result["series"].items():
        for k, f in e["fields"].items():
            if f["status"] == "ok":
                lines.append(f"{code}\t{k}\tok\t{len(f['d'])}\t{f['d'][0]}\t{f['d'][-1]}\t{f['source']['unit']}\t{f['frequency']}")
            else:
                lines.append(f"{code}\t{k}\tunavailable")
        c = e["componentNum"]
        lines.append(f"{code}\tcomponentNum\t{c['status']}\t{c['value']}\t{c['date']}")
    return lines


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--offline", action="store_true", help="只读 supplemental_raw 缓存，不联网")
    ap.add_argument("--as-of", default=dt.date.today().isoformat())
    ap.add_argument("--summary", action="store_true", help="打印逐指数字段覆盖")
    ap.add_argument("--only", default="", help="逗号分隔代码：只为这些指数联网下载（新增指数初始化），其余只读 raw")
    a = ap.parse_args(argv)
    sys.path.insert(0, HERE)
    import fetch_data  # 只读取 INDICES 元数据
    only = {c.strip() for c in a.only.split(",") if c.strip()} or None
    res = collect(fetch_data.INDICES, a.as_of, offline=a.offline, only=only)
    ok = sum(1 for e in res["series"].values() for f in e["fields"].values() if f["status"] == "ok")
    tot = sum(len(e["fields"]) for e in res["series"].values())
    comp = sum(1 for e in res["series"].values() if e["componentNum"]["status"] == "ok")
    print(f"[supplemental] mode={res['mode']} fields ok {ok}/{tot}, componentNum ok {comp}/{len(res['series'])}, errors {len(res['errors'])}")
    for er in res["errors"]:
        print("  error:", er["source"], er["url"], er["error"])
    if a.summary:
        print("\n".join(summarize(res)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
