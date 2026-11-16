#!/usr/bin/env python3
"""指数全景：独立真实数据层采集脚本。

产出 data-bundle.js（window.PANO_DATA，schemaVersion 1），前端离线可用。

来源与口径（详见 README.md / reports/data.md）：
  * price/volume：腾讯证券日 K 收盘点位（web.ifzq.gtimg.cn fqkline）；本仓库只读历史缓存
    （../布鲁斯的金融宝藏/replica/data/*.csv）作为早期历史，腾讯补新。A 股指数腾讯成交量单位为
    “手”，×100 换算为“股”；港股/美股成交量口径不明，置 null。
  * pe：中证指数官网 index-perf 接口 peg 字段（官网滚动市盈率）。
  * amt：中证指数官网 tradingValue（亿元）。
  * componentNum：中证 consNumber。
  * dy：中证官方 indicator.xls 的“股息率2（计算用股本）D/P2”，仅近期若干交易日；逐次运行累积。
    indicator 的 PE1/PE2 只存入 data/store，不写入 pe 字段，避免与 peg 长历史跨口径拼接。
  * chg：由同一 price 序列相邻两个观测收盘计算（%）。
  * ROUND2 provider：data/providers/domestic.json（A股 PE/PB/股息率）与 supplemental.json（港美估值、
    市值/换手/盈利/成分股数等）。集成层只读取、校验（ISO升序去重、d/v等长、有限数、单位、来源、频率），
    每个字段整列只选一个来源（不逐日跨源拼接）；amt/volume 已有行情源时保留原列。provider 报告日不按
    价格交易日历过滤（月末报告日可能是周末）。每个字段的 availability 记录来源/频率/候选/失败原因。
  * 无可靠来源的字段一律 null（可在前端 CSV 导入补充）。

模式：默认全量（联网刷新行情/中证 + 读 provider 缓存）；--enrich-only 不重抓行情只用 data/store + provider
缓存；--offline 严格不联网；--collect-providers 才会调用 provider 的在线 collect。

只用标准库即可运行；读取 indicator.xls 需 xlrd（见 requirements.txt，可装到本目录 .venv）。
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import io
import json
import math
import os
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from typing import Callable, Iterable

HERE = os.path.dirname(os.path.abspath(__file__))
STORE = os.path.join(HERE, "data", "store")
BUNDLE = os.path.join(HERE, "data-bundle.js")
MANIFEST = os.path.join(HERE, "data", "manifest.json")
PROVIDER_DIR = os.path.join(HERE, "data", "providers")
BASELINE = os.path.join(HERE, "reports", "round2-baseline.json")
COVERAGE_REPORT = os.path.join(HERE, "reports", "round2-coverage.json")
CACHE_DIR = os.path.normpath(os.path.join(HERE, "..", "布鲁斯的金融宝藏", "replica", "data"))

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
# 主端点为腾讯 proxy.finance.qq.com（AKShare 开源代码记载的公开端点，非认证接口）；旧 web.ifzq 端点作回退
TENCENT_URLS = [
    "https://proxy.finance.qq.com/ifzqgtimg/appstock/app/newfqkline/get?param={sym},day,{start},{end},640,qfq",
    "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={sym},day,{start},{end},640,qfq",
]
CSI_PERF_URL = ("https://www.csindex.com.cn/csindex-home/perf/index-perf?indexCode={code}"
                "&startDate={start}&endDate={end}")
CSI_IND_URL = ("https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/file/autofile/"
               "indicator/{code}indicator.xls")

FIELDS = ["price", "chg", "pe", "pb", "dy", "mcap", "amt", "turn", "eps", "roe", "bps", "volume"]

# ---------------------------------------------------------------------------
# 指数清单
# tsym: 腾讯代码；csi: 中证官网代码（None 表示中证接口不覆盖）；cache: 只读缓存文件名；
# floor: 真实基日/可得首日下限，早于该日的任何行都视为伪行丢弃；market: A/HK/US 决定交易日历与成交量单位。
# ---------------------------------------------------------------------------
INDICES = [
    # 全局坐标
    dict(code="000001.SH", name="上证指数", category="全局坐标", description="上交所全部上市股票综合", tsym="sh000001", csi="000001", cache="index_sh000001_ohlc.csv", floor="1990-12-19", market="A"),
    dict(code="399001.SZ", name="深证成指", category="全局坐标", description="深交所代表性成份股", tsym="sz399001", csi=None, cache=None, floor="1991-04-03", market="A"),
    dict(code="399006.SZ", name="创业板指", category="全局坐标", description="创业板代表性成长股", tsym="sz399006", csi=None, cache="index_sz399006_ohlc.csv", floor="2010-05-31", market="A"),
    dict(code="000688.SH", name="科创50", category="全局坐标", description="科创板市值大、流动性好的50只", tsym="sh000688", csi="000688", cache="index_sh000688_ohlc.csv", floor="2019-12-31", market="A"),
    # 核心宽基
    dict(code="000016.SH", name="上证50", category="核心宽基", description="上证超大盘龙头", tsym="sh000016", csi="000016", cache="index_sh000016_ohlc.csv", floor="2003-12-31", market="A"),
    dict(code="000300.SH", name="沪深300", category="核心宽基", description="大盘核心资产", tsym="sh000300", csi="000300", cache="index_sh000300_ohlc.csv", floor="2004-12-31", market="A"),
    dict(code="000905.SH", name="中证500", category="核心宽基", description="中盘成长", tsym="sh000905", csi="000905", cache="index_sh000905_ohlc.csv", floor="2004-12-31", market="A"),
    dict(code="000852.SH", name="中证1000", category="核心宽基", description="小盘", tsym="sh000852", csi="000852", cache="index_sh000852_ohlc.csv", floor="2004-12-31", market="A"),
    # 宽基谱系
    dict(code="000903.SH", name="中证A100", category="宽基谱系", description="超大盘100（原中证100）", tsym="sh000903", csi="000903", cache="index_sh000903.csv", floor="2004-12-31", market="A"),
    dict(code="000906.SH", name="中证800", category="宽基谱系", description="沪深300+中证500", tsym="sh000906", csi="000906", cache="index_sh000906.csv", floor="2004-12-31", market="A"),
    dict(code="000985.SH", name="中证全指", category="宽基谱系", description="全市场宽基", tsym="sh000985", csi="000985", cache="csindex_000985.csv", floor="2004-12-31", market="A"),
    dict(code="399303.SZ", name="国证2000", category="宽基谱系", description="小微盘（国证）", tsym="sz399303", csi=None, cache=None, floor="2009-12-31", market="A"),
    dict(code="932000.CSI", name="中证2000", category="宽基谱系", description="小微盘（中证）", tsym=None, csi="932000", cache=None, floor="2013-12-31", market="A"),
    # 行业与主题
    dict(code="000922.CSI", name="中证红利", category="行业与主题", description="高股息", tsym="sh000922", csi="000922", cache=None, floor="2004-12-31", market="A"),
    dict(code="000932.SH", name="中证消费", category="行业与主题", description="主要消费", tsym="sh000932", csi="000932", cache=None, floor="2004-12-31", market="A"),
    dict(code="399967.SZ", name="中证军工", category="行业与主题", description="军工主题", tsym="sz399967", csi="399967", cache=None, floor="2004-12-31", market="A"),
    dict(code="399975.SZ", name="证券公司", category="行业与主题", description="券商", tsym="sz399975", csi="399975", cache=None, floor="2007-06-29", market="A"),
    dict(code="399986.SZ", name="中证银行", category="行业与主题", description="银行", tsym="sz399986", csi="399986", cache=None, floor="2004-12-31", market="A"),
    dict(code="399971.SZ", name="中证传媒", category="行业与主题", description="传媒", tsym="sz399971", csi="399971", cache=None, floor="2004-12-31", market="A"),
    dict(code="000827.SH", name="中证环保", category="行业与主题", description="环保产业", tsym="sh000827", csi="000827", cache=None, floor="2004-12-31", market="A"),
    # 行业指数（中证全指一级行业）
    dict(code="000986.SH", name="全指能源", category="行业指数", description="中证全指一级行业·能源", tsym="sh000986", csi="000986", cache="x_sh000986.csv", floor="2004-12-31", market="A"),
    dict(code="000987.SH", name="全指材料", category="行业指数", description="中证全指一级行业·原材料", tsym="sh000987", csi="000987", cache="x_sh000987.csv", floor="2004-12-31", market="A"),
    dict(code="000988.SH", name="全指工业", category="行业指数", description="中证全指一级行业·工业", tsym="sh000988", csi="000988", cache="x_sh000988.csv", floor="2004-12-31", market="A"),
    dict(code="000989.SH", name="全指可选", category="行业指数", description="中证全指一级行业·可选消费", tsym="sh000989", csi="000989", cache="x_sh000989.csv", floor="2004-12-31", market="A"),
    dict(code="000990.SH", name="全指消费", category="行业指数", description="中证全指一级行业·主要消费", tsym="sh000990", csi="000990", cache="x_sh000990.csv", floor="2004-12-31", market="A"),
    dict(code="000991.SH", name="全指医药", category="行业指数", description="中证全指一级行业·医药卫生", tsym="sh000991", csi="000991", cache="x_sh000991.csv", floor="2004-12-31", market="A"),
    dict(code="000992.SH", name="全指金融", category="行业指数", description="中证全指一级行业·金融地产", tsym="sh000992", csi="000992", cache="x_sh000992.csv", floor="2004-12-31", market="A"),
    dict(code="000993.SH", name="全指信息", category="行业指数", description="中证全指一级行业·信息技术", tsym="sh000993", csi="000993", cache="x_sh000993.csv", floor="2004-12-31", market="A"),
    dict(code="000994.SH", name="全指通信", category="行业指数", description="中证全指一级行业·通信服务", tsym="sh000994", csi="000994", cache="x_sh000994.csv", floor="2004-12-31", market="A"),
    dict(code="000995.SH", name="全指公用", category="行业指数", description="中证全指一级行业·公用事业", tsym="sh000995", csi="000995", cache="x_sh000995.csv", floor="2004-12-31", market="A"),
    # ---- 2026-11-16 扩展：27 只行业/主题指数（代码/全称/基日均核对中证官网 index-basic-info，见
    # reports/new-index-expansion.md）。tsym=None 的指数腾讯无日K，点位取中证 index-perf（同中证2000）。
    # 「行业指数」= 中证全指样本空间、按中证行业分类的二/三级行业；其余产业/主题/细分行业归「行业与主题」。
    dict(code="H30184.CSI", name="全指半导体", category="行业指数", description="中证全指半导体产品与设备指数", tsym=None, csi="H30184", cache=None, floor="2004-12-31", market="A"),
    dict(code="H30202.CSI", name="全指软件", category="行业指数", description="中证全指软件指数", tsym=None, csi="H30202", cache=None, floor="2004-12-31", market="A"),
    dict(code="931160.CSI", name="全指通信设备", category="行业指数", description="中证全指通信设备指数（不是000994全指通信服务）", tsym=None, csi="931160", cache=None, floor="2004-12-31", market="A"),
    dict(code="931775.CSI", name="全指房地产", category="行业指数", description="中证全指房地产指数", tsym=None, csi="931775", cache=None, floor="2004-12-31", market="A"),
    dict(code="930697.CSI", name="全指家电", category="行业指数", description="中证全指家用电器指数", tsym=None, csi="930697", cache=None, floor="2004-12-31", market="A"),
    dict(code="H30199.CSI", name="全指电力", category="行业指数", description="中证全指电力公用事业指数", tsym=None, csi="H30199", cache=None, floor="2004-12-31", market="A"),
    dict(code="990001.CSI", name="半导体芯片", category="行业与主题", description="中华交易服务半导体芯片行业指数（中证编制）", tsym=None, csi="990001", cache=None, floor="2011-12-30", market="A"),
    dict(code="930651.CSI", name="中证计算机", category="行业与主题", description="中证计算机主题指数", tsym=None, csi="930651", cache=None, floor="2004-12-31", market="A"),
    dict(code="930713.CSI", name="人工智能", category="行业与主题", description="中证人工智能主题指数", tsym=None, csi="930713", cache=None, floor="2012-06-29", market="A"),
    dict(code="H30590.CSI", name="机器人", category="行业与主题", description="中证机器人指数", tsym=None, csi="H30590", cache=None, floor="2010-12-31", market="A"),
    dict(code="931079.CSI", name="5G通信", category="行业与主题", description="中证5G通信主题指数", tsym=None, csi="931079", cache=None, floor="2015-12-31", market="A"),
    dict(code="931151.CSI", name="光伏产业", category="行业与主题", description="中证光伏产业指数", tsym=None, csi="931151", cache=None, floor="2012-12-31", market="A"),
    dict(code="399976.SZ", name="新能源车", category="行业与主题", description="中证新能源汽车指数（不是国证399417）", tsym="sz399976", csi="399976", cache=None, floor="2011-12-31", market="A"),
    dict(code="931719.CSI", name="电池", category="行业与主题", description="中证电池主题指数", tsym=None, csi="931719", cache=None, floor="2014-12-31", market="A"),
    dict(code="399989.SZ", name="中证医疗", category="行业与主题", description="中证医疗指数", tsym="sz399989", csi="399989", cache=None, floor="2004-12-31", market="A"),
    dict(code="931152.CSI", name="创新药", category="行业与主题", description="中证创新药产业指数", tsym=None, csi="931152", cache=None, floor="2014-12-31", market="A"),
    dict(code="930743.CSI", name="生物科技", category="行业与主题", description="中证生物科技主题指数", tsym=None, csi="930743", cache=None, floor="2011-12-31", market="A"),
    dict(code="399997.SZ", name="中证白酒", category="行业与主题", description="中证白酒指数", tsym="sz399997", csi="399997", cache=None, floor="2008-12-31", market="A"),
    dict(code="930653.CSI", name="食品饮料", category="行业与主题", description="中证食品饮料指数", tsym=None, csi="930653", cache=None, floor="2004-12-31", market="A"),
    dict(code="399998.SZ", name="中证煤炭", category="行业与主题", description="中证煤炭指数", tsym="sz399998", csi="399998", cache=None, floor="2008-12-31", market="A"),
    dict(code="000819.SH", name="有色金属", category="行业与主题", description="中证申万有色金属指数", tsym="sh000819", csi="000819", cache=None, floor="2004-12-31", market="A"),
    dict(code="930606.CSI", name="中证钢铁", category="行业与主题", description="中证钢铁指数", tsym=None, csi="930606", cache=None, floor="2008-12-31", market="A"),
    dict(code="000949.SH", name="中证农业", category="行业与主题", description="中证农业主题指数", tsym="sh000949", csi="000949", cache=None, floor="2004-12-31", market="A"),
    dict(code="399973.SZ", name="中证国防", category="行业与主题", description="中证国防指数", tsym="sz399973", csi="399973", cache=None, floor="2011-06-30", market="A"),
    dict(code="931066.CSI", name="军工龙头", category="行业与主题", description="中证军工龙头指数", tsym=None, csi="931066", cache=None, floor="2012-12-31", market="A"),
    dict(code="H30269.CSI", name="红利低波", category="行业与主题", description="中证红利低波动指数", tsym=None, csi="H30269", cache=None, floor="2005-12-30", market="A"),
    dict(code="399809.SZ", name="保险主题", category="行业与主题", description="中证方正富邦保险主题指数", tsym="sz399809", csi="399809", cache=None, floor="2011-12-31", market="A"),
    # 跨境对照
    dict(code="HSI.HK", name="恒生指数", category="跨境对照", description="港股大盘", tsym="hkHSI", csi=None, cache="x_hsi.csv", floor="1964-07-31", market="HK"),
    dict(code="HSTECH.HK", name="恒生科技", category="跨境对照", description="港股科技龙头", tsym="hkHSTECH", csi=None, cache="x_hstech.csv", floor="2014-12-31", market="HK"),
    dict(code="HSCEI.HK", name="恒生国企", category="跨境对照", description="H股国企", tsym="hkHSCEI", csi=None, cache="x_hscei.csv", floor="1994-07-08", market="HK"),
    dict(code="SPX.US", name="标普500", category="跨境对照", description="美股大盘", tsym="us.INX", csi=None, cache="x_spx.csv", floor="1957-03-04", market="US"),
    dict(code="IXIC.US", name="纳斯达克综指", category="跨境对照", description="美股科技成长", tsym="us.IXIC", csi=None, cache="x_ixic.csv", floor="1971-02-05", market="US"),
    dict(code="DJI.US", name="道琼斯工业", category="跨境对照", description="美股蓝筹30", tsym="us.DJI", csi=None, cache="x_dji.csv", floor="1896-05-26", market="US"),
]

# ---------------------------------------------------------------------------
# 工具
# ---------------------------------------------------------------------------

class FetchError(Exception):
    pass


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def http_get(url: str, timeout: float = 20.0, retries: int = 2, backoff: float = 1.5) -> bytes:
    """带超时与有限重试的 GET；失败抛 FetchError（不吞掉，交由调用方保留旧数据）。"""
    last = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://gu.qq.com/"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                if resp.status != 200:
                    raise FetchError(f"HTTP {resp.status}")
                return resp.read()
        except (urllib.error.URLError, OSError, FetchError, ValueError) as e:  # 含超时/SSL/HTTPError
            last = e
            if attempt < retries:
                time.sleep(backoff * (attempt + 1))
    raise FetchError(f"{url} -> {type(last).__name__}: {last}")


class HostBreaker:
    """同一主机连续失败 threshold 次后快速失败，避免对已拒绝/限流的来源反复冲击。"""

    def __init__(self, get: Callable, threshold: int = 4):
        import threading
        self.get, self.threshold, self.fails, self.lock = get, threshold, {}, threading.Lock()

    def __call__(self, url: str, **kw) -> bytes:
        host = urllib.parse.urlsplit(url).netloc
        with self.lock:
            if self.fails.get(host, 0) >= self.threshold:
                raise FetchError(f"{host} 连续失败{self.threshold}次，本轮跳过")
        try:
            out = self.get(url, **kw)
        except FetchError:
            with self.lock:
                self.fails[host] = self.fails.get(host, 0) + 1
            raise
        with self.lock:
            self.fails[host] = 0
        return out


def to_float(v) -> float | None:
    """把来源值转为有限 float；空串/None/'-'/NaN/inf 一律 None（绝不把空当 0）。"""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        f = float(v)
    else:
        s = str(v).strip().replace(",", "")
        if s in ("", "-", "--", "None", "null", "nan", "NaN"):
            return None
        try:
            f = float(s)
        except ValueError:
            return None
    return f if math.isfinite(f) else None


def norm_date(s) -> str | None:
    """'20261111' / '2026-11-11' / '2026/11/11' / datetime -> 'YYYY-MM-DD'；非法返回 None。"""
    if s is None:
        return None
    if isinstance(s, (dt.date, dt.datetime)):
        return s.strftime("%Y-%m-%d")
    t = str(s).strip().replace("/", "-")
    if len(t) == 8 and t.isdigit():
        t = f"{t[:4]}-{t[4:6]}-{t[6:]}"
    t = t[:10]
    try:
        return dt.date.fromisoformat(t).isoformat()
    except ValueError:
        return None


def merge_rows(old: Iterable[dict], new: Iterable[dict]) -> list[dict]:
    """按 date 去重合并（new 覆盖 old 中同日行的非空字段），并按日期升序。"""
    out: dict[str, dict] = {}
    for r in list(old) + list(new):
        d = norm_date(r.get("date"))
        if not d:
            continue
        cur = out.setdefault(d, {"date": d})
        for k, v in r.items():
            if k == "date":
                continue
            if v is None or v == "":
                cur.setdefault(k, None)
            else:
                cur[k] = v
    return [out[d] for d in sorted(out)]


def atomic_write(path: str, text: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".tmp_", suffix=os.path.basename(path))
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.chmod(tmp, 0o644)  # mkstemp 默认 0600，静态服务/他人读取需 0644
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def read_csv_rows(path: str) -> list[dict]:
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def write_store(path: str, rows: list[dict], cols: list[str]) -> None:
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["date"] + cols)
    for r in rows:
        w.writerow([r["date"]] + ["" if r.get(c) is None else r.get(c) for c in cols])
    atomic_write(path, buf.getvalue())


def load_store(path: str, cols: list[str], numeric: set[str]) -> list[dict]:
    out = []
    for r in read_csv_rows(path):
        d = norm_date(r.get("date"))
        if not d:
            continue
        row = {"date": d}
        for c in cols:
            v = r.get(c)
            row[c] = to_float(v) if c in numeric else (v or None)
        out.append(row)
    return merge_rows([], out)

# ---------------------------------------------------------------------------
# 腾讯证券
# ---------------------------------------------------------------------------

def volume_factor(market: str) -> float | None:
    """腾讯指数 K 线成交量：A 股为“手”→×100 得“股”；港/美口径不明 -> None（不输出）。"""
    return 100.0 if market == "A" else None


def parse_tencent(payload: bytes | str, sym: str, market: str) -> list[dict]:
    """解析 fqkline 返回；空数据返回 []；结构异常抛 FetchError。"""
    try:
        obj = json.loads(payload)
    except (ValueError, TypeError) as e:
        raise FetchError(f"tencent {sym}: 非 JSON ({e})")
    if not isinstance(obj, dict):
        raise FetchError(f"tencent {sym}: 结构异常 {str(obj)[:120]}")
    if obj.get("code") not in (0, "0", None):
        raise FetchError(f"tencent {sym}: code={obj.get('code')} msg={obj.get('msg')}")
    data = obj.get("data")
    if not isinstance(data, dict):
        return []
    node = data.get(sym)
    if not isinstance(node, dict):
        return []
    kl = node.get("day") or node.get("qfqday") or []
    fac = volume_factor(market)
    rows = []
    for k in kl:
        if not isinstance(k, (list, tuple)) or len(k) < 3:
            continue
        d = norm_date(k[0])
        close = to_float(k[2])
        if not d or close is None or close <= 0:
            continue
        vol = to_float(k[5]) if len(k) > 5 else None
        # 早期深市指数腾讯成交量为占位值 100 手，视为缺失
        if fac is None or vol is None or vol <= 100:
            vol_sh = None
        else:
            vol_sh = round(vol * fac)
        # newfqkline 第 9 列为成交额（万元）→ /1e4 得亿元；仅 A 股采用，港美口径不明
        amt = to_float(k[8]) if len(k) > 8 and market == "A" else None
        amt_yi = round(amt / 1e4, 2) if amt is not None and amt > 0 else None
        rows.append({"date": d, "close": close, "volume": vol_sh, "amt": amt_yi, "src": "tencent"})
    return merge_rows([], rows)


def tencent_get(get: Callable, sym: str, start: str, end: str) -> bytes:
    """依次尝试主/回退端点；返回首个可解析为 JSON 的响应，全部失败抛 FetchError。"""
    errs = []
    for tpl in TENCENT_URLS:
        try:
            body = get(tpl.format(sym=sym, start=start, end=end))
            json.loads(body)
            return body
        except (FetchError, ValueError) as e:
            errs.append(str(e)[:160])
    raise FetchError(" | ".join(errs))


def fetch_tencent(sym: str, market: str, since: str, until: str, get: Callable = http_get,
                  max_pages: int = 30) -> list[dict]:
    """腾讯单次最多 640 根且返回区间内最近 640 根，故从 until 向前翻页直到 since 或无新数据。"""
    rows: list[dict] = []
    end = until
    for _ in range(max_pages):
        page = parse_tencent(tencent_get(get, sym, since, end), sym, market)
        if not page:
            break
        rows = merge_rows(page, rows)
        first = page[0]["date"]
        if first <= since or len(page) < 600:
            break
        nxt = (dt.date.fromisoformat(first) - dt.timedelta(days=1)).isoformat()
        if nxt >= end:
            break
        end = nxt
    return rows

# ---------------------------------------------------------------------------
# 中证指数官网
# ---------------------------------------------------------------------------

def parse_csi_perf(payload: bytes | str, code: str) -> list[dict]:
    """解析 index-perf；tradingValue 已是亿元，peg 为官网滚动市盈率。"""
    try:
        obj = json.loads(payload)
    except (ValueError, TypeError) as e:
        raise FetchError(f"csi {code}: 非 JSON ({e})")
    if not isinstance(obj, dict):
        raise FetchError(f"csi {code}: 结构异常")
    # 任一成立即视为服务错误：显式非成功 code，或 success 为 false。未给 code 时保持兼容。
    has_code = "code" in obj and obj.get("code") is not None
    if (has_code and str(obj.get("code")) not in ("200", "0")) or obj.get("success") is False:
        raise FetchError(f"csi {code}: code={obj.get('code')} success={obj.get('success')} msg={obj.get('msg')}")
    data = obj.get("data") or []
    if not isinstance(data, list):
        raise FetchError(f"csi {code}: data 非列表")
    rows = []
    for r in data:
        d = norm_date(r.get("tradeDate"))
        if not d:
            continue
        close = to_float(r.get("close"))
        if close is not None and close <= 0:
            # 官网偶见收盘 0.0 的无效行（2026-11-16 实测 H30184/H30199/H30202 的 2013-06-28），整行不可信，丢弃
            continue
        rows.append({
            "date": d,
            "close": close,
            "amt": to_float(r.get("tradingValue")),       # 亿元
            "pe": to_float(r.get("peg")),                 # 官网滚动市盈率（倍）
            "cons": to_float(r.get("consNumber")),
        })
    return rows


def clean_csi_rows(rows: list[dict], request_start: str, floor: str,
                   calendar: set[str] | None, calendar_end: str | None) -> tuple[list[dict], list[str]]:
    """清理中证接口在请求起始日插入的伪行。

    规则（全部满足才保留）：
      1. 日期 > request_start（接口会把首条真实数据复制到起始日；调用方保证起始日已被上一窗口覆盖或早于基日）；
      2. 日期 >= floor（真实基日/可得首日）；
      3. 若有可靠交易日历：日期在日历中；超出日历末日的行仅保留工作日。
    返回 (保留行, 丢弃原因列表)。
    """
    kept, dropped = [], []
    for r in rows:
        d = r["date"]
        if d <= request_start:
            dropped.append(f"{d}:请求起始日伪行")
            continue
        if d < floor:
            dropped.append(f"{d}:早于基日{floor}")
            continue
        if calendar:
            if calendar_end and d > calendar_end:
                if dt.date.fromisoformat(d).weekday() >= 5:
                    dropped.append(f"{d}:非交易日")
                    continue
            elif d not in calendar:
                dropped.append(f"{d}:不在交易日历")
                continue
        kept.append(r)
    return merge_rows([], kept), dropped


def filter_calendar(rows: list[dict], calendar: set[str], calendar_end: str | None) -> tuple[list[dict], list[str]]:
    """按可靠交易日历过滤；日历末日之后的行仅保留工作日（日历源可能比本源更新慢）。"""
    kept, bad = [], []
    for r in rows:
        d = r["date"]
        ok = (dt.date.fromisoformat(d).weekday() < 5) if (calendar_end and d > calendar_end) else (d in calendar)
        (kept if ok else bad).append(r if ok else d)
    return kept, bad


def csi_windows(start: str, end: str, years: int = 8) -> list[tuple[str, str]]:
    """生成首尾相接（重叠 1 天）的窗口，每窗起始日的行会被当伪行丢弃，但已被上一窗口覆盖。"""
    out = []
    s = dt.date.fromisoformat(start)
    e_all = dt.date.fromisoformat(end)
    while s < e_all:
        e = min(dt.date(s.year + years, s.month, min(s.day, 28)), e_all)
        out.append((s.isoformat(), e.isoformat()))
        s = e
    return out


def fetch_csi_perf(code: str, start: str, end: str, floor: str, calendar, calendar_end,
                   get: Callable = http_get) -> tuple[list[dict], int]:
    rows: list[dict] = []
    dropped = 0
    for s, e in csi_windows(start, end):
        url = CSI_PERF_URL.format(code=code, start=s.replace("-", ""), end=e.replace("-", ""))
        page = parse_csi_perf(get(url, timeout=30), code)
        kept, drop = clean_csi_rows(page, s, floor, calendar, calendar_end)
        dropped += len(drop)
        rows = merge_rows(rows, kept)
        time.sleep(0.3)
    return rows, dropped


def parse_indicator_xls(content: bytes) -> list[dict]:
    """解析中证 indicator.xls：按表头关键词识别 PE1/PE2/D/P1/D/P2，返回日期行。"""
    try:
        import xlrd  # noqa: WPS433
    except ImportError as e:
        raise FetchError("缺少 xlrd，无法读取 indicator.xls（pip install -r requirements.txt）") from e
    book = xlrd.open_workbook(file_contents=content)
    sh = book.sheet_by_index(0)
    if sh.nrows < 2:
        return []
    head = [str(h).replace(" ", "") for h in sh.row_values(0)]

    def find(*keys):
        for i, h in enumerate(head):
            if any(k in h for k in keys):
                return i
        return None

    ci = {"date": find("日期", "Date"), "pe1": find("P/E1", "市盈率1"), "pe2": find("P/E2", "市盈率2"),
          "dy1": find("D/P1", "股息率1"), "dy2": find("D/P2", "股息率2")}
    if ci["date"] is None:
        raise FetchError(f"indicator 表头无日期列: {head}")
    rows = []
    for i in range(1, sh.nrows):
        v = sh.row_values(i)
        raw = v[ci["date"]]
        if isinstance(raw, float):
            try:
                d = xlrd.xldate.xldate_as_datetime(raw, book.datemode).date().isoformat()
            except Exception:  # 部分文件把 20261111 存成数字
                d = norm_date(str(int(raw)))
        else:
            d = norm_date(raw)
        if not d:
            continue
        rows.append({"date": d, **{k: (to_float(v[j]) if j is not None else None)
                                     for k, j in ci.items() if k != "date"}})
    return merge_rows([], rows)

# ---------------------------------------------------------------------------
# 缓存
# ---------------------------------------------------------------------------

def load_cache_prices(fname: str | None, market: str) -> list[dict]:
    """读取只读缓存。支持 date,close[,volume] 与中证导出（日期/收盘/成交量）。缓存 volume 已是股。"""
    if not fname:
        return []
    path = os.path.join(CACHE_DIR, fname)
    rows = []
    for r in read_csv_rows(path):
        d = norm_date(r.get("date") or r.get("日期"))
        c = to_float(r.get("close") if "close" in r else r.get("收盘"))
        if not d or c is None or c <= 0:
            continue
        vol = None
        if market == "A" and "volume" in r:
            vol = to_float(r.get("volume"))
            if vol is not None and vol <= 0:
                vol = None
        rows.append({"date": d, "close": c, "volume": vol, "src": "cache"})
    return merge_rows([], rows)

# ---------------------------------------------------------------------------
# Provider 缓存（ROUND2：providers/<name>.py 的 collect 输出 = data/providers/<name>.json）
# 集成层只读取、校验、整列选源，不改写 provider 缓存。
# ---------------------------------------------------------------------------

# original_eps：原站李神奇数据网 eps（只提供 eps 一个字段，页面只读抓取后离线解析，见 providers/original_eps.py）
PROVIDER_NAMES = ("domestic", "supplemental", "original_eps")
# provider 可提供的字段；price/chg 只来自行情源
PROVIDER_FIELDS = ("pe", "pb", "dy", "mcap", "amt", "turn", "eps", "roe", "bps", "volume")
# 合法单位（CONTRACT 固定口径）；eps/bps 保留来源原定义，只要求注明且不能是“点”
FIELD_UNITS = {
    "pe": ("倍",), "pb": ("倍",),
    "dy": ("%", "百分数", "百分比"), "turn": ("%", "百分数", "百分比"), "roe": ("%", "百分数", "百分比"),
    "mcap": ("亿元",), "amt": ("亿元",), "volume": ("股",),
}
# 价格类字段：已有行情源可用时整列保留，provider 只在该列完全为空时补
KEEP_BASE_FIELDS = ("amt", "volume")
FREQ_ALIASES = {
    "daily": "daily", "day": "daily", "日": "daily", "日频": "daily", "trading_day": "daily",
    "weekly": "weekly", "week": "weekly", "周": "weekly", "周频": "weekly",
    "monthly": "monthly", "month": "monthly", "月": "monthly", "月频": "monthly", "month_end": "monthly",
    "quarterly": "quarterly", "quarter": "quarterly", "季": "quarterly", "季频": "quarterly",
    "annual": "annual", "yearly": "annual", "年": "annual", "年频": "annual",
    "single": "single", "snapshot": "single", "latest": "single", "单期": "single",
    "irregular": "irregular", "不定期": "irregular",
}
FREQ_CN = {"daily": "日频", "weekly": "周频", "monthly": "月频", "quarterly": "季频",
           "annual": "年频", "single": "单期", "irregular": "不定期"}
PROVIDER_OK_STATUS = ("ok", "partial", "stale")


def unit_ok(field: str, unit) -> bool:
    u = str(unit or "").strip().replace(" ", "")
    if not u:
        return False
    if field in ("eps", "bps"):
        return "点" not in u  # 指数盈利点位不能冒充每股字段
    for tok in FIELD_UNITS.get(field, ()):
        if u == tok or u.startswith(tok + "（") or u.startswith(tok + "("):
            return True
    return False


def _unavailable(reason: str, source=None, status: str = "unavailable") -> dict:
    return {"d": [], "v": [], "status": status, "reason": reason, "source": source or {}, "frequency": None}


def normalize_provider_field(field: str, raw) -> dict:
    """校验 provider 单字段。返回规范 dict：status=ok（含 d/v）或 unavailable/rejected（含原因）。

    不修补来源错误：日期非升序/重复、d/v 不等长、非有限数、单位不符、缺来源，都整列拒收并写明原因。
    """
    if not isinstance(raw, dict):
        return _unavailable("字段结构不是对象", status="rejected")
    src = raw.get("source") if isinstance(raw.get("source"), dict) else {}
    status = str(raw.get("status") or "").strip().lower()
    reason = str(raw.get("reason") or "").strip()
    d, v = raw.get("d"), raw.get("v")
    if d is None and v is None:
        d, v = [], []
    if not isinstance(d, list) or not isinstance(v, list):
        return _unavailable("d/v 不是数组", src, "rejected")
    if len(d) != len(v):
        return _unavailable(f"d/v 不等长({len(d)}/{len(v)})", src, "rejected")
    if status and status not in PROVIDER_OK_STATUS:
        if any(x is not None for x in v):
            return _unavailable(f"status={status} 却带数据，状态与数据不一致", src, "rejected")
        return _unavailable(reason or f"provider 标记 {status}，未给原因", src)
    dates, vals = [], []
    for raw_d, raw_v in zip(d, v):
        if not isinstance(raw_d, str) or len(raw_d) != 10 or norm_date(raw_d) != raw_d:
            return _unavailable(f"非 ISO 日期 {raw_d!r}", src, "rejected")
        if raw_v is None:
            continue  # 空就是缺失，不当 0
        if isinstance(raw_v, bool) or not isinstance(raw_v, (int, float)) or not math.isfinite(raw_v):
            return _unavailable(f"{raw_d} 值 {raw_v!r} 不是有限数", src, "rejected")
        dates.append(raw_d)
        vals.append(float(raw_v))
    if any(b <= a for a, b in zip(d, d[1:])):
        return _unavailable("日期未按升序去重", src, "rejected")
    if not vals:
        return _unavailable(reason or "provider 未给出有效观测", src)
    if not status:
        return _unavailable("有数据但缺 status", src, "rejected")
    if not unit_ok(field, src.get("unit")):
        want = "/".join(FIELD_UNITS.get(field, ("来源原定义（非指数点）",)))
        return _unavailable(f"单位 {src.get('unit')!r} 与契约 {want} 不符，未换算接入", src, "rejected")
    if not str(src.get("label") or "").strip() or not str(src.get("url") or "").strip():
        return _unavailable("缺来源 label/url", src, "rejected")
    if not str(src.get("method") or "").strip():
        return _unavailable("缺口径 method", src, "rejected")
    freq = FREQ_ALIASES.get(str(raw.get("frequency") or "").strip().lower())
    if not freq:
        return _unavailable(f"未知频率 {raw.get('frequency')!r}", src, "rejected")
    return {"d": dates, "v": vals, "status": "ok", "providerStatus": status, "reason": reason,
            "source": dict(src), "frequency": freq}


def normalize_component(raw) -> tuple[dict | None, str]:
    """componentNum 只接受有真实日期和来源的正整数披露。"""
    if raw is None:
        return None, "未提供"
    if not isinstance(raw, dict):
        return None, "结构不是对象"
    val, date = raw.get("value"), raw.get("date")
    src = raw.get("source") if isinstance(raw.get("source"), dict) else {}
    if val is None:
        return None, str(raw.get("reason") or "value 为空")
    if isinstance(val, bool) or not isinstance(val, (int, float)) or not math.isfinite(val) \
            or val <= 0 or float(val) != int(val):
        return None, f"value {val!r} 不是正整数"
    if not isinstance(date, str) or norm_date(date) != date:
        return None, f"缺真实日期或非 ISO：{date!r}"
    if not str(src.get("label") or "").strip() or not str(src.get("url") or "").strip():
        return None, "缺来源 label/url"
    return {"value": int(val), "date": date, "source": dict(src)}, ""


def normalize_provider_payload(name: str, payload, known_codes: set[str]) -> dict:
    """整份 provider 输出 -> {status, retrievedAt, errors, series:{code:{fields:{f:norm}, componentNum, componentReason}},
    rejected:[...], unknownCodes:[...]}。"""
    out = {"provider": name, "status": "ok", "retrievedAt": None, "errors": [], "series": {},
           "rejected": [], "unknownCodes": []}
    if not isinstance(payload, dict):
        out.update(status="invalid", errors=["顶层不是对象"])
        return out
    if payload.get("provider") not in (None, name):
        out.update(status="invalid", errors=[f"provider 字段为 {payload.get('provider')!r}，与 {name} 不符"])
        return out
    out["retrievedAt"] = payload.get("retrievedAt")
    errs = payload.get("errors") or []
    out["errors"] = [e if isinstance(e, str) else json.dumps(e, ensure_ascii=False) for e in errs] \
        if isinstance(errs, list) else [str(errs)]
    series = payload.get("series")
    if not isinstance(series, dict):
        out.update(status="invalid", errors=out["errors"] + ["series 不是对象"])
        return out
    for code, node in series.items():
        if code not in known_codes:
            out["unknownCodes"].append(code)
            continue
        if not isinstance(node, dict):
            out["rejected"].append(f"{code}: 节点不是对象")
            continue
        fields = {}
        raw_fields = node.get("fields")
        if raw_fields is None:
            raw_fields = {}
        if not isinstance(raw_fields, dict):
            out["rejected"].append(f"{code}.fields: 不是对象（{type(raw_fields).__name__}），整组字段拒收")
            raw_fields = {}
        for f, raw in raw_fields.items():
            if f not in PROVIDER_FIELDS:
                out["rejected"].append(f"{code}.{f}: 不是 provider 可提供字段，忽略")
                continue
            norm = normalize_provider_field(f, raw)
            if norm["status"] == "rejected":
                out["rejected"].append(f"{code}.{f}: {norm['reason']}")
            fields[f] = norm
        comp, creason = normalize_component(node.get("componentNum"))
        out["series"][code] = {"fields": fields, "componentNum": comp, "componentReason": creason}
    return out


def provider_path(name: str) -> str:
    return os.path.join(PROVIDER_DIR, f"{name}.json")


def load_provider_cache(name: str, known_codes: set[str]) -> dict:
    """只读 data/providers/<name>.json；缺失/损坏返回空态（status 说明），不联网、不写文件。"""
    path = provider_path(name)
    if not os.path.exists(path):
        return {"provider": name, "status": "missing", "retrievedAt": None, "series": {}, "rejected": [],
                "unknownCodes": [], "errors": [f"缓存不存在：{os.path.relpath(path, HERE)}"]}
    try:
        with open(path, encoding="utf-8") as f:
            payload = json.load(f)
    except (OSError, ValueError) as e:
        return {"provider": name, "status": "invalid", "retrievedAt": None, "series": {}, "rejected": [],
                "unknownCodes": [], "errors": [f"缓存无法解析：{type(e).__name__}: {e}"]}
    out = normalize_provider_payload(name, payload, known_codes)
    out["path"] = os.path.relpath(path, HERE)
    return out


def collect_provider(name: str, indices: list[dict], as_of: str, known_codes: set[str]) -> dict:
    """显式 --collect-providers 时调用 providers.<name>.collect(offline=False)；失败回退读缓存。"""
    try:
        import importlib
        if HERE not in sys.path:
            sys.path.insert(0, HERE)
        mod = importlib.import_module(f"providers.{name}")
        payload = mod.collect(indices, as_of, offline=False)
    except Exception as e:  # provider 自身任何异常都不应毁掉整体重建
        out = load_provider_cache(name, known_codes)
        out["errors"] = [f"在线 collect 失败，改读缓存：{type(e).__name__}: {e}"] + out["errors"]
        return out
    out = normalize_provider_payload(name, payload, known_codes)
    out["path"] = "collect()"
    return out

# ---------------------------------------------------------------------------
# 组装
# ---------------------------------------------------------------------------

def compute_chg(prices: list[float | None]) -> list[float | None]:
    out: list[float | None] = []
    prev = None
    for p in prices:
        if p is None:
            out.append(None)
            continue
        out.append(round((p / prev - 1) * 100, 2) if prev else None)
        prev = p
    return out


def coverage(dates: list[str], vals: list) -> dict:
    idx = [i for i, v in enumerate(vals) if v is not None]
    if not idx:
        return {"count": 0, "first": None, "last": None}
    return {"count": len(idx), "first": dates[idx[0]], "last": dates[idx[-1]]}


STALE_DAYS = 400  # 某列最新观测早于 asOf 超过此天数视为“陈旧”，选源时排在仍在更新的列之后


def _cand(provider: str, order: int, base: bool, dv: dict, source: dict, frequency, reason: str = "",
          status: str = "ok", raw_count: int | None = None) -> dict:
    ds = sorted(dv)
    return {"provider": provider, "order": order, "base": base, "map": dv, "source": source,
            "frequency": frequency, "reason": reason, "status": status if ds else ("unavailable" if status == "ok" else status),
            "count": len(ds), "first": ds[0] if ds else None, "last": ds[-1] if ds else None,
            "rawCount": len(dv) if raw_count is None else raw_count}


def select_column(field: str, cands: list[dict], until: str | None) -> dict | None:
    """整列选一个来源，不逐日拼接。

    amt/volume：已有行情源（腾讯/中证）只要有数据就整列保留；其余字段及行情源为空时：
    仍在更新（最新观测距 asOf ≤ STALE_DAYS）优先，再按样本数、最新日期、固定次序（现有源→domestic→supplemental）。
    """
    live = [c for c in cands if c["count"] > 0]
    if not live:
        return None
    if field in KEEP_BASE_FIELDS:
        base = [c for c in live if c["base"]]
        if base:
            return base[0]
    lim = (dt.date.fromisoformat(until) - dt.timedelta(days=STALE_DAYS)).isoformat() if until else None

    def key(c):
        stale = 1 if (lim and c["last"] < lim) else 0
        return (stale, -c["count"], -dt.date.fromisoformat(c["last"]).toordinal(), c["order"])
    return sorted(live, key=key)[0]


def _cand_summary(c: dict, chosen: dict | None) -> dict:
    out = {"provider": c["provider"], "status": c["status"], "count": c["count"], "first": c["first"],
           "last": c["last"], "frequency": c["frequency"], "selected": chosen is c}
    if c.get("rawCount") != c["count"]:
        out["rawCount"] = c["rawCount"]
    if c["reason"]:
        out["reason"] = c["reason"]
    elif chosen is not None and chosen is not c and c["count"]:
        out["reason"] = f"未选：整列选用 {chosen['provider']}，不跨源逐日拼接"
    return out


def build_series(meta: dict, price_rows: list[dict], csi_rows: list[dict], ind_rows: list[dict],
                 since: str, extra_warn: list[str], providers: list[dict] | None = None,
                 until: str | None = None) -> dict:
    """把各来源按真实日期对齐到并集日期轴；未知一律 None；12 字段与 d 等长。

    providers 为 normalize_provider_payload 输出列表（顺序即同分时的优先次序）。provider 日期不按价格交易日历过滤
    （月末报告日可能是周末），只裁掉 floor/since 之前与 until 之后的观测。
    """
    floor = max(meta["floor"], since)
    pmap = {r["date"]: r for r in price_rows if r["date"] >= floor}
    # 收盘 ≤0 的中证行是无效记录（见 parse_csi_perf），连同其成交额/PE 一并忽略
    cmap = {r["date"]: r for r in csi_rows if r["date"] >= floor and not (r.get("close") is not None and r["close"] <= 0)}
    imap = {r["date"]: r for r in ind_rows if r["date"] >= floor}
    code = meta["code"]
    warnings = list(extra_warn)

    # ---- 现有来源（行情 store / 中证 store）----
    srcs = sorted({r.get("src") for r in pmap.values()})
    cache_end = max((x for x, r in pmap.items() if r.get("src") == "cache"), default=None)
    if meta.get("tsym"):
        price_src = {"label": "腾讯证券", "url": tencent_page(meta["tsym"]), "unit": "点", "method": "日K收盘点位（指数不复权）"}
        if "cache" in srcs:
            price_src["label"] = "本地历史缓存 + 腾讯证券"
            price_src["method"] = (f"{cache_end}及以前取本仓库只读缓存 replica/data/{meta['cache']}"
                                   f"（缓存原上游未标注、未验证），此后腾讯日K收盘补新（指数不复权）")
    elif "csi" in srcs:
        price_src = {"label": "中证指数", "url": "https://www.csindex.com.cn/", "unit": "点", "method": "官网收盘点位"}
    else:
        price_src = {"label": "无", "url": "", "unit": "点", "method": "无可用价格来源"}
    sources = {"price": price_src}
    # 成交额单一来源：有腾讯成交额则全序列用腾讯（日度完整、含最新日），否则用中证 tradingValue；不逐日混拼
    amt_from = "tencent" if any(r.get("amt") is not None for r in pmap.values()) else "csi"
    base_src = {}
    if meta.get("csi"):
        base_src["pe"] = {"label": "中证指数", "url": csi_page(meta["csi"]), "unit": "倍", "method": "官网 index-perf 的 peg（滚动市盈率）"}
        base_src["dy"] = {"label": "中证指数", "url": CSI_IND_URL.format(code=meta["csi"]), "unit": "%", "method": "官方 indicator.xls 股息率2（计算用股本）D/P2，仅近期观测，逐次累积"}
    if amt_from == "tencent":
        base_src["amt"] = {"label": "腾讯证券", "url": tencent_page(meta["tsym"]), "unit": "亿元", "method": "newfqkline 成交额(万元)÷1e4；缓存期日期亦取腾讯成交额"}
    elif meta.get("csi"):
        base_src["amt"] = {"label": "中证指数", "url": csi_page(meta["csi"]), "unit": "亿元", "method": "官网 index-perf 的 tradingValue"}
    if meta["market"] == "A" and meta.get("tsym"):
        base_src["volume"] = {"label": "腾讯证券", "url": tencent_page(meta["tsym"]), "unit": "股", "method": "腾讯成交量(手)×100；缓存期为缓存原值(股)"}
    base_maps = {
        "pe": ("csi", {x: r["pe"] for x, r in cmap.items() if r.get("pe") is not None}),
        "dy": ("csi_indicator", {x: r["dy2"] for x, r in imap.items() if r.get("dy2") is not None}),
        "amt": (amt_from, {x: r["amt"] for x, r in (pmap if amt_from == "tencent" else cmap).items()
                           if r.get("amt") is not None}),
        "volume": ("tencent", {x: int(r["volume"]) for x, r in pmap.items() if r.get("volume") is not None}),
    }

    # ---- 逐字段候选与整列选源 ----
    selected: dict[str, dict | None] = {}
    availability: dict[str, dict] = {}
    for f in PROVIDER_FIELDS:
        cands = []
        if f in base_maps:
            name, dv = base_maps[f]
            src = base_src.get(f, {})
            reason = "" if dv else ("中证来源不可达或未覆盖" if (src and name.startswith("csi")) else "现有行情/中证来源无此字段")
            if src or dv:
                cands.append(_cand(name, 0, True, dv, src, "daily", reason))
        for order, p in enumerate(providers or [], start=1):
            pname = p.get("provider", f"provider{order}")
            if p.get("status") not in ("ok",):
                continue
            node = (p.get("series") or {}).get(code)
            norm = (node or {}).get("fields", {}).get(f) if node else None
            if norm is None:
                continue
            if norm["status"] != "ok":
                cands.append(_cand(pname, order, False, {}, norm.get("source") or {}, norm.get("frequency"),
                                   norm.get("reason") or "unavailable", norm["status"]))
                continue
            dv = {x: y for x, y in zip(norm["d"], norm["v"]) if x >= floor and (until is None or x <= until)}
            reason = ""
            if len(dv) != len(norm["d"]):
                reason = f"裁掉 {len(norm['d']) - len(dv)} 个早于 {floor} 或晚于 {until} 的观测"
            if f == "volume":
                dv = {x: int(round(y)) for x, y in dv.items()}
            c = _cand(pname, order, False, dv, norm["source"], norm["frequency"], reason, raw_count=len(norm["d"]))
            if not dv:
                c["reason"] = reason or "无有效观测"
            cands.append(c)
        chosen = select_column(f, cands, until)
        selected[f] = chosen
        if chosen is not None:
            sources[f] = dict(chosen["source"], frequency=chosen["frequency"], provider=chosen["provider"])
        elif f in base_src:
            sources[f] = dict(base_src[f])  # 保留“应有来源”说明；数组为空
        reasons = [f"{c['provider']}: {c['reason']}" for c in cands if c["count"] == 0 and c["reason"]]
        availability[f] = {
            "status": "ok" if chosen else "unavailable",
            "provider": chosen["provider"] if chosen else None,
            "frequency": chosen["frequency"] if chosen else None,
            "unit": (chosen["source"].get("unit") if chosen else None),
            "reason": "" if chosen else ("；".join(reasons) or "无任何已接入来源"),
            "candidates": [_cand_summary(c, chosen) for c in cands],
        }

    # ---- 日期轴：价格/中证日 ∪ 选中列的真实观测日 ----
    axis = set(pmap) | set(cmap) | set(imap)
    for c in selected.values():
        if c is not None:
            axis |= set(c["map"])
    d = sorted(axis)
    n = len(d)
    s = {f: [None] * n for f in FIELDS}
    for i, day in enumerate(d):
        p = pmap.get(day)
        if p:
            s["price"][i] = round(p["close"], 3)
        for f, c in selected.items():
            if c is not None and day in c["map"]:
                s[f][i] = c["map"][day]
    s["chg"] = compute_chg(s["price"])
    sources["chg"] = {"label": "派生", "url": "", "unit": "%", "method": "同一 price 序列相邻观测收盘涨跌"}
    cov = {f: coverage(d, s[f]) for f in FIELDS}
    for f in ("price", "chg"):
        availability[f] = {"status": "ok" if cov[f]["count"] else "unavailable",
                           "provider": ("derived" if f == "chg" else ("+".join(x for x in srcs if x) or None)),
                           "frequency": "daily", "unit": sources[f].get("unit"),
                           "reason": "" if cov[f]["count"] else "无可用价格", "candidates": []}
    for f in FIELDS:
        availability[f].update(cov[f])

    # ---- 一致性抽检与提示 ----
    diffs = [abs(cmap[x]["close"] / pmap[x]["close"] - 1) for x in cmap
             if x in pmap and cmap[x].get("close")]
    if diffs and max(diffs) > 0.005:
        warnings.append(f"中证收盘与价格源存在>0.5%差异（最大{max(diffs) * 100:.2f}%，{len(diffs)}个共同日）")
    adiff = [abs(cmap[x]["amt"] / pmap[x]["amt"] - 1) for x in cmap
             if x in pmap and cmap[x].get("amt") and pmap[x].get("amt")]
    if adiff and max(adiff) > 0.02:
        warnings.append(f"中证与腾讯成交额存在>2%差异（最大{max(adiff) * 100:.1f}%，{len(adiff)}个共同日）")
    for f in ("pe", "pb", "dy"):
        if cov[f]["count"] == 0 and (meta.get("csi") or any(c["provider"] != "csi" for c in availability[f]["candidates"])):
            warnings.append(f"{f} 暂无数据：{availability[f]['reason']}")
    if cov["price"]["last"] and cov["pe"]["last"] and cov["pe"]["last"] < cov["price"]["last"]:
        warnings.append(f"PE 最新 {cov['pe']['last']}，点位最新 {cov['price']['last']}："
                        f"估值来源（{sources['pe'].get('label')}）日期不同，不视为同日")
    for f in PROVIDER_FIELDS:
        c = selected[f]
        if c is None:
            continue
        if c["frequency"] == "single":
            warnings.append(f"{f} 仅单期观测（{c['last']}，{c['source'].get('label')}），不能生成历史分位")
        elif c["frequency"] != "daily":
            warnings.append(f"{f} 为{FREQ_CN.get(c['frequency'], c['frequency'])}数据，{c['count']} 个观测"
                            f"（{c['first']}~{c['last']}），分位只按实际观测")
        elif f == "dy" and c["provider"] == "csi_indicator":
            warnings.append(f"股息率仅 {c['count']} 个近期观测（{c['first']}~{c['last']}），分位不具长期意义")

    # ---- 成分股数：只用带真实日期+来源的披露，取最新 ----
    comp = []
    for r in sorted(cmap.values(), key=lambda r: r["date"], reverse=True):
        if r.get("cons"):
            comp.append({"provider": "csi", "order": 0, "value": int(r["cons"]), "date": r["date"],
                         "source": {"label": "中证指数", "url": csi_page(meta["csi"]), "method": "index-perf consNumber"}})
            break
    comp_reasons = []
    for order, p in enumerate(providers or [], start=1):
        node = (p.get("series") or {}).get(code) if p.get("status") == "ok" else None
        if not node:
            continue
        if node.get("componentNum"):
            comp.append(dict(node["componentNum"], provider=p["provider"], order=order))
        elif node.get("componentReason") and node["componentReason"] != "未提供":
            comp_reasons.append(f"{p['provider']}: {node['componentReason']}")
    if until:
        future = [c for c in comp if c["date"] > until]
        comp = [c for c in comp if c["date"] <= until]
        comp_reasons += [f"{c['provider']}: 披露日期 {c['date']} 晚于 {until}（未来日期），拒收 value={c['value']}"
                         for c in future]
    comp.sort(key=lambda c: (c["date"], -c["order"]), reverse=True)
    pick = comp[0] if comp else None
    if pick:
        sources["componentNum"] = dict(pick["source"], provider=pick["provider"])
    availability["componentNum"] = {
        "status": "ok" if pick else "unavailable", "provider": pick["provider"] if pick else None,
        "date": pick["date"] if pick else None, "value": pick["value"] if pick else None,
        "reason": "" if pick else ("；".join(comp_reasons) or "无带日期与来源的成分股数披露"),
        "rejected": comp_reasons,
        "candidates": [{"provider": c["provider"], "value": c["value"], "date": c["date"]} for c in comp],
    }

    out = {k: meta[k] for k in ("code", "name", "category", "description")}
    out.update({"componentNum": pick["value"] if pick else None, "componentDate": pick["date"] if pick else None,
                "market": meta["market"], "sources": sources, "warnings": warnings, "coverage": cov,
                "availability": availability, "d": d})
    out.update(s)
    return out


def tencent_page(sym: str) -> str:
    if sym.startswith(("sh", "sz")):
        return f"https://gu.qq.com/{sym}/zs"
    if sym.startswith("hk"):
        return f"https://gu.qq.com/{sym}"
    return f"https://gu.qq.com/{sym.replace('.', '')}"


def csi_page(code: str) -> str:
    return f"https://www.csindex.com.cn/#/indices/family/detail?indexCode={code}"


def validate_bundle(data: dict) -> list[str]:
    errs = []
    for s in data.get("indices", []):
        n = len(s["d"])
        if s["d"] != sorted(set(s["d"])):
            errs.append(f"{s['code']} 日期未去重升序")
        for f in FIELDS:
            if len(s[f]) != n:
                errs.append(f"{s['code']}.{f} 长度 {len(s[f])} != {n}")
            for v in s[f]:
                if v is not None and not (isinstance(v, (int, float)) and math.isfinite(v)):
                    errs.append(f"{s['code']}.{f} 含非有限值")
                    break
        av = s.get("availability")
        if av is None:
            continue
        for f in FIELDS:
            a = av.get(f)
            if a is None:
                errs.append(f"{s['code']} availability 缺 {f}")
                continue
            cnt = sum(1 for v in s[f] if v is not None)
            if a.get("count") != cnt:
                errs.append(f"{s['code']}.{f} availability.count {a.get('count')} != 实际 {cnt}")
            if (a.get("status") == "ok") != (cnt > 0):
                errs.append(f"{s['code']}.{f} availability.status {a.get('status')} 与数据不符")
            src = (s.get("sources") or {}).get(f)
            if cnt and f in PROVIDER_FIELDS and not (src and unit_ok(f, src.get("unit"))):
                errs.append(f"{s['code']}.{f} 来源单位 {src and src.get('unit')!r} 不符合契约")
            if cnt and f in PROVIDER_FIELDS and len([c for c in a.get("candidates", []) if c.get("selected")]) != 1:
                errs.append(f"{s['code']}.{f} 非恰好一个选中来源（禁止跨源拼列）")
        if s.get("componentNum") is not None and not s.get("componentDate"):
            errs.append(f"{s['code']} componentNum 无日期")
    return errs


def read_bundle(path: str) -> dict | None:
    """读取已有 data-bundle.js（用于前后覆盖对比）；不存在/损坏返回 None。"""
    try:
        with open(path, encoding="utf-8") as f:
            txt = f.read()
        body = txt.split("window.PANO_DATA=", 1)[1].rstrip().rstrip(";")
        return json.loads(body)
    except (OSError, IndexError, ValueError):
        return None


def _cov_of(series: dict) -> dict:
    """从 bundle series 计算逐字段 {count,first,last}（不依赖 series 自带 coverage）。"""
    return {f: coverage(series.get("d", []), series.get(f) or []) for f in FIELDS}


def build_coverage_report(series: list[dict], previous: dict | None, baseline: dict | None,
                          provider_state: dict, mode: str, generated: str, as_of: str) -> dict:
    """逐指数、逐字段前后覆盖对比。before 优先用 manager 基线 round2-baseline.json，并附上一版 bundle。"""
    base_rows = {r["code"]: r for r in (baseline or {}).get("rows", [])}
    prev_rows = {s["code"]: s for s in (previous or {}).get("indices", [])}
    empty = {"count": 0, "first": None, "last": None}
    rows, summary = [], {f: {"beforeNonEmpty": 0, "afterNonEmpty": 0, "filled": [], "lost": []}
                         for f in FIELDS + ["componentNum"]}
    codes = [s["code"] for s in series] + [c for c in base_rows if c not in {s["code"] for s in series}]
    by_code = {s["code"]: s for s in series}
    for code in codes:
        s = by_code.get(code)
        b = base_rows.get(code)
        pv = prev_rows.get(code)
        pcov = _cov_of(pv) if pv else None
        fields = {}
        for f in FIELDS:
            before = (b or {}).get("fields", {}).get(f) or (pcov or {}).get(f) or empty
            after = dict(s["availability"][f]) if s else {"status": "unavailable", "reason": "指数未纳入", **empty}
            after.pop("candidates", None)
            fb, fa = (before or empty).get("count") or 0, after.get("count") or 0
            fields[f] = {"before": before, "previousBundle": (pcov or {}).get(f), "after": after,
                         "filled": fb == 0 and fa > 0, "lost": fb > 0 and fa == 0, "delta": fa - fb}
            summary[f]["beforeNonEmpty"] += fb > 0
            summary[f]["afterNonEmpty"] += fa > 0
            if fields[f]["filled"]:
                summary[f]["filled"].append(code)
            if fields[f]["lost"]:
                summary[f]["lost"].append(code)
        cb = (b or {}).get("componentNum") if b else (pv or {}).get("componentNum")
        ca = s["availability"]["componentNum"] if s else {"status": "unavailable", "reason": "指数未纳入"}
        ca = {k: v for k, v in ca.items() if k != "candidates"}
        fields["componentNum"] = {"before": cb, "after": ca, "filled": cb is None and ca.get("value") is not None,
                                  "lost": cb is not None and ca.get("value") is None}
        summary["componentNum"]["beforeNonEmpty"] += cb is not None
        summary["componentNum"]["afterNonEmpty"] += ca.get("value") is not None
        if fields["componentNum"]["filled"]:
            summary["componentNum"]["filled"].append(code)
        if fields["componentNum"]["lost"]:
            summary["componentNum"]["lost"].append(code)
        rows.append({"code": code, "name": (s or b or pv or {}).get("name"), "included": s is not None,
                     "fields": fields})
    return {"generatedAt": generated, "asOf": as_of, "mode": mode,
            "before": {"baseline": os.path.relpath(BASELINE, HERE) if baseline else None,
                       "baselineAsOf": (baseline or {}).get("asOf"),
                       "previousBundleGeneratedAt": (previous or {}).get("generatedAt")},
            "providers": provider_state, "summary": summary, "indices": rows}


def render_bundle(data: dict) -> str:
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    return ("/* 由 fetch_data.py 生成，勿手改。来源与口径见 README.md。 */\n"
            f"window.PANO_DATA={body};\n")

# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------

def store_path(kind: str, code: str) -> str:
    return os.path.join(STORE, f"{kind}_{code.replace('.', '_')}.csv")


PRICE_COLS, CSI_COLS, IND_COLS = ["close", "volume", "amt", "src"], ["close", "amt", "pe", "cons"], ["pe1", "pe2", "dy1", "dy2"]


def update_prices(meta: dict, today: str, get: Callable, offline: bool, backfill_since: str = "2005-01-01") -> tuple[list[dict], list[str]]:
    path = store_path("price", meta["code"])
    stored = load_store(path, PRICE_COLS, {"close", "volume", "amt"})
    warns: list[str] = []
    if not stored:
        stored = load_cache_prices(meta.get("cache"), meta["market"])
    if not meta.get("tsym") or offline:
        return stored, warns
    has_tencent = any(r.get("src") == "tencent" for r in stored)
    if has_tencent:
        # 已有腾讯历史：只回补最近 30 天（重叠用于去重与一致性校验）
        since = (dt.date.fromisoformat(stored[-1]["date"]) - dt.timedelta(days=30)).isoformat()
    else:
        # 首次：从 max(基日, backfill_since) 翻页回补，为缓存期补上腾讯成交额
        since = max(meta["floor"], backfill_since)
    try:
        fresh = fetch_tencent(meta["tsym"], meta["market"], since, today, get=get)
    except FetchError as e:
        warns.append(f"腾讯更新失败，保留已有数据：{e}")
        return stored, warns
    if not fresh:
        warns.append("腾讯返回空数据，保留已有数据")
        return stored, warns
    # 合并顺序：旧腾讯行 < 新腾讯行 < 缓存行。缓存期点位/成交量保留缓存原值（精度更高、不改历史），
    # 缓存无成交额字段，merge_rows 不以空覆盖，故腾讯成交额得以保留。
    cache_rows = [r for r in stored if r.get("src") == "cache"]
    tencent_old = [r for r in stored if r.get("src") != "cache"]
    merged = merge_rows(merge_rows(tencent_old, fresh), cache_rows)
    write_store(path, merged, PRICE_COLS)
    return merged, warns


def update_csi(meta: dict, today: str, calendar, calendar_end, get: Callable, offline: bool) -> tuple[list[dict], list[str], int]:
    if not meta.get("csi"):
        return [], [], 0
    path = store_path("csi", meta["code"])
    stored = load_store(path, CSI_COLS, set(CSI_COLS))
    if offline:
        return stored, [], 0
    if stored:
        start = stored[-1]["date"]  # 起始日已有，返回的起始日行（可能伪行）将被丢弃
    else:
        start = (dt.date.fromisoformat(meta["floor"]) - dt.timedelta(days=1)).isoformat()
    try:
        fresh, dropped = fetch_csi_perf(meta["csi"], start, today, meta["floor"], calendar, calendar_end, get=get)
    except FetchError as e:
        return stored, [f"中证行情/PE更新失败，保留已有数据：{e}"], 0
    if not fresh and not stored:
        return [], ["中证接口返回空数据"], dropped
    merged = merge_rows(stored, fresh)
    write_store(path, merged, CSI_COLS)
    return merged, [], dropped


def update_indicator(meta: dict, get: Callable, offline: bool) -> tuple[list[dict], list[str]]:
    if not meta.get("csi"):
        return [], []
    path = store_path("indicator", meta["code"])
    stored = load_store(path, IND_COLS, set(IND_COLS))
    if offline:
        return stored, []
    try:
        fresh = parse_indicator_xls(get(CSI_IND_URL.format(code=meta["csi"]), timeout=30))
    except FetchError as e:
        return stored, [f"中证 indicator 更新失败，保留已有数据：{e}"]
    except Exception as e:  # xlrd 解析异常
        return stored, [f"中证 indicator 解析失败：{type(e).__name__}: {e}"]
    merged = merge_rows(stored, fresh)
    if fresh:
        write_store(path, merged, IND_COLS)
    return merged, []


def offline_get(url: str, **kw) -> bytes:
    """--offline / --enrich-only 下替换网络函数：任何请求都立即失败，保证不联网。"""
    raise FetchError(f"离线模式禁止联网：{url}")


def main(argv=None, get: Callable = http_get) -> int:
    ap = argparse.ArgumentParser(description="指数全景数据采集")
    ap.add_argument("--since", default="2005-01-01", help="bundle 最早日期（缩小文件体积；store 仍保留全量）")
    ap.add_argument("--only", default="", help="逗号分隔 code，仅更新这些（其余用 store 离线数据）")
    ap.add_argument("--offline", action="store_true",
                    help="严格不联网：仅用 data/store、只读历史缓存与 data/providers/*.json 重建 bundle")
    ap.add_argument("--enrich-only", action="store_true",
                    help="不重抓行情/中证：用现有 data/store，读取 provider 缓存后重建 bundle（默认同样不联网）")
    ap.add_argument("--collect-providers", action="store_true",
                    help="调用 providers.<name>.collect(offline=False) 在线采集（默认只读 provider 缓存）；不可与 --offline 同用")
    ap.add_argument("--providers", default=",".join(PROVIDER_NAMES), help="逗号分隔 provider 名，空串表示不接入")
    ap.add_argument("--no-csi", action="store_true", help="跳过中证接口")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--coverage-report", default=COVERAGE_REPORT, help="前后覆盖对比 JSON 输出路径，空串不写")
    args = ap.parse_args(argv)
    if args.offline and args.collect_providers:
        ap.error("--offline 严格不联网，不能与 --collect-providers 同用")
    no_net = args.offline or (args.enrich_only and not args.collect_providers)
    mode = "offline" if args.offline else ("enrich-only" if args.enrich_only else "full")
    get = HostBreaker(offline_get if (args.offline or args.enrich_only) else get)
    today = dt.date.today().isoformat()
    only = {c.strip() for c in args.only.split(",") if c.strip()}
    gen = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    run = {"generatedAt": gen, "mode": mode, "networkAllowed": not no_net, "args": vars(args), "indices": {}}

    def is_off(m):
        return args.offline or args.enrich_only or (only and m["code"] not in only)

    # 1) 价格（腾讯 + 缓存），并发
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as ex:
        price_res = dict(zip([m["code"] for m in INDICES],
                             ex.map(lambda m: update_prices(m, today, get, is_off(m), args.since), INDICES)))
    # 2) A 股交易日历：上证指数可靠日线（缓存+腾讯）
    cal_rows = price_res["000001.SH"][0]
    calendar = {r["date"] for r in cal_rows}
    calendar_end = max(calendar) if calendar else None
    # 缓存中部分文件源自中证导出，同样带“起始日伪行”（如 2005-01-01、2010-01-01 元旦），按日历剔除。
    # 只针对价格；provider 估值报告日（可能是周末月末）不在此过滤。
    for m in INDICES:
        if m["market"] == "A" and m["code"] != "000001.SH" and calendar:
            rows, w = price_res[m["code"]]
            kept, bad = filter_calendar(rows, calendar, calendar_end)
            if bad:
                w = w + [f"剔除价格缓存中 {len(bad)} 个非交易日伪行：{', '.join(bad[:5])}"]
            price_res[m["code"]] = (kept, w)
    # 3) 中证（行情/PE/成交额 + indicator 股息率），低并发以免触发限流
    def do_csi(m):
        if args.no_csi:
            return (load_store(store_path("csi", m["code"]), CSI_COLS, set(CSI_COLS)), [], 0), \
                   (load_store(store_path("indicator", m["code"]), IND_COLS, set(IND_COLS)), [])
        return (update_csi(m, today, calendar, calendar_end, get, is_off(m)),
                update_indicator(m, get, is_off(m)))
    with ThreadPoolExecutor(max_workers=2) as ex:
        csi_res = dict(zip([m["code"] for m in INDICES], ex.map(do_csi, INDICES)))

    # 4) provider：默认只读 data/providers/<name>.json；显式 --collect-providers 才在线 collect
    known = {m["code"] for m in INDICES}
    a_cal_last = calendar_end or today
    providers = []
    for name in [x.strip() for x in args.providers.split(",") if x.strip()]:
        if args.collect_providers and not args.offline:
            providers.append(collect_provider(name, [dict(m) for m in INDICES], a_cal_last, known))
        else:
            providers.append(load_provider_cache(name, known))
    provider_state = {}
    for p in providers:
        provider_state[p["provider"]] = {
            "status": p["status"], "path": p.get("path"), "retrievedAt": p.get("retrievedAt"),
            "codes": len(p.get("series") or {}),
            "okFields": sum(1 for n in (p.get("series") or {}).values()
                            for f in n["fields"].values() if f["status"] == "ok"),
            "errors": p.get("errors", [])[:50], "rejected": p.get("rejected", [])[:200],
            "unknownCodes": p.get("unknownCodes", []),
        }
        if p["status"] != "ok":
            log(f"provider {p['provider']}: {p['status']} {'; '.join(p.get('errors', [])[:2])}")
    run["providers"] = provider_state

    series, global_warn = [], []
    for m in INDICES:
        prices, pw = price_res[m["code"]]
        (crow, cw, dropped), (irow, iw) = csi_res[m["code"]]
        if not prices and crow:
            # 无腾讯价格（如中证2000）时以中证官网收盘为点位
            prices = [{"date": r["date"], "close": r["close"], "volume": None, "src": "csi"} for r in crow if r.get("close")]
        if not prices and not crow:
            pv = [p["provider"] for p in providers if m["code"] in (p.get("series") or {})]
            extra = f"；provider {','.join(pv)} 有该指数条目但无价格，未单独纳入" if pv else ""
            global_warn.append(f"{m['name']}({m['code']}) 无任何可用价格数据，未纳入{extra}")
            run["indices"][m["code"]] = {"included": False, "warnings": pw + cw + iw}
            continue
        s = build_series(m, prices, crow, irow, args.since, pw + cw + iw, providers=providers, until=today)
        series.append(s)
        run["indices"][m["code"]] = {"included": True, "csiDroppedRows": dropped, "warnings": s["warnings"],
                                     "coverage": s["coverage"],
                                     "availability": {f: {k: v for k, v in a.items() if k != "candidates"}
                                                      for f, a in s["availability"].items()}}
    if not series:
        log("没有任何指数可用，保留原 bundle 不覆盖")
        return 2
    a_last = [s["coverage"]["price"]["last"] for s in series if s["market"] == "A" and s["coverage"]["price"]["last"]]
    as_of = max(a_last) if a_last else max(s["d"][-1] for s in series if s["d"])
    filled = {f: sum(1 for s in series if s["coverage"][f]["count"]) for f in FIELDS}
    val_last = {}
    for s in series:
        for f in ("pe", "pb", "dy"):
            lst = s["coverage"][f]["last"]
            if lst and (f not in val_last or lst > val_last[f]):
                val_last[f] = lst
    global_warn.insert(0, f"点位最新 {as_of}（腾讯证券）；估值最新 "
                          + ("，".join(f"{f.upper()} {val_last[f]}" for f in ("pe", "pb", "dy") if f in val_last) or "无")
                          + "；各字段日期独立，不视为同日")
    empty_fields = [f for f in ("pe", "pb", "dy", "mcap", "turn", "eps", "roe", "bps", "amt", "volume") if filled[f] == 0]
    partial = [f"{f} {filled[f]}/{len(series)}" for f in ("pe", "pb", "dy", "mcap", "turn", "eps", "roe", "bps", "amt", "volume")
               if 0 < filled[f] < len(series)]
    if empty_fields:
        global_warn.append(f"{'/'.join(empty_fields)} 尚无任何指数有可靠数据，为 null，可用 CSV 导入补充")
    if partial:
        global_warn.append("部分指数有数据的字段：" + "、".join(partial) + "；其余为 null（原因见各指数 availability）")
    for p in providers:
        if p["status"] != "ok":
            global_warn.append(f"provider {p['provider']} 未接入（{p['status']}）：{'; '.join(p.get('errors', [])[:1])}")
    plabel = "；".join(f"{p['provider']}（{p.get('retrievedAt') or p['status']}）" for p in providers) or "无"
    data = {"schemaVersion": 1, "generatedAt": gen, "asOf": as_of, "warnings": global_warn,
            "sourceNote": ("腾讯证券日K收盘点位；中证指数官网 index-perf（peg滚动PE、成交额亿元）与 indicator.xls（D/P2股息率）；"
                           f"本仓库只读历史缓存；provider 缓存：{plabel}。各字段整列单一来源，见 sources/availability。"),
            "providers": {k: {kk: v[kk] for kk in ("status", "retrievedAt", "okFields")} for k, v in provider_state.items()},
            "indices": series}
    errs = validate_bundle(data)
    if errs:
        log("bundle 校验失败，未写入：\n" + "\n".join(errs[:20]))
        return 3
    previous = read_bundle(BUNDLE)
    atomic_write(BUNDLE, render_bundle(data))
    run["asOf"] = as_of
    run["bundleBytes"] = os.path.getsize(BUNDLE)
    run["globalWarnings"] = global_warn
    atomic_write(MANIFEST, json.dumps(run, ensure_ascii=False, indent=1))
    if args.coverage_report:
        baseline = None
        try:
            with open(BASELINE, encoding="utf-8") as f:
                baseline = json.load(f)
        except (OSError, ValueError):
            pass
        rep = build_coverage_report(series, previous, baseline, provider_state, mode, gen, as_of)
        atomic_write(args.coverage_report, json.dumps(rep, ensure_ascii=False, indent=1))
    log(f"写入 {BUNDLE}：{len(series)} 只，asOf {as_of}，{run['bundleBytes'] / 1e6:.1f} MB，模式 {mode}")
    for s in series:
        c, a = s["coverage"], s["availability"]
        extra = " ".join(f"{f} {c[f]['count']}[{a[f]['provider']}]" for f in ("pe", "pb", "dy", "mcap", "turn")
                         if c[f]["count"])
        log(f"  {s['code']:<11}{s['name']:<8} price {c['price']['first']}~{c['price']['last']}({c['price']['count']}) "
            f"amt {c['amt']['count']} {extra}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
