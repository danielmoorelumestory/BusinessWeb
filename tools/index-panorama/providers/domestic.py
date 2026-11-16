"""A 股指数 PE / PB / 股息率 provider（round2 domestic）。

接口：collect(indices, as_of, offline=False) -> dict，结构见 ROUND2.md「Provider契约」。
CLI：python providers/domestic.py [--offline] [--as-of YYYY-MM-DD]

来源（2026-11-15 实测可匿名访问，均为各站自身网页前端调用的公开 JSON / 文件）：
  * 中证指数官网 /csindex-home/perf/indexCsiDsPe：官网「滚动市盈率」(peg, PE TTM) 日频全历史，2011 起。
  * 中证指数官网 indicator.xls：近 20 个交易日 PE1/PE2/D/P1/D/P2，dy 取 D/P2（计算用股本），
    每次运行把新窗口并入本地累积缓存（只累积同一文件同一列，不与他源拼接）。
  * 中证指数官网 /csindex-home/data-service/indexValuation：「每日指数信息-指数估值」最新单期，
    仅 8 只主要指数，含 pb；本 provider 只用于上证指数 pb（其余有更长的同口径序列）。
  * 国证指数官网 /index/indexList：国证指数最新单期 peStatic/peDynamic(PE 滚动)/pb，无日期字段，
    日期通过同站日线收盘点位匹配得到。
  * 蛋卷基金 danjuanfunds.com /djapi/index_eva：估值页使用的匿名 JSON，周频约 10 年 pe/pb，
    最新单期股息率；口径为蛋卷自有计算，与中证官网不同，因此每个 code+field 只取一个来源，不拼接。
每个 code+field 的来源在 PLAN 中静态固定，某来源失败只沿用该来源的缓存，绝不换源补洞。
只用标准库 + xlrd（indicator.xls）。
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import os
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Callable

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT_PATH = os.path.join(ROOT, "data", "providers", "domestic.json")
RAW_DIR = os.path.join(ROOT, "data", "providers", "domestic_raw")
CALENDAR_CSV = os.path.join(ROOT, "data", "store", "price_000001_SH.csv")  # 只读，作 A 股交易日历

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"

CSI_PE_URL = "https://www.csindex.com.cn/csindex-home/perf/indexCsiDsPe?indexCode={code}"
CSI_IND_URL = ("https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/file/autofile/"
               "indicator/{code}indicator.xls")
CSI_VAL_URL = "https://www.csindex.com.cn/csindex-home/data-service/indexValuation"
CSI_PAGE = "https://www.csindex.com.cn/#/indices/family/detail?indexCode={code}"
CN_LIST_URL = "https://www.cnindex.com.cn/index/indexList?channelCode=-1&rows=2000&pageNum=1"
CN_DAILY_URL = ("https://hq.cnindex.com.cn/market/market/getIndexDailyDataWithDataFormat?"
                "indexCode={code}&startDate={start}&endDate={end}&frequency=day")
CN_PAGE = "https://www.cnindex.com.cn/module/index-detail.html?act_menu=1&indexCode={code}"
DJ_HIST_URL = "https://danjuanfunds.com/djapi/index_eva/{kind}_history/{sym}?day=all"
DJ_DETAIL_URL = "https://danjuanfunds.com/djapi/index_eva/detail/{sym}"
DJ_PAGE = "https://danjuanfunds.com/dj-valuation-table-detail/{sym}"

FIELDS = ("pe", "pb", "dy", "roe")

# 海外目标：蛋卷估值列表实际 index_code 映射（2026-11-15 实测 /djapi/index_eva/dj 63 项）。
# 只补 supplemental 官方来源仍缺的字段，不碰其已有的官方 PE/DY。IXIC 蛋卷仅有 NDX（纳指100），不能代替综指；DJI 未覆盖。
OVERSEAS_DJ_SYM = {"HSI.HK": "HKHSI", "HSTECH.HK": "HKHSTECH", "HSCEI.HK": "HKHSCEI", "SPX.US": "SP500"}
OVERSEAS_PLAN = {
    "HSI.HK": {"pb": "danjuan_pb", "roe": "danjuan_roe"},
    "HSCEI.HK": {"pb": "danjuan_pb", "roe": "danjuan_roe"},
    "HSTECH.HK": {"pe": "danjuan_pe", "pb": "danjuan_pb", "dy": "danjuan_dy", "roe": "danjuan_roe"},
    "SPX.US": {"pb": "danjuan_pb", "roe": "danjuan_roe"},
    "IXIC.US": {"pe": None, "pb": None, "dy": None, "roe": None},
    "DJI.US": {"pb": None, "roe": None},
}
OVERSEAS_MISSING = {
    "IXIC.US": "蛋卷估值列表只有 NDX（纳斯达克100），不是纳斯达克综合指数 IXIC，不能替代；IXIC 无蛋卷映射。",
    "DJI.US": "蛋卷估值列表（63 项）不含道琼斯工业指数，pb/roe 无公开匿名同指数来源。",
}

# 蛋卷估值表当前在更新（末期 ≥ 2026-11）的目标指数；SH000986/987/990 历史停更于 2018-2019，不采用
DANJUAN_ACTIVE = {"000688.SH", "000016.SH", "000300.SH", "000905.SH", "000852.SH", "000903.SH",
                  "000922.CSI", "000932.SH", "399967.SZ", "399975.SZ", "399986.SZ", "399971.SZ",
                  "000827.SH", "000989.SH", "000991.SH", "000993.SH", "399001.SZ", "399006.SZ"}
# 2026-11-16 扩展指数中蛋卷估值列表（/djapi/index_eva/dj，63 项）确有同一指数代码的 5 只；其余新增指数蛋卷未覆盖，
# 不按名称近似代配（如蛋卷 SZ399417 是国证新能源车，不是中证新能源汽车 399976）。
DANJUAN_ACTIVE |= {"399997.SZ", "399989.SZ", "399998.SZ", "931079.CSI", "H30269.CSI"}
# 蛋卷对中证 93xxxx/H3xxxx 指数用 CSI 前缀（列表实测 CSI931079、CSIH30269），不能套 SH 前缀
DJ_SYM_OVERRIDE = {"931079.CSI": "CSI931079", "H30269.CSI": "CSIH30269"}
DANJUAN_STALE = {"000986.SH": "2018-07-16", "000987.SH": "2018-07-04", "000990.SH": "2019-04-26"}
CNINDEX_CODES = {"399001.SZ", "399006.SZ", "399303.SZ"}
CSI_VAL_NAMES = {"000001.SH": "上证指数"}  # 只用该接口补上证指数 pb

# 已调查但不可用/不采用的来源（写入 unavailable reason）
TRIED_NOTE = {
    "pb": ("已查：中证 indexCsiDsPe 仅 PE；中证 indicator.xls 无 PB；中证 data-service/indexValuation 仅 8 只主要指数最新单期；"
           "国证 indexList 仅国证指数；蛋卷估值表未覆盖该指数{extra}；乐咕乐股 API 需页面 token（上一轮 403/401，不绕过）；"
           "中证 dataServer 行业市盈率为行业分类而非本指数，不作代理。"),
    "dy": ("已查：国证 indexList 无股息率字段；蛋卷 dividend_yield_history 需登录（不绕过）；蛋卷估值表未覆盖该指数；"
           "中证 indicator.xls 不覆盖国证指数。"),
}


def plan_for(meta: dict) -> dict:
    """每个 code+field 固定一个来源 key（None=无可用来源）。海外只含本 provider 负责补的字段。"""
    code, csi = meta["code"], meta.get("csi")
    if meta.get("market") != "A":
        return dict(OVERSEAS_PLAN.get(code, {}))
    p = {}
    if csi:
        p["pe"] = "csi_peg"
    elif code in DANJUAN_ACTIVE:
        p["pe"] = "danjuan_pe"
    elif code in CNINDEX_CODES:
        p["pe"] = "cnindex_pe"
    else:
        p["pe"] = None
    if code in DANJUAN_ACTIVE:
        p["pb"] = "danjuan_pb"
    elif code in CSI_VAL_NAMES:
        p["pb"] = "csi_val_pb"
    elif code in CNINDEX_CODES:
        p["pb"] = "cnindex_pb"
    else:
        p["pb"] = None
    if csi:
        p["dy"] = "csi_dp2"
    elif code in DANJUAN_ACTIVE:
        p["dy"] = "danjuan_dy"
    else:
        p["dy"] = None
    p["roe"] = "danjuan_roe" if code in DANJUAN_ACTIVE else None
    return p


# ---------------------------------------------------------------------------
# 网络 / 缓存工具
# ---------------------------------------------------------------------------

class FetchError(Exception):
    pass


def http_get(url: str, timeout: float = 30.0, retries: int = 2) -> bytes:
    last = None
    for i in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                if r.status != 200:
                    raise FetchError(f"HTTP {r.status}")
                return r.read()
        except (urllib.error.URLError, OSError, FetchError) as e:  # 含 TLS/超时
            last = e
            if isinstance(e, urllib.error.HTTPError) and e.code in (401, 403, 404):
                break  # 鉴权/不存在不重试
            time.sleep(1.5 * (i + 1))
    raise FetchError(f"{type(last).__name__}: {last}")


def atomic_write(path: str, data: bytes) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".tmp-")
    with os.fdopen(fd, "wb") as f:
        f.write(data)
    os.replace(tmp, path)


def raw_path(name: str, raw_dir: str) -> str:
    return os.path.join(raw_dir, name)


def read_raw(name: str, raw_dir: str):
    p = raw_path(name, raw_dir)
    if not os.path.exists(p):
        return None
    with open(p, "rb") as f:
        return f.read()


def finite(x) -> float | None:
    if x is None or isinstance(x, bool):
        return None
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return v if math.isfinite(v) else None


def ymd(s: str) -> str:
    s = str(s).strip()
    if len(s) == 8 and s.isdigit():
        return dt.date(int(s[:4]), int(s[4:6]), int(s[6:])).isoformat()  # 非法日期抛 ValueError
    return dt.date.fromisoformat(s[:10]).isoformat()


def ts_to_date(ms) -> str:
    """蛋卷 ts 为北京时间 0 点的毫秒时间戳。"""
    return dt.datetime.fromtimestamp(int(ms) / 1000, dt.timezone(dt.timedelta(hours=8))).date().isoformat()


def load_calendar(path: str = CALENDAR_CSV) -> set[str]:
    cal = set()
    try:
        with open(path, encoding="utf-8") as f:
            next(f, None)
            for line in f:
                d = line.split(",", 1)[0].strip()
                if len(d) == 10:
                    cal.add(d)
    except OSError:
        pass
    return cal


def sorted_series(pairs: dict) -> tuple[list[str], list[float]]:
    ds = sorted(d for d, v in pairs.items() if finite(v) is not None)
    return ds, [round(float(pairs[d]), 4) for d in ds]


# ---------------------------------------------------------------------------
# 解析（纯函数，便于测试）
# ---------------------------------------------------------------------------

def parse_csi_peg(raw: bytes, calendar: set[str]) -> tuple[dict, list[str]]:
    """indexCsiDsPe -> {date: peg}。中证接口会把请求起始日/节假日伪插一行，按交易日历剔除：
    在日历范围内必须是交易日；晚于日历末日的只保留工作日。"""
    js = json.loads(raw.decode("utf-8"))
    if str(js.get("code")) != "200":
        raise FetchError(f"中证返回 code={js.get('code')} msg={js.get('msg')}")
    cal_end = max(calendar) if calendar else None
    out, dropped = {}, []
    for r in js.get("data") or []:
        try:
            d = ymd(r.get("tradeDate"))
        except (ValueError, TypeError):
            continue
        v = finite(r.get("peg"))
        if v is None or v <= 0:
            continue
        if calendar and cal_end and d <= cal_end:
            ok = d in calendar
        else:
            ok = dt.date.fromisoformat(d).weekday() < 5
        if not ok:
            dropped.append(d)
            continue
        out[d] = v
    return out, dropped


def parse_indicator_xls(raw: bytes) -> dict:
    """indicator.xls -> {date: {'pe1','pe2','dp1','dp2'}}，按表头关键词定位列。"""
    import xlrd  # 局部依赖
    book = xlrd.open_workbook(file_contents=raw)
    sh = book.sheet_by_index(0)
    head = [str(x) for x in sh.row_values(0)]

    def col(*keys):
        for i, h in enumerate(head):
            if all(k in h for k in keys):
                return i
        raise FetchError(f"indicator.xls 缺少列 {keys}: {head}")
    ci = {"date": col("日期"), "pe1": col("P/E1"), "pe2": col("P/E2"), "dp1": col("D/P1"), "dp2": col("D/P2")}
    out = {}
    for r in range(1, sh.nrows):
        row = sh.row_values(r)
        try:
            d = ymd(str(row[ci["date"]]).split(".")[0])
        except (ValueError, TypeError):
            continue
        out[d] = {k: finite(row[i]) for k, i in ci.items() if k != "date"}
    return out


def parse_danjuan_history(raw: bytes, kind: str) -> dict:
    js = json.loads(raw.decode("utf-8"))
    data = js.get("data")
    if not isinstance(data, dict):
        raise FetchError(f"蛋卷返回异常：{js.get('result_code')} {js.get('message')}")
    arr = data.get(f"index_eva_{kind}_growths") or []
    out = {}
    for r in arr:
        v = finite(r.get(kind))
        if v is None:
            continue
        if kind == "roe":
            if v == 0:  # 蛋卷以 0 作缺失占位（如国证地产 pe/roe 同为 0）；负 ROE 为合法值保留
                continue
            v = round(v * 100, 4)  # 小数 -> 百分数（估值页渲染 numeral(item.roe * 100) + '%'）
        elif v <= 0:  # pe/pb：蛋卷以 0 表示亏损/无意义，不能当数值
            continue
        out[ts_to_date(r["ts"])] = v
    return out


def parse_danjuan_detail(raw: bytes) -> tuple[str, float | None]:
    js = json.loads(raw.decode("utf-8"))
    d = js.get("data")
    if not isinstance(d, dict) or "ts" not in d:
        raise FetchError(f"蛋卷 detail 异常：{js.get('result_code')} {js.get('message')}")
    y = finite(d.get("yeild"))  # 非有限 -> None
    # 0 是合法股息率（不分红）予以保留；负值不合法，拒收
    return ts_to_date(d["ts"]), (round(y * 100, 4) if y is not None and y >= 0 else None)


def parse_cnindex_list(raw: bytes) -> dict:
    js = json.loads(raw.decode("utf-8"))
    if js.get("code") != 200:
        raise FetchError(f"国证 indexList code={js.get('code')}")
    return {r["indexcode"]: r for r in (js.get("data") or {}).get("rows") or []}


def cnindex_date_for_close(raw_daily: bytes, close) -> str | None:
    """indexList 无日期，用同站日线中收盘点位一致的最近交易日确定观测日。"""
    js = json.loads(raw_daily.decode("utf-8"))
    rows = ((js.get("data") or {}).get("data")) or []
    c = finite(close)
    if c is None:
        return None
    for r in sorted(rows, key=lambda x: x[0], reverse=True):
        rc = finite(r[5]) if len(r) > 5 else None
        if rc is not None and abs(rc - c) < 1e-3:
            return ymd(r[0])
    return None


def parse_csi_valuation(raw: bytes) -> tuple[str, dict]:
    js = json.loads(raw.decode("utf-8"))
    d = js.get("data") or {}
    return ymd(d["tradeDate"]), {x["indexName"]: x for x in d.get("indexValuations") or []}


# ---------------------------------------------------------------------------
# 采集
# ---------------------------------------------------------------------------

def _nonempty(x, what: str):
    if not x:
        raise FetchError(f"{what} 解析结果为空")
    return x


def v_csi_peg(cal):
    return lambda raw: _nonempty(parse_csi_peg(raw, cal)[0], "indexCsiDsPe")


def v_indicator(raw):
    return _nonempty(parse_indicator_xls(raw), "indicator.xls")


def v_danjuan(kind):
    return lambda raw: _nonempty(parse_danjuan_history(raw, kind), f"蛋卷 {kind}_history")


def v_cnindex_list(raw):
    return _nonempty(parse_cnindex_list(raw), "国证 indexList")


def v_cnindex_daily(raw):
    js = json.loads(raw.decode("utf-8"))
    rows = _nonempty(((js.get("data") or {}).get("data")) or [], "国证日线")
    for r in rows:
        ymd(r[0])
    return rows


def v_csi_val(raw):
    return _nonempty(parse_csi_valuation(raw)[1], "中证 indexValuation")


def dj_sym(code: str) -> str:
    if code in OVERSEAS_DJ_SYM:
        return OVERSEAS_DJ_SYM[code]
    if code in DJ_SYM_OVERRIDE:
        return DJ_SYM_OVERRIDE[code]
    num, suf = code.split(".")
    pre = {"SH": "SH", "SZ": "SZ", "CSI": "SH"}.get(suf)
    return pre + num if pre else ""  # 无蛋卷映射（如 IXIC/DJI）


class Collector:
    def __init__(self, raw_dir: str, offline: bool, get: Callable, calendar: set[str], as_of: str,
                 missing_only: bool = False):
        self.raw_dir, self.offline, self.get, self.calendar, self.as_of = raw_dir, offline, get, calendar, as_of
        self.missing_only = missing_only  # True：已有有效 raw 的请求不联网（增量补新来源，保持旧值不变）
        self.errors: list[str] = []
        self.notes: dict[str, str] = {}  # raw name -> 本次是否沿用缓存
        self._mem: dict[str, bytes | None] = {}

    def fetch(self, name: str, url: str, validate: Callable[[bytes], object] | None = None) -> bytes | None:
        """联网取数，先用 validate 校验（解析失败/空结果即抛异常），通过后才覆盖 raw 缓存；
        请求失败、HTTP 200 但内容无效（HTML、错误 JSON、空数据）或离线时，读上一份已通过校验的缓存。
        返回 None 表示既没拿到有效数据也没缓存。"""
        if name in self._mem:
            return self._mem[name]
        data = None
        skip = self.missing_only and read_raw(name, self.raw_dir) is not None
        if not self.offline and not skip:
            try:
                fresh = self.get(url)
                if self.get is http_get:
                    time.sleep(0.2)  # 真实联网时的礼貌间隔
                if validate is not None:
                    try:
                        validate(fresh)
                    except Exception as e:  # 坏响应不得覆盖有效缓存
                        raise FetchError(f"响应无效 {type(e).__name__}: {str(e)[:120]}") from e
                atomic_write(raw_path(name, self.raw_dir), fresh)
                data = fresh
                self.notes[name] = "fresh"
            except FetchError as e:
                self.errors.append(f"{name}: {url} -> {e}")
                self.notes[name] = f"本次请求失败或响应无效（{e}），沿用上一份有效缓存"
        if data is None:
            data = read_raw(name, self.raw_dir)
            if data is not None and name not in self.notes:
                mt = dt.datetime.fromtimestamp(os.path.getmtime(raw_path(name, self.raw_dir)), dt.timezone.utc)
                self.notes[name] = f"读取本地已验证缓存（采集于 {mt.replace(microsecond=0).isoformat().replace('+00:00', 'Z')}）"
        self._mem[name] = data
        return data

    # 累积型（最新单期/近 20 日窗口）：同源同列按日期并入本地 accum 文件
    def accumulate(self, key: str, fresh: dict) -> dict:
        p = raw_path(f"accum_{key}.json", self.raw_dir)
        old = {}
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                old = json.load(f)
        if fresh and not self.offline:
            old.update({d: v for d, v in fresh.items() if finite(v) is not None})
            atomic_write(p, json.dumps(dict(sorted(old.items())), ensure_ascii=False, indent=0).encode())
        return old


def empty_field(reason: str, source: dict | None = None, frequency: str = "") -> dict:
    return {"d": [], "v": [], "source": source or {"label": "", "url": "", "unit": "", "method": ""},
            "frequency": frequency, "status": "unavailable", "reason": reason}


def make_field(pairs: dict, source: dict, frequency: str, note: str, empty_reason: str) -> dict:
    ds, vs = sorted_series(pairs)
    if not ds:
        return empty_field(empty_reason + (f"（{note}）" if note else ""), source, frequency)
    return {"d": ds, "v": vs, "source": source, "frequency": frequency, "status": "ok", "reason": note}


def collect_one(meta: dict, c: Collector) -> tuple[dict, dict]:
    code, csi = meta["code"], meta.get("csi")
    plan = plan_for(meta)
    fields, info = {}, {}
    sym = dj_sym(code)

    # ---- pe
    src = plan.get("pe")
    if src == "csi_peg":
        url = CSI_PE_URL.format(code=csi)
        source = {"label": "中证指数官网", "url": url, "unit": "倍",
                  "method": "中证官网「滚动市盈率」peg（PE TTM，官网口径）；已按A股交易日历剔除接口伪插的起始日/节假日行"}
        raw = c.fetch(f"csi_pe_{csi}.json", url, v_csi_peg(c.calendar))
        pairs, dropped = {}, []
        if raw is not None:
            try:
                pairs, dropped = parse_csi_peg(raw, c.calendar)
            except (FetchError, ValueError) as e:
                c.errors.append(f"{code} pe 解析失败：{e}")
        note = c.notes.get(f"csi_pe_{csi}.json", "")
        note = "" if note == "fresh" else note
        if dropped:
            note = (note + "；" if note else "") + f"剔除非交易日伪行 {len(dropped)} 条：{', '.join(dropped[:5])}"
        fields["pe"] = make_field(pairs, source, "daily", note, "中证 indexCsiDsPe 无数据")
    elif src == "danjuan_pe":
        fields["pe"] = danjuan_hist(c, code, sym, "pe")
    elif src == "cnindex_pe":
        fields["pe"] = cnindex_field(c, code, "pe")
    else:
        fields["pe"] = empty_field("无可用公开来源")

    # ---- pb
    src = plan.get("pb")
    if src == "danjuan_pb":
        fields["pb"] = danjuan_hist(c, code, sym, "pb")
    elif src == "csi_val_pb":
        fields["pb"] = csi_val_field(c, code, "pb")
    elif src == "cnindex_pb":
        fields["pb"] = cnindex_field(c, code, "pb")
    else:
        extra = f"（蛋卷 {sym} 历史停更于 {DANJUAN_STALE[code]}，不作最新数据）" if code in DANJUAN_STALE else ""
        fields["pb"] = empty_field("无同口径公开PB来源。" + TRIED_NOTE["pb"].format(extra=extra), frequency="")

    # ---- dy
    src = plan.get("dy")
    if src == "csi_dp2":
        url = CSI_IND_URL.format(code=csi)
        source = {"label": "中证指数官网 indicator.xls", "url": url, "unit": "%",
                  "method": "中证官网 indicator.xls 列「股息率2（计算用股本）D/P2」，按官网原值；"
                            "具体计算公式未经独立验证；官网文件仅提供近约20个交易日，本地按日期累积同一列"}
        raw = c.fetch(f"csi_ind_{csi}.xls", url, v_indicator)
        fresh = {}
        if raw is not None and c.notes.get(f"csi_ind_{csi}.xls") == "fresh":
            try:
                fresh = {d: r["dp2"] for d, r in parse_indicator_xls(raw).items()}
            except Exception as e:  # xlrd 解析异常
                c.errors.append(f"{code} indicator.xls 解析失败：{type(e).__name__}: {e}")
        pairs = c.accumulate(f"dy_csi_{csi}", fresh)
        if not pairs and raw is not None:  # 首次离线也能从缓存文件解析
            try:
                pairs = {d: r["dp2"] for d, r in parse_indicator_xls(raw).items()}
            except Exception:
                pass
        note = c.notes.get(f"csi_ind_{csi}.xls", "")
        note = "" if note == "fresh" else note
        note = (note + "；" if note else "") + "仅近期窗口，样本不足以计算长期分位"
        fields["dy"] = make_field(pairs, source, "daily", note, "indicator.xls 无数据")
    elif src == "danjuan_dy":
        url = DJ_DETAIL_URL.format(sym=sym)
        source = {"label": "蛋卷基金指数估值", "url": url, "unit": "%",
                  "method": "蛋卷估值表最新股息率 yeild×100（蛋卷自有口径，非指数公司官方）；单期快照，本地按日期累积"}
        name = f"dj_detail_{sym}.json"
        raw = c.fetch(name, url, parse_danjuan_detail)
        fresh = {}
        if raw is not None and c.notes.get(name) == "fresh":
            try:
                d, y = parse_danjuan_detail(raw)
                if y is not None:
                    fresh = {d: y}
            except (FetchError, ValueError, KeyError) as e:
                c.errors.append(f"{code} 蛋卷 detail 解析失败：{e}")
        pairs = c.accumulate(f"dy_dj_{sym}", fresh)
        note = c.notes.get(name, "")
        note = "" if note == "fresh" else note
        note = (note + "；" if note else "") + "最新单期快照，不能生成长期分位（蛋卷股息率历史接口需登录，未使用）"
        fields["dy"] = make_field(pairs, source, "latest", note, "蛋卷 detail 无股息率")
    else:
        fields["dy"] = empty_field("无公开股息率来源。" + TRIED_NOTE["dy"])

    # ---- roe
    src = plan.get("roe")
    if src == "danjuan_roe":
        fields["roe"] = danjuan_hist(c, code, sym, "roe")
    else:
        reason = OVERSEAS_MISSING.get(code) or (
            "无公开 ROE 来源：蛋卷估值表未覆盖该指数（列表 63 项，见报告）；中证/国证官网接口不披露指数 ROE；"
            "不用 PE/PB 推算。")
        fields["roe"] = empty_field(reason)

    # 只输出本 provider 对该 code 负责的字段（海外只补 supplemental 缺口）
    fields = {k: v for k, v in fields.items() if k in plan}
    for k, v in fields.items():
        if v["status"] == "unavailable" and code in OVERSEAS_MISSING:
            v["reason"] = OVERSEAS_MISSING[code]
    info["plan"] = plan
    return fields, info


def danjuan_hist(c: Collector, code: str, sym: str, kind: str) -> dict:
    url = DJ_HIST_URL.format(kind=kind, sym=sym)
    if kind == "roe":
        source = {"label": "蛋卷基金指数估值", "url": url, "unit": "%",
                  "method": "蛋卷估值表 ROE 历史（蛋卷自有口径，计算公式未独立验证；非指数公司官方值）；"
                            "接口为小数，按估值页 https://danjuanfunds.com/djmodule/value-center 渲染方式 roe×100 记为百分数；"
                            "采样：每周一网格 + 最新交易日 1 个尾点（尾点值同 detail，每个交易日被新尾点取代，旧尾点不保留）；"
                            "约2018-2020年起；0 视为缺失占位，负值保留"}
    else:
        source = {"label": "蛋卷基金指数估值", "url": url, "unit": "倍",
                  "method": f"蛋卷估值表 {kind.upper()} 历史（蛋卷自有计算口径，TTM/静态等定义接口未标明、未独立验证；非指数公司官方值，"
                            "与中证/国证/恒生/标普官方数值不同，不与其拼接）；约10年；采样：每周一网格 + 最新交易日 1 个尾点"
                            "（尾点值同 detail，每个交易日被新尾点取代，旧尾点不保留）；0/负值视为缺失"}
    name = f"dj_{kind}_{sym}.json"
    raw = c.fetch(name, url, v_danjuan(kind))
    pairs = {}
    if raw is not None:
        try:
            pairs = parse_danjuan_history(raw, kind)
        except (FetchError, ValueError, KeyError) as e:
            c.errors.append(f"{code} 蛋卷 {kind} 解析失败：{e}")
    note = c.notes.get(name, "")
    return make_field(pairs, source, "weekly", "" if note == "fresh" else note, f"蛋卷 {kind}_history 无数据")


def cnindex_field(c: Collector, code: str, field: str) -> dict:
    num = code.split(".")[0]
    key = {"pe": "peDynamic", "pb": "pb"}[field]
    source = {"label": "国证指数官网", "url": CN_LIST_URL, "unit": "倍",
              "method": ("国证官网指数列表 peDynamic「PE(滚动)」" if field == "pe" else "国证官网指数列表 pb 市净率")
              + "；最新单期（接口无日期，观测日按同站日线收盘点位匹配），本地按日期累积，不能生成长期分位"}
    raw = c.fetch("cnindex_list.json", CN_LIST_URL, v_cnindex_list)
    fresh = {}
    if raw is not None and c.notes.get("cnindex_list.json") == "fresh":
        try:
            row = parse_cnindex_list(raw).get(num)
            if row:
                end = dt.date.fromisoformat(c.as_of)
                daily_url = CN_DAILY_URL.format(code=num, start=(end - dt.timedelta(days=20)).isoformat(),
                                                end=end.isoformat())
                daily = c.fetch(f"cnindex_daily_{num}.json", daily_url, v_cnindex_daily)
                d = cnindex_date_for_close(daily, row.get("closeingPoint")) if daily else None
                v = finite(row.get(key))
                if d and v is not None and v > 0:
                    fresh = {d: v}
                elif not d:
                    c.errors.append(f"{code} 国证 {field}：无法用收盘点位确定观测日，本次不入库")
        except (FetchError, ValueError, KeyError) as e:
            c.errors.append(f"{code} 国证 indexList 解析失败：{e}")
    pairs = c.accumulate(f"{field}_cn_{num}", fresh)
    note = c.notes.get("cnindex_list.json", "")
    note = "" if note == "fresh" else note
    note = (note + "；" if note else "") + "最新单期快照（官网页面该列当前隐藏，接口仍返回）"
    return make_field(pairs, source, "latest", note, "国证 indexList 无该指数")


def csi_val_field(c: Collector, code: str, field: str) -> dict:
    source = {"label": "中证指数官网 每日指数信息-指数估值", "url": CSI_VAL_URL, "unit": "倍",
              "method": "中证官网 indexValuation 最新单期 pb（市净率）；仅8只主要指数、无历史，本地按日期累积"}
    raw = c.fetch("csi_valuation.json", CSI_VAL_URL, v_csi_val)
    fresh = {}
    if raw is not None and c.notes.get("csi_valuation.json") == "fresh":
        try:
            d, rows = parse_csi_valuation(raw)
            r = rows.get(CSI_VAL_NAMES[code])
            v = finite(r.get(field)) if r else None
            if v is not None and v > 0:
                fresh = {d: v}
        except (ValueError, KeyError) as e:
            c.errors.append(f"{code} 中证 indexValuation 解析失败：{e}")
    pairs = c.accumulate(f"{field}_csival_{code.split('.')[0]}", fresh)
    note = c.notes.get("csi_valuation.json", "")
    note = "" if note == "fresh" else note
    note = (note + "；" if note else "") + "最新单期快照，不能生成长期分位"
    return make_field(pairs, source, "latest", note, "中证 indexValuation 无该指数")


def collect(indices, as_of, offline=False, *, get: Callable = http_get, raw_dir: str = RAW_DIR,
            calendar: set[str] | None = None, out_path: str | None = None, missing_only: bool = False) -> dict:
    """采集 market=A 指数的 pe/pb/dy/roe，以及 OVERSEAS_PLAN 中海外指数仍缺的字段。offline=True 时只读 raw_dir 缓存、不联网、不写缓存。"""
    cal = load_calendar() if calendar is None else calendar
    c = Collector(raw_dir, offline, get, cal, as_of, missing_only)
    series = {}
    for m in indices:
        if m.get("market") != "A" and m["code"] not in OVERSEAS_PLAN:
            continue
        fields, _ = collect_one(m, c)
        series[m["code"]] = {"fields": fields}
    result = {"provider": "domestic",
              "retrievedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
              "asOf": as_of, "offline": bool(offline), "series": series, "errors": c.errors}
    if out_path and not offline:
        atomic_write(out_path, json.dumps(result, ensure_ascii=False, indent=1).encode("utf-8"))
    return result


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="A股指数 PE/PB/股息率 provider")
    ap.add_argument("--offline", action="store_true", help="只读缓存，不联网")
    ap.add_argument("--as-of", default=dt.date.today().isoformat())
    ap.add_argument("--out", default=OUT_PATH)
    ap.add_argument("--missing-only", action="store_true", help="只请求本地尚无 raw 缓存的接口，其余读缓存")
    args = ap.parse_args(argv)
    sys.path.insert(0, ROOT)
    from fetch_data import INDICES  # 只读引用指数清单
    res = collect(INDICES, args.as_of, offline=args.offline, out_path=None, missing_only=args.missing_only)
    if not args.offline or not os.path.exists(args.out):
        atomic_write(args.out, json.dumps(res, ensure_ascii=False, indent=1).encode("utf-8"))
    ok = sum(1 for s in res["series"].values() for f in s["fields"].values() if f["status"] == "ok")
    tot = sum(len(s["fields"]) for s in res["series"].values())
    print(f"domestic: {len(res['series'])} 指数，{ok}/{tot} 字段 ok，errors={len(res['errors'])}", file=sys.stderr)
    for e in res["errors"]:
        print("  ! " + e, file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
