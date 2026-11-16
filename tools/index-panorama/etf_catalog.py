#!/usr/bin/env python3
"""指数全景 · ETF 官方映射目录（快照，非实时）。

数据只来自官方来源，不用聚合站：
  1. 上交所 ETF 清单（query.sse.com.cn FUND_LIST，字段 INDEX_CODE/INDEX_NAME）——上交所挂牌 ETF 的跟踪指数；
  2. 深交所基金子网 ETF 列表（fund.szse.cn CATALOGID=1945，字段“拟合指数”）——深交所挂牌 ETF 的跟踪指数；
  3. 中证指数官网“相关产品”（csindex.com.cn index-list/queryByIndexCode）——中证系指数的指数公司口径交叉核对。

规则：
  - 只收两所当前 ETF 清单里存在的场内 ETF（清单即在市产品，已清盘/未上市不在其中）；不收联接、LOF、普通指数基金、增强 ETF；
  - relationship=tracks 仅当交易所登记的跟踪指数代码 == 本指数官方代码（或 benchmarkAliases 中显式声明的同一指数别名）；
  - 中证系指数还要求中证官网相关产品中同时列出该代码，二者不一致时不收并写入报告；
  - related_theme 只在 RELATED 中人工逐条声明，记录产品真实跟踪的 benchmarkCode/Name 与关系说明；
  - benchmarkCode 保留官方原码（中证指数为不带后缀的 6 位/字母码），不为匹配本地后缀改写。

用法：
  python etf_catalog.py fetch --cache <目录>     # 联网下载三类官方原始数据到缓存目录
  python etf_catalog.py build --cache <目录>     # 由缓存生成 data/etf_catalog.json、etf-catalog.js、reports/etf-mapping.md
  python etf_catalog.py validate                 # 离线校验目录（CI 可执行，无网络）
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
CATALOG_JSON = HERE / "data" / "etf_catalog.json"
CATALOG_JS = HERE / "etf-catalog.js"
REPORT_MD = HERE / "reports" / "etf-mapping.md"
JS_PREFIX = "window.PANO_ETFS="
UA = "Mozilla/5.0 (index-panorama etf catalog)"

SSE_LIST_URL = ("https://query.sse.com.cn/commonSoaQuery.do?isPagination=true&pageHelp.pageSize=100"
                "&pageHelp.pageNo={p}&pageHelp.beginPage={p}&pageHelp.cacheSize=1&sqlId=FUND_LIST&fundType=00")
SZSE_LIST_URL = "https://fund.szse.cn/api/report/ShowReport/data?SHOWTYPE=JSON&CATALOGID=1945&TABKEY=tab1&PAGENO={p}"
CSI_PRODUCTS_URL = "https://www.csindex.com.cn/csindex-home/index-list/queryByIndexCode/{c}"
CSI_BASIC_URL = "https://www.csindex.com.cn/csindex-home/indexInfo/index-basic-info/{c}"
CSI_PAGE_URL = "https://www.csindex.com.cn/#/indices/family/detail?indexCode={c}"
SSE_PRODUCT_URL = "https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID={c}"
SZSE_LIST_PAGE = "https://fund.szse.cn/marketdata/fundslist/index.html"

# 本地指数代码（与数据包一致） -> 官方基准代码、指数公司。csi=True 表示中证指数公司编制（需中证官网交叉核对）。
TARGETS: dict[str, dict] = {}


def _t(code, name, bench=None, csi=True, aliases=None):
    TARGETS[code] = dict(name=name, bench=bench or code.split(".")[0], csi=csi, aliases=aliases or [])


# 原 36 只
_t("000001.SH", "上证指数")
_t("399001.SZ", "深证成指", csi=False)
_t("399006.SZ", "创业板指", csi=False)
_t("000688.SH", "科创50")
_t("000016.SH", "上证50")
_t("000300.SH", "沪深300", aliases=["399300"])
_t("000905.SH", "中证500", aliases=["399905"])
_t("000852.SH", "中证1000")
_t("000903.SH", "中证A100", aliases=["399903"])
_t("000906.SH", "中证800", aliases=["399906"])
_t("000985.SH", "中证全指")
_t("399303.SZ", "国证2000", csi=False)
_t("932000.CSI", "中证2000")
_t("000922.CSI", "中证红利")
_t("000932.SH", "中证消费")
_t("399967.SZ", "中证军工")
_t("399975.SZ", "证券公司")
_t("399986.SZ", "中证银行")
_t("399971.SZ", "中证传媒")
_t("000827.SH", "中证环保")
for _c, _n in [("000986", "全指能源"), ("000987", "全指材料"), ("000988", "全指工业"), ("000989", "全指可选"),
               ("000990", "全指消费"), ("000991", "全指医药"), ("000992", "全指金融"), ("000993", "全指信息"),
               ("000994", "全指通信"), ("000995", "全指公用")]:
    _t(f"{_c}.SH", _n)
_t("HSI.HK", "恒生指数", csi=False)
_t("HSTECH.HK", "恒生科技", csi=False)
_t("HSCEI.HK", "恒生国企", csi=False)
_t("SPX.US", "标普500", csi=False)
_t("IXIC.US", "纳斯达克综指", csi=False)
_t("DJI.US", "道琼斯工业", bench="DJIA", csi=False, aliases=["DJIA"])
# 数据 owner 新增 27 只（manager 2026-11-16 转发）
for _c, _n in [("H30184.CSI", "全指半导体"), ("H30202.CSI", "全指软件"), ("931160.CSI", "全指通信设备"),
               ("931775.CSI", "全指房地产"), ("930697.CSI", "全指家电"), ("H30199.CSI", "全指电力"),
               ("990001.CSI", "中华半导体芯片"), ("930651.CSI", "中证计算机"), ("930713.CSI", "人工智能"),
               ("H30590.CSI", "机器人"), ("931079.CSI", "5G通信"), ("931151.CSI", "光伏产业"),
               ("399976.SZ", "中证新能源汽车"), ("931719.CSI", "电池"), ("399989.SZ", "中证医疗"),
               ("931152.CSI", "创新药"), ("930743.CSI", "生物科技"), ("399997.SZ", "中证白酒"),
               ("930653.CSI", "食品饮料"), ("399998.SZ", "中证煤炭"), ("000819.SH", "有色金属"),
               ("930606.CSI", "中证钢铁"), ("000949.SH", "中证农业"), ("399973.SZ", "中证国防"),
               ("931066.CSI", "军工龙头"), ("H30269.CSI", "红利低波"), ("399809.SZ", "保险主题")]:
    _t(_c, _n)

# 人工声明的主题相关（related_theme）：本地指数 -> [(真实跟踪基准代码, 关系说明)]
RELATED: dict[str, list[tuple[str, str]]] = {
    "000994.SH": [("931235", "跟踪中证电信主题指数（电信运营/增值服务/通信设备/数据中心等50只），与全指通信服务行业部分重叠，非本指数跟踪产品")],
    "399997.SZ": [("399987", "跟踪中证酒指数（白酒、啤酒、葡萄酒等酒类公司），覆盖白酒但范围更宽，非中证白酒跟踪产品")],
    "IXIC.US": [("NDX", "跟踪纳斯达克100指数（纳斯达克综指中市值最大的约100只非金融股），非综指跟踪产品")],
}
RELATED_MAX = 3  # 每个相关基准最多列入的产品数

NOTES: dict[str, str] = {
    "000994.SH": ("中证官网相关产品为空，两所 ETF 清单中无跟踪 000994 的产品：无已核实的直接跟踪 ETF。"
                  "常被当作“通信ETF”的 515880 跟踪 931160 中证全指通信设备、515050 跟踪 931079 中证5G通信，"
                  "均非本指数；下列仅为主题相关产品。"),
    "IXIC.US": "两所 ETF 清单中无跟踪纳斯达克综合指数的产品；“纳指ETF”跟踪的是纳斯达克100（NDX），仅作主题相关列示。",
    "399997.SZ": "中证官网相关产品中仅有境外上市及LOF/场外产品，两所ETF清单无跟踪399997的场内ETF；下列为中证酒指数产品，仅主题相关。",
    "DJI.US": "本地代码 DJI 与上交所登记的 DJIA 为同一指数（道琼斯工业平均指数），在 benchmarkAliases 中显式声明。",
}


# ---------------------------------------------------------------- 联网下载

def http_json(url: str, referer: str, tries: int = 4):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": referer})
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001  网络错误统一重试
            last = e
            time.sleep(1.5 * (i + 1))
    raise RuntimeError(f"{url}: {last}")


def fetch(cache: Path) -> None:
    cache.mkdir(parents=True, exist_ok=True)
    rows, p = [], 1
    while True:
        d = http_json(SSE_LIST_URL.format(p=p), "https://www.sse.com.cn/")
        data = d["pageHelp"]["data"]
        rows += data
        if len(data) < 100:
            break
        p += 1
        time.sleep(0.3)
    (cache / "sse_etf.json").write_text(json.dumps(rows, ensure_ascii=False))
    out, p = [], 1
    while True:
        d = http_json(SZSE_LIST_URL.format(p=p), "https://fund.szse.cn/")
        for r in d[0]["data"]:
            out.append(dict(code=re.search(r"<u>(\d{6})</u>", r["sys_key"]).group(1),
                            name=re.search(r"<u>([^<]+)</u>", r["kzjcurl"]).group(1),
                            index=r["nhzs"].strip(), manager=r["glrmc"]))
        if p >= d[0]["metadata"]["pagecount"]:
            break
        p += 1
        time.sleep(0.3)
    (cache / "szse_etf.json").write_text(json.dumps(out, ensure_ascii=False))
    csi_codes = sorted({t["bench"] for t in TARGETS.values() if t["csi"]} | {b for v in RELATED.values() for b, _ in v if re.fullmatch(r"[0-9H]\w{5}", b)})
    prod, basic = {}, {}
    for c in csi_codes:
        prod[c] = http_json(CSI_PRODUCTS_URL.format(c=c), "https://www.csindex.com.cn/").get("data") or []
        b = http_json(CSI_BASIC_URL.format(c=c), "https://www.csindex.com.cn/").get("data") or {}
        basic[c] = {k: b.get(k) for k in ("indexCode", "indexShortNameCn", "indexFullNameCn", "basicDate", "publishDate")}
        time.sleep(0.3)
    (cache / "csi_products.json").write_text(json.dumps(prod, ensure_ascii=False))
    (cache / "csi_basic.json").write_text(json.dumps(basic, ensure_ascii=False))
    (cache / "fetched_at.txt").write_text(dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
    print(f"SSE {len(rows)} / SZSE {len(out)} / CSI {len(prod)} 指数 -> {cache}")


# ---------------------------------------------------------------- 生成

def _excluded_name(name: str) -> bool:
    return any(k in name for k in ("增强", "指增", "联接", "LOF"))


def _exchange_rows(cache: Path) -> list[dict]:
    """统一两所清单：[{code,name,exchange,index,indexName,manager}]。深交所“拟合指数”形如 '399006 创业板指'。"""
    out = []
    for r in json.loads((cache / "sse_etf.json").read_text()):
        out.append(dict(code=r["fundCode"], name=r["secNameFull"] or r["fundAbbr"], exchange="SH",
                        index=(r.get("INDEX_CODE") or "").strip().upper(), indexName=(r.get("INDEX_NAME") or "").strip(),
                        manager=r.get("companyName") or ""))
    for r in json.loads((cache / "szse_etf.json").read_text()):
        parts = r["index"].split(None, 1)
        out.append(dict(code=r["code"], name=r["name"], exchange="SZ", index=(parts[0] if parts else "").upper(),
                        indexName=parts[1].strip() if len(parts) > 1 else "", manager=r.get("manager") or ""))
    return out


def build(cache: Path) -> dict:
    fetched_at = (cache / "fetched_at.txt").read_text().strip()
    day = fetched_at[:10]
    rows = _exchange_rows(cache)
    csi_prod = json.loads((cache / "csi_products.json").read_text())
    csi_basic = json.loads((cache / "csi_basic.json").read_text())
    # 基准名称：中证官网全称优先，其次上交所 INDEX_NAME，再次深交所简称
    names: dict[str, str] = {}
    for r in rows:
        if r["index"] and r["indexName"] and (r["exchange"] == "SH" or r["index"] not in names):
            names.setdefault(r["index"], r["indexName"])
    for c, b in csi_basic.items():
        if b.get("indexFullNameCn"):
            names[c] = b["indexFullNameCn"]

    for t in TARGETS.values():  # 深市镜像代码与主代码为同一中证指数，名称取中证官网全称
        if t["csi"] and t["bench"] in names:
            for a in t["aliases"]:
                names[a.upper()] = names[t["bench"]]

    def csi_etf_codes(bench):
        return {x["productCode"] for x in csi_prod.get(bench, []) if x.get("fundType") == "ETF"}

    def product(r, rel, bench, note=None, cross=None):
        if r["exchange"] == "SH":
            url, title = SSE_PRODUCT_URL.format(c=r["code"]), f"上交所ETF基本信息 {r['code']}（跟踪指数 {r['index']} {r['indexName']}）"
        else:
            url, title = SZSE_LIST_PAGE, f"深交所基金子网ETF列表 {r['code']}（拟合指数 {r['index']}）"
        p = dict(code=r["code"], name=r["name"], exchange=r["exchange"], relationship=rel, benchmarkCode=bench,
                 benchmarkName=names.get(bench) or r["indexName"] or bench, sourceUrl=url, sourceTitle=title,
                 verifiedAt=day, manager=r["manager"])
        if cross:
            p["crossCheck"] = cross
        if note:
            p["relationNote"] = note
        return p

    indices, issues = {}, []
    for local, t in TARGETS.items():
        bench, keys = t["bench"].upper(), {t["bench"].upper(), *[a.upper() for a in t["aliases"]]}
        prods, seen = [], set()
        csi_set = csi_etf_codes(t["bench"]) if t["csi"] else None
        for r in sorted((r for r in rows if r["index"] in keys), key=lambda r: (r["exchange"], r["code"])):
            if _excluded_name(r["name"]) or (r["code"], r["exchange"]) in seen:
                continue
            cross = None
            if t["csi"]:
                if r["code"] not in csi_set:
                    issues.append(f"{local} {r['code']} {r['name']}：交易所登记跟踪 {r['index']}，但中证官网相关产品未列为 ETF，未收录")
                    continue
                cross = f"中证指数官网相关产品同列为跟踪 {t['bench']} 的ETF（{CSI_PAGE_URL.format(c=t['bench'])}）"
            seen.add((r["code"], r["exchange"]))
            prods.append(product(r, "tracks", r["index"] if r["index"] in t["aliases"] else t["bench"], cross=cross))
        if t["csi"]:
            listed = {r["code"] for r in rows}
            for c in sorted(csi_set - {p["code"] for p in prods}):
                x = next(x for x in csi_prod[t["bench"]] if x["productCode"] == c)
                if c in listed or not re.fullmatch(r"\d{6}", c) or x.get("exchange") not in ("上海证券交易所", "深圳证券交易所"):
                    continue  # 已处理，或境外上市产品（不属A股场内ETF范围）
                issues.append(f"{local} {c} {x['fundName']}：中证官网列为ETF，但不在两所当前ETF清单（未上市/已退市/境外），未收录")
        for rb, note in RELATED.get(local, []):
            rr = [r for r in rows if r["index"] == rb.upper() and not _excluded_name(r["name"])]
            for r in sorted(rr, key=lambda r: (r["exchange"], r["code"]))[:RELATED_MAX]:
                if (r["code"], r["exchange"]) not in seen:
                    seen.add((r["code"], r["exchange"]))
                    prods.append(product(r, "related_theme", rb, note=note))
        direct = sum(p["relationship"] == "tracks" for p in prods)
        note = NOTES.get(local) or (f"两所当前ETF清单中跟踪 {t['bench']} 的场内ETF共 {direct} 只"
                                    + ("，均经中证官网相关产品交叉核对。" if t["csi"] else "（非中证编制指数，以交易所登记为准）。")
                                    if direct else
                                    f"未找到已核实的直接跟踪 {t['bench']} 的场内ETF"
                                    + ("（中证官网相关产品与两所清单均无）。" if t["csi"] else "（两所ETF清单均无）。"))
        entry = dict(name=t["name"], benchmarkCode=t["bench"], notes=note, products=prods)
        if t["aliases"]:
            entry["benchmarkAliases"] = t["aliases"]
        indices[local] = entry
    catalog = dict(schemaVersion=1, verifiedAt=fetched_at,
                   snapshotNote="官方来源核验快照，非实时自动更新；产品名单变化以交易所与基金公司最新公告为准。不构成投资建议。",
                   sources=[dict(label="上海证券交易所ETF清单", url="https://www.sse.com.cn/assortment/fund/etf/list/"),
                            dict(label="深圳证券交易所基金子网ETF列表", url=SZSE_LIST_PAGE),
                            dict(label="中证指数有限公司指数相关产品", url="https://www.csindex.com.cn/")],
                   indices=indices)
    errs = validate_catalog(catalog)
    if errs:
        raise SystemExit("目录校验失败：\n" + "\n".join(errs[:30]))
    write_outputs(catalog)
    write_report(catalog, issues, csi_basic, {e: sum(r["exchange"] == e for r in rows) for e in ("SH", "SZ")})
    return catalog


def write_outputs(catalog: dict) -> None:
    text = json.dumps(catalog, ensure_ascii=False, indent=1)
    for path, body in ((CATALOG_JSON, text + "\n"), (CATALOG_JS, JS_PREFIX + json.dumps(catalog, ensure_ascii=False) + ";\n")):
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(body, encoding="utf-8")
        os.replace(tmp, path)


def write_report(catalog: dict, issues: list[str], csi_basic: dict, counts: dict) -> None:
    idx = catalog["indices"]
    n_direct = sum(1 for e in idx.values() if any(p["relationship"] == "tracks" for p in e["products"]))
    n_tracks = sum(p["relationship"] == "tracks" for e in idx.values() for p in e["products"])
    n_rel = sum(p["relationship"] == "related_theme" for e in idx.values() for p in e["products"])
    L = ["# 指数全景 · ETF 官方映射报告", "",
         f"- 核验快照时间：{catalog['verifiedAt']}（非实时；重新执行 `fetch`+`build` 才会更新）",
         f"- 指数 {len(idx)} 只；有直接跟踪 ETF 的 {n_direct} 只；tracks 产品 {n_tracks} 条；related_theme {n_rel} 条。",
         "- 生成：`python etf_catalog.py fetch --cache <dir> && python etf_catalog.py build --cache <dir>`；离线校验：`python etf_catalog.py validate`、`python -m unittest tests/test_etf_catalog.py`。",
         "- 产出：`data/etf_catalog.json`、`etf-catalog.js`（`window.PANO_ETFS=` 同内容）。不构成投资建议，列表顺序为交易所+代码，与收益无关。", "",
         "## 方法与证据口径", "",
         "1. **交易所登记的跟踪指数**（主证据）：上交所 ETF 清单 `query.sse.com.cn` FUND_LIST 的 `INDEX_CODE/INDEX_NAME`；深交所基金子网 ETF 列表 `fund.szse.cn` CATALOGID=1945 的“拟合指数”。清单只含当前挂牌 ETF，已清盘产品自然排除。",
         "2. **指数公司交叉核对**：中证系指数要求中证官网“相关产品”（`/csindex-home/index-list/queryByIndexCode/<code>`）中该产品 fundType=ETF；两者不一致不收。国证/恒生/标普/道琼斯/纳斯达克指数以交易所登记为准（未逐只查招募说明书，见“未验证项”）。",
         "3. 排除：ETF 联接、LOF、普通指数/主动基金、名称含“增强”的增强 ETF、境外上市 ETF。",
         "4. `benchmarkCode` 保留官方原码：中证指数官方为无后缀代码（如本地 `000922.CSI` ↔ 官方 `000922`，`399967.SZ` ↔ `399967`），前端按去后缀比较；别名以条目 `benchmarkAliases` 显式声明：`DJI.US` ↔ 上交所登记 `DJIA`；深交所对中证系宽基登记深市镜像代码 `399300`(沪深300)/`399905`(中证500)/`399903`(中证100)/`399906`(中证800)，产品 benchmarkCode 保留交易所登记原码，且这些产品均经中证官网相关产品在主代码下交叉核对。",
         "5. related_theme 仅人工声明（000994 → 931235 中证电信；399997 → 399987 中证酒；IXIC → NDX 纳斯达克100），不计入直接跟踪。", "",
         "## 000994.SH 全指通信（优先项）", "",
         "- 官方全称：" + (csi_basic.get("000994", {}).get("indexFullNameCn") or "中证全指通信服务指数") + "；中证官网相关产品接口返回 `data: []`。",
         f"- 上交所 {counts['SH']} 只 / 深交所 {counts['SZ']} 只 ETF 清单中无跟踪代码 000994 的产品。**结论：无已核实的直接跟踪 ETF。**",
         "- 515880 通信ETF国泰 跟踪 931160 中证全指通信设备；515050 通信ETF华夏 跟踪 931079 中证5G通信 —— 均非 000994，已分别归入新增指数 931160/931079 的 tracks。",
         "- 000994 下仅列 related_theme：中证电信 931235 的产品（上交所 INDEX_CODE=931235），relationNote 说明关系。", "",
         "## 逐指数映射与证据摘要", ""]
    for code, e in idx.items():
        L.append(f"### {code} {e['name']}（基准 {e['benchmarkCode']}）")
        L.append(f"- {e['notes']}")
        for p in e["products"]:
            ev = f"{'上交所 INDEX_CODE' if p['exchange'] == 'SH' else '深交所 拟合指数'}={p['benchmarkCode']}"
            if p.get("crossCheck"):
                ev += "；中证官网相关产品同列"
            tag = "直接跟踪" if p["relationship"] == "tracks" else "主题相关"
            L.append(f"  - `{p['code']}` {p['name']}（{p['exchange']}，{p['manager']}）— {tag} {p['benchmarkCode']} {p['benchmarkName']}；证据：{ev}；[{p['sourceTitle']}]({p['sourceUrl']})"
                     + (f"；说明：{p['relationNote']}" if p.get("relationNote") else ""))
        L.append("")
    L += ["## 未收录与不一致", ""] + ([f"- {x}" for x in issues] or ["- 无"]) + ["",
          "## 未验证项与风险", "",
          "- 未逐只打开基金公司产品页/招募说明书；跟踪指数以两所登记字段为主证据、中证官网为交叉证据。非中证指数（399001/399006/399303、恒生、标普、道琼斯、纳指）只有交易所单一官方来源。",
          "- 深交所产品 sourceUrl 指向基金子网 ETF 列表页（无稳定的单产品静态页），按代码检索可复现；上交所产品指向单只 ETF 基本信息页。",
          "- 快照之后新上市/清盘/变更标的的 ETF 不会自动反映；产品名称以交易所证券简称为准。", ""]
    REPORT_MD.parent.mkdir(parents=True, exist_ok=True)
    REPORT_MD.write_text("\n".join(L), encoding="utf-8")


# ---------------------------------------------------------------- 校验（离线）

ISO = re.compile(r"^\d{4}-\d{2}-\d{2}")
URL_OK = re.compile(r"^https://[^\s\"'<>@]+$")


def code_key(c) -> str:
    return str(c or "").strip().upper().split(".")[0]


def validate_catalog(cat: dict) -> list[str]:
    errs = []
    if cat.get("schemaVersion") != 1:
        errs.append("schemaVersion 应为 1")
    if not ISO.match(str(cat.get("verifiedAt", ""))):
        errs.append("verifiedAt 不是 ISO")
    idx = cat.get("indices")
    if not isinstance(idx, dict):
        return errs + ["indices 不是对象"]
    for code, e in idx.items():
        if not isinstance(e.get("products"), list):
            errs.append(f"{code}.products 不是数组")
            continue
        if not str(e.get("notes", "")).strip():
            errs.append(f"{code}.notes 为空")
        keys = {code_key(code), *[code_key(a) for a in e.get("benchmarkAliases", [])]}
        seen = set()
        for i, p in enumerate(e["products"]):
            at = f"{code}.products[{i}]"
            for k in ("code", "name", "exchange", "benchmarkCode", "benchmarkName", "sourceTitle", "sourceUrl"):
                if not isinstance(p.get(k), str) or not p[k].strip():
                    errs.append(f"{at}.{k} 为空")
            if not re.fullmatch(r"\d{6}", str(p.get("code", ""))):
                errs.append(f"{at}.code 不是6位字符串：{p.get('code')!r}")
            if p.get("exchange") not in ("SH", "SZ"):
                errs.append(f"{at}.exchange 应为 SH/SZ")
            if p.get("relationship") not in ("tracks", "related_theme"):
                errs.append(f"{at}.relationship 非法")
            if p.get("relationship") == "tracks" and code_key(p.get("benchmarkCode")) not in keys:
                errs.append(f"{at} tracks 但基准 {p.get('benchmarkCode')} ≠ {code}")
            if p.get("relationship") == "related_theme" and not str(p.get("relationNote", "")).strip():
                errs.append(f"{at} related_theme 缺 relationNote")
            if not URL_OK.match(str(p.get("sourceUrl", ""))):
                errs.append(f"{at}.sourceUrl 非 https 或含凭据")
            if not ISO.match(str(p.get("verifiedAt", ""))):
                errs.append(f"{at}.verifiedAt 非 ISO")
            if p.get("code") in seen:
                errs.append(f"{at} 重复 {p.get('code')}")
            seen.add(p.get("code"))
    return errs


def validate_files() -> list[str]:
    cat = json.loads(CATALOG_JSON.read_text(encoding="utf-8"))
    errs = validate_catalog(cat)
    js = CATALOG_JS.read_text(encoding="utf-8")
    if not js.startswith(JS_PREFIX):
        errs.append("etf-catalog.js 缺 window.PANO_ETFS= 前缀")
    elif json.loads(js[len(JS_PREFIX):].strip().rstrip(";")) != cat:
        errs.append("etf-catalog.js 与 data/etf_catalog.json 内容不一致")
    return errs


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for n in ("fetch", "build"):
        s = sub.add_parser(n)
        s.add_argument("--cache", required=True, type=Path)
    sub.add_parser("validate")
    a = ap.parse_args(argv)
    if a.cmd == "fetch":
        fetch(a.cache)
    elif a.cmd == "build":
        c = build(a.cache)
        print(f"写出 {len(c['indices'])} 指数 -> {CATALOG_JSON.name}, {CATALOG_JS.name}, {REPORT_MD.name}")
    else:
        errs = validate_files()
        print("\n".join(errs) if errs else "ETF 目录校验通过")
        return 1 if errs else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
