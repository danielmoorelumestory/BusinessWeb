"""成分股自算 provider 回归：python3 -m unittest discover -s tests -p 'test_constituent_fin.py'

覆盖：TTM 净利润与平均净资产口径、整体法汇总、覆盖率门槛、报告期对齐交易日、
输出能通过 fetch_data 的 provider 字段校验（单位/频率/来源），以及非目标指数不输出。
全部离线，不联网。
"""
import os
import sys
import unittest

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
import fetch_data as fd  # noqa: E402
from providers import constituent_fin as cf  # noqa: E402

CONS = {"csi": "931719", "date": "2026-10-30", "url": "u",
        "constituents": [{"code": "000001", "name": "A", "weight": 60.0},
                         {"code": "300001", "name": "B", "weight": 40.0}]}


def stock(np_, eq):
    return {"np": np_, "eq": eq}


class TestCalc(unittest.TestCase):
    def test_ttm_np(self):
        npd = {"2025-09-30": 30.0, "2025-12-31": 50.0, "2026-09-30": 45.0}
        self.assertEqual(cf.ttm_np(npd, "2026-09-30"), 45.0 + 50.0 - 30.0)
        self.assertEqual(cf.ttm_np(npd, "2025-12-31"), 50.0)  # 年报直接取
        self.assertIsNone(cf.ttm_np(npd, "2026-06-30"))       # 缺本期
        self.assertIsNone(cf.ttm_np({"2026-09-30": 1.0}, "2026-09-30"))  # 缺上年数据

    def test_avg_eq(self):
        self.assertEqual(cf.avg_eq({"2026-09-30": 120.0, "2025-09-30": 80.0}, "2026-09-30"), 100.0)
        self.assertIsNone(cf.avg_eq({"2026-09-30": 120.0}, "2026-09-30"))
        self.assertIsNone(cf.avg_eq({"2026-09-30": 120.0, "2025-09-30": -5.0}, "2026-09-30"))  # 负净资产不入

    def test_compute_overall_method_and_cover(self):
        stocks = {
            "000001": stock({"2025-12-31": 10e8}, {"2025-12-31": 100e8, "2024-12-31": 100e8}),
            "300001": stock({"2025-12-31": 30e8}, {"2025-12-31": 100e8, "2024-12-31": 100e8}),
        }
        rows, dropped = cf.compute(CONS, stocks, "2026-01-10", ["2025-12-30", "2025-12-31", "2026-01-05"])
        r = [x for x in rows if x["period"] == "2025-12-31"][0]
        self.assertAlmostEqual(r["roe"], 20.0)  # (10+30)/(100+100) 整体法，不是 (10%+30%)/2 加权
        self.assertAlmostEqual(r["np"], 40.0)
        self.assertEqual((r["cover"], r["n"], r["total"]), (100.0, 2, 2))
        self.assertEqual(r["date"], "2025-12-31")

    def test_cover_threshold_drops_period(self):
        stocks = {"000001": stock({"2025-12-31": 10e8}, {"2025-12-31": 100e8, "2024-12-31": 100e8})}
        rows, dropped = cf.compute(CONS, stocks, "2026-01-10", ["2025-12-31"])
        self.assertEqual(rows, [])  # 只覆盖 60% < 90%
        self.assertTrue(any("2025-12-31" in x for x in dropped))

    def test_snap_to_trading_day(self):
        cal = ["2023-09-27", "2023-09-28", "2023-10-09"]  # 2023-09-29 中秋休市、09-30 周六
        self.assertEqual(cf.snap("2023-09-30", cal), "2023-09-28")
        self.assertIsNone(cf.snap("2014-03-31", cal))  # 日历之前
        self.assertEqual(cf.snap("2026-03-28", []), "2026-03-27")  # 无日历退到工作日

    def test_market(self):
        self.assertEqual(cf.market("600000"), "SH")
        self.assertEqual(cf.market("688001"), "SH")
        self.assertEqual(cf.market("300750"), "SZ")
        self.assertEqual(cf.market("002594"), "SZ")
        self.assertEqual(cf.market("920001"), "BJ")
        self.assertEqual(cf.market("830799"), "BJ")


class TestPayload(unittest.TestCase):
    def test_fields_pass_fetch_data_validation(self):
        rows = [{"period": "2025-12-31", "date": "2025-12-31", "roe": 20.0, "np": 40.0, "cover": 100.0, "n": 2, "total": 2},
                {"period": "2026-03-31", "date": "2026-03-31", "roe": 19.0, "np": 41.0, "cover": 100.0, "n": 2, "total": 2}]
        fields = cf.build_fields("931719.CSI", "931719", CONS, rows, [])
        for f in ("roe", "np"):
            norm = fd.normalize_provider_field(f, fields[f])
            self.assertEqual(norm["status"], "ok", norm.get("reason"))
            self.assertEqual(norm["frequency"], "quarterly")
        self.assertEqual(fields["roe"]["source"]["unit"], "%")
        self.assertEqual(fields["np"]["source"]["unit"], "亿元")
        self.assertIn("幸存者偏差", fields["roe"]["source"]["method"])

    def test_empty_rows_unavailable(self):
        fields = cf.build_fields("931719.CSI", "931719", CONS, [], ["2014-12-31 覆盖 40.0%"])
        for f in ("roe", "np"):
            self.assertEqual(fd.normalize_provider_field(f, fields[f])["status"], "unavailable")

    def test_np_registered_in_contract(self):
        self.assertIn("np", fd.FIELDS)
        self.assertIn("np", fd.PROVIDER_FIELDS)
        self.assertIn("constituent_fin", fd.PROVIDER_NAMES)
        self.assertTrue(fd.unit_ok("np", "亿元"))
        self.assertFalse(fd.unit_ok("np", "元"))

    def test_only_targets_emitted(self):
        orig_out, orig_stocks = cf.OUT_PATH, cf.STOCKS_PATH
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            cf.OUT_PATH = os.path.join(tmp, "out.json")
            cf.STOCKS_PATH = os.path.join(tmp, "stocks.json")
            try:
                p = cf.collect([{"code": "000300.SH"}], "2026-11-20", offline=True)
            finally:
                cf.OUT_PATH, cf.STOCKS_PATH = orig_out, orig_stocks
        self.assertEqual(p["series"], {})


if __name__ == "__main__":
    unittest.main()
