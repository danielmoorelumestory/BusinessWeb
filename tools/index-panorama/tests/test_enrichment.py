"""ROUND2 provider 集成回归：python3 -m unittest discover -s tests -p 'test_enrichment.py'

覆盖：provider schema 校验、单位、等长/日期、整列选源（不跨源逐日拼接）、amt/volume 保留行情源、
周末月末报告日不被价格日历删除、componentNum 只收带日期+来源的披露、缓存缺失空态、
--enrich-only / --offline 严格不联网且不改 provider 缓存、前后覆盖报告。
"""
import hashlib
import json
import os
import socket
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import fetch_data as fd  # noqa: E402

SRC = {"label": "测试来源", "url": "https://example.org/x", "unit": "倍", "method": "TTM 滚动"}
A_META = dict(code="000300.SH", name="沪深300", category="核心宽基", description="", floor="2004-12-31",
              market="A", tsym="sh000300", csi="000300", cache=None)
HK_META = dict(code="HSI.HK", name="恒生指数", category="跨境对照", description="", floor="1964-07-31",
               market="HK", tsym="hkHSI", csi=None, cache=None)


def _sha(p):
    with open(p, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def _json(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def fld(d, v, unit="倍", freq="daily", status="ok", **src):
    return {"d": d, "v": v, "source": dict(SRC, unit=unit, **src), "frequency": freq, "status": status, "reason": ""}


def provider(name, series, status="ok"):
    """构造并规范化一份 provider 输出。"""
    raw = {"provider": name, "retrievedAt": "2026-11-15T00:00:00Z", "series": series, "errors": []}
    p = fd.normalize_provider_payload(name, raw, {"000300.SH", "HSI.HK", "000001.SH"})
    if status != "ok":
        p["status"] = status
    return p


def prices(*pairs, amt=None, vol=None):
    return [{"date": d, "close": c, "volume": vol, "amt": amt, "src": "tencent"} for d, c in pairs]


class TestFieldSchema(unittest.TestCase):
    def test_valid_field_and_nulls_not_zero(self):
        n = fd.normalize_provider_field("pe", fld(["2026-11-11", "2026-11-12"], [13.1, None]))
        self.assertEqual(n["status"], "ok")
        self.assertEqual((n["d"], n["v"]), (["2026-11-11"], [13.1]))  # null 只是缺失，不当 0

    def test_rejects_structural_errors(self):
        cases = {
            "不等长": fld(["2026-11-11", "2026-11-12"], [1.0]),
            "升序": fld(["2026-11-12", "2026-11-11"], [1.0, 2.0]),
            "重复": fld(["2026-11-11", "2026-11-11"], [1.0, 1.0]),
            "ISO": fld(["20261111"], [1.0]),
            "有限": fld(["2026-11-11"], [float("nan")]),
            "布尔": fld(["2026-11-11"], [True]),
            "字符串": fld(["2026-11-11"], ["13.1"]),
        }
        for name, raw in cases.items():
            n = fd.normalize_provider_field("pe", raw)
            self.assertEqual(n["status"], "rejected", name)
            self.assertEqual(n["v"], [], name)

    def test_units_follow_contract(self):
        ok = [("pe", "倍"), ("pb", "倍"), ("dy", "%"), ("dy", "%（1=1%）"), ("turn", "百分数"), ("roe", "%"),
              ("mcap", "亿元"), ("amt", "亿元"), ("volume", "股"), ("eps", "元/股"), ("bps", "元")]
        bad = [("dy", "小数"), ("dy", ""), ("mcap", "万元"), ("mcap", "元"), ("amt", "万元"), ("pe", "%"),
               ("volume", "手"), ("eps", "指数点"), ("bps", "点")]
        for f, u in ok:
            self.assertEqual(fd.normalize_provider_field(f, fld(["2026-11-11"], [1.0], unit=u))["status"], "ok", (f, u))
        for f, u in bad:
            n = fd.normalize_provider_field(f, fld(["2026-11-11"], [1.0], unit=u))
            self.assertEqual(n["status"], "rejected", (f, u))
            self.assertIn("单位", n["reason"])

    def test_requires_source_method_and_frequency(self):
        self.assertIn("label/url", fd.normalize_provider_field("pe", fld(["2026-11-11"], [1.0], url=""))["reason"])
        self.assertIn("method", fd.normalize_provider_field("pe", fld(["2026-11-11"], [1.0], method=""))["reason"])
        self.assertIn("频率", fd.normalize_provider_field("pe", fld(["2026-11-11"], [1.0], freq="hourly"))["reason"])
        self.assertEqual(fd.normalize_provider_field("pe", fld(["2026-10-31"], [1.0], freq="月"))["frequency"], "monthly")

    def test_unavailable_keeps_reason(self):
        n = fd.normalize_provider_field("pb", {"d": [], "v": [], "status": "unavailable", "reason": "官网403", "source": {}})
        self.assertEqual((n["status"], n["reason"]), ("unavailable", "官网403"))
        n = fd.normalize_provider_field("pb", {"d": ["2026-11-11"], "v": [1.0], "status": "unavailable", "source": SRC})
        self.assertEqual(n["status"], "rejected")  # 状态与数据矛盾

    def test_payload_level(self):
        p = fd.normalize_provider_payload("domestic", {"provider": "supplemental", "series": {}}, set())
        self.assertEqual(p["status"], "invalid")
        p = fd.normalize_provider_payload("domestic", {"provider": "domestic", "series": {
            "ZZZ.XX": {"fields": {}}, "000300.SH": {"fields": {"price": fld(["2026-11-11"], [1.0], unit="点")}}}},
            {"000300.SH"})
        self.assertEqual(p["unknownCodes"], ["ZZZ.XX"])
        self.assertTrue(any("price" in r for r in p["rejected"]))  # 点位不允许由 provider 覆盖


    def test_non_object_fields_rejected_not_crash(self):
        for bad in (["bad"], "bad", 3):
            p = fd.normalize_provider_payload("domestic", {"provider": "domestic", "series": {
                "000300.SH": {"fields": bad, "componentNum": {
                    "value": 300, "date": "2026-11-11", "source": {"label": "中证", "url": "https://x"}}},
                "HSI.HK": {"fields": {"pe": fld(["2026-11-13"], [10.0])}}}}, {"000300.SH", "HSI.HK"})
            self.assertEqual(p["status"], "ok", bad)
            self.assertEqual(p["series"]["000300.SH"]["fields"], {}, bad)
            self.assertTrue(any("000300.SH.fields" in r and "不是对象" in r for r in p["rejected"]), bad)
            self.assertEqual(p["series"]["000300.SH"]["componentNum"]["value"], 300)  # 同节点其他合法内容保留
            self.assertEqual(p["series"]["HSI.HK"]["fields"]["pe"]["status"], "ok")    # 其他指数不受影响
            s = fd.build_series(A_META, prices(("2026-11-13", 4000.0)), [], [], "2005-01-01", [], providers=[p])
            self.assertEqual(s["pe"], [None])
            self.assertEqual(fd.validate_bundle({"indices": [s]}), [])


class TestComponent(unittest.TestCase):
    def test_component_requires_date_and_source(self):
        good = {"value": 300, "date": "2026-11-11", "source": {"label": "中证", "url": "https://x"}}
        self.assertEqual(fd.normalize_component(good)[0]["value"], 300)
        self.assertIsNone(fd.normalize_component(dict(good, date=None))[0])
        self.assertIsNone(fd.normalize_component(dict(good, source={"label": "中证"}))[0])
        self.assertIsNone(fd.normalize_component(dict(good, value=300.5))[0])
        self.assertIsNone(fd.normalize_component(dict(good, value=0))[0])

    def test_latest_dated_disclosure_wins_and_reason_kept(self):
        csi = [{"date": "2026-11-11", "close": 4000.0, "amt": 1.0, "pe": None, "cons": 300}]
        p1 = provider("supplemental", {"000300.SH": {"fields": {}, "componentNum": {
            "value": 301, "date": "2026-11-13", "source": {"label": "中证官网", "url": "https://x", "method": "披露"}}}})
        s = fd.build_series(A_META, prices(("2026-11-13", 4000.0)), csi, [], "2005-01-01", [], providers=[p1])
        self.assertEqual((s["componentNum"], s["componentDate"]), (301, "2026-11-13"))
        self.assertEqual(s["sources"]["componentNum"]["provider"], "supplemental")
        p2 = provider("supplemental", {"HSI.HK": {"fields": {}, "componentNum": {"value": 82, "source": SRC}}})
        s = fd.build_series(HK_META, prices(("2026-11-13", 26000.0)), [], [], "2005-01-01", [], providers=[p2])
        self.assertIsNone(s["componentNum"])
        self.assertIn("日期", s["availability"]["componentNum"]["reason"])

    def test_future_component_disclosure_rejected_with_reason(self):
        csi = [{"date": "2026-11-11", "close": 4000.0, "amt": 1.0, "pe": None, "cons": 300}]
        fut = provider("supplemental", {"000300.SH": {"fields": {}, "componentNum": {
            "value": 999, "date": "2099-01-01", "source": {"label": "QA", "url": "https://x", "method": "未来"}}}})
        s = fd.build_series(A_META, prices(("2026-11-13", 4000.0)), csi, [], "2005-01-01", [],
                            providers=[fut], until="2026-11-15")
        self.assertEqual((s["componentNum"], s["componentDate"]), (300, "2026-11-11"))  # 回落到真实已披露值
        self.assertEqual(s["availability"]["componentNum"]["provider"], "csi")
        self.assertTrue(any("2099-01-01" in r and "未来" in r for r in s["availability"]["componentNum"]["rejected"]))
        s = fd.build_series(HK_META, prices(("2026-11-13", 26000.0)), [], [], "2005-01-01", [],
                            providers=[provider("supplemental", {"HSI.HK": {"fields": {}, "componentNum": {
                                "value": 85, "date": "2099-01-01", "source": {"label": "QA", "url": "https://x"}}}})],
                            until="2026-11-15")
        self.assertIsNone(s["componentNum"])
        self.assertIsNone(s["componentDate"])
        self.assertIn("2099-01-01", s["availability"]["componentNum"]["reason"])
        self.assertEqual(fd.validate_bundle({"indices": [s]}), [])


class TestMergeAndSelection(unittest.TestCase):
    def test_weekend_month_end_report_kept_and_aligned(self):
        # 2026-10-31 是周六：月末估值报告日不能因价格日历被删
        p = provider("domestic", {"000300.SH": {"fields": {
            "pb": fld(["2026-09-30", "2026-10-31"], [1.40, 1.45], freq="monthly")}}})
        s = fd.build_series(A_META, prices(("2026-10-30", 4000.0), ("2026-11-02", 4010.0)), [], [],
                            "2005-01-01", [], providers=[p], until="2026-11-15")
        self.assertEqual(s["d"], ["2026-09-30", "2026-10-30", "2026-10-31", "2026-11-02"])
        self.assertEqual(s["pb"], [1.40, None, 1.45, None])
        self.assertEqual(s["price"], [None, 4000.0, None, 4010.0])
        self.assertEqual(s["chg"], [None, None, None, 0.25])  # 涨跌只连真实价格观测
        for f in fd.FIELDS:
            self.assertEqual(len(s[f]), len(s["d"]), f)
        self.assertEqual(s["availability"]["pb"]["frequency"], "monthly")
        self.assertEqual(s["sources"]["pb"]["frequency"], "monthly")
        self.assertTrue(any("月频" in w for w in s["warnings"]))
        self.assertEqual(fd.validate_bundle({"indices": [s]}), [])

    def test_whole_column_choice_never_mixes_sources(self):
        csi = [{"date": "2026-11-10", "close": 4000.0, "amt": None, "pe": 99.0, "cons": None}]
        p = provider("domestic", {"000300.SH": {"fields": {
            "pe": fld(["2026-11-11", "2026-11-12", "2026-11-13"], [13.1, 13.2, 13.3])}}})
        s = fd.build_series(A_META, prices(("2026-11-13", 4000.0)), csi, [], "2005-01-01", [], providers=[p])
        self.assertEqual(s["pe"], [None, 13.1, 13.2, 13.3])  # 中证 2026-11-10 的 99 不被拼入
        self.assertEqual(s["availability"]["pe"]["provider"], "domestic")
        self.assertEqual(s["sources"]["pe"]["label"], "测试来源")
        sel = [c for c in s["availability"]["pe"]["candidates"] if c["selected"]]
        self.assertEqual([c["provider"] for c in sel], ["domestic"])
        other = [c for c in s["availability"]["pe"]["candidates"] if not c["selected"]][0]
        self.assertIn("不跨源", other["reason"])
        # 反过来：现有源样本更多时整列保留现有源，provider 值一个也不进
        csi2 = [{"date": f"2026-11-{x:02d}", "close": 4000.0, "amt": None, "pe": 12.0 + x / 100, "cons": None}
                for x in (9, 10, 11, 12)]
        p2 = provider("domestic", {"000300.SH": {"fields": {"pe": fld(["2026-11-13"], [55.0])}}})
        s = fd.build_series(A_META, prices(("2026-11-13", 4000.0)), csi2, [], "2005-01-01", [], providers=[p2])
        self.assertNotIn(55.0, s["pe"])
        self.assertEqual(s["availability"]["pe"]["provider"], "csi")

    def test_two_providers_tie_break_and_stale(self):
        old = fld([f"201{x}-12-31" for x in range(5)], [10.0, 11, 12, 13, 14], freq="annual")
        cur = fld(["2026-10-30", "2026-11-13"], [20.0, 21.0])
        pa = provider("domestic", {"000300.SH": {"fields": {"pe": old}}})
        pb = provider("supplemental", {"000300.SH": {"fields": {"pe": cur}}})
        s = fd.build_series(A_META, prices(("2026-11-13", 4000.0)), [], [], "2005-01-01", [],
                            providers=[pa, pb], until="2026-11-15")
        self.assertEqual(s["availability"]["pe"]["provider"], "supplemental")  # 陈旧长序列让位于在更新的序列
        self.assertNotIn(10.0, s["pe"])
        same = fld(["2026-11-13"], [9.0])
        s = fd.build_series(A_META, prices(("2026-11-13", 4000.0)), [], [], "2005-01-01", [],
                            providers=[provider("domestic", {"000300.SH": {"fields": {"pe": same}}}),
                                       provider("supplemental", {"000300.SH": {"fields": {"pe": fld(["2026-11-13"], [8.0])}}})])
        self.assertEqual(s["availability"]["pe"]["provider"], "domestic")  # 同分按固定次序

    def test_amt_volume_keep_existing_market_data(self):
        p = provider("supplemental", {
            "000300.SH": {"fields": {"amt": fld(["2026-11-13"], [1.0], unit="亿元")}},
            "HSI.HK": {"fields": {"amt": fld(["2026-11-13"], [1200.5], unit="亿元"),
                                  "volume": fld(["2026-11-13"], [1.5e10], unit="股")}}})
        s = fd.build_series(A_META, prices(("2026-11-13", 4000.0), amt=4421.28, vol=1e10), [], [],
                            "2005-01-01", [], providers=[p])
        self.assertEqual(s["amt"], [4421.28])
        self.assertEqual(s["availability"]["amt"]["provider"], "tencent")
        h = fd.build_series(HK_META, prices(("2026-11-13", 26000.0)), [], [], "2005-01-01", [], providers=[p])
        self.assertEqual(h["amt"], [1200.5])
        self.assertEqual(h["volume"], [15000000000])
        self.assertIsInstance(h["volume"][0], int)
        self.assertEqual(fd.validate_bundle({"indices": [s, h]}), [])

    def test_trim_before_floor_and_future(self):
        p = provider("domestic", {"000300.SH": {"fields": {
            "pe": fld(["2003-06-30", "2026-11-13", "2026-12-31"], [30.0, 13.0, 12.0])}}})
        s = fd.build_series(A_META, prices(("2026-11-13", 4000.0)), [], [], "2005-01-01", [],
                            providers=[p], until="2026-11-15")
        self.assertEqual((s["d"], s["pe"]), (["2026-11-13"], [13.0]))
        c = s["availability"]["pe"]["candidates"][-1]
        self.assertEqual((c["count"], c["rawCount"]), (1, 3))

    def test_provider_not_ok_is_ignored_and_reasons_recorded(self):
        bad = provider("domestic", {"000300.SH": {"fields": {"pe": fld(["2026-11-13"], [13.0])}}}, status="missing")
        rej = provider("supplemental", {"000300.SH": {"fields": {
            "pb": fld(["2026-11-13"], [1.3], unit="%"),
            "dy": {"d": [], "v": [], "status": "unavailable", "reason": "官网无股息率", "source": {}}}}})
        s = fd.build_series(A_META, prices(("2026-11-13", 4000.0)), [], [], "2005-01-01", [], providers=[bad, rej])
        self.assertEqual(s["pe"], [None])
        self.assertEqual(s["pb"], [None])
        self.assertIn("单位", s["availability"]["pb"]["reason"])
        self.assertIn("官网无股息率", s["availability"]["dy"]["reason"])
        self.assertEqual(s["availability"]["pb"]["status"], "unavailable")

    def test_validate_catches_bad_availability_and_unit(self):
        p = provider("domestic", {"000300.SH": {"fields": {"pe": fld(["2026-11-13"], [13.0])}}})
        s = fd.build_series(A_META, prices(("2026-11-13", 4000.0)), [], [], "2005-01-01", [], providers=[p])
        s["availability"]["pe"]["count"] = 5
        s["sources"]["pe"]["unit"] = "%"
        errs = fd.validate_bundle({"indices": [s]})
        self.assertTrue(any("availability.count" in e for e in errs))
        self.assertTrue(any("单位" in e for e in errs))


class TestCacheAndModes(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        t = self.tmp.name
        self.paths = dict(STORE=os.path.join(t, "store"), BUNDLE=os.path.join(t, "data-bundle.js"),
                          MANIFEST=os.path.join(t, "manifest.json"), PROVIDER_DIR=os.path.join(t, "providers"),
                          BASELINE=os.path.join(t, "baseline.json"), COVERAGE_REPORT=os.path.join(t, "cov.json"),
                          CACHE_DIR=os.path.join(t, "nocache"))
        os.makedirs(self.paths["STORE"])
        os.makedirs(self.paths["PROVIDER_DIR"])
        self.patches = [mock.patch.object(fd, k, v) for k, v in self.paths.items()]
        self.patches.append(mock.patch.object(fd, "INDICES", [
            dict(code="000001.SH", name="上证指数", category="全局坐标", description="", tsym="sh000001", csi="000001",
                 cache=None, floor="1990-12-19", market="A"),
            dict(HK_META)]))
        for p in self.patches:
            p.start()
        fd.write_store(fd.store_path("price", "000001.SH"), [
            {"date": "2026-10-30", "close": 3600.0, "volume": 1e10, "amt": 5000.0, "src": "tencent"},
            {"date": "2026-11-13", "close": 3634.35, "volume": 1.1e10, "amt": 5100.0, "src": "tencent"}], fd.PRICE_COLS)
        fd.write_store(fd.store_path("price", "HSI.HK"), [
            {"date": "2026-11-13", "close": 26000.0, "volume": None, "amt": None, "src": "tencent"}], fd.PRICE_COLS)
        with open(self.paths["BASELINE"], "w", encoding="utf-8") as f:
            json.dump({"asOf": "2026-11-13", "rows": [
                {"code": "000001.SH", "name": "上证指数", "componentNum": None,
                 "fields": {x: {"count": 0, "first": None, "last": None} for x in fd.FIELDS}}]}, f)

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    def write_provider(self, name, series):
        path = os.path.join(self.paths["PROVIDER_DIR"], f"{name}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"provider": name, "retrievedAt": "2026-11-15T01:00:00Z", "series": series, "errors": []}, f)
        return path

    def run_main(self, argv):
        def no_get(url, **kw):
            raise AssertionError(f"不应联网：{url}")

        def no_socket(*a, **k):
            raise AssertionError("不应建立网络连接")
        with mock.patch.object(socket, "create_connection", no_socket), \
                mock.patch.object(socket.socket, "connect", no_socket):
            return fd.main(argv + ["--coverage-report", self.paths["COVERAGE_REPORT"]], get=no_get)

    def bundle(self):
        return fd.read_bundle(self.paths["BUNDLE"])

    def test_missing_corrupt_cache_is_empty_state(self):
        known = {"000001.SH"}
        self.assertEqual(fd.load_provider_cache("domestic", known)["status"], "missing")
        with open(os.path.join(self.paths["PROVIDER_DIR"], "domestic.json"), "w") as f:
            f.write("{not json")
        self.assertEqual(fd.load_provider_cache("domestic", known)["status"], "invalid")
        self.assertEqual(self.run_main(["--offline"]), 0)
        b = self.bundle()
        self.assertEqual(b["providers"]["domestic"]["status"], "invalid")
        self.assertEqual(b["providers"]["supplemental"]["status"], "missing")
        sh = b["indices"][0]
        self.assertEqual(sh["pe"], [None, None])
        self.assertEqual(sh["price"], [3600.0, 3634.35])
        self.assertTrue(any("provider domestic 未接入" in w for w in b["warnings"]))

    def test_enrich_only_reads_caches_without_network_or_writes(self):
        dpath = self.write_provider("domestic", {"000001.SH": {"fields": {
            "pe": fld(["2026-10-31", "2026-11-13"], [14.2, 14.5], freq="daily"),
            "pb": fld(["2026-10-31"], [1.4], freq="monthly")}}})
        spath = self.write_provider("supplemental", {
            "HSI.HK": {"fields": {"pe": fld(["2026-11-13"], [10.1], freq="single"),
                                  "amt": fld(["2026-11-13"], [1300.0], unit="亿元")},
                       "componentNum": {"value": 85, "date": "2026-11-13",
                                        "source": {"label": "恒生指数公司", "url": "https://hsi.example", "method": "官方"}}},
            "000001.SH": {"fields": {"mcap": fld(["2026-11-13"], [600000.0], unit="亿元", freq="single")}}})
        hashes = {p: _sha(p) for p in (dpath, spath)}
        sys.modules.pop("providers.domestic", None)
        self.assertEqual(self.run_main(["--enrich-only"]), 0)
        for p, h in hashes.items():
            self.assertEqual(_sha(p), h)  # 不改 provider 缓存
        self.assertNotIn("providers.domestic", sys.modules)  # 未导入在线 collect
        b = self.bundle()
        sh, hk = b["indices"]
        self.assertEqual(sh["d"], ["2026-10-30", "2026-10-31", "2026-11-13"])  # 周六报告日保留
        self.assertEqual(sh["pe"], [None, 14.2, 14.5])
        self.assertEqual(sh["pb"], [None, 1.4, None])
        self.assertEqual(sh["mcap"], [None, None, 600000.0])
        self.assertEqual(sh["amt"], [5000.0, None, 5100.0])  # 行情成交额保留
        self.assertEqual((hk["pe"], hk["amt"], hk["componentNum"]), ([10.1], [1300.0], 85))
        self.assertTrue(any("单期" in w for w in hk["warnings"]))
        self.assertEqual(fd.validate_bundle(b), [])
        man = _json(self.paths["MANIFEST"])
        self.assertEqual((man["mode"], man["networkAllowed"]), ("enrich-only", False))
        self.assertEqual(man["providers"]["domestic"]["okFields"], 2)
        cov = _json(self.paths["COVERAGE_REPORT"])
        row = {r["code"]: r for r in cov["indices"]}["000001.SH"]["fields"]
        self.assertTrue(row["pe"]["filled"])
        self.assertEqual(row["pe"]["after"]["provider"], "domestic")
        self.assertEqual(row["pe"]["after"]["count"], 2)
        self.assertFalse(row["price"]["lost"])
        self.assertIn("000001.SH", cov["summary"]["pb"]["filled"])
        self.assertEqual(cov["before"]["baselineAsOf"], "2026-11-13")

    def test_offline_rejects_collect_providers(self):
        with self.assertRaises(SystemExit) as cm, mock.patch("sys.stderr"):
            fd.main(["--offline", "--collect-providers"])
        self.assertEqual(cm.exception.code, 2)

    def test_offline_get_guard_raises(self):
        with self.assertRaises(fd.FetchError):
            fd.offline_get("https://www.csindex.com.cn/")

    def test_invalid_bundle_not_written(self):
        self.write_provider("domestic", {"000001.SH": {"fields": {"pe": fld(["2026-11-13"], [14.5])}}})
        with mock.patch.object(fd, "validate_bundle", return_value=["boom"]):
            self.assertEqual(self.run_main(["--offline"]), 3)
        self.assertFalse(os.path.exists(self.paths["BUNDLE"]))


if __name__ == "__main__":
    unittest.main()
