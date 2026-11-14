# 同花顺 ETF 主升浪采集（标准库）。与 gupiaoWS 的 bruce_replica/uptrend.py 是同一份代码；
# 由 .github/workflows/etf-uptrend.yml 每日运行，用法见文件内说明与 README。
"""同花顺 ETF 主升浪：每日采集、按日快照、单只 ETF 历史上涨区间与来源 AI 原因、页面生成、launchd 定时。

只用 Python 标准库，定时任务可以直接用系统 Python 运行，不依赖项目的 pandas/akshare 环境。

  python -m bruce_replica uptrend run                 # 手动采集（当天已有快照则安全覆盖更新）
  python -m bruce_replica uptrend run --scheduled     # 定时入口：当天已成功则跳过
  python -m bruce_replica uptrend show [--date D]     # 终端查看最近成功快照或某日快照
  python -m bruce_replica uptrend page                # 重新生成页面
  python -m bruce_replica uptrend schedule install [--time 23:30 --time 07:00]
  python -m bruce_replica uptrend schedule status | uninstall

数据边界（与同花顺页面的差异）：
- 公开接口只给名单、趋势回踩/新入池标签、历史上涨区间和 AI 原因；盘中今日涨幅、累计涨幅、连续上涨天数、
  涨停指标的接口要求登录（未登录返回 401），这里不采集、不伪造。名单顺序是接口原序，不是涨幅排行。
- 历史区间的 period_rise 截至该区间 end_day，不是 App 里的盘中累计涨幅。
- 名单接口不带日期。「来源截止日」取本次新取到的在池 ETF 最近上涨区间的 end_day 最大值；
  快照按来源截止日（行情日）命名，采集时间另记；来源晚上才更新，所以默认北京时间 23:30 和次日 07:00 各采一次，
  定时运行先探测来源截止日，没有前进就跳过。
- 历史快照只能从开始采集之日起积累，不回填。
"""
from __future__ import annotations

import argparse
import fcntl
import gzip
import json
import os
import plistlib
import subprocess
import sys
import tempfile
import time
from contextlib import contextmanager
from http.client import HTTPException
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Callable
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

PACKAGE_DIR = Path(__file__).resolve().parent
REPLICA_DIR = PACKAGE_DIR.parent
DATA_ROOT = REPLICA_DIR / "data" / "ths_uptrend"
PAGE_PATH = REPLICA_DIR.parent / "charts" / "ths-etf-uptrend.html"
TEMPLATE = PACKAGE_DIR / "templates" / "uptrend.html"

SOURCE_PAGE = "https://fund.10jqka.com.cn/thsjj-jj-fe-market-domain/uptrend-list/index.html#/"
POOL_API = "https://fund.10jqka.com.cn/quotation/fund_pool/v2/query"
PERIOD_API = "https://eq.10jqka.com.cn/open/api/etf_rank/etf/uptrend/v1/period/etf"
REASONS_API = "https://eq.10jqka.com.cn/open/api/etf_rank/etf/uptrend/v1/ai/insights"
ALL_POOL = "1f3b943f-c5f4-312f-95b9-64de02642115"
FILTERS = {"trend_retracement": "last_day_step_signal", "new_pool": "new_up_trend"}
# 来源页面的分类标签（同一 businessKey 下的子池），以及「同类ETF仅展示一只」（custom.uniqueTracking）。
# 这些是附加标签：取不到时快照记为 partial，名单照常保存，对应标签记为未知（None）。
CATEGORY_POOLS = {"t0": "f3e152a1-5cc0-3617-a89d-d68bdd0d1dab",
                  "industry": "012e0cb0-f790-35ed-a369-eddc757f228e",
                  "broad_index": "d6d4b394-ab20-3f9d-9d65-a7589767c57a"}
TAG_KEYS = ("trend_retracement", "new_pool", "t0", "industry", "broad_index", "unique_rep")

TZ_NAME = "Asia/Shanghai"
TZ = ZoneInfo(TZ_NAME)
LABEL = "com.gupiaows.ths-etf-uptrend"
PLIST = Path.home() / "Library" / "LaunchAgents" / f"{LABEL}.plist"

DEFAULT_CONFIG = {
    # 北京时间采集时点。同花顺当天的榜单一般要到深夜才更新（实测 21:25 仍是前一日、次日 04:57 已更新），
    # 所以 23:30 一次、次日 07:00 再兜底一次；来源没有新数据时只发一个探测请求就跳过。
    "times": ["23:30", "07:00"],
    "period_budget": 120,     # 每次最多刷新多少只 ETF 的历史区间（其余用缓存，并标出缓存日期）
    "reason_budget": 40,      # 每次最多新取多少条 AI 原因（按 ETF + 区间起始日缓存）
    "min_interval": 0.35,     # 两次请求之间的最短间隔（秒），顺序请求、并发为 1
    "timeout": 20,
    "retries": 3,
    "pool_timeout": 30,       # 名单接口晚间偶尔很慢或断连，单独放宽
    "pool_retries": 5,
    "detail_deadline_s": 900,  # 历史区间与 AI 原因阶段的总时长上限，超时后留待下次
    "detail_max_consecutive_failures": 5,  # 连续失败这么多次就判定上游不稳，停止明细请求
    "probe_count": 3,         # 每次必定新取历史区间的在池 ETF 数，用来确定来源截止日
}


# ---------------------------------------------------------------- 基础工具

def now() -> datetime:
    return datetime.now(TZ)


def iso(t: datetime) -> str:
    return t.isoformat(timespec="seconds")


def write_json_atomic(path: Path, obj: Any, gz: bool = False) -> None:
    """先写临时文件再改名，进程中途被杀也不会留下半个文件。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp")
    try:
        data = json.dumps(obj, ensure_ascii=False, indent=None if gz else 1).encode("utf-8")
        with os.fdopen(fd, "wb") as f:
            f.write(gzip.compress(data, mtime=0) if gz else data + b"\n")
        os.chmod(tmp, 0o644)
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def read_json(path: Path, default: Any = None) -> Any:
    try:
        raw = path.read_bytes()
    except FileNotFoundError:
        return default
    if path.suffix == ".gz":
        raw = gzip.decompress(raw)
    return json.loads(raw)


def load_config(root: Path = DATA_ROOT) -> dict:
    cfg = dict(DEFAULT_CONFIG)
    saved = read_json(root / "config.json", {}) or {}
    saved.pop("time", None)          # 旧版单一时点配置，已由 times 取代
    cfg.update(saved)
    return cfg


def parse_hhmm(value: str) -> tuple[int, int]:
    try:
        h, m = (int(x) for x in value.split(":"))
    except ValueError:
        raise ValueError(f"时间格式应为 HH:MM，收到 {value!r}") from None
    if not (0 <= h < 24 and 0 <= m < 60):
        raise ValueError(f"时间超出范围：{value!r}")
    return h, m


@contextmanager
def run_lock(root: Path):
    """进程级互斥：定时与手动同时触发时，后到的直接退出，不重入。"""
    root.mkdir(parents=True, exist_ok=True)
    f = open(root / ".lock", "w")
    try:
        try:
            fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            yield False
            return
        f.write(str(os.getpid()))
        f.flush()
        yield True
    finally:
        f.close()


# ---------------------------------------------------------------- HTTP

class Fetcher:
    """顺序请求、温和限速、有限重试；把每次响应原样记进 raw 列表，便于追溯。"""

    def __init__(self, timeout: float = 20, retries: int = 3, min_interval: float = 0.35,
                 opener: Callable = urlopen, sleep: Callable = time.sleep):
        self.timeout, self.retries, self.min_interval = timeout, retries, min_interval
        self.opener, self.sleep = opener, sleep
        self._last = 0.0
        self.raw: list[dict] = []

    def _throttle(self) -> None:
        wait = self._last + self.min_interval - time.monotonic()
        if wait > 0:
            self.sleep(wait)
        self._last = time.monotonic()

    def json(self, url: str, payload: dict | None = None) -> Any:
        headers = {"User-Agent": "Mozilla/5.0", "Referer": SOURCE_PAGE, "Origin": "https://fund.10jqka.com.cn"}
        body = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            body = json.dumps(payload).encode("utf-8")
        last_err: Exception | None = None
        for attempt in range(self.retries):
            self._throttle()
            try:
                with self.opener(Request(url, data=body, headers=headers), timeout=self.timeout) as resp:
                    result = json.load(resp)
                self.raw.append({"url": url, "payload": payload, "fetched_at": iso(now()), "response": result})
                if not isinstance(result, dict) or result.get("status_code") != 0:
                    raise RuntimeError(f"接口返回错误 {url}: {str(result)[:300]}")
                return result.get("data")
            except HTTPError as exc:
                with exc:
                    last_err = RuntimeError(f"HTTP {exc.code} {url}: {exc.read(300).decode('utf-8', 'replace')}")
                if exc.code not in (429, 500, 502, 503, 504):
                    raise last_err from exc
            except (OSError, HTTPException, ValueError) as exc:  # 含 URLError、超时、断连、JSON 解析失败
                last_err = RuntimeError(f"{type(exc).__name__} {url}: {exc}")
            if attempt < self.retries - 1:
                self.sleep(min(2 ** (attempt + 1), 30))  # 2、4、8、16、30 秒
        raise last_err or RuntimeError(f"请求失败 {url}")


# ---------------------------------------------------------------- 解析

def parse_pool(data: Any) -> list[dict]:
    """按 indexes[].type 对齐每行；条数与 total 不符视为不完整。"""
    if not isinstance(data, dict) or "itemList" not in data or "indexes" not in data:
        raise RuntimeError(f"名单响应结构不符：{str(data)[:200]}")
    fields = [item["type"] for item in data["indexes"]]
    rows = [dict(zip(fields, row)) for row in data["itemList"]]
    total = int(data.get("total", len(rows)))
    if len(rows) != total:
        raise RuntimeError(f"名单不完整：{len(rows)} / {total}")
    for r in rows:
        if ":" not in str(r.get("code", "")):
            raise RuntimeError(f"名单行缺少市场代码：{r}")
    return rows


def pool_payload(filter_type: str | None = None, pool_key: str = ALL_POOL, unique: bool = False) -> dict:
    custom: dict = {"fieldList": ["code"], "limit": 10000, "offset": 0}
    if filter_type:
        custom["filterList"] = [{"type": filter_type, "relation": "AND",
                                 "filterTypeQueryList": [{"cond": "eq", "value": "1"}]}]
    if unique:
        custom["uniqueTracking"] = True
    return {"businessKey": "etfUpTrend", "businessPoolKey": pool_key, "custom": custom}


def normalize(pools: dict[str, list[dict]]) -> tuple[list[dict], list[str]]:
    """合并全量池与各筛选/分类结果；没取到的标签记为 None；子池里出现但全量池没有的代码记为警告。"""
    tags = {k: {r["code"] for r in pools[k]} for k in TAG_KEYS if k in pools}
    all_codes = {r["code"] for r in pools["all"]}
    warnings = [f"{k} 中有 {len(v - all_codes)} 只不在全量池：{sorted(v - all_codes)[:5]}"
                for k, v in tags.items() if v - all_codes]
    rows = []
    for r in pools["all"]:
        market, code = r["code"].split(":", 1)
        rows.append({"ths_code": r["code"], "code": r.get("tradeCode") or code, "market": market,
                     "name": r.get("simpleName"),
                     **{k: (r["code"] in tags[k]) if k in tags else None for k in TAG_KEYS}})
    return rows, warnings


def latest_period(periods: list[dict] | None) -> dict | None:
    return max(periods, key=lambda p: p.get("start_day") or "") if periods else None


def source_as_of(period_lists: list[list[dict]]) -> str | None:
    ends = [p.get("end_day") for ps in period_lists for p in (ps or []) if p.get("end_day")]
    return max(ends) if ends else None


# ---------------------------------------------------------------- 缓存

def _cache_name(ths_code: str) -> str:
    return ths_code.replace(":", "_")


def period_cache_path(root: Path, ths_code: str) -> Path:
    return root / "cache" / "periods" / f"{_cache_name(ths_code)}.json"


def reason_cache_path(root: Path, ths_code: str, start_day: str) -> Path:
    return root / "cache" / "reasons" / f"{_cache_name(ths_code)}_{start_day}.json"


def period_is_fresh(cached: dict | None, as_of: str | None) -> bool:
    """在池 ETF 的当前上涨区间应当延伸到来源截止日；没延伸到就需要刷新。"""
    if not cached:
        return False
    if as_of is None:
        return True
    lp = latest_period(cached.get("periods"))
    return bool(lp and (lp.get("end_day") or "") >= as_of)


def plan_period_refresh(rows: list[dict], root: Path, as_of: str | None, budget: int,
                        skip: set[str]) -> list[str]:
    """优先级：趋势回踩 > 新入池 > 从未缓存 > 缓存最旧。"""
    cand = []
    for r in rows:
        c = r["ths_code"]
        if c in skip:
            continue
        cached = read_json(period_cache_path(root, c))
        if period_is_fresh(cached, as_of):
            continue
        prio = 0 if r["trend_retracement"] else 1 if r["new_pool"] else 2 if cached is None else 3
        cand.append((prio, (cached or {}).get("fetched_at", ""), c))
    cand.sort()
    return [c for _, _, c in cand[:max(budget, 0)]]


# ---------------------------------------------------------------- 采集

def snapshot_path(root: Path, day: str) -> Path:
    return root / "snapshots" / f"{day}.json"


def rekey_snapshots(root: Path) -> list[tuple[str, str]]:
    """把旧版按采集日命名的快照改名为按来源截止日命名；同一行情日有多份时保留采集较晚的一份。"""
    moved = []
    d = root / "snapshots"
    for path in sorted(d.glob("*.json")) if d.exists() else []:
        snap = read_json(path)
        key = (snap or {}).get("source_as_of")
        if not key or key == path.stem:
            continue
        target = snapshot_path(root, key)
        other = read_json(target)
        if other and (other.get("fetch_completed_at") or "") >= (snap.get("fetch_completed_at") or ""):
            path.unlink()
        else:
            snap["date"] = key
            write_json_atomic(target, snap)
            path.unlink()
        moved.append((path.stem, key))
    return moved


def list_snapshots(root: Path) -> list[str]:
    d = root / "snapshots"
    return sorted(p.stem for p in d.glob("*.json")) if d.exists() else []


def collect(root: Path = DATA_ROOT, cfg: dict | None = None, fetcher: Fetcher | None = None,
            clock: Callable[[], datetime] = now, allow_empty: bool = False) -> dict:
    """完成一次采集并落盘。名单失败时抛错且不改动任何已有快照。"""
    cfg = cfg or load_config(root)
    f = fetcher or Fetcher(cfg["timeout"], cfg["retries"], cfg["min_interval"])
    started = clock()
    day = started.date().isoformat()
    run_id = started.strftime("%Y%m%dT%H%M%S")

    base = (f.timeout, f.retries)
    f.timeout, f.retries = cfg.get("pool_timeout", f.timeout), cfg.get("pool_retries", f.retries)
    try:
        pools = {"all": parse_pool(f.json(POOL_API, pool_payload()))}
        for key, ftype in FILTERS.items():
            pools[key] = parse_pool(f.json(POOL_API, pool_payload(ftype)))
        optional_errors = []
        extra = {**{k: (None, pk, False) for k, pk in CATEGORY_POOLS.items()},
                 "unique_rep": (None, ALL_POOL, True)}
        for key, (ftype, pk, uniq) in extra.items():
            try:
                pools[key] = parse_pool(f.json(POOL_API, pool_payload(ftype, pk, uniq)))
            except RuntimeError as exc:
                optional_errors.append({"stage": f"pool:{key}", "ths_code": None, "message": str(exc)})
    finally:
        f.timeout, f.retries = base
    if not pools["all"] and not allow_empty:
        raise RuntimeError("上游返回空的主升浪名单，判为异常，未覆盖已有数据（确属空池可加 --allow-empty）")
    rows, warnings = normalize(pools)

    errors: list[dict] = list(optional_errors)
    fresh: dict[str, list[dict]] = {}
    deadline = time.monotonic() + cfg.get("detail_deadline_s", 900)
    streak = {"fail": 0, "halted": None}

    def halted() -> bool:
        """明细是锦上添花：超时或连续失败就停下，名单快照照常保存，缺的下次补。"""
        if streak["halted"] is None:
            if time.monotonic() > deadline:
                streak["halted"] = f"明细阶段超过 {cfg.get('detail_deadline_s', 900)} 秒，剩余留待下次"
            elif streak["fail"] >= cfg.get("detail_max_consecutive_failures", 5):
                streak["halted"] = f"明细请求连续失败 {streak['fail']} 次，判定上游不稳，剩余留待下次"
            if streak["halted"]:
                errors.append({"stage": "details", "ths_code": None, "message": streak["halted"]})
        return streak["halted"] is not None

    def fetch_periods(c: str) -> None:
        if halted():
            return
        market, code = c.split(":", 1)
        try:
            ps = f.json(f"{PERIOD_API}/{market}/{code}")
            if not isinstance(ps, list):
                raise RuntimeError(f"历史区间响应不是列表：{str(ps)[:200]}")
            fresh[c] = ps
            write_json_atomic(period_cache_path(root, c), {"ths_code": c, "fetched_at": iso(clock()), "periods": ps})
            streak["fail"] = 0
        except RuntimeError as exc:
            streak["fail"] += 1
            errors.append({"stage": "periods", "ths_code": c, "message": str(exc)})

    # 1) 探针：确定来源截止日
    probes = [r["ths_code"] for r in rows[:cfg["probe_count"]]]
    for c in probes:
        fetch_periods(c)
    as_of = source_as_of(list(fresh.values()))
    # 2) 按预算刷新其余过期缓存
    for c in plan_period_refresh(rows, root, as_of, cfg["period_budget"], set(probes)):
        fetch_periods(c)
    as_of = source_as_of(list(fresh.values())) or as_of

    # 3) AI 原因：只取缓存里没有的 (ETF, 当前区间起始日)
    reason_todo = []
    for r in rows:
        cached = fresh.get(r["ths_code"]) or (read_json(period_cache_path(root, r["ths_code"])) or {}).get("periods")
        lp = latest_period(cached)
        if lp and lp.get("start_day") and not reason_cache_path(root, r["ths_code"], lp["start_day"]).exists():
            prio = 0 if r["trend_retracement"] else 1 if r["new_pool"] else 2
            reason_todo.append((prio, r["ths_code"], lp["start_day"]))
    reason_todo.sort()
    for _, c, start in reason_todo[:max(cfg["reason_budget"], 0)]:
        if halted():
            break
        market, code = c.split(":", 1)
        try:
            items = f.json(f"{REASONS_API}/{market}/{code}/{start}")
            write_json_atomic(reason_cache_path(root, c, start),
                              {"ths_code": c, "start_day": start, "fetched_at": iso(clock()), "items": items or []})
            streak["fail"] = 0
        except RuntimeError as exc:
            streak["fail"] += 1
            errors.append({"stage": "ai_reasons", "ths_code": c, "message": str(exc)})

    finished = clock()
    # 快照以来源截止日（行情日）为键：周末、休市或来源未更新时重跑，只会更新同一行情日的快照。
    key = as_of or day
    notes = []
    if as_of is None:
        notes.append(f"本次没有取到历史区间，无法确定来源截止日，暂按采集日 {day} 保存。")

    snap = {
        "date": key,
        "collected_on": day,
        "source_as_of": as_of,
        "fetch_started_at": iso(started),
        "fetch_completed_at": iso(finished),
        "run_id": run_id,
        "status": "partial" if errors else "success",
        "counts": {k: len(v) for k, v in pools.items()},
        "etfs": rows,
        "warnings": warnings,
        "errors": errors,
        "notes": notes,
        "periods_refreshed": len(fresh),
        "source_page": SOURCE_PAGE,
    }
    raw_path = root / "raw" / day / f"{run_id}.json.gz"
    write_json_atomic(raw_path, {"run_id": run_id, "requests": f.raw}, gz=True)
    snap["raw_file"] = str(raw_path.relative_to(root))
    write_json_atomic(snapshot_path(root, key), snap)
    write_json_atomic(root / "latest.json", snap)
    return snap


def record_run(root: Path, entry: dict) -> None:
    root.mkdir(parents=True, exist_ok=True)
    with open(root / "runs.jsonl", "a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
    status = read_json(root / "status.json", {}) or {}
    status["last_run"] = entry
    if entry["status"] in ("success", "partial"):
        status["last_success"] = entry
    write_json_atomic(root / "status.json", status)


def probe_as_of(latest: dict, cfg: dict, fetcher: Fetcher | None = None) -> str | None:
    """只取上次名单前几只 ETF 的历史区间，看来源截止日有没有前进。请求全部失败时返回 None（交给完整采集处理）。"""
    f = fetcher or Fetcher(cfg["timeout"], cfg["retries"], cfg["min_interval"])
    lists = []
    for r in (latest.get("etfs") or [])[:cfg["probe_count"]]:
        market, code = r["ths_code"].split(":", 1)
        try:
            ps = f.json(f"{PERIOD_API}/{market}/{code}")
            if isinstance(ps, list):
                lists.append(ps)
        except RuntimeError:
            continue
    return source_as_of(lists)


def already_current(latest: dict | None, probed: str | None) -> bool:
    """定时去重：最近一份完整快照的来源截止日不早于来源当前的截止日，说明没有新数据。
    不看采集时刻：来源还没更新时采过的快照，不会挡住之后的采集。"""
    return bool(latest and latest.get("status") == "success" and probed
                and latest.get("source_as_of") and latest["source_as_of"] >= probed)


def run(root: Path = DATA_ROOT, scheduled: bool = False, allow_empty: bool = False,
        make_page: bool = True, collector: Callable[..., dict] = collect,
        clock: Callable[[], datetime] = now, prober: Callable[[dict], str | None] | None = None) -> int:
    with run_lock(root) as ok:
        if not ok:
            print("另一次采集正在进行，本次退出。")
            return 0
        rekey_snapshots(root)
        latest = read_json(root / "latest.json")
        if scheduled and latest and latest.get("status") == "success":
            probed = (prober or (lambda snap: probe_as_of(snap, load_config(root))))(latest)
            if already_current(latest, probed):
                print(f"来源截止日仍是 {probed}，已有完整快照（采集于 {latest['fetch_completed_at']}），跳过。手动重跑请用 run。")
                return 0
        started = clock()
        entry = {"run_id": started.strftime("%Y%m%dT%H%M%S"), "started_at": iso(started),
                 "trigger": "scheduled" if scheduled else "manual"}
        try:
            snap = collector(root=root, clock=clock, allow_empty=allow_empty)
            entry.update(status=snap["status"], finished_at=iso(clock()), collected_on=snap["collected_on"],
                         source_as_of=snap["source_as_of"], counts=snap["counts"],
                         errors=len(snap["errors"]), message="; ".join(snap["notes"]) or None)
            code = 0
        except Exception as exc:  # noqa: BLE001 —— 任何失败都要记录，并保留旧数据
            entry.update(status="failed", finished_at=iso(clock()), message=f"{type(exc).__name__}: {exc}")
            code = 1
        record_run(root, entry)
        print(json.dumps(entry, ensure_ascii=False))
        if make_page:
            try:
                print("页面：", build_page(root))
            except Exception as exc:  # noqa: BLE001
                print(f"页面生成失败：{exc}", file=sys.stderr)
        return code


# ---------------------------------------------------------------- 页面

def page_data(root: Path = DATA_ROOT) -> dict:
    days = list_snapshots(root)
    snaps = {d: read_json(snapshot_path(root, d)) for d in days}
    history = [{"d": d, "asof": s.get("source_as_of"), "at": s.get("fetch_completed_at"), "st": s.get("status"),
                "n": s.get("counts", {}), "notes": s.get("notes", []),
                "cats": [k for k in TAG_KEYS if s["etfs"] and s["etfs"][0].get(k) is not None],
                "rows": [[r["ths_code"], r["name"], sum(1 << i for i, k in enumerate(TAG_KEYS) if r.get(k))]
                         for r in s["etfs"]]}
               for d, s in snaps.items()]
    codes = {r[0] for h in history for r in h["rows"]}
    detail = {}
    for c in sorted(codes):
        cached = read_json(period_cache_path(root, c))
        if not cached:
            continue
        reasons = {}
        for p in cached["periods"]:
            rc = read_json(reason_cache_path(root, c, p.get("start_day", "")))
            if rc:
                reasons[p["start_day"]] = rc["items"]
        detail[c] = {"at": cached["fetched_at"], "periods": cached["periods"], "reasons": reasons}
    cfg = load_config(root)
    return {"history": history, "detail": detail, "status": read_json(root / "status.json", {}) or {},
            "generated_at": iso(now()), "schedule": {"times": cfg["times"], "tz": TZ_NAME},
            "source_page": SOURCE_PAGE}


def export_site(root: Path, out_dir: Path) -> list[Path]:
    """导出给 BusinessWeb 实验页的静态数据：index.json（快照目录与运行状态）、detail.json（区间与 AI 原因）、
    days/日期.json（当天名单）。内容不变时不改写文件，免得产生无意义的提交。"""
    data = page_data(root)
    written: list[Path] = []

    def put(path: Path, obj: Any) -> None:
        new = json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n"
        if path.exists() and path.read_text(encoding="utf-8") == new:
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(new, encoding="utf-8")
        os.replace(tmp, path)
        written.append(path)

    days = []
    keep = {f"{h['d']}.json" for h in data["history"]}
    for old in (out_dir / "days").glob("*.json") if (out_dir / "days").exists() else []:
        if old.name not in keep:          # 旧版按采集日命名的快照已改名
            old.unlink()
            written.append(old)
    for h in data["history"]:
        put(out_dir / "days" / f"{h['d']}.json", {"d": h["d"], "cats": h["cats"], "rows": h["rows"]})
        days.append({k: h[k] for k in ("d", "asof", "at", "st", "n", "notes")})
    put(out_dir / "detail.json", data["detail"])
    put(out_dir / "index.json", {"days": days, "status": data["status"], "schedule": data["schedule"],
                                 "source_page": data["source_page"], "tag_keys": list(TAG_KEYS)})
    return written


def build_page(root: Path = DATA_ROOT, out: Path = PAGE_PATH) -> Path:
    payload = json.dumps(page_data(root), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html = TEMPLATE.read_text(encoding="utf-8").replace("__DATA__", payload)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".tmp")
    tmp.write_text(html, encoding="utf-8")
    os.replace(tmp, out)
    return out


# ---------------------------------------------------------------- 终端查看

def show(root: Path, day: str | None, limit: int) -> int:
    status = read_json(root / "status.json", {}) or {}
    lr = status.get("last_run")
    if lr:
        print(f"最近一次运行：{lr.get('started_at')}  {lr['status']}" + (f"  {lr.get('message')}" if lr.get("message") else ""))
    snap = read_json(snapshot_path(root, day)) if day else read_json(root / "latest.json")
    if not snap:
        print("没有快照。" if not day else f"{day} 没有快照。已有：{', '.join(list_snapshots(root)) or '无'}")
        return 1
    n = snap["counts"]
    print(f"行情日（来源截止日） {snap['source_as_of'] or '未知'}  采集于 {snap['fetch_completed_at']}  状态 {snap['status']}")
    print(f"主升浪 {n['all']} 只  趋势回踩 {n['trend_retracement']} 只  新入池 {n['new_pool']} 只")
    labels = {"t0": "T+0", "industry": "行业板块", "broad_index": "宽基指数", "unique_rep": "同类仅一只"}
    extra = "  ".join(f"{v} {n[k]} 只" if k in n else f"{v} 未取到" for k, v in labels.items())
    print(extra)
    for s in snap["notes"] + snap["warnings"]:
        print("  注意：", s)
    for label, key in (("趋势回踩", "trend_retracement"), ("新入池", "new_pool")):
        print(f"\n{label}：")
        for r in [r for r in snap["etfs"] if r[key]][:limit]:
            lp = latest_period((read_json(period_cache_path(root, r["ths_code"])) or {}).get("periods"))
            span = f"  区间 {lp['start_day']}~{lp['end_day']}  区间涨幅 {lp.get('period_rise')}" if lp else ""
            print(f"  {r['code']} {r['name']}{span}")
    print("\n名单为接口原序，不是涨幅排行；盘中涨幅等字段需登录，未采集。")
    return 0


# ---------------------------------------------------------------- launchd

def shanghai_to_local(hh: int, mm: int, ref: datetime | None = None) -> tuple[int, int]:
    ref = ref or now()
    t = datetime.combine(ref.astimezone(TZ).date(), datetime.min.time(), TZ).replace(hour=hh, minute=mm)
    loc = t.astimezone()
    return loc.hour, loc.minute


def next_fire(hh: int, mm: int, ref: datetime | None = None) -> datetime:
    ref = (ref or now()).astimezone(TZ)
    t = ref.replace(hour=hh, minute=mm, second=0, microsecond=0)
    return t if t > ref else t + timedelta(days=1)


def fire_times(cfg: dict) -> list[tuple[int, int]]:
    """配置里的北京时间采集时点，去重并保持配置顺序。"""
    out: list[tuple[int, int]] = []
    for t in cfg.get("times") or []:
        hm = parse_hhmm(t)
        if hm not in out:
            out.append(hm)
    if not out:
        raise ValueError("至少要配置一个采集时点")
    return out


def build_plist(python: str, local_times: list[tuple[int, int]], root: Path = DATA_ROOT) -> dict:
    logs = root / "logs"
    return {
        "Label": LABEL,
        "ProgramArguments": [python, "-m", "bruce_replica.uptrend", "run", "--scheduled"],
        "WorkingDirectory": str(REPLICA_DIR),
        "StartCalendarInterval": [{"Hour": h, "Minute": m} for h, m in local_times],
        "StandardOutPath": str(logs / "launchd.out.log"),
        "StandardErrorPath": str(logs / "launchd.err.log"),
        "EnvironmentVariables": {"PYTHONIOENCODING": "utf-8", "PYTHONDONTWRITEBYTECODE": "1"},
        "ProcessType": "Background",
        "RunAtLoad": False,
    }


def _launchctl(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["launchctl", *args], capture_output=True, text=True)


def schedule_install(time_strs: list[str] | None, root: Path = DATA_ROOT) -> int:
    cfg = load_config(root)
    if time_strs:
        for t in time_strs:
            parse_hhmm(t)
        cfg["times"] = list(time_strs)
    times = fire_times(cfg)
    local = [shanghai_to_local(h, m) for h, m in times]
    saved = read_json(root / "config.json", {}) or {}
    saved.pop("time", None)
    saved.update(times=cfg["times"], installed_local_utcoffset=now().astimezone().strftime("%z"),
                 installed_local_tz=str(datetime.now().astimezone().tzinfo))
    write_json_atomic(root / "config.json", saved)
    (root / "logs").mkdir(parents=True, exist_ok=True)
    PLIST.parent.mkdir(parents=True, exist_ok=True)
    PLIST.write_bytes(plistlib.dumps(build_plist(sys.executable, local, root)))
    domain = f"gui/{os.getuid()}"
    _launchctl("bootout", f"{domain}/{LABEL}")       # 先卸再装：同一 Label 只会有一份
    r = _launchctl("bootstrap", domain, str(PLIST))
    if r.returncode != 0:
        print(f"launchctl bootstrap 失败：{r.stderr.strip() or r.stdout.strip()}", file=sys.stderr)
        return 1
    _launchctl("enable", f"{domain}/{LABEL}")
    fmt = lambda ts: "、".join(f"{h:02d}:{m:02d}" for h, m in ts)
    print(f"已注册 {LABEL}：每天北京时间 {fmt(times)}（本机时间 {fmt(local)}）")
    return schedule_status(root)


def schedule_uninstall() -> int:
    r = _launchctl("bootout", f"gui/{os.getuid()}/{LABEL}")
    PLIST.unlink(missing_ok=True)
    print("已停用并删除定时任务。" if r.returncode == 0 else f"任务原本未加载（{r.stderr.strip()}）；plist 已删除。")
    return 0


def schedule_status(root: Path = DATA_ROOT) -> int:
    cfg = load_config(root)
    times = fire_times(cfg)
    fmt = lambda ts: "、".join(f"{h:02d}:{m:02d}" for h, m in ts)
    r = _launchctl("print", f"gui/{os.getuid()}/{LABEL}")
    loaded = r.returncode == 0
    print(f"plist：{PLIST}（{'存在' if PLIST.exists() else '不存在'}）  launchd：{'已加载' if loaded else '未加载'}")
    if PLIST.exists():
        p = plistlib.loads(PLIST.read_bytes())
        sci = p["StartCalendarInterval"]
        got = [(d["Hour"], d["Minute"]) for d in (sci if isinstance(sci, list) else [sci])]
        exp = [shanghai_to_local(h, m) for h, m in times]
        print(f"  本机触发时间 {fmt(got)}，对应北京时间 {fmt(times)}"
              + ("" if got == exp else f"  ⚠ 与配置或本机时区不符，应为 {fmt(exp)}，请重新 install"))
        print(f"  命令：{' '.join(p['ProgramArguments'])}（工作目录 {p['WorkingDirectory']}）")
    if loaded:
        seen = set()
        for line in r.stdout.splitlines():
            s = line.strip()
            key = s.split(" =")[0]
            if key in ("state", "runs", "last exit code") and key not in seen:
                seen.add(key)
                print("  " + s)
    print(f"  下一次触发：{iso(min(next_fire(h, m) for h, m in times))}（北京时间；Mac 睡眠错过时会在唤醒后补跑一次；来源截止日没前进就只探测不采集）")
    st = read_json(root / "status.json", {}) or {}
    for k, label in (("last_run", "最近运行"), ("last_success", "最近成功")):
        e = st.get(k)
        if e:
            print(f"  {label}：{e.get('started_at')}  {e['status']}  来源截止日 {e.get('source_as_of')}")
    return 0 if loaded else 1


# ---------------------------------------------------------------- CLI

def cli(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="bruce_replica uptrend", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--data-dir", type=Path, default=DATA_ROOT, help=argparse.SUPPRESS)
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run", help="采集一次（手动补跑也用它）")
    r.add_argument("--scheduled", action="store_true", help="定时入口：当天已有成功快照则跳过")
    r.add_argument("--allow-empty", action="store_true", help="上游名单为空时也保存")
    r.add_argument("--no-page", action="store_true", help="不重新生成页面")
    s = sub.add_parser("show", help="终端查看快照")
    s.add_argument("--date", help="YYYY-MM-DD，默认最近一次成功快照")
    s.add_argument("--limit", type=int, default=50)
    pg = sub.add_parser("page", help="重新生成页面")
    pg.add_argument("--out", type=Path, default=PAGE_PATH)
    ex = sub.add_parser("export", help="导出站点静态数据（BusinessWeb 实验页用）")
    ex.add_argument("--out", type=Path, required=True)
    sc = sub.add_parser("schedule", help="launchd 定时任务")
    sc.add_argument("action", choices=["install", "uninstall", "status"])
    sc.add_argument("--time", action="append", help="北京时间 HH:MM，可重复；默认读配置（23:30、07:00）")
    a = p.parse_args(argv)
    root = a.data_dir
    if a.cmd == "run":
        return run(root, scheduled=a.scheduled, allow_empty=a.allow_empty, make_page=not a.no_page)
    if a.cmd in ("show", "export", "page"):
        rekey_snapshots(root)            # 旧版按采集日命名的快照改为按行情日命名
    if a.cmd == "show":
        return show(root, a.date, a.limit)
    if a.cmd == "export":
        w = export_site(root, a.out)
        print(f"已导出到 {a.out}：更新 {len(w)} 个文件")
        return 0
    if a.cmd == "page":
        print(build_page(root, a.out))
        return 0
    if a.action == "install":
        return schedule_install(a.time, root)
    if a.action == "uninstall":
        return schedule_uninstall()
    return schedule_status(root)


if __name__ == "__main__":
    sys.exit(cli())
