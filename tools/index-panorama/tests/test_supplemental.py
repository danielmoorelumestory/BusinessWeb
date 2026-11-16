"""providers/supplemental.py 标准库 unittest：
python3 -m unittest discover -s tests -p 'test_supplemental.py'
全部用伪造的 get（不联网）与临时 raw 目录，不触碰真实 data/providers。"""
import io
import json
import os
import sys
import tempfile
import unittest
import zipfile
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from providers import supplemental as sp  # noqa: E402

AS_OF = "2026-11-15"
INDICES = [
    dict(code="000300.SH", name="沪深300", market="A", tsym="sh000300", csi="000300", floor="2004-12-31"),
    dict(code="399001.SZ", name="深证成指", market="A", tsym="sz399001", csi=None, floor="1991-04-03"),
    dict(code="HSI.HK", name="恒生指数", market="HK", tsym="hkHSI", csi=None, floor="1964-07-31"),
    dict(code="HSTECH.HK", name="恒生科技", market="HK", tsym="hkHSTECH", csi=None, floor="2014-12-31"),
    dict(code="SPX.US", name="标普500", market="US", tsym="us.INX", csi=None, floor="1957-03-04"),
    dict(code="IXIC.US", name="纳斯达克综指", market="US", tsym="us.IXIC", csi=None, floor="1971-02-05"),
]


def idx_csv(rows, with_val=True):
    head_cn = ['"交易日"', '"指數"', '"指數貨幣"', '"指數收市"'] + (['"股息率"', '"市盈率"'] if with_val else [])
    head_en = ['"Trade Date"', '"Index"', '"Index Currency"', '"Index Close"'] + (
        ['"Dividend Yield (%)"', '"PE Ratio (times)"'] if with_val else [])
    lines = ["\t".join(head_cn), "\t".join(head_en)]
    for r in rows:
        lines.append("\t".join(f'"{c}"' for c in r))
    return "\r\n".join(lines).encode("utf-16")


def xlsx_bytes(title, pts):
    """最小 xlsx：A1 标题(shared string)，A4.. Excel 序列日期，B 列数值。"""
    sheet_rows = ['<row r="1"><c r="A1" t="s"><v>0</v></c></row>']
    for i, (serial, v) in enumerate(pts, start=4):
        sheet_rows.append(f'<row r="{i}"><c r="A{i}"><v>{serial}</v></c><c r="B{i}"><v>{v}</v></c></row>')
    ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("xl/sharedStrings.xml", f'<sst {ns}><si><t>{title}</t></si></sst>')
        z.writestr("xl/worksheets/sheet1.xml", f'<worksheet {ns}><sheetData>{"".join(sheet_rows)}</sheetData></worksheet>')
    return buf.getvalue()


WSJ_HTML = ('<html><meta name="description" content="P/E data based on as-reported earnings; estimate data based on operating earnings."/>'
            '<script>{"x":{"type":"mdc_peAndYields","data":{"timestamp":"Friday","tradeDate":"2026-11-13T00:00:00",'
            '"instruments":[{"ticker":"RIXF","name":"NASDAQ 100 Index","priceEarningsRatio":"29.55","yield":"0.59"},'
            '{"ticker":"INX","name":"S&P 500 Index","priceEarningsRatio":"23.25","yield":"1.09"}]}}}</script></html>')
NASDAQ_HTML = ("<div>COMP NASDAQ Composite 11/13/2026 1D 1M</div><div>Quick Facts</div>"
               "<div># of Components</div><div>3,395</div>")


ECB_XML = (b'<?xml version="1.0" encoding="UTF-8"?><gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" '
           b'xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref"><Cube>'
           b'<Cube time="2026-11-13"><Cube currency="USD" rate="1.1052"/><Cube currency="HKD" rate="8.6714"/>'
           b'<Cube currency="CNY" rate="7.3738"/></Cube>'
           b'<Cube time="2026-11-12"><Cube currency="HKD" rate="8.6928"/><Cube currency="CNY" rate="7.3891"/></Cube>'
           b'</Cube></gesmes:Envelope>')
HTML_200 = b"<!DOCTYPE html><html><head><title>Maintenance</title></head><body>error</body></html>"


class FakeNet:
    """按 URL 路由的伪网络；fail=True 时一律失败，用于“失败保留缓存”。"""

    def __init__(self, fail=False, html=False, ecb=ECB_XML):
        self.fail, self.html, self.ecb, self.calls = fail, html, ecb, []

    def __call__(self, url, **kw):
        self.calls.append(url)
        if self.fail:
            raise sp.FetchError("模拟网络失败")
        if self.html:
            return HTML_200  # 模拟 HTTP 200 但返回错误页
        if "ecb.europa.eu" in url:
            if self.ecb is None:
                raise sp.FetchError("HTTP 503")
            return self.ecb
        if "index-feature/000300" in url:
            return json.dumps({"code": "200", "data": {"indexCode": "000300", "tradeDate": "20261111",
                                                       "consNum": 300.0, "calMkvSum": "232035.16"}}).encode()
        if "indexList" in url:
            return json.dumps({"data": {"rows": [{"indexcode": "399001", "samplesize": 500, "closeingPoint": 10968.7872,
                                                  "freeMarketValue": 12553759175282.8,
                                                  "totalMarketValue": 23276633043254.82}]}}).encode()
        if "getIndexDailyDataWithDataFormat" in url:
            return json.dumps({"data": {"item": ["timestamp", "close"],
                                        "data": [["2026-11-13", 10968.7872], ["2026-11-12", 11197.9763]]}}).encode()
        if "data=dailyReport&seriesCode=hsi" in url:
            return json.dumps([{"seriesCode": "hsi", "reportList": [
                {"reportType": "idx", "reportDate": [{"url": "/r/hsi/idx_13Nov26.csv", "date": "2026-11-13"},
                                                     {"url": "/r/hsi/idx_12Nov26.csv", "date": "2026-11-12"}]},
                {"reportType": "ips", "reportDate": [{"url": "/r/ips_13Nov26.xls", "date": "2026-11-13"}]}]}]).encode()
        if "data=dailyReport&seriesCode=hstech" in url:
            return json.dumps([{"seriesCode": "hstech", "reportList": [
                {"reportType": "idx", "reportDate": [{"url": "/r/hstech/idx_13Nov26.csv", "date": "2026-11-13"}]}]}]).encode()
        if "idx_13Nov26.csv" in url and "/hsi/" in url:
            return idx_csv([["20261113", "Hang Seng Index 恒生指數", "HKD", "23637.6", "3.09", "13.23"],
                            ["20261113", "Hang Seng Index - Finance 恒生金融分類指數", "HKD", "54675.69", "3.99", "9.65"],
                            ["20261113", "Hang Seng Index USD 恒生指數美元", "USD", "3012.98", "3.09", "13.23"]])
        if "idx_12Nov26.csv" in url:
            # PE 空值：不得当 0
            return idx_csv([["20261112", "Hang Seng Index 恒生指數", "HKD", "24008.55", "3.05", ""]])
        if "hstech/idx_13Nov26.csv" in url:
            return idx_csv([["20261113", "Hang Seng TECH Index 恒生科技指數", "HKD", "3813.19"]], with_val=False)
        if "ips_13Nov26.xls" in url:
            return b"XLS"
        if "constituent/metadata" in url and "seriesCode=hsi&" in url:
            return json.dumps({"data": {"numOfConsList": [{"indexName": "Hang Seng Index", "count": 95}],
                                        "viewConsDetail": {"00001.04": [{"dateTime": "2026-11-13 16:10:00"}]}}}).encode()
        if "historical_pe/en_hk/hsi/" in url:
            return xlsx_bytes("MONTH-END WEIGHTED AVERAGE P/E RATIO (times)", [(46022, 13.21), (45989, 13.15)])
        if "wsj.com" in url:
            return WSJ_HTML.encode()
        if "nasdaqomx" in url:
            return NASDAQ_HTML.encode()
        raise sp.FetchError(f"HTTP 404 {url}")


def fake_ips(_bytes):
    return [["Trade Date", "Index", "Index", "a", "b", "Index Currency", "Prev", "Close", "pc", "%", "H", "L",
             "* Index Turnover (Mn)", "Market Turnover (Mn)"],
            ["20261113", "Hang Seng Index", "恒生指數", "", "", "HKD", "", "", 0, 0, "", "", "91246", ""],
            ["20261113", "Hang Seng TECH Index", "恒生科技指數", "", "", "HKD", "", "", 0, 0, "", "", "", ""]]


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.raw = os.path.join(self.tmp.name, "raw")
        self.out = os.path.join(self.tmp.name, "supplemental.json")
        p = mock.patch.object(sp, "extract_ips_rows", fake_ips)
        p.start()
        self.addCleanup(p.stop)
        self.addCleanup(self.tmp.cleanup)

    def run_collect(self, net, offline=False, as_of=AS_OF):
        return sp.collect(INDICES, as_of, offline=offline, raw_dir=self.raw, out_path=self.out, get=net)


class TestPure(unittest.TestCase):
    def test_to_float_empty_not_zero(self):
        for v in ("", "-", "--", None, "nan", "NA", float("inf"), True):
            self.assertIsNone(sp.to_float(v))
        self.assertEqual(sp.to_float("1,234.5"), 1234.5)
        self.assertEqual(sp.to_float(0), 0.0)

    def test_series_sorted_dedup_asof(self):
        d, v = sp.series_from_points({"2026-11-13": 2, "20261111": "1", "2026-11-20": 9, "2026-11-12": None}, "2026-11-15")
        self.assertEqual(d, ["2026-11-11", "2026-11-13"])
        self.assertEqual(v, [1.0, 2.0])

    def test_hsi_csv_picks_exact_hkd_row(self):
        raw = idx_csv([["20261113", "Hang Seng Index - Finance 恒生金融分類指數", "HKD", "1", "3.99", "9.65"],
                       ["20261113", "Hang Seng Index USD 恒生指數美元", "USD", "1", "3.0", "13.0"],
                       ["20261113", "Hang Seng Index 恒生指數", "HKD", "1", "3.09", "13.23"]])
        row = sp.parse_hsi_idx_csv(raw, "Hang Seng Index")
        self.assertEqual(row["PE Ratio (times)"], "13.23")
        self.assertIsNone(sp.parse_hsi_idx_csv(raw, "Hang Seng TECH Index"))

    def test_cnindex_date_match_unique(self):
        items = ["timestamp", "close"]
        self.assertEqual(sp.match_cnindex_date({"closeingPoint": 10.5}, items, [["2026-11-13", 10.5], ["2026-11-12", 10.4]]), "2026-11-13")
        self.assertIsNone(sp.match_cnindex_date({"closeingPoint": 10.6}, items, [["2026-11-13", 10.5]]))
        self.assertIsNone(sp.match_cnindex_date({"closeingPoint": 10.5}, items, [["2026-11-13", 10.5], ["2026-11-10", 10.5]]))
        self.assertIsNone(sp.match_cnindex_date({"closeingPoint": None}, items, [["2026-11-13", 10.5]]))

    def test_wsj_and_nasdaq_parsers(self):
        b = sp.extract_wsj_blocks(WSJ_HTML)
        self.assertEqual(len(b), 1)
        self.assertEqual([x["ticker"] for x in b[0]["instruments"]], ["RIXF", "INX"])
        n = sp.parse_nasdaq_overview(NASDAQ_HTML, "COMP")
        self.assertEqual((n["components"], n["date"]), (3395, "2026-11-13"))
        self.assertIsNone(sp.parse_nasdaq_overview("<p>nothing</p>", "COMP"))

    def test_monthly_xlsx(self):
        title, pts = sp.parse_hsi_monthly(xlsx_bytes("T", [(45989, 13.15), (46022, 13.21)]))
        self.assertEqual(title, "T")
        self.assertEqual(pts, {"2025-11-28": 13.15, "2025-12-31": 13.21})


class TestCollect(Base):
    def test_schema_units_and_status(self):
        res = self.run_collect(FakeNet())
        with open(self.out, encoding="utf-8") as f:
            self.assertEqual(json.load(f)["series"].keys(), res["series"].keys())
        self.assertEqual(res["provider"], "supplemental")
        for m in INDICES:
            e = res["series"][m["code"]]
            owned = sp.OWNED_ALL + (sp.OWNED_XB if m["market"] != "A" else [])
            self.assertEqual(sorted(e["fields"]), sorted(owned), m["code"])  # A股不越权输出 pe/pb/dy/amt/volume
            for k, f in e["fields"].items():
                self.assertEqual(len(f["d"]), len(f["v"]))
                self.assertEqual(f["d"], sorted(set(f["d"])))
                self.assertIn(f["status"], ("ok", "unavailable"))
                self.assertTrue(set(f["source"]) >= {"label", "url", "unit", "method"})
                if f["status"] == "unavailable":
                    self.assertTrue(f["reason"], f"{m['code']}.{k} 缺 reason")
                    self.assertEqual(f["d"], [])
                else:
                    self.assertTrue(all(isinstance(x, float) for x in f["v"]))
            c = e["componentNum"]
            self.assertIn(c["status"], ("ok", "unavailable"))
            if c["status"] == "ok":
                self.assertTrue(c["date"] and c["source"]["url"])
        s = res["series"]
        self.assertEqual(s["000300.SH"]["fields"]["mcap"]["v"], [232035.16])
        self.assertEqual(s["000300.SH"]["fields"]["mcap"]["source"]["unit"], "亿元")
        self.assertIn("自由流通", s["000300.SH"]["fields"]["mcap"]["source"]["method"])
        self.assertEqual(s["000300.SH"]["fields"]["mcap"]["source"]["marketCapBasis"], "free_float")
        self.assertEqual(s["000300.SH"]["componentNum"]["value"], 300)
        # 国证：主 mcap＝总市值（元 -> 亿元），自由流通在 extras；日期由收盘点位匹配
        self.assertEqual(s["399001.SZ"]["fields"]["mcap"]["d"], ["2026-11-13"])
        self.assertEqual(s["399001.SZ"]["fields"]["mcap"]["v"], [232766.33])
        self.assertEqual(s["399001.SZ"]["fields"]["mcap"]["source"]["marketCapBasis"], "total")
        self.assertEqual(s["399001.SZ"]["extras"]["mcapFreeFloat"]["v"], [125537.59])
        self.assertEqual(s["399001.SZ"]["extras"]["mcapFreeFloat"]["source"]["marketCapBasis"], "free_float")
        self.assertEqual((s["399001.SZ"]["componentNum"]["value"], s["399001.SZ"]["componentNum"]["date"]), (500, "2026-11-13"))
        # 恒生：PE 空值那天不入列；DY 两天都有；amt 百万港元 -> 亿港元
        hsi = s["HSI.HK"]["fields"]
        self.assertEqual((hsi["pe"]["d"], hsi["pe"]["v"]), (["2026-11-13"], [13.23]))
        self.assertEqual(hsi["dy"]["d"], ["2026-11-12", "2026-11-13"])
        # amt：912.46 亿港元 × 7.3738/8.6714 ＝ 775.92 人民币亿元；原币留 extras
        self.assertEqual((hsi["amt"]["v"], hsi["amt"]["source"]["unit"]), ([round(912.46 * 7.3738 / 8.6714, 2)], "亿元"))
        self.assertEqual(hsi["amt"]["v"], [775.92])
        self.assertIn("ECB", hsi["amt"]["source"]["method"])
        self.assertEqual(hsi["amt"]["source"]["fxSource"]["url"], sp.ECB_URL)
        self.assertEqual(s["HSI.HK"]["extras"]["amtHKD"]["v"], [912.46])
        self.assertEqual(s["HSI.HK"]["extras"]["amtHKD"]["source"]["unit"], "亿港元")
        self.assertEqual(s["HSI.HK"]["componentNum"]["value"], 95)
        self.assertEqual(s["HSI.HK"]["extras"]["peMonthly"]["d"], ["2025-11-28", "2025-12-31"])
        # 恒生科技：日报无估值列 -> unavailable；IPS 成交额为空 -> 不当 0
        tech = s["HSTECH.HK"]["fields"]
        self.assertEqual(tech["pe"]["status"], "unavailable")
        self.assertEqual(tech["amt"]["d"], [])
        # 美股：S&P 用 INX；Nasdaq Composite 不得用 Nasdaq 100 替代
        self.assertEqual(s["SPX.US"]["fields"]["pe"]["v"], [23.25])
        self.assertEqual(s["IXIC.US"]["fields"]["pe"]["status"], "unavailable")
        self.assertIn("Nasdaq 100", s["IXIC.US"]["fields"]["pe"]["reason"])
        self.assertEqual(s["IXIC.US"]["componentNum"]["value"], 3395)
        for code in ("000300.SH", "HSI.HK", "SPX.US"):
            for k in ("eps", "bps", "roe", "turn"):
                self.assertEqual(s[code]["fields"][k]["status"], "unavailable")
        self.assertTrue(any(er["source"] == "shiller" for er in res["errors"]))  # 失败来源记入 errors

    def test_failure_keeps_cache_and_records_errors(self):
        first = self.run_collect(FakeNet())
        second = self.run_collect(FakeNet(fail=True))
        self.assertTrue(second["errors"])
        for code in ("000300.SH", "399001.SZ", "HSI.HK", "SPX.US"):
            self.assertEqual(second["series"][code]["fields"], first["series"][code]["fields"], code)
            self.assertEqual(second["series"][code]["componentNum"], first["series"][code]["componentNum"])

    def test_offline_never_calls_network(self):
        self.run_collect(FakeNet())

        def boom(url, **kw):
            raise AssertionError(f"offline 联网了: {url}")
        res = self.run_collect(boom, offline=True)
        self.assertEqual(res["mode"], "offline")
        self.assertEqual(res["errors"], [])
        self.assertEqual(res["series"]["HSI.HK"]["fields"]["pe"]["v"], [13.23])

    def test_offline_empty_cache_all_unavailable(self):
        res = self.run_collect(lambda u, **k: (_ for _ in ()).throw(AssertionError(u)), offline=True)
        for e in res["series"].values():
            for f in e["fields"].values():
                self.assertEqual(f["status"], "unavailable")
                self.assertTrue(f["reason"])
            self.assertEqual(e["componentNum"]["status"], "unavailable")

    def test_as_of_filters_later_observations(self):
        self.run_collect(FakeNet())
        res = self.run_collect(None, offline=True, as_of="2026-11-12")
        self.assertEqual(res["series"]["HSI.HK"]["fields"]["dy"]["d"], ["2026-11-12"])
        self.assertEqual(res["series"]["399001.SZ"]["fields"]["mcap"]["status"], "unavailable")
        self.assertEqual(res["series"]["000300.SH"]["fields"]["mcap"]["d"], ["2026-11-11"])

    def test_incremental_skips_cached_hsi_files(self):
        self.run_collect(FakeNet())
        net = FakeNet()
        self.run_collect(net)
        self.assertFalse([u for u in net.calls if "idx_13Nov26.csv" in u or "ips_13Nov26" in u])


class TestRound2Fixes(Base):
    def snapshot(self):
        out = {}
        for root, _, files in os.walk(self.raw):
            for fn in files:
                if fn == "_last_online.json":
                    continue
                p = os.path.join(root, fn)
                with open(p, "rb") as f:
                    out[os.path.relpath(p, self.raw)] = f.read()
        return out

    def test_http200_html_never_overwrites_valid_raw(self):
        first = self.run_collect(FakeNet())
        before = self.snapshot()
        second = self.run_collect(FakeNet(html=True))
        self.assertEqual(self.snapshot(), before)  # 无任何 raw 被坏 HTML 覆盖/新增
        srcs = {e["source"] for e in second["errors"]}
        self.assertTrue({"csi_feature", "cnindex_list", "hsi_dailyReport", "ecb_eurofxref", "wsj_peyields",
                         "nasdaq_overview", "shiller"} <= srcs, srcs)
        for code in ("000300.SH", "399001.SZ", "HSI.HK", "SPX.US", "IXIC.US"):
            self.assertEqual(second["series"][code]["fields"], first["series"][code]["fields"])
            self.assertEqual(second["series"][code].get("extras"), first["series"][code].get("extras"))

    def test_html_body_for_new_files_not_written(self):
        dl = sp.Downloader(self.raw, lambda u, **k: HTML_200)
        dl.hsi(["hsi"])
        dl.ecb()
        dl.shiller()
        self.assertEqual(self.snapshot(), {})
        self.assertFalse(sp.valid_hsi_idx(HTML_200, "2026-11-13"))
        good = idx_csv([["20261113", "Hang Seng Index 恒生指數", "HKD", "1", "3", "13"]])
        self.assertTrue(sp.valid_hsi_idx(good, "2026-11-13"))
        self.assertFalse(sp.valid_hsi_idx(good, "2026-11-12"))

    def test_invalid_cached_idx_is_redownloaded(self):
        bad = os.path.join(self.raw, "hsi", "idx", "hsi_2026-11-13.csv")
        os.makedirs(os.path.dirname(bad))
        with open(bad, "wb") as f:
            f.write(HTML_200)
        res = self.run_collect(FakeNet())
        self.assertEqual(res["series"]["HSI.HK"]["fields"]["pe"]["v"], [13.23])

    def test_ecb_missing_date_no_forward_fill(self):
        only12 = ECB_XML.replace(b'<Cube time="2026-11-13">', b'<Cube time="2026-11-11">')
        res = self.run_collect(FakeNet(ecb=only12))
        amt = res["series"]["HSI.HK"]["fields"]["amt"]
        self.assertEqual(amt["status"], "unavailable")
        self.assertEqual(amt["source"]["fxSource"]["unmatchedDates"], ["2026-11-13"])
        self.assertEqual(res["series"]["HSI.HK"]["extras"]["amtHKD"]["v"], [912.46])

    def test_ecb_unreachable_amt_unavailable(self):
        res = self.run_collect(FakeNet(ecb=None))
        amt = res["series"]["HSI.HK"]["fields"]["amt"]
        self.assertEqual((amt["status"], amt["d"]), ("unavailable", []))
        self.assertIn("ECB", amt["reason"])
        self.assertTrue(any(e["source"] == "ecb_eurofxref" for e in res["errors"]))

    def test_retrieved_vs_built_time(self):
        with mock.patch.object(sp, "utc_now", side_effect=["2026-11-15T10:00:00Z"] + ["2026-11-15T10:00:05Z"] * 200):
            on = self.run_collect(FakeNet())
        self.assertEqual(on["retrievedAt"], "2026-11-15T10:00:00Z")
        with mock.patch.object(sp, "utc_now", return_value="2026-11-16T08:00:00Z"):
            off = self.run_collect(None, offline=True)
        self.assertEqual(off["mode"], "offline")
        self.assertEqual(off["retrievedAt"], "2026-11-15T10:00:00Z")  # offline 不刷新联网时间
        self.assertEqual(off["builtAt"], "2026-11-16T08:00:00Z")
        self.assertEqual(off["lastOnline"]["retrievedAt"], "2026-11-15T10:00:00Z")

    def test_offline_without_marker_has_no_retrieved_time(self):
        res = self.run_collect(None, offline=True)
        self.assertIsNone(res["retrievedAt"])
        self.assertTrue(res["builtAt"])


if __name__ == "__main__":
    unittest.main()
