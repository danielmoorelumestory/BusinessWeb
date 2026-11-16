"""无人值守刷新 runner 回归：python -m unittest discover -s tests -p 'test_refresh_runner.py'

门禁纯函数（丢观测/裁头/末日回退/修订/选源切换/EPS 一一对应/子集抓取不可发布），
以及在应用临时副本上的端到端：离线全流程发布、EPS 抓取失败/坏数据回退、门禁失败不发布、
发布中途出错全部回滚、锁占用跳过、提交白名单不含大 raw。不联网。
"""
import copy
import datetime as dt
import json
import os
import shutil
import sys
import tempfile
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
import fetch_data as fd  # noqa: E402
import refresh_runner as rr  # noqa: E402

FIELDS = rr.FIELDS


def rb(path):
    with open(path, "rb") as f:
        return f.read()


def rj(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def fld(d, v):
    return {"d": d, "v": v, "status": "ok", "frequency": "daily",
            "source": {"label": "x", "url": "https://x", "unit": "倍", "method": "m"}}


def payload(fields):
    return {"provider": "p", "series": {"000300.SH": {"fields": fields}}, "errors": []}


class TestDiffRules(unittest.TestCase):
    def test_rules(self):
        old = {f"2026-01-{i:02d}": float(i) for i in range(1, 21)}
        # 原样 → 通过
        self.assertEqual(rr.judge_diff(rr._series_diff(old, dict(old))), [])
        # 区间内丢失 → 拒收
        new = dict(old); new.pop("2026-01-10")
        self.assertTrue(rr.judge_diff(rr._series_diff(old, new)))
        # 末日回退 → 拒收
        new = dict(old); new.pop("2026-01-20")
        self.assertTrue(any("末日回退" in w for w in rr.judge_diff(rr._series_diff(old, new))))
        # 滚动窗口裁头 1 个并新增 1 个（≥90%）→ 通过但记录
        new = dict(old); new.pop("2026-01-01"); new["2026-01-21"] = 21.0
        d = rr._series_diff(old, new)
        self.assertEqual(rr.judge_diff(d), [])
        self.assertEqual(d["headTrim"], ["2026-01-01"])
        # 裁头过多（<90%）→ 拒收
        new = {k: v for k, v in old.items() if k >= "2026-01-05"}
        self.assertTrue(rr.judge_diff(rr._series_diff(old, new)))
        # 修订旧值 → 通过，只记录
        new = dict(old); new["2026-01-05"] = 99.0
        d = rr._series_diff(old, new)
        self.assertEqual(rr.judge_diff(d), [])
        self.assertEqual(d["revised"], [("2026-01-05", 5.0, 99.0)])
        # 整列消失 → 拒收
        self.assertTrue(rr.judge_diff(rr._series_diff(old, {})))


class TestProviderGate(unittest.TestCase):
    def test_field_disappears_rejected_new_field_allowed(self):
        old = payload({"pe": fld(["2026-11-10", "2026-11-11"], [13.0, 13.1])})
        self.assertTrue(rr.provider_gate(old, copy.deepcopy(old))["ok"])
        gone = payload({"pe": {"d": [], "v": [], "status": "unavailable", "reason": "接口失败"}})
        g = rr.provider_gate(old, gone)
        self.assertFalse(g["ok"])
        self.assertIn("000300.SH.pe", g["problems"][0])
        more = payload({"pe": fld(["2026-11-10", "2026-11-11", "2026-11-12"], [13.0, 13.1, 13.2]),
                        "pb": fld(["2026-11-12"], [1.3])})
        g = rr.provider_gate(old, more)
        self.assertTrue(g["ok"])
        self.assertEqual(g["newFields"], 1)

    def test_invalid_new_payload(self):
        self.assertFalse(rr.provider_gate({}, None)["ok"])
        self.assertFalse(rr.provider_gate({}, {"series": []})["ok"])


DJ = "https://danjuanfunds.com/djapi/index_eva/{k}_history/SZ399006?day=all"


def dj_fld(d, v, kind="pe"):
    f = fld(d, v)
    f["frequency"] = "weekly"
    f["source"] = {"label": "蛋卷基金指数估值", "url": DJ.format(k=kind), "unit": "倍", "method": "m"}
    return f


class TestDanjuanRollingTail(unittest.TestCase):
    """蛋卷 {pe,pb,roe}_history = 周一网格 + 最新交易日滚动尾点。
    2026-11-16 浏览器实测创业板：17:09 尾点 11-13（27.506），18:32 后变为 11-16（26.3822），11-13 消失，样本数仍 516。"""

    OLD_D = ["2026-10-26", "2026-11-02", "2026-11-09", "2026-11-13"]
    OLD_V = [30.847, 27.7107, 27.9519, 27.506]
    NEW_D = ["2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16"]
    NEW_V = [30.847, 27.7107, 27.9519, 26.3822]

    def test_rule_only_releases_old_last(self):
        old, new = dict(zip(self.OLD_D, self.OLD_V)), dict(zip(self.NEW_D, self.NEW_V))
        # 通用规则：判为区间内丢失（这就是 2026-11-16 前会让整份 domestic 回退旧缓存的原因）
        self.assertTrue(rr.judge_diff(rr._series_diff(old, new)))
        d = rr._series_diff(old, new, rolling_tail=True)
        self.assertEqual(rr.judge_diff(d), [])
        self.assertEqual(d["tailReplaced"], [("2026-11-13", 27.506)])
        # 丢的是网格点（非旧末日）→ 仍拒收
        bad = dict(new); bad.pop("2026-11-02")
        self.assertTrue(rr.judge_diff(rr._series_diff(old, bad, rolling_tail=True)))
        # 新末日不晚于旧末日 → 末日回退，拒收
        back = {k: v for k, v in old.items() if k != "2026-11-13"}
        self.assertTrue(any("末日回退" in w for w in rr.judge_diff(rr._series_diff(old, back, rolling_tail=True))))
        # 新序列里仍有旧末日 → 不记录替换
        keep = dict(old); keep["2026-11-16"] = 26.3822
        self.assertEqual(rr._series_diff(old, keep, rolling_tail=True)["tailReplaced"], [])

    def test_source_detection(self):
        self.assertTrue(rr.is_rolling_tail_source({"url": DJ.format(k="pb")}))
        self.assertFalse(rr.is_rolling_tail_source({"url": "https://danjuanfunds.com/djapi/index_eva/detail/SZ399006"}))
        self.assertFalse(rr.is_rolling_tail_source({"url": "https://www.csindex.com.cn/x"}))
        self.assertFalse(rr.is_rolling_tail_source(None))

    def test_provider_gate_danjuan_only(self):
        old = payload({"pe": dj_fld(self.OLD_D, self.OLD_V)})
        new = payload({"pe": dj_fld(self.NEW_D, self.NEW_V)})
        g = rr.provider_gate(old, new)
        self.assertTrue(g["ok"], g["problems"])
        self.assertEqual(g["tailReplaced"][0]["replaced"], ["2026-11-13", 27.506])
        # 同样形状但来源不是蛋卷历史 → 仍按丢观测拒收
        g = rr.provider_gate(payload({"pe": fld(self.OLD_D, self.OLD_V)}), payload({"pe": fld(self.NEW_D, self.NEW_V)}))
        self.assertFalse(g["ok"])

    def test_monday_grid_last_is_protected(self):
        """旧末日是周一（网格点）时，即使新末日更晚也不能被删。"""
        old = {"2026-11-09": 27.9519, "2026-11-16": 26.3822}          # 11-16 周一
        new = {"2026-11-09": 27.9519, "2026-11-17": 26.0}             # 11-16 被删
        d = rr._series_diff(old, new, rolling_tail=True)
        self.assertEqual(d["tailReplaced"], [])
        self.assertTrue(any("区间内丢失" in w for w in rr.judge_diff(d)))
        # 正常情况：周一网格保留、周二新尾点追加 → 通过
        ok = {"2026-11-09": 27.9519, "2026-11-16": 26.3822, "2026-11-17": 26.0}
        self.assertEqual(rr.judge_diff(rr._series_diff(old, ok, rolling_tail=True)), [])
        # 周二尾点被周三尾点取代 → 放行
        old2, new2 = dict(ok), {"2026-11-09": 27.9519, "2026-11-16": 26.3822, "2026-11-18": 25.9}
        d = rr._series_diff(old2, new2, rolling_tail=True)
        self.assertEqual(rr.judge_diff(d), [])
        self.assertEqual(d["tailReplaced"], [("2026-11-17", 26.0)])

    def test_tail_gap_limit(self):
        self.assertTrue(rr.is_replaceable_tail("2026-11-13", "2026-11-16"))
        self.assertTrue(rr.is_replaceable_tail("2026-09-30", "2026-10-09"))   # 长假
        self.assertFalse(rr.is_replaceable_tail("2026-11-16", "2026-11-17"))  # 周一网格
        self.assertFalse(rr.is_replaceable_tail("2026-11-13", "2026-11-13"))
        self.assertFalse(rr.is_replaceable_tail("2026-11-13", "2026-12-01"))  # 超过 14 天
        old = {"2026-11-09": 1.0, "2026-11-13": 2.0}
        self.assertTrue(rr.judge_diff(rr._series_diff(old, {"2026-11-09": 1.0, "2026-12-01": 3.0}, rolling_tail=True)))

    @staticmethod
    def _advance(fld_):
        """把一列蛋卷历史按上游规则前移一个交易日，与生产包当前末日无关：
        末日非周一 → 用下一个工作日取代它（临时尾点被替换）；末日是周一 → 保留并追加周二尾点。"""
        last = dt.date.fromisoformat(fld_["d"][-1])
        nxt = last + dt.timedelta(days=1)
        while nxt.weekday() >= 5:
            nxt += dt.timedelta(days=1)
        if last.weekday() != 0:
            fld_["d"][-1], fld_["v"][-1] = nxt.isoformat(), round(fld_["v"][-1] * 0.99, 4)
            return "replaced"
        fld_["d"].append(nxt.isoformat())
        fld_["v"].append(round(fld_["v"][-1] * 0.99, 4))
        return "appended"

    def test_replay_real_domestic_cache(self):
        """用仓库里真实的 domestic.json（无论当前末日是哪天）模拟蛋卷尾点前移一个交易日，两轮。"""
        cur = rj(os.path.join(HERE, "data", "providers", "domestic.json"))
        for _ in range(2):
            nxt = copy.deepcopy(cur)
            kinds = []
            for node in nxt["series"].values():
                for f in node["fields"].values():
                    if f.get("status") == "ok" and rr.is_rolling_tail_source(f.get("source")) and f["d"]:
                        kinds.append(self._advance(f))
            self.assertGreater(len(kinds), 20)
            g = rr.provider_gate(cur, nxt)
            self.assertTrue(g["ok"], g["problems"][:5])
            self.assertEqual(len(g["tailReplaced"]), kinds.count("replaced"))
            cur = nxt
        # 周一网格末日被删 → 拒收
        bad = copy.deepcopy(cur)
        f = bad["series"]["399006.SZ"]["fields"]["pe"]
        mondays = [i for i, x in enumerate(f["d"]) if dt.date.fromisoformat(x).weekday() == 0]
        f["d"], f["v"] = f["d"][:mondays[-1]], f["v"][:mondays[-1]]
        f["d"].append((dt.date.fromisoformat(cur["series"]["399006.SZ"]["fields"]["pe"]["d"][-1])
                       + dt.timedelta(days=1)).isoformat())
        f["v"].append(25.0)
        self.assertFalse(rr.provider_gate(cur, bad)["ok"])

    @staticmethod
    def _dj_bundle(dates, pe, pe_url=DJ.format(k="pe")):
        s = {"code": "399006.SZ", "name": "创业板指", "category": "全局坐标", "market": "A", "componentNum": 100,
             "componentDate": "2026-11-13", "d": list(dates), "sources": {}, "availability": {}}
        for f in FIELDS:
            s[f] = [None] * len(dates)
        s["price"] = [2300.0 + i for i in range(len(dates))]
        s["pe"] = list(pe)
        for f in ("price", "pe"):
            prov = {"pe": "domestic", "price": "tencent"}[f]
            s["availability"][f] = {"status": "ok", "provider": prov, "count": sum(v is not None for v in s[f]),
                                    "candidates": [{"provider": prov, "selected": True}]}
            s["sources"][f] = {"unit": {"pe": "倍", "price": "点"}[f], "provider": prov}
        s["sources"]["pe"]["url"] = pe_url
        for f in FIELDS:
            s["availability"].setdefault(f, {"status": "unavailable", "provider": None, "count": 0, "candidates": []})
        return {"asOf": dates[-1], "indices": [s]}

    def test_bundle_gate_fixture(self):
        """独立的确定性数据包 fixture（不依赖生产包当前日期）。"""
        d = ["2026-11-09", "2026-11-13", "2026-11-16"]
        old = self._dj_bundle(d, [27.9519, 27.506, None])
        new = self._dj_bundle(d, [27.9519, None, 26.3822])
        g = rr.bundle_gate(old, new, fd, None)
        self.assertTrue(g["ok"], g["problems"])
        self.assertEqual(g["tailReplaced"], [{"code": "399006.SZ", "field": "pe", "replaced": ["2026-11-13", 27.506],
                                             "newLast": "2026-11-16"}])
        # 周一网格末日被删 → 拒收
        d2 = ["2026-11-09", "2026-11-16", "2026-11-17"]
        g = rr.bundle_gate(self._dj_bundle(d2, [27.9519, 26.3822, None]),
                           self._dj_bundle(d2, [27.9519, None, 26.0]), fd, None)
        self.assertFalse(g["ok"])
        # 同样形状但来源不是蛋卷历史（如中证 peg）→ 拒收
        csi = "https://www.csindex.com.cn/csindex-home/perf/indexCsiDsPe?indexCode=399006"
        g = rr.bundle_gate(self._dj_bundle(d, [27.9519, 27.506, None], csi),
                           self._dj_bundle(d, [27.9519, None, 26.3822], csi), fd, None)
        self.assertFalse(g["ok"])

RAW = {"capturedAt": "2026-11-16T12:30:00Z", "page": "https://lishenqi.vip/#/panorama", "range": "all",
       "via": "x", "panelDay": "20261116", "unitEps": "yuan", "roster": {}, "errors": [],
       "series": {"000001.SH": {"origCode": "000001.SH", "origName": "上证指数", "freq": "week", "step": 5,
                                "first": "20261103", "last": "20261113", "points": 2, "dailyPoints": 10,
                                "shards": 1, "errors": [], "d": ["20261103", "20261113"], "eps": [0.8, 0.79]}}}


class TestEpsGate(unittest.TestCase):
    def new(self, **kw):
        r = copy.deepcopy(RAW)
        r["series"]["000001.SH"]["d"].append("20261116")
        r["series"]["000001.SH"]["eps"].append(0.79)
        r.update(kw)
        return r

    def test_ok_and_rejections(self):
        self.assertTrue(rr.eps_capture_gate(RAW, self.new())["ok"])
        self.assertFalse(rr.eps_capture_gate(RAW, self.new(errors=["000300.SH: rate limited"]))["ok"])
        self.assertFalse(rr.eps_capture_gate(RAW, self.new(onlyCodes=["000001.SH"]))["ok"])  # 子集不可发布
        self.assertFalse(rr.eps_capture_gate(RAW, self.new(unitEps="point"))["ok"])
        self.assertFalse(rr.eps_capture_gate(RAW, self.new(series={}))["ok"])  # 旧有 EPS 本次缺失
        shrunk = self.new()
        shrunk["series"]["000001.SH"].update(d=["20261103"], eps=[0.8])
        self.assertFalse(rr.eps_capture_gate(RAW, shrunk)["ok"])  # 末日回退
        big = copy.deepcopy(RAW)
        big["series"]["000001.SH"].update(d=[f"202610{i:02d}" for i in range(1, 11)], eps=[0.8] * 10)
        few = copy.deepcopy(big)
        few["series"]["000001.SH"].update(d=["20261001", "20261005", "20261010"], eps=[0.8] * 3)
        self.assertFalse(rr.eps_capture_gate(big, few)["ok"])  # 样本数明显减少
        daily = self.new()
        daily["series"]["000001.SH"].update(freq="day", step=1)
        self.assertFalse(rr.eps_capture_gate(RAW, daily)["ok"])

    def test_grid_shift_is_accepted(self):
        # 2026-11-16 实测：原站 step=5 网格以最新交易日为锚，每天整体平移，新旧日期可以完全不重合
        shifted = copy.deepcopy(RAW)
        shifted["series"]["000001.SH"].update(d=["20261104", "20261116"], eps=[0.8, 0.79], first="20261104",
                                              last="20261116")
        g = rr.eps_capture_gate(RAW, shifted)
        self.assertTrue(g["ok"], g["problems"])
        late = copy.deepcopy(shifted)
        late["series"]["000001.SH"]["d"] = ["20261201", "20261202"]
        self.assertFalse(rr.eps_capture_gate(RAW, late)["ok"])  # 最早日推迟过多

    def test_subset_smoke(self):
        sub = self.new(onlyCodes=["000001.SH"])
        g = rr.eps_capture_gate(RAW, sub, subset=["000001.SH"])
        self.assertTrue(g["ok"], g["problems"])
        self.assertEqual(g["detail"]["000001.SH"]["last"], "20261116")
        self.assertFalse(rr.eps_capture_gate(RAW, sub, subset=["000001.SH", "399006.SZ"])["ok"])


def mini_bundle(pe_provider="domestic", pe=(13.0, 13.1), eps=(None, None)):
    n = 2
    s = {"code": "000300.SH", "name": "沪深300", "category": "核心宽基", "market": "A", "componentNum": 300,
         "componentDate": "2026-11-11", "d": ["2026-11-10", "2026-11-11"], "sources": {}, "availability": {}}
    for f in FIELDS:
        s[f] = [None] * n
    s["price"] = [4000.0, 4010.0]
    s["pe"] = list(pe)
    s["eps"] = list(eps)
    for f in FIELDS:
        cnt = sum(v is not None for v in s[f])
        prov = {"pe": pe_provider, "eps": "original_eps", "price": "tencent"}.get(f)
        s["availability"][f] = {"status": "ok" if cnt else "unavailable", "provider": prov if cnt else None,
                                "count": cnt, "candidates": [{"provider": prov, "selected": True}] if cnt else []}
        if cnt:
            s["sources"][f] = {"unit": {"pe": "倍", "eps": "元", "price": "点"}[f], "provider": prov}
    return {"asOf": "2026-11-11", "indices": [s]}


class TestBundleGate(unittest.TestCase):
    def test_identical_ok_switch_and_loss_rejected(self):
        old = mini_bundle()
        self.assertTrue(rr.bundle_gate(old, copy.deepcopy(old), fd, None)["ok"])
        g = rr.bundle_gate(old, mini_bundle(pe_provider="supplemental"), fd, None)
        self.assertFalse(g["ok"])
        self.assertTrue(any("来源切换" in p for p in g["problems"]))
        g = rr.bundle_gate(old, mini_bundle(pe=(13.0, None)), fd, None)
        self.assertFalse(g["ok"])
        gone = copy.deepcopy(old)
        gone["indices"] = []
        self.assertFalse(rr.bundle_gate(old, gone, fd, None)["ok"])

    def test_revision_recorded_not_rejected(self):
        g = rr.bundle_gate(mini_bundle(), mini_bundle(pe=(12.9, 13.1)), fd, None)
        self.assertTrue(g["ok"], g["problems"])
        self.assertEqual(g["revisions"][0]["field"], "pe")

    def test_eps_must_match_raw(self):
        raw = {"series": {"000300.SH": {"d": ["20261110", "20261111"], "eps": [1.07, 1.08]}}}
        good = mini_bundle(eps=(1.07, 1.08))
        self.assertTrue(rr.bundle_gate(good, copy.deepcopy(good), fd, raw)["ok"])
        bad = mini_bundle(eps=(1.07, 1.09))
        self.assertFalse(rr.bundle_gate(good, bad, fd, raw)["ok"])


class TestCommitPaths(unittest.TestCase):
    def test_whitelist(self):
        paths = rr.commit_paths(HERE)
        self.assertIn("data-bundle.js", paths)
        self.assertIn("data/providers/original_eps_raw/capture.json", paths)
        self.assertTrue(any(p.startswith("data/providers/domestic_raw/accum_") for p in paths))
        for p in paths:
            self.assertFalse("shiller" in p or "/csi_pe_" in p or "/dj_pb_" in p or "refresh-work" in p
                             or "refresh-backups" in p or p.endswith(".log"), p)


IGNORE = shutil.ignore_patterns(".venv", "__pycache__", "refresh-work", "refresh-backups", "screenshots",
                                "evidence", "tasks", "assets", ".refresh-runner.lock")


@unittest.skipUnless(os.path.exists(os.path.join(HERE, "data-bundle.js")), "缺生产数据包")
class TestEndToEnd(unittest.TestCase):
    """在应用临时副本上跑 runner；绝不触碰真实生产目录、不联网。"""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="panorama-runner-")
        cls.app = os.path.join(cls.tmp, "app")
        shutil.copytree(HERE, cls.app, ignore=IGNORE)
        cls.orig = rr.read_bundle(os.path.join(HERE, "data-bundle.js"))

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def runner(self, **kw):
        kw.setdefault("work_root", os.path.join(self.tmp, "work"))
        return rr.Runner(self.app, kw.pop("mode", "offline"), kw.pop("skip_eps", True), step_timeout=600, **kw)

    def snapshot(self):
        with open(os.path.join(self.app, "data-bundle.js"), "rb") as f:
            return f.read()

    def test_1_offline_full_run_publishes_identical_data(self):
        out = os.path.join(self.tmp, "public", "data-bundle.js")
        r = self.runner(bundle_out=out)
        code = r.run()
        self.assertEqual(code, rr.EXIT_PARTIAL, json.dumps(r.report["steps"], ensure_ascii=False)[:2000])
        self.assertTrue(r.report["published"])
        self.assertFalse(os.path.exists(os.path.join(self.app, "data", ".refresh-runner.lock")))
        new = rr.read_bundle(os.path.join(self.app, "data-bundle.js"))
        self.assertEqual(rr.read_bundle(out)["generatedAt"], new["generatedAt"])
        O, N = rr.bundle_maps(self.orig), rr.bundle_maps(new)
        self.assertEqual(set(O), set(N))
        for code_, o in O.items():
            for f in FIELDS:
                om = {d: v for d, v in zip(o["d"], o[f]) if v is not None}
                nm = {d: v for d, v in zip(N[code_]["d"], N[code_][f]) if v is not None}
                self.assertEqual(om, nm, f"{code_}.{f}")
        rep = rj(os.path.join(self.app, "reports/refresh/last-refresh.json"))
        self.assertEqual(rep["status"], "partial")
        with open(os.path.join(self.app, "reports/refresh/last-refresh.md"), encoding="utf-8") as f:
            md = f.read()
        self.assertIn("生成时间不等于数据时间", md)
        self.assertIn("仅缓存", md)

    def test_2_eps_capture_failure_and_bad_data_fall_back(self):
        raw_rel = "data/providers/original_eps_raw/capture.json"
        old = rb(os.path.join(self.app, raw_rel))
        for capture, expect in ((lambda *a, **k: (_ for _ in ()).throw(TimeoutError("PANO_IX 未就绪")), "抓取失败"),
                                (lambda *a, **k: dict(json.loads(old), errors=["399006.SZ: 429"]), "未通过门禁")):
            r = self.runner(mode="online", skip_eps=False, capture=capture)
            os.makedirs(r.work, exist_ok=True)
            r.prepare()
            r.s4_eps("2026-11-13")
            self.assertEqual(r.steps[-1]["status"], "fallback")
            self.assertIn(expect, r.steps[-1]["detail"])
            self.assertEqual(rb(r.stg(raw_rel)), old)
            shutil.rmtree(r.work, ignore_errors=True)

    def test_3_eps_capture_success_reparses(self):
        raw_rel = "data/providers/original_eps_raw/capture.json"
        old = rj(os.path.join(self.app, raw_rel))
        new = copy.deepcopy(old)
        new["capturedAt"] = "2026-11-16T12:31:00Z"
        r = self.runner(mode="online", skip_eps=False, capture=lambda *a, **k: new)
        os.makedirs(r.work, exist_ok=True)
        r.prepare()
        r.s4_eps("2026-11-13")
        self.assertEqual(r.steps[-1]["status"], "ok", r.steps[-1])
        prov = rj(r.stg("data/providers/original_eps.json"))
        self.assertEqual(prov["retrievedAt"], "2026-11-16T12:31:00Z")
        shutil.rmtree(r.work, ignore_errors=True)

    def test_4_gate_failure_does_not_publish(self):
        before = self.snapshot()
        r = self.runner()
        with mock.patch.object(rr.Runner, "s6_verify", return_value=False):
            code = r.run()
        self.assertEqual(code, rr.EXIT_FAILED)
        self.assertFalse(r.report["published"])
        self.assertEqual(self.snapshot(), before)
        rep = rj(os.path.join(self.app, "reports/refresh/last-refresh.json"))
        self.assertEqual(rep["status"], "failed")
        self.assertTrue(os.path.isdir(os.path.join(self.app, rep["workDir"])) if not os.path.isabs(rep["workDir"]) else True)

    def test_5_publish_error_rolls_back(self):
        r = self.runner()
        os.makedirs(r.work, exist_ok=True)
        r.prepare()
        # staging 里制造两处差异，第二次写入时出错
        for rel in ("data/manifest.json", "data-bundle.js"):
            with open(r.stg(rel), "ab") as f:
                f.write(b"\n")
        before = {rel: rb(r.prod(rel)) for rel in ("data/manifest.json", "data-bundle.js")}
        real = rr.atomic_write_bytes
        calls = {"n": 0}

        def flaky(path, data):
            calls["n"] += 1
            if calls["n"] == 2:
                raise OSError("磁盘满（模拟）")
            return real(path, data)
        with mock.patch.object(rr, "atomic_write_bytes", side_effect=flaky):
            ok = r.publish()
        self.assertFalse(ok)
        for rel, b in before.items():
            self.assertEqual(rb(r.prod(rel)), b, rel)
        shutil.rmtree(r.work, ignore_errors=True)

    def test_7_online_s1_keeps_source_layout(self):
        """在线 S1：腾讯 --no-csi + 只对生产已有中证 store 的指数 --only；新出现的中证 store 被丢弃（不改选源）。"""
        r = self.runner(mode="online")
        os.makedirs(r.work, exist_ok=True)
        r.prepare()
        self.assertEqual(r.csi_codes_in_prod(), ["932000.CSI"])
        calls = []

        def fake(args, name, timeout=None):
            calls.append(args)
            if "--only" in args:  # 模拟 fetch_data 顺带新建 indicator store
                with open(r.stg("data/store/indicator_932000_CSI.csv"), "w", encoding="utf-8") as f:
                    f.write("date,pe1,pe2,dy1,dy2\n")
            return 0, ""
        with mock.patch.object(r, "run_cmd", side_effect=fake):
            self.assertTrue(r.s1_market())
        self.assertIn("--no-csi", calls[0])
        self.assertEqual(calls[1][calls[1].index("--only") + 1], "932000.CSI")
        self.assertFalse(os.path.exists(r.stg("data/store/indicator_932000_CSI.csv")))
        self.assertIn("丢弃", r.steps[-1]["detail"])
        shutil.rmtree(r.work, ignore_errors=True)

    def test_6_lock_skips_and_keeps_foreign_lock(self):
        lock = os.path.join(self.app, "data", ".refresh-runner.lock")
        os.makedirs(lock)
        try:
            r = self.runner()
            self.assertEqual(r.run(), rr.EXIT_LOCKED)
            self.assertTrue(os.path.isdir(lock))
        finally:
            shutil.rmtree(lock)


if __name__ == "__main__":
    unittest.main()
