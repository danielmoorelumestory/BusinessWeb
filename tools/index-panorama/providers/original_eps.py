#!/usr/bin/env python3
"""原站 EPS provider：李神奇数据网（lishenqi.vip）指数全景的每股盈利（eps）历史。

用户已明确本地自用，并要求使用原站「每股利润」数据。本 provider 只提供 ``eps`` 一个字段，
不提供、也不影响 PE/PB/价格/ROE/股息率等任何其他字段。

数据路径（只读）：
  * 在已正常打开的 https://lishenqi.vip/#/panorama 页面里，执行 ``providers/original_eps_capture.js``：
    它只调用页面自身的只读函数 ``PANO_IX.panel()`` 与 ``PANO_IX.series(code,'all',PANO_IX.FIELDS)``
    （= 详情页点「全部」区间时页面发出的同一请求，云函数 action=ixSeries），顺序执行、间隔 1.5 秒、
    遇错即停；只保留 d/eps 与采样元数据，不读取 cookie/token/请求头，不调用任何写接口。
  * 抓取结果保存为脱敏 raw ``data/providers/original_eps_raw/capture.json``。
  * 本模块**不联网**：只解析该 raw，输出 ``data/providers/original_eps.json``（与其他 provider 同构）。
    Python 端无法、也不应绕开页面去直接调用原站云函数；需要更新时重新在页面执行抓取脚本。

口径（已确认 / 未核实）：
  * 单位：原站 ixPanel 单位表 ``u.eps = "yuan"`` → 元（每股）。原值保留，不换算。
  * 计算口径（分子 TTM/报告期、分母股本口径、加权方式）原站未披露，**未核实**。
  * 不是「每指数点盈利」：原站 price/pe 与 eps 不相等，本模块也绝不用点位/PE 反推或校正 EPS。
  * 'all' 区间是服务端每 5 个交易日取 1 点（step=5，freq=week），**不是完整日频**；
    原站 10y 区间同样是周采样，1y 区间才是日频但只有一年，二者不混用。每只指数只用这一份 'all' 历史。
  * 港股/美股原站 eps 全为空 → 保留缺失，不伪造。

接口：``collect(indices, as_of, offline=False) -> dict``；CLI：``python3 providers/original_eps.py``。
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import os
import sys
import tempfile

NAME = "original_eps"
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_PATH = os.path.join(HERE, "data", "providers", "original_eps_raw", "capture.json")
OUT_PATH = os.path.join(HERE, "data", "providers", "original_eps.json")

SOURCE_LABEL = "李神奇数据网（lishenqi.vip 指数全景，计算口径未核实）"
SOURCE_URL = "https://lishenqi.vip/#/panorama"
EXPECTED_RANGE = "all"
# raw 中允许出现的键；出现其他键（例如 token/cookie/header 之类）一律拒绝解析
# onlyCodes 只出现在冒烟子集抓取中；refresh_runner 的发布门禁拒绝带 onlyCodes 的 raw
ALLOWED_TOP = {"capturedAt", "page", "range", "via", "panelDay", "unitEps", "roster", "series", "errors", "onlyCodes"}
ALLOWED_SERIES = {"origCode", "origName", "freq", "step", "first", "last", "points", "dailyPoints",
                  "shards", "errors", "d", "eps"}
SENSITIVE = ("token", "cookie", "openid", "authorization", "session", "secret", "password", "uid")

# 本地 36 只指数中原站名册里存在的映射（本地代码 → 原站代码）；其余在原站名册中不存在
CODE_MAP = {
    "000001.SH": "000001.SH", "399001.SZ": "399001.SZ", "399006.SZ": "399006.SZ", "000688.SH": "000688.SH",
    "000016.SH": "000016.SH", "000300.SH": "000300.SH", "000905.SH": "000905.SH", "000852.SH": "000852.SH",
    "000903.SH": "000903.SH", "000906.SH": "000906.SH", "000922.CSI": "000922.SH", "399967.SZ": "399967.SZ",
    "399975.SZ": "399975.SZ", "399986.SZ": "399986.SZ", "000827.SH": "000827.SH",
    "HSI.HK": "HSI.HI", "HSTECH.HK": "HSTECH.HI", "HSCEI.HK": "HSCEI.HI", "SPX.US": "SPX.GI", "IXIC.US": "IXIC.GI",
}
UNIT_MAP = {"yuan": "元"}


class RawError(ValueError):
    pass


def _iso(d8: str) -> str:
    if not isinstance(d8, str) or len(d8) != 8 or not d8.isdigit():
        raise RawError(f"非 YYYYMMDD 日期 {d8!r}")
    iso = f"{d8[:4]}-{d8[4:6]}-{d8[6:]}"
    dt.date.fromisoformat(iso)  # 非法日期抛 ValueError
    return iso


def _scan_sensitive(obj, path="") -> list[str]:
    """只扫描键名（值里的指数名等不会误报）。"""
    hits = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if any(s in str(k).lower() for s in SENSITIVE):
                hits.append(f"{path}.{k}")
            hits += _scan_sensitive(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj[:3]):
            hits += _scan_sensitive(v, f"{path}[{i}]")
    return hits


def load_raw(path: str = RAW_PATH) -> dict:
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    if not isinstance(raw, dict):
        raise RawError("raw 顶层不是对象")
    extra = set(raw) - ALLOWED_TOP
    if extra:
        raise RawError(f"raw 含未知顶层键 {sorted(extra)}（脱敏 raw 只允许数据字段）")
    hits = _scan_sensitive(raw)
    if hits:
        raise RawError(f"raw 含疑似凭据键 {hits[:5]}，拒绝使用")
    if raw.get("range") != EXPECTED_RANGE:
        raise RawError(f"raw range={raw.get('range')!r}，本 provider 只接受 'all' 一份历史")
    if not isinstance(raw.get("series"), dict):
        raise RawError("raw.series 不是对象")
    return raw


def _unavailable(reason: str) -> dict:
    return {"d": [], "v": [], "status": "unavailable", "reason": reason, "frequency": "",
            "source": {"label": SOURCE_LABEL, "url": SOURCE_URL, "unit": "元", "method": ""}}


def parse_series(local: str, node: dict, raw: dict) -> dict:
    """单只指数 → eps 字段（status ok / unavailable）。结构问题抛 RawError。"""
    extra = set(node) - ALLOWED_SERIES
    if extra:
        raise RawError(f"{local}: 含未知键 {sorted(extra)}")
    d, e = node.get("d"), node.get("eps")
    if not isinstance(d, list) or not isinstance(e, list) or len(d) != len(e):
        raise RawError(f"{local}: d/eps 不是等长数组")
    if node.get("errors"):
        raise RawError(f"{local}: 原站返回 errors={node['errors']!r}")
    iso = [_iso(x) for x in d]
    if any(b <= a for a, b in zip(iso, iso[1:])):
        raise RawError(f"{local}: 日期未严格升序")
    dates, vals = [], []
    for day, v in zip(iso, e):
        if v is None:
            continue
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
            raise RawError(f"{local}: {day} eps={v!r} 不是有限数")
        dates.append(day)
        vals.append(v)  # 原值，不换算、不取整
    if not dates:
        return _unavailable(f"原站 ixSeries('all') 返回 {len(d)} 个日期但 eps 全为空（原站该指数无每股盈利），保留缺失，不伪造")
    unit = UNIT_MAP.get(str(raw.get("unitEps") or ""))
    if not unit:
        raise RawError(f"原站单位表 u.eps={raw.get('unitEps')!r} 未知，不猜测单位")
    step = node.get("step")
    freq = str(node.get("freq") or "")
    if freq != "week" or step != 5:
        raise RawError(f"{local}: 原站采样 freq={freq!r} step={step!r}，与已核对的 'all' 周采样(step=5)不符")
    method = (f"原站页面只读调用 PANO_IX.series('{node.get('origCode')}','all')（云函数 ixSeries，=详情页「全部」区间）返回的 eps 原值；"
              f"单位取原站单位表 u.eps=yuan（元/每股），未换算。服务端从 {node.get('dailyPoints')} 个日点中每 5 个交易日取 1 点"
              f"（step=5，freq=week），不是完整日频；原站 raw 非空观测 {len(dates)} 个（{dates[0]}~{dates[-1]}），"
              f"数据包按 --since 起始日裁剪，实际样本数/范围以 availability.eps 为准。"
              f"计算口径（盈利期、股本、加权方式）与上游原站未披露，未核实；不是每指数点盈利，与点位/PE 不存在恒等关系；"
              f"每只指数只用这一份历史，不与其他来源拼接。采集 {raw.get('capturedAt')}")
    return {
        "d": dates, "v": vals, "status": "ok", "reason": "", "frequency": "weekly",
        "source": {
            "label": SOURCE_LABEL, "url": SOURCE_URL, "unit": unit, "method": method,
            "origCode": node.get("origCode"), "origName": node.get("origName"),
            "range": EXPECTED_RANGE, "sampling": "每5个交易日取1点（step=5）",
            "serverFirst": _iso(node["first"]) if node.get("first") else None,
            "serverLast": _iso(node["last"]) if node.get("last") else None,
            "serverPoints": node.get("points"), "serverDailyPoints": node.get("dailyPoints"),
            "rawSampleCount": len(dates), "rawFirstDate": dates[0], "rawLastDate": dates[-1],
            "capturedAt": raw.get("capturedAt"), "calcVerified": False,
        },
    }


def build_payload(indices: list[dict] | None, as_of: str, raw: dict | None, raw_error: str = "") -> dict:
    codes = [m["code"] for m in indices] if indices else list(CODE_MAP)
    series, errors = {}, []
    if raw_error:
        errors.append(raw_error)
    roster = (raw or {}).get("roster") or {}
    for code in codes:
        if raw is None:
            field = _unavailable(f"原站 EPS raw 不可用：{raw_error}")
        elif code not in CODE_MAP:
            field = _unavailable("原站指数全景名册没有该指数（已核对 ixPanel roster），保留缺失，不用其他来源替代")
        elif code not in raw["series"]:
            orig = CODE_MAP[code]
            why = "原站名册无 " + orig if orig not in roster else "本次抓取未含该指数（抓取中途停止或未采集）"
            field = _unavailable(why + "，保留缺失")
        else:
            try:
                field = parse_series(code, raw["series"][code], raw)
            except (RawError, ValueError) as e:
                errors.append(str(e))
                field = _unavailable(f"raw 校验失败：{e}")
        series[code] = {"fields": {"eps": field}}
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return {"provider": NAME, "retrievedAt": (raw or {}).get("capturedAt"), "builtAt": now, "asOf": as_of,
            "mode": "cache", "sourceLabel": SOURCE_LABEL, "sourceUrl": SOURCE_URL,
            "capture": {k: (raw or {}).get(k) for k in ("capturedAt", "page", "range", "via", "panelDay", "unitEps")},
            "series": series, "errors": errors + list((raw or {}).get("errors") or [])}


def collect(indices: list[dict] | None, as_of: str, offline: bool = False) -> dict:
    """解析 raw → payload（同时写 data/providers/original_eps.json）。

    无论 offline 与否都不联网：原站数据只能在正常打开的页面里用 original_eps_capture.js 只读抓取。
    """
    try:
        raw, err = load_raw(), ""
    except (OSError, ValueError) as e:
        raw, err = None, f"{type(e).__name__}: {e}"
    payload = build_payload(indices, as_of, raw, err)
    if not offline:
        payload["errors"].insert(0, "original_eps 不在 Python 端联网；本次仅解析页面抓取的 raw 缓存")
    write_payload(payload)
    return payload


def write_payload(payload: dict, path: str = OUT_PATH) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="解析原站 EPS raw（不联网）→ data/providers/original_eps.json")
    ap.add_argument("--as-of", default=dt.date.today().isoformat())
    args = ap.parse_args(argv)
    if HERE not in sys.path:
        sys.path.insert(0, HERE)
    try:
        from fetch_data import INDICES  # 本地 36 只指数清单
        indices = [dict(m) for m in INDICES]
    except Exception:  # noqa: BLE001  fetch_data 不可导入时按映射表输出
        indices = None
    p = collect(indices, args.as_of, offline=True)
    ok = [c for c, n in p["series"].items() if n["fields"]["eps"]["status"] == "ok"]
    print(f"original_eps: {len(ok)}/{len(p['series'])} 只有 EPS；errors={p['errors']}")
    return 0 if not p["errors"] else 1


if __name__ == "__main__":
    sys.exit(main())
