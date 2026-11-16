"""fetch_data.py 标准库 unittest：python3 -m unittest discover -s tests -p 'test_fetch.py'"""
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import fetch_data as fd  # noqa: E402


def _read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def tencent_payload(sym, rows):
    return json.dumps({"code": 0, "msg": "", "data": {sym: {"day": rows}}}).encode()


def csi_payload(rows):
    return json.dumps({"code": "200", "msg": "success", "success": True, "data": rows}).encode()


def csi_row(date, close, peg=12.3, val=1234.5, cons=50):
    return {"tradeDate": date.replace("-", ""), "close": close, "changePct": 0.1, "tradingVol": 1,
            "tradingValue": val, "consNumber": cons, "peg": peg}


class TestRequestErrors(unittest.TestCase):
    def test_http_get_retries_then_raises_fetcherror(self):
        calls = []

        def boom(*a, **k):
            calls.append(1)
            raise fd.urllib.error.URLError("ssl eof")

        with mock.patch.object(fd.urllib.request, "urlopen", boom), mock.patch.object(fd.time, "sleep"):
            with self.assertRaises(fd.FetchError):
                fd.http_get("https://x.test/a", retries=2)
        self.assertEqual(len(calls), 3)

    def test_breaker_short_circuits_failing_host_only(self):
        hits = []

        def get(url, **k):
            hits.append(url)
            if "bad" in url:
                raise fd.FetchError("501")
            return b"ok"

        g = fd.HostBreaker(get, threshold=2)
        for _ in range(2):
            with self.assertRaises(fd.FetchError):
                g("https://bad.test/1")
        with self.assertRaises(fd.FetchError):
            g("https://bad.test/2")
        self.assertEqual(len([h for h in hits if "bad" in h]), 2)  # 第三次未真正发出
        self.assertEqual(g("https://good.test/"), b"ok")

    def test_tencent_error_code_and_bad_json(self):
        with self.assertRaises(fd.FetchError):
            fd.parse_tencent(b'{"code":-1,"msg":"param error","data":[]}', "sh000001", "A")
        with self.assertRaises(fd.FetchError):
            fd.parse_tencent(b"<html>501</html>", "sh000001", "A")

    def test_csi_service_error_code_raises(self):
        # 显式非成功 code，即使未给 success 也必须失败，不能当空数据
        with self.assertRaises(fd.FetchError):
            fd.parse_csi_perf(b'{"code":"500","msg":"system error","data":[]}', "000300")

    def test_csi_success_false_raises(self):
        # success:false 即使 code 看似正常也必须失败
        with self.assertRaises(fd.FetchError):
            fd.parse_csi_perf(b'{"code":"200","success":false,"msg":"limit","data":null}', "000300")

    def test_csi_missing_code_with_data_still_parses(self):
        rows = fd.parse_csi_perf(json.dumps({"data": [csi_row("2026-11-11", 4075.71)]}).encode(), "000300")
        self.assertEqual(rows[0]["date"], "2026-11-11")

    def test_csi_bad_json(self):
        with self.assertRaises(fd.FetchError):
            fd.parse_csi_perf(b"not json", "000300")

    def test_failed_update_keeps_existing_store(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(fd, "STORE", tmp):
            meta = dict(code="000300.SH", tsym="sh000300", market="A", floor="2004-12-31", cache=None)
            path = fd.store_path("price", meta["code"])
            fd.write_store(path, [{"date": "2026-11-10", "close": 4059.11, "volume": 1, "src": "tencent"}], fd.PRICE_COLS)
            before = _read(path)

            def fail(*a, **k):
                raise fd.FetchError("down")

            rows, warns = fd.update_prices(meta, "2026-11-15", fail, offline=False)
            self.assertEqual([r["date"] for r in rows], ["2026-11-10"])
            self.assertTrue(any("保留已有数据" in w for w in warns))
            self.assertEqual(_read(path), before)


class TestEmptyData(unittest.TestCase):
    def test_tencent_empty_and_missing_symbol(self):
        self.assertEqual(fd.parse_tencent(tencent_payload("sh932000", []), "sh932000", "A"), [])
        self.assertEqual(fd.parse_tencent(b'{"code":0,"data":{}}', "sh932000", "A"), [])
        self.assertEqual(fd.parse_tencent(b'{"code":0,"data":[]}', "sh932000", "A"), [])

    def test_csi_empty_data(self):
        self.assertEqual(fd.parse_csi_perf(csi_payload([]), "399001"), [])
        self.assertEqual(fd.parse_csi_perf(b'{"code":"200","data":null}', "399001"), [])

    def test_empty_strings_are_none_not_zero(self):
        for v in ("", " ", "-", "--", None, "nan", float("nan"), float("inf")):
            self.assertIsNone(fd.to_float(v), v)
        self.assertEqual(fd.to_float("0"), 0.0)
        self.assertEqual(fd.to_float("1,234.5"), 1234.5)
        rows = fd.parse_csi_perf(csi_payload([csi_row("2026-11-11", 4075.71, peg="", val=None)]), "000300")
        self.assertIsNone(rows[0]["pe"])
        self.assertIsNone(rows[0]["amt"])

    def test_empty_series_builds_aligned_null_arrays(self):
        meta = dict(code="X", name="x", category="宽基谱系", description="", floor="2000-01-01", market="A", tsym=None, csi="932000", cache=None)
        s = fd.build_series(meta, [], [], [], "2005-01-01", [])
        self.assertEqual(s["d"], [])
        for f in fd.FIELDS:
            self.assertEqual(s[f], [])

    def test_update_csi_empty_response_no_store_written(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(fd, "STORE", tmp), mock.patch.object(fd.time, "sleep"):
            meta = dict(code="399001.SZ", csi="399001", floor="2026-01-01")
            rows, warns, _ = fd.update_csi(meta, "2026-03-01", None, None, lambda *a, **k: csi_payload([]), False)
            self.assertEqual(rows, [])
            self.assertTrue(warns)
            self.assertFalse(os.path.exists(fd.store_path("csi", meta["code"])))


class TestStartDateFakeRow(unittest.TestCase):
    """中证接口会把首条真实数据复制到请求起始日：000688 以 20160101 请求时也返回 2016-01-01 行。"""

    def setUp(self):
        self.calendar = {"2019-12-31", "2020-01-02", "2020-01-03", "2016-01-04"}

    def test_star50_fake_row_before_base_date_dropped(self):
        raw = fd.parse_csi_perf(csi_payload([
            csi_row("2016-01-01", 1019.72),   # 伪行：请求起始日 + 非交易日 + 早于基日
            csi_row("2016-01-04", 1019.72),   # 伪造到交易日也不行：早于基日
            csi_row("2019-12-31", 1000.0),
            csi_row("2020-01-02", 1019.72),
            csi_row("2020-01-03", 1024.48),
        ]), "000688")
        kept, dropped = fd.clean_csi_rows(raw, "2016-01-01", "2019-12-31", self.calendar, "2020-01-03")
        self.assertEqual([r["date"] for r in kept], ["2019-12-31", "2020-01-02", "2020-01-03"])
        self.assertEqual(len(dropped), 2)

    def test_fake_row_on_request_start_trading_day_dropped(self):
        raw = fd.parse_csi_perf(csi_payload([csi_row("2020-01-02", 1019.72), csi_row("2020-01-03", 1024.48)]), "000688")
        kept, _ = fd.clean_csi_rows(raw, "2020-01-02", "2019-12-31", self.calendar, "2020-01-03")
        self.assertEqual([r["date"] for r in kept], ["2020-01-03"])

    def test_rows_after_calendar_end_keep_weekdays_only(self):
        raw = fd.parse_csi_perf(csi_payload([csi_row("2020-01-06", 1), csi_row("2020-01-04", 1)]), "000688")
        kept, _ = fd.clean_csi_rows(raw, "2020-01-03", "2019-12-31", self.calendar, "2020-01-03")
        self.assertEqual([r["date"] for r in kept], ["2020-01-06"])

    def test_windows_overlap_so_dropping_start_loses_nothing(self):
        w = fd.csi_windows("2019-12-30", "2036-01-01", years=8)
        for (a, b), (c, _) in zip(w, w[1:]):
            self.assertEqual(b, c)  # 下一窗起始日 = 上一窗末日，已被覆盖
        self.assertEqual(w[0][0], "2019-12-30")
        self.assertEqual(w[-1][1], "2036-01-01")

    def test_fetch_csi_perf_end_to_end_drops_fake_rows(self):
        def get(url, **k):
            start = url.split("startDate=")[1][:8]
            # 模拟接口：总在起始日插入一条复制首条真实数据的伪行
            return csi_payload([csi_row(start, 1019.72), csi_row("2020-01-02", 1019.72), csi_row("2020-01-03", 1024.48)])

        with mock.patch.object(fd.time, "sleep"):
            rows, dropped = fd.fetch_csi_perf("000688", "2019-12-30", "2020-01-05", "2019-12-31",
                                              self.calendar, "2020-01-03", get=get)
        self.assertEqual([r["date"] for r in rows], ["2020-01-02", "2020-01-03"])
        self.assertGreaterEqual(dropped, 1)

    def test_cache_holiday_rows_filtered_by_calendar(self):
        rows = [{"date": "2005-01-01", "close": 984.4}, {"date": "2005-01-04", "close": 984.4}]
        kept, bad = fd.filter_calendar(rows, {"2005-01-04"}, "2005-01-04")
        self.assertEqual([r["date"] for r in kept], ["2005-01-04"])
        self.assertEqual(bad, ["2005-01-01"])


class TestUnits(unittest.TestCase):
    def test_tencent_a_share_volume_hands_to_shares(self):
        rows = fd.parse_tencent(tencent_payload("sh000001", [
            ["2026-11-10", "3682.040", "3663.720", "3683.730", "3660.720", "404865177.000"]]), "sh000001", "A")
        self.assertEqual(rows[0]["volume"], 40486517700)  # 手×100 = 股，与缓存原值一致
        self.assertAlmostEqual(rows[0]["close"], 3663.72)

    def test_placeholder_and_foreign_volume_are_null(self):
        a = fd.parse_tencent(tencent_payload("sz399001", [["1993-06-11", "1", "2392.51", "1", "1", "100.000"]]), "sz399001", "A")
        self.assertIsNone(a[0]["volume"])
        hk = fd.parse_tencent(tencent_payload("hkHSI", [["2026-11-13", "1", "23637.6", "1", "1", "195857007140"]]), "hkHSI", "HK")
        self.assertIsNone(hk[0]["volume"])

    def test_csi_units_amount_yi_and_pe(self):
        r = fd.parse_csi_perf(csi_payload([csi_row("2026-11-11", "4075.71", peg="13.14", val="4421.28", cons="300")]), "000300")[0]
        self.assertEqual((r["amt"], r["pe"], r["cons"]), (4421.28, 13.14, 300.0))

    def test_chg_percent_from_price(self):
        self.assertEqual(fd.compute_chg([100.0, 101.0, None, 99.99]), [None, 1.0, None, -1.0])

    def test_norm_date_formats(self):
        self.assertEqual(fd.norm_date("20261111"), "2026-11-11")
        self.assertEqual(fd.norm_date("2026/11/11"), "2026-11-11")
        self.assertIsNone(fd.norm_date("2026-02-30"))
        self.assertIsNone(fd.norm_date(""))


class TestDedupAndBundle(unittest.TestCase):
    def test_merge_dedup_sort_and_new_overrides_nonnull(self):
        old = [{"date": "2026-11-11", "close": 1.0, "pe": 10.0}, {"date": "2026-11-10", "close": 0.9, "pe": 9.0}]
        new = [{"date": "20261111", "close": 1.1, "pe": None}, {"date": "2026-11-12", "close": 1.2, "pe": 11.0}]
        m = fd.merge_rows(old, new)
        self.assertEqual([r["date"] for r in m], ["2026-11-10", "2026-11-11", "2026-11-12"])
        self.assertEqual(m[1]["close"], 1.1)
        self.assertEqual(m[1]["pe"], 10.0)  # 新值为空不覆盖旧值

    def test_build_series_aligns_independent_dates(self):
        meta = dict(code="000300.SH", name="沪深300", category="核心宽基", description="", floor="2004-12-31",
                    market="A", tsym="sh000300", csi="000300", cache=None)
        prices = [{"date": d, "close": c, "volume": None, "src": "tencent"}
                  for d, c in [("2026-11-13", 4016.29), ("2026-11-11", 4075.71), ("2026-11-12", 4040.0)]]
        csi = [{"date": "2026-11-11", "close": 4075.71, "amt": 4421.28, "pe": 13.14, "cons": 300}]
        ind = [{"date": "2026-11-11", "pe1": 13.0, "pe2": 13.5, "dy1": 2.9, "dy2": 2.7}]
        s = fd.build_series(meta, prices, csi, ind, "2005-01-01", [])
        self.assertEqual(s["d"], ["2026-11-11", "2026-11-12", "2026-11-13"])
        for f in fd.FIELDS:
            self.assertEqual(len(s[f]), 3, f)
        self.assertEqual(s["pe"], [13.14, None, None])     # 不前填
        self.assertEqual(s["dy"], [2.7, None, None])        # D/P2 口径
        self.assertEqual(s["amt"], [4421.28, None, None])
        self.assertEqual(s["pb"], [None, None, None])
        self.assertEqual(s["coverage"]["pe"]["last"], "2026-11-11")
        self.assertEqual(s["coverage"]["price"]["last"], "2026-11-13")
        self.assertEqual(s["componentNum"], 300)
        self.assertEqual(s["sources"]["price"]["label"], "腾讯证券")  # 纯腾讯保持腾讯
        self.assertTrue(any("日期不同" in w for w in s["warnings"]))
        self.assertEqual(fd.validate_bundle({"indices": [s]}), [])

    def test_validate_bundle_catches_misaligned_and_unsorted(self):
        s = {"code": "X", "d": ["2026-11-12", "2026-11-11"], **{f: [None, None] for f in fd.FIELDS}}
        s["pe"] = [1.0]
        errs = fd.validate_bundle({"indices": [s]})
        self.assertTrue(any("升序" in e for e in errs))
        self.assertTrue(any("X.pe" in e for e in errs))

    def test_render_and_atomic_write(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = os.path.join(tmp, "b.js")
            fd.atomic_write(p, fd.render_bundle({"schemaVersion": 1, "indices": []}))
            txt = _read(p)
            self.assertIn("window.PANO_DATA=", txt)
            body = txt.split("window.PANO_DATA=", 1)[1].rstrip().rstrip(";")
            self.assertEqual(json.loads(body)["schemaVersion"], 1)
            self.assertEqual([f for f in os.listdir(tmp) if f.startswith(".tmp_")], [])
            with self.assertRaises(ValueError):
                fd.render_bundle({"x": float("nan")})

    def test_tencent_pagination_dedups_overlap(self):
        pages = {
            "2026-11-15": [["2026-11-12", "1", "3", "1", "1", "1000"], ["2026-11-13", "1", "4", "1", "1", "1000"]],
        }

        def get(url, **k):
            end = url.split(",day,")[1].split(",")[1]
            return tencent_payload("sh000001", pages.get(end, []))

        rows = fd.fetch_tencent("sh000001", "A", "2026-11-01", "2026-11-15", get=get)
        self.assertEqual([r["date"] for r in rows], ["2026-11-12", "2026-11-13"])

class TestTencentAmountAndFallback(unittest.TestCase):
    def test_price_label_mixed_cache_is_honest(self):
        meta = dict(code="000300.SH", name="沪深300", category="核心宽基", description="", floor="2004-12-31",
                    market="A", tsym="sh000300", csi="000300", cache="index_sh000300_ohlc.csv")
        prices = [{"date": "2026-11-10", "close": 4059.111, "volume": None, "src": "cache"},
                  {"date": "2026-11-11", "close": 4075.71, "volume": None, "src": "tencent"}]
        src = fd.build_series(meta, prices, [], [], "2005-01-01", [])["sources"]["price"]
        self.assertEqual(src["label"], "本地历史缓存 + 腾讯证券")
        self.assertIn("未验证", src["method"])
        self.assertIn("2026-11-10", src["method"])

    def test_newfqkline_amount_wan_to_yi_a_share_only(self):
        k = ["2008-12-31", "1835.11", "1817.72", "1844.42", "1813.73", "35631355.00", {}, "0.87", "2729191.42", "0", "0"]
        a = fd.parse_tencent(tencent_payload("sh000300", [k]), "sh000300", "A")[0]
        self.assertEqual(a["amt"], 272.92)          # 万元 -> 亿元
        self.assertEqual(a["volume"], 3563135500)   # 手 -> 股
        hk = fd.parse_tencent(tencent_payload("hkHSI", [k]), "hkHSI", "HK")[0]
        self.assertIsNone(hk["amt"])

    def test_endpoint_fallback_when_primary_501(self):
        seen = []

        def get(url, **kw):
            seen.append(url)
            if "proxy.finance.qq.com" in url:
                raise fd.FetchError("HTTP 501")
            return tencent_payload("sh000001", [["2026-11-13", "1", "3634.35", "1", "1", "1000"]])

        rows = fd.fetch_tencent("sh000001", "A", "2026-11-01", "2026-11-15", get=get)
        self.assertEqual(rows[0]["close"], 3634.35)
        self.assertEqual(len(seen), 2)

    def test_cache_close_kept_tencent_amount_added(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(fd, "STORE", tmp):
            meta = dict(code="000300.SH", tsym="sh000300", market="A", floor="2004-12-31", cache="c.csv")
            cache = [{"date": "2026-11-10", "close": 4059.111, "volume": 15038545100, "amt": None, "src": "cache"}]

            def get(url, **kw):
                return tencent_payload("sh000300", [
                    ["2026-11-10", "1", "4059.11", "1", "1", "150385451", {}, "1", "44210000", "0", "0"],
                    ["2026-11-11", "1", "4075.71", "1", "1", "160000000", {}, "1", "44212800", "0", "0"]])

            with mock.patch.object(fd, "load_cache_prices", return_value=cache):
                rows, warns = fd.update_prices(meta, "2026-11-15", get, offline=False)
            self.assertEqual(warns, [])
            self.assertEqual([(r["date"], r["close"], r["src"]) for r in rows],
                             [("2026-11-10", 4059.111, "cache"), ("2026-11-11", 4075.71, "tencent")])
            self.assertEqual(rows[0]["amt"], 4421.0)
            stored = fd.load_store(fd.store_path("price", meta["code"]), fd.PRICE_COLS, {"close", "volume", "amt"})
            self.assertEqual(len(stored), 2)


if __name__ == "__main__":
    unittest.main()
