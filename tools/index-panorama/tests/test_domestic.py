"""providers/domestic.py 单元测试：python3 -m unittest discover -s tests -p 'test_domestic.py'"""
import json
import math
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from providers import domestic as dm  # noqa: E402

CAL = {"2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"}


def csi_pe_payload(rows):
    return json.dumps({"code": "200", "msg": "Success", "data": [
        {"tradeDate": d.replace("-", ""), "indexName": "x", "peg": v} for d, v in rows]}).encode()


def dj_payload(kind, rows):
    ts = lambda d: int(__import__("datetime").datetime.fromisoformat(d + "T00:00:00+08:00").timestamp() * 1000)
    return json.dumps({"data": {f"index_eva_{kind}_growths": [{kind: v, "ts": ts(d)} for d, v in rows]}}).encode()


def dj_detail(d, y):
    ts = int(__import__("datetime").datetime.fromisoformat(d + "T00:00:00+08:00").timestamp() * 1000)
    return json.dumps({"data": {"index_code": "SZ399001", "pe": 20.1, "pb": 2.0, "yeild": y, "ts": ts}}).encode()


def cn_list(rows):
    return json.dumps({"code": 200, "data": {"total": len(rows), "rows": rows}}).encode()


def cn_daily(rows):
    return json.dumps({"code": 200, "data": {"data": [[d, c, 0, 0, 0, c, 0, "0%", 0, 0, None] for d, c in rows]}}).encode()


def csi_val(d, rows):
    return json.dumps({"code": "200", "data": {"tradeDate": d.replace("-", ""), "indexValuations": rows}}).encode()


META = [
    dict(code="000001.SH", name="上证指数", market="A", csi="000001", floor="1990-12-19"),
    dict(code="399001.SZ", name="深证成指", market="A", csi=None, floor="1991-04-03"),
    dict(code="399303.SZ", name="国证2000", market="A", csi=None, floor="2009-12-31"),
    dict(code="000300.SH", name="沪深300", market="A", csi="000300", floor="2004-12-31"),
    dict(code="000986.SH", name="全指能源", market="A", csi="000986", floor="2004-12-31"),
    dict(code="HSI.HK", name="恒生指数", market="HK", csi=None, floor="1964-07-31"),
    dict(code="IXIC.US", name="纳斯达克综指", market="US", csi=None, floor="1971-02-05"),
]


def fake_get(table):
    calls = []

    def get(url):
        calls.append(url)
        for k, v in table.items():
            if k in url:
                if isinstance(v, Exception):
                    raise v
                return v
        raise dm.FetchError(f"HTTPError: 404 {url}")
    get.calls = calls
    return get


def make_xls_bytes():
    """用真实官网文件不便入库，这里只在有缓存样本时测解析。"""
    p = os.path.join(dm.RAW_DIR, "csi_ind_000300.xls")
    if not os.path.exists(p):
        return None
    with open(p, "rb") as f:
        return f.read()


def snapshot_dir(d):
    out = {}
    for n in os.listdir(d):
        with open(os.path.join(d, n), "rb") as f:
            out[n] = f.read()
    return out


class ParseTests(unittest.TestCase):
    def test_csi_peg_drops_pseudo_rows_and_sorts(self):
        raw = csi_pe_payload([("2026-11-11", 13.14), ("2026-11-08", 13.0), ("2026-11-10", 13.13),
                              ("2026-11-16", 13.2), ("2026-11-15", 13.3), ("2026-11-12", None), ("2026-11-09", 0)])
        pairs, dropped = dm.parse_csi_peg(raw, CAL)
        self.assertEqual(pairs, {"2026-11-10": 13.13, "2026-11-11": 13.14, "2026-11-16": 13.2})
        self.assertIn("2026-11-08", dropped)   # 日历内周日
        self.assertIn("2026-11-15", dropped)   # 日历外周日
        self.assertNotIn("2026-11-12", pairs)  # null 不当 0
        self.assertNotIn("2026-11-09", pairs)  # 0 视为缺失

    def test_csi_peg_bad_code_raises(self):
        with self.assertRaises(dm.FetchError):
            dm.parse_csi_peg(json.dumps({"code": "500", "msg": "x"}).encode(), CAL)

    def test_danjuan_history_dates_beijing_and_zero_dropped(self):
        raw = dj_payload("pb", [("2026-11-06", 1.3), ("2026-11-13", 0), ("2026-10-30", 1.25)])
        self.assertEqual(dm.parse_danjuan_history(raw, "pb"), {"2026-11-06": 1.3, "2026-10-30": 1.25})

    def test_danjuan_login_error(self):
        with self.assertRaises(dm.FetchError):
            dm.parse_danjuan_history(json.dumps({"result_code": 300001, "message": "请重新登录"}).encode(), "pe")

    def test_danjuan_detail_zero_kept_negative_rejected(self):
        self.assertEqual(dm.parse_danjuan_detail(dj_detail("2026-11-13", 0))[1], 0.0)
        self.assertIsNone(dm.parse_danjuan_detail(dj_detail("2026-11-13", -0.01))[1])
        raw = json.dumps({"data": {"yeild": float("nan"), "ts": 1794499200000}}).encode()
        self.assertIsNone(dm.parse_danjuan_detail(raw)[1])

    def test_ymd_rejects_invalid_calendar_date(self):
        self.assertEqual(dm.ymd("20261113"), "2026-11-13")
        for bad in ("20261332", "20260230", "20261100"):
            with self.assertRaises(ValueError):
                dm.ymd(bad)
        raw = csi_pe_payload([("2026-11-11", 13.14)]).replace(b"20261111", b"20261131")
        self.assertEqual(dm.parse_csi_peg(raw, CAL)[0], {})

    def test_danjuan_roe_percent_zero_placeholder_negative_kept(self):
        raw = dj_payload("roe", [("2026-11-06", 0.0993), ("2026-11-13", 0), ("2026-10-30", -0.012)])
        self.assertEqual(dm.parse_danjuan_history(raw, "roe"), {"2026-11-06": 9.93, "2026-10-30": -1.2})

    def test_danjuan_detail_unit_percent(self):
        d, y = dm.parse_danjuan_detail(dj_detail("2026-11-13", 0.0189))
        self.assertEqual(d, "2026-11-13")
        self.assertAlmostEqual(y, 1.89)

    def test_cnindex_date_matched_by_close(self):
        daily = cn_daily([("2026-11-13", 10968.7872), ("2026-11-12", 11197.9763)])
        self.assertEqual(dm.cnindex_date_for_close(daily, 11197.9763), "2026-11-12")
        self.assertIsNone(dm.cnindex_date_for_close(daily, 1.0))

    def test_indicator_xls_real_sample(self):
        raw = make_xls_bytes()
        if raw is None:
            self.skipTest("尚无真实 indicator.xls 缓存")
        rows = dm.parse_indicator_xls(raw)
        self.assertTrue(rows)
        for d, r in rows.items():
            self.assertRegex(d, r"^\d{4}-\d{2}-\d{2}$")
            self.assertEqual(set(r), {"pe1", "pe2", "dp1", "dp2"})

    def test_plan_one_source_per_field(self):
        p = {m["code"]: dm.plan_for(m) for m in META}
        self.assertEqual(p["000001.SH"], {"pe": "csi_peg", "pb": "csi_val_pb", "dy": "csi_dp2", "roe": None})
        self.assertEqual(p["399001.SZ"], {"pe": "danjuan_pe", "pb": "danjuan_pb", "dy": "danjuan_dy", "roe": "danjuan_roe"})
        self.assertEqual(p["399303.SZ"], {"pe": "cnindex_pe", "pb": "cnindex_pb", "dy": None, "roe": None})
        self.assertEqual(p["000300.SH"], {"pe": "csi_peg", "pb": "danjuan_pb", "dy": "csi_dp2", "roe": "danjuan_roe"})
        # 海外只补 supplemental 缺口：HSI 已有官方 PE/DY，不得出现在计划里
        self.assertEqual(p["HSI.HK"], {"pb": "danjuan_pb", "roe": "danjuan_roe"})
        self.assertEqual(dm.dj_sym("HSI.HK"), "HKHSI")
        self.assertEqual(dm.plan_for(dict(code="IXIC.US", market="US"))["pe"], None)  # 不用 NDX 代替
        self.assertIsNone(p["000986.SH"]["pb"])


class CollectTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.table = {
            "indexCsiDsPe?indexCode=000001": csi_pe_payload([("2026-11-10", 14.6), ("2026-11-11", 14.64)]),
            "indexCsiDsPe?indexCode=000300": csi_pe_payload([("2026-11-11", 13.14), ("2026-11-10", 13.13)]),
            "indexCsiDsPe?indexCode=000986": csi_pe_payload([("2026-11-11", 14.15)]),
            "indicator/000001indicator.xls": dm.FetchError("URLError: TLS EOF"),
            "indicator/000300indicator.xls": dm.FetchError("URLError: TLS EOF"),
            "indicator/000986indicator.xls": dm.FetchError("URLError: TLS EOF"),
            "indexValuation": csi_val("2026-11-11", [{"indexName": "上证指数", "pe": 15.8, "peg": 14.64, "pb": 1.38, "dp": 2.48}]),
            "pe_history/SZ399001": dj_payload("pe", [("2026-11-06", 24.0), ("2026-11-13", 24.64)]),
            "pb_history/SZ399001": dj_payload("pb", [("2026-11-06", 2.2), ("2026-11-13", 2.2185)]),
            "pb_history/SH000300": dj_payload("pb", [("2026-11-13", 1.3326)]),
            "detail/SZ399001": dj_detail("2026-11-13", 0.0189),
            "roe_history/SZ399001": dj_payload("roe", [("2026-11-06", 0.0905), ("2026-11-13", 0.09)]),
            "pb_history/HKHSI": dj_payload("pb", [("2026-11-13", 1.0847)]),
            "roe_history/HKHSI": dj_payload("roe", [("2026-11-13", 0.1001)]),
            "indexList": cn_list([{"indexcode": "399303", "peDynamic": 28.4056, "peStatic": 31.18, "pb": 2.08,
                                   "closeingPoint": 9000.5}]),
            "indexCode=399303": cn_daily([("2026-11-13", 9000.5), ("2026-11-12", 9100.0)]),
        }

    def run_collect(self, offline=False, table=None):
        return dm.collect(META, "2026-11-15", offline=offline, get=fake_get(table or self.table),
                          raw_dir=self.tmp, calendar=CAL)

    def check_schema(self, res):
        self.assertEqual(res["provider"], "domestic")
        self.assertEqual(set(res["series"]["HSI.HK"]["fields"]), {"pb", "roe"})  # 不覆盖官方 PE/DY
        for code, s in res["series"].items():
            want = {"pe", "pb", "dy", "roe"} if not code.endswith((".HK", ".US")) else set(dm.OVERSEAS_PLAN[code])
            self.assertEqual(set(s["fields"]), want)
            for f, x in s["fields"].items():
                self.assertEqual(len(x["d"]), len(x["v"]), (code, f))
                self.assertEqual(x["d"], sorted(set(x["d"])))
                self.assertTrue(all(isinstance(v, float) and math.isfinite(v) for v in x["v"]))
                self.assertIn(x["status"], ("ok", "unavailable"))
                for k in ("label", "url", "unit", "method"):
                    self.assertIn(k, x["source"])
                if x["status"] == "unavailable":
                    self.assertEqual(x["d"], [])
                    self.assertTrue(x["reason"])
                else:
                    self.assertTrue(x["source"]["url"].startswith("https://"))
                    self.assertIn(x["frequency"], ("daily", "weekly", "monthly", "latest"))

    def test_online_mapping_units_and_sources(self):
        res = self.run_collect()
        self.check_schema(res)
        s = res["series"]
        self.assertEqual(s["000001.SH"]["fields"]["pe"]["d"], ["2026-11-10", "2026-11-11"])
        self.assertEqual(s["000001.SH"]["fields"]["pe"]["source"]["unit"], "倍")
        self.assertIn("indexCsiDsPe", s["000001.SH"]["fields"]["pe"]["source"]["url"])
        self.assertEqual(s["000001.SH"]["fields"]["pb"]["v"], [1.38])
        self.assertEqual(s["000001.SH"]["fields"]["pb"]["frequency"], "latest")
        self.assertEqual(s["399001.SZ"]["fields"]["pe"]["frequency"], "weekly")
        self.assertEqual(s["399001.SZ"]["fields"]["dy"]["v"], [1.89])
        self.assertEqual(s["399001.SZ"]["fields"]["dy"]["source"]["unit"], "%")
        self.assertEqual(s["399303.SZ"]["fields"]["pe"], {**s["399303.SZ"]["fields"]["pe"], "d": ["2026-11-13"], "v": [28.4056]})
        self.assertEqual(s["399303.SZ"]["fields"]["dy"]["status"], "unavailable")
        self.assertEqual(s["000986.SH"]["fields"]["pb"]["status"], "unavailable")
        self.assertIn("2018", s["000986.SH"]["fields"]["pb"]["reason"])
        # indicator 失败且无缓存 -> unavailable，不用别的来源填补
        self.assertEqual(s["000300.SH"]["fields"]["dy"]["status"], "unavailable")
        self.assertTrue(any("indicator" in e for e in res["errors"]))

    def test_roe_and_overseas_fields(self):
        res = self.run_collect()
        s = res["series"]
        roe = s["399001.SZ"]["fields"]["roe"]
        self.assertEqual((roe["d"], roe["v"], roe["source"]["unit"], roe["frequency"]),
                         (["2026-11-06", "2026-11-13"], [9.05, 9.0], "%", "weekly"))
        self.assertIn("公式未独立验证", roe["source"]["method"])
        self.assertEqual(s["000001.SH"]["fields"]["roe"]["status"], "unavailable")
        self.assertEqual(s["HSI.HK"]["fields"]["pb"]["v"], [1.0847])
        self.assertEqual(s["HSI.HK"]["fields"]["roe"]["v"], [10.01])
        self.assertIn("HKHSI", s["HSI.HK"]["fields"]["pb"]["source"]["url"])

    def test_missing_only_skips_cached_requests(self):
        self.run_collect()
        get = fake_get(self.table)
        dm.collect(META, "2026-11-15", get=get, raw_dir=self.tmp, calendar=CAL, missing_only=True)
        cached = {"indexCsiDsPe", "pb_history/SZ399001", "indexList", "indexValuation"}
        self.assertFalse([u for u in get.calls if any(k in u for k in cached)])

    def test_failure_keeps_cache_and_offline_no_network(self):
        self.run_collect()
        broken = {k: dm.FetchError("URLError: reset") for k in self.table}
        res = self.run_collect(table=broken)
        pe = res["series"]["000300.SH"]["fields"]["pe"]
        self.assertEqual(pe["status"], "ok")
        self.assertEqual(pe["v"], [13.13, 13.14])
        self.assertIn("沿用上一份有效缓存", pe["reason"])
        # 累积型快照在失败时不丢
        self.assertEqual(res["series"]["399303.SZ"]["fields"]["pb"]["v"], [2.08])
        self.assertEqual(res["series"]["399001.SZ"]["fields"]["dy"]["v"], [1.89])

        def no_net(url):
            raise AssertionError("offline 不得联网")
        before = sorted(os.listdir(self.tmp))
        res2 = dm.collect(META, "2026-11-15", offline=True, get=no_net, raw_dir=self.tmp, calendar=CAL)
        self.check_schema(res2)
        self.assertEqual(sorted(os.listdir(self.tmp)), before)
        self.assertEqual(res2["series"]["399001.SZ"]["fields"]["pb"]["v"], [2.2, 2.2185])

    def test_bad_200_body_keeps_previous_valid_cache(self):
        self.run_collect()
        bad = dict(self.table)
        bad["indexCsiDsPe?indexCode=000300"] = b"<html>busy</html>"
        bad["indexCsiDsPe?indexCode=000001"] = json.dumps({"code": "500", "msg": "err", "data": None}).encode()
        bad["indexCsiDsPe?indexCode=000986"] = csi_pe_payload([])
        bad["pb_history/SZ399001"] = json.dumps({"result_code": 300001, "message": "请重新登录"}).encode()
        bad["indexList"] = b"<html>"
        bad["indexValuation"] = b"{}"
        bad["detail/SZ399001"] = b"not json"
        before = snapshot_dir(self.tmp)
        res = self.run_collect(table=bad)
        self.check_schema(res)
        f = res["series"]
        self.assertEqual(f["000300.SH"]["fields"]["pe"]["v"], [13.13, 13.14])
        self.assertIn("响应无效", f["000300.SH"]["fields"]["pe"]["reason"])
        self.assertEqual(f["000001.SH"]["fields"]["pe"]["v"], [14.6, 14.64])
        self.assertEqual(f["000986.SH"]["fields"]["pe"]["v"], [14.15])
        self.assertEqual(f["399001.SZ"]["fields"]["pb"]["v"], [2.2, 2.2185])
        self.assertEqual(f["399303.SZ"]["fields"]["pe"]["v"], [28.4056])
        self.assertEqual(f["000001.SH"]["fields"]["pb"]["v"], [1.38])
        self.assertEqual(f["399001.SZ"]["fields"]["dy"]["v"], [1.89])
        after = snapshot_dir(self.tmp)
        self.assertEqual(after, before)  # 坏响应没有覆盖任何缓存
        self.assertGreaterEqual(sum("响应无效" in e for e in res["errors"]), 7)

    def test_snapshot_accumulates_by_date(self):
        self.run_collect()
        t2 = dict(self.table)
        t2["indexList"] = cn_list([{"indexcode": "399303", "peDynamic": 28.9, "pb": 2.1, "closeingPoint": 9200.0}])
        t2["indexCode=399303"] = cn_daily([("2026-11-16", 9200.0), ("2026-11-13", 9000.5)])
        res = dm.collect(META, "2026-11-16", get=fake_get(t2), raw_dir=self.tmp, calendar=CAL)
        pe = res["series"]["399303.SZ"]["fields"]["pe"]
        self.assertEqual(pe["d"], ["2026-11-13", "2026-11-16"])
        self.assertEqual(pe["v"], [28.4056, 28.9])


if __name__ == "__main__":
    unittest.main()
