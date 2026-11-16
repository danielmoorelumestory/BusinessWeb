"""ETF 官方映射目录离线校验（无网络，CI 可执行）：python -m unittest tests/test_etf_catalog.py"""
import copy
import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
import etf_catalog as E  # noqa: E402


class CatalogFiles(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cat = json.loads(E.CATALOG_JSON.read_text(encoding="utf-8"))

    def test_files_valid_and_js_identical(self):
        self.assertEqual(E.validate_files(), [])

    def test_keys_are_bundle_codes(self):
        # 键必须与数据包代码原样一致：原 36 只来自 fetch_data.INDICES
        import fetch_data
        local = {m["code"] for m in fetch_data.INDICES}
        self.assertTrue(local <= set(self.cat["indices"]), local - set(self.cat["indices"]))
        self.assertEqual(set(self.cat["indices"]), set(E.TARGETS))

    def test_000994_has_no_direct_product(self):
        e = self.cat["indices"]["000994.SH"]
        self.assertEqual([p for p in e["products"] if p["relationship"] == "tracks"], [])
        self.assertIn("无已核实的直接跟踪", e["notes"])
        for p in e["products"]:
            self.assertNotIn(p["benchmarkCode"], ("000994", "931160", "931079"))
            self.assertTrue(p["relationNote"])

    def test_known_products_not_misfiled(self):
        idx = self.cat["indices"]
        codes = lambda k: {p["code"] for p in idx[k]["products"] if p["relationship"] == "tracks"}
        self.assertIn("515880", codes("931160.CSI"))
        self.assertIn("515050", codes("931079.CSI"))
        self.assertIn("510300", codes("000300.SH"))
        self.assertIn("159919", codes("000300.SH"))  # 深交所登记 399300，经中证官网交叉核对

    def test_codes_are_strings_with_leading_zero_preserved(self):
        for k, e in self.cat["indices"].items():
            for p in e["products"]:
                self.assertIsInstance(p["code"], str)
                self.assertRegex(p["code"], r"^\d{6}$")

    def test_no_enhanced_or_feeder(self):
        for e in self.cat["indices"].values():
            for p in e["products"]:
                for bad in ("增强", "指增", "联接", "LOF"):
                    self.assertNotIn(bad, p["name"])

    def test_alias_only_where_declared(self):
        for k, e in self.cat["indices"].items():
            for p in e["products"]:
                if p["relationship"] == "tracks" and E.code_key(p["benchmarkCode"]) != E.code_key(k):
                    self.assertIn(p["benchmarkCode"], e.get("benchmarkAliases", []), (k, p["code"]))
        self.assertEqual(self.cat["indices"]["DJI.US"]["benchmarkAliases"], ["DJIA"])


class Validator(unittest.TestCase):
    BASE = {"schemaVersion": 1, "verifiedAt": "2026-11-16T00:00:00Z", "indices": {"000300.SH": {"name": "沪深300", "notes": "x", "products": [
        {"code": "510300", "name": "沪深300ETF华泰柏瑞", "exchange": "SH", "relationship": "tracks", "benchmarkCode": "000300",
         "benchmarkName": "沪深300指数", "sourceUrl": "https://www.sse.com.cn/x", "sourceTitle": "t", "verifiedAt": "2026-11-16"}]}}}

    def bad(self, mutate):
        c = copy.deepcopy(self.BASE)
        mutate(c["indices"]["000300.SH"], c["indices"]["000300.SH"]["products"][0])
        return E.validate_catalog(c)

    def test_base_ok(self):
        self.assertEqual(E.validate_catalog(self.BASE), [])

    def test_rejects(self):
        cases = {
            "tracks 其他指数": lambda e, p: p.update(benchmarkCode="931160"),
            "代码丢前导0": lambda e, p: p.update(code=510300),
            "http 链接": lambda e, p: p.update(sourceUrl="http://www.sse.com.cn/"),
            "含凭据链接": lambda e, p: p.update(sourceUrl="https://u:p@www.sse.com.cn/"),
            "related 缺说明": lambda e, p: p.update(relationship="related_theme"),
            "非法关系": lambda e, p: p.update(relationship="similar"),
            "交易所非法": lambda e, p: p.update(exchange="上交所"),
            "日期非法": lambda e, p: p.update(verifiedAt="16/11/2026"),
            "重复产品": lambda e, p: e["products"].append(dict(p)),
            "notes 为空": lambda e, p: e.update(notes=""),
        }
        for label, fn in cases.items():
            with self.subTest(label):
                self.assertTrue(self.bad(fn), label)

    def test_alias_accepts_declared_only(self):
        self.assertTrue(self.bad(lambda e, p: p.update(benchmarkCode="399300")))
        self.assertEqual(self.bad(lambda e, p: (e.update(benchmarkAliases=["399300"]), p.update(benchmarkCode="399300"))), [])

    def test_suffix_ignored(self):
        self.assertEqual(self.bad(lambda e, p: p.update(benchmarkCode="000300.SH")), [])


if __name__ == "__main__":
    unittest.main()
