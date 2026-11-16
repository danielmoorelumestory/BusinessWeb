"""原站 EPS provider 回归：python3 -m unittest discover -s tests -p 'test_original_eps.py'

覆盖：脱敏 raw 校验（拒收凭据键/非 'all' 区间/乱序/非有限数/未知单位/采样不符）、港美全空保留缺失、
名册外指数保留缺失、单位 元/频率 weekly/口径未核实标注、并集日期补 null 不前填、
接入后其他字段逐日不变，以及生产数据包 EPS 与 raw 一一对应、PE 仍为原来源。
"""
import copy
import json
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
import fetch_data as fd  # noqa: E402
from providers import original_eps as oe  # noqa: E402

RAW = {
    "capturedAt": "2026-11-15T20:02:24Z", "page": "https://lishenqi.vip/", "range": "all",
    "via": "PANO_IX.series", "panelDay": "20261113", "unitEps": "yuan",
    "roster": {"000300.SH": "沪深300", "HSI.HI": "恒生指数"}, "errors": [],
    "series": {
        "000300.SH": {"origCode": "000300.SH", "origName": "沪深300", "freq": "week", "step": 5,
                      "first": "20041229", "last": "20261113", "points": 4, "dailyPoints": 20, "shards": 1,
                      "errors": [], "d": ["20041229", "20261103", "20261108", "20261113"],
                      "eps": [None, 1.07, 1.08, 1.08]},
        "HSI.HK": {"origCode": "HSI.HI", "origName": "恒生指数", "freq": "week", "step": 5,
                   "first": "20261103", "last": "20261113", "points": 2, "dailyPoints": 10, "shards": 1,
                   "errors": [], "d": ["20261103", "20261113"], "eps": [None, None]},
    },
}
A_META = dict(code="000300.SH", name="沪深300", category="核心宽基", description="", floor="2004-12-31",
              market="A", tsym="sh000300", csi="000300", cache=None)
IDX = [{"code": "000300.SH"}, {"code": "HSI.HK"}, {"code": "000985.SH"}]


def payload(raw=RAW):
    return oe.build_payload(IDX, "2026-11-16", raw)


def eps_of(p, code):
    return p["series"][code]["fields"]["eps"]


class TestParse(unittest.TestCase):
    def test_ok_series_values_unit_freq(self):
        e = eps_of(payload(), "000300.SH")
        self.assertEqual(e["status"], "ok")
        self.assertEqual(e["d"], ["2026-11-03", "2026-11-08", "2026-11-13"])  # null 只是缺失，被跳过
        self.assertEqual(e["v"], [1.07, 1.08, 1.08])  # 原值，不换算
        self.assertEqual(e["frequency"], "weekly")
        src = e["source"]
        self.assertEqual(src["unit"], "元")
        self.assertIn("李神奇数据网", src["label"])
        self.assertIn("计算口径未核实", src["label"])
        self.assertIs(src["calcVerified"], False)
        self.assertIn("step=5", src["method"])
        self.assertIn("不是完整日频", src["method"])
        self.assertIn("不存在恒等关系", src["method"])

    def test_hk_all_null_and_off_roster_stay_missing(self):
        p = payload()
        for code in ("HSI.HK", "000985.SH"):
            e = eps_of(p, code)
            self.assertEqual(e["status"], "unavailable")
            self.assertEqual((e["d"], e["v"]), ([], []))
            self.assertTrue(e["reason"])
        self.assertIn("全为空", eps_of(p, "HSI.HK")["reason"])
        self.assertIn("名册没有", eps_of(p, "000985.SH")["reason"])

    def test_structural_errors_reject_whole_series(self):
        def bad(mut):
            r = copy.deepcopy(RAW)
            mut(r["series"]["000300.SH"])
            p = payload(r)
            return eps_of(p, "000300.SH"), p["errors"]
        cases = {
            "乱序": lambda s: s.update(d=["20261103", "20041229", "20261108", "20261113"]),
            "不等长": lambda s: s.update(eps=[1.0]),
            "非有限": lambda s: s.update(eps=[None, float("nan"), 1.0, 1.0]),
            "字符串值": lambda s: s.update(eps=[None, "1.07", 1.0, 1.0]),
            "采样不符": lambda s: s.update(freq="day", step=1),
            "原站报错": lambda s: s.update(errors=["rate limited"]),
            "未知键": lambda s: s.update(pe=[1, 2, 3, 4]),
        }
        for name, mut in cases.items():
            e, errs = bad(mut)
            self.assertEqual(e["status"], "unavailable", name)
            self.assertEqual(e["v"], [], name)
            self.assertTrue(errs, name)

    def test_unknown_unit_not_guessed(self):
        r = copy.deepcopy(RAW)
        r["unitEps"] = "point"
        e = eps_of(payload(r), "000300.SH")
        self.assertEqual(e["status"], "unavailable")

    def test_load_raw_rejects_credentials_and_other_ranges(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "c.json")
            for mut, msg in ((lambda r: r["series"]["000300.SH"].update(accessToken="x"), "凭据"),
                             (lambda r: r.update(cookie="x"), "未知顶层键"),
                             (lambda r: r.update(range="10y"), "'all'")):
                r = copy.deepcopy(RAW)
                mut(r)
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(r, f)
                with self.assertRaises(oe.RawError) as cm:
                    oe.load_raw(path)
                self.assertIn(msg, str(cm.exception))

    def test_missing_raw_gives_unavailable_payload(self):
        p = oe.build_payload(IDX, "2026-11-16", None, "OSError: 不存在")
        self.assertTrue(all(n["fields"]["eps"]["status"] == "unavailable" for n in p["series"].values()))
        self.assertTrue(p["errors"])


class TestMerge(unittest.TestCase):
    def setUp(self):
        self.prov = fd.normalize_provider_payload("original_eps", payload(), {"000300.SH", "HSI.HK", "000985.SH"})
        self.prices = [{"date": d, "close": c, "volume": None, "amt": 100.0, "src": "tencent"}
                       for d, c in (("2026-11-03", 4000.0), ("2026-11-04", 4010.0), ("2026-11-13", 4020.0))]
        self.csi = [{"date": d, "close": c, "pe": pe, "amt": None, "cons": None}
                    for d, c, pe in (("2026-11-03", 4000.0, 13.1), ("2026-11-04", 4010.0, 13.2))]

    def test_payload_passes_integration_validation(self):
        self.assertEqual(self.prov["status"], "ok")
        self.assertEqual(self.prov["rejected"], [])

    def test_union_dates_null_fill_no_forward_fill_other_fields_unchanged(self):
        base = fd.build_series(A_META, self.prices, self.csi, [], "2005-01-01", [], providers=[], until="2026-11-16")
        s = fd.build_series(A_META, self.prices, self.csi, [], "2005-01-01", [], providers=[self.prov],
                            until="2026-11-16")
        # 2026-11-08（周日，原站 EPS 日）不在价格日历 → 新增日期行，其他字段为 null
        self.assertIn("2026-11-08", s["d"])
        i = s["d"].index("2026-11-08")
        for f in fd.FIELDS:
            if f != "eps":
                self.assertIsNone(s[f][i], f)
        # EPS 只在真实观测日有值，不前填
        self.assertIsNone(s["eps"][s["d"].index("2026-11-04")])
        got = {d: v for d, v in zip(s["d"], s["eps"]) if v is not None}
        self.assertEqual(got, {"2026-11-03": 1.07, "2026-11-08": 1.08, "2026-11-13": 1.08})
        # 其他字段：原日期非空值完全不变
        for f in fd.FIELDS:
            if f == "eps":
                continue
            old = {d: v for d, v in zip(base["d"], base[f]) if v is not None}
            new = {d: v for d, v in zip(s["d"], s[f]) if v is not None}
            self.assertEqual(old, new, f)
        self.assertEqual(s["sources"]["pe"], base["sources"]["pe"])
        self.assertEqual(s["sources"]["eps"]["provider"], "original_eps")
        self.assertEqual(s["sources"]["eps"]["unit"], "元")
        sel = [c for c in s["availability"]["eps"]["candidates"] if c["selected"]]
        self.assertEqual(len(sel), 1)
        self.assertEqual(fd.validate_bundle({"indices": [s]}), [])


def _read_bundle():
    return fd.read_bundle(os.path.join(HERE, "data-bundle.js"))


@unittest.skipUnless(os.path.exists(oe.RAW_PATH) and os.path.exists(os.path.join(HERE, "data-bundle.js")),
                     "缺少生产 raw 或 bundle")
class TestProductionBundle(unittest.TestCase):
    """生产数据包：EPS 与 raw 一一对应（仅按 --since/floor 裁剪），其他来源未被原站替换。"""

    @classmethod
    def setUpClass(cls):
        cls.bundle = _read_bundle()
        cls.raw = oe.load_raw()

    def test_eps_one_to_one_with_raw(self):
        since = "2005-01-01"
        floors = {m["code"]: max(m["floor"], since) for m in fd.INDICES}
        with_eps = 0
        for s in self.bundle["indices"]:
            got = {d: v for d, v in zip(s["d"], s["eps"]) if v is not None}
            node = self.raw["series"].get(s["code"])
            exp = {}
            if node:
                exp = {oe._iso(d): v for d, v in zip(node["d"], node["eps"])
                       if v is not None and oe._iso(d) >= floors[s["code"]]}
            self.assertEqual(got, exp, s["code"])
            if got:
                with_eps += 1
                self.assertEqual(s["sources"]["eps"]["provider"], "original_eps")
                self.assertEqual(s["sources"]["eps"]["unit"], "元")
                self.assertEqual(s["availability"]["eps"]["frequency"], "weekly")
                self.assertNotEqual(s["sources"]["pe"].get("provider"), "original_eps")
        self.assertEqual(with_eps, 15)

    def test_hk_us_have_no_eps(self):
        for s in self.bundle["indices"]:
            if s["market"] in ("HK", "US"):
                self.assertTrue(all(v is None for v in s["eps"]), s["code"])

    def test_original_eps_only_supplies_eps(self):
        for s in self.bundle["indices"]:
            for f, src in s["sources"].items():
                if f != "eps":
                    self.assertNotEqual((src or {}).get("provider"), "original_eps", f"{s['code']}.{f}")
                    self.assertNotIn("李神奇", str((src or {}).get("label")), f"{s['code']}.{f}")


if __name__ == "__main__":
    unittest.main()
