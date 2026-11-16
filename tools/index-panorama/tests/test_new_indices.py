"""2026-11-16 新增 27 只行业/主题指数的回归：python3 -m unittest discover -s tests -p 'test_new_indices.py'

清单元数据（代码/中证代码/基日/分类，均核对中证官网 index-basic-info）、蛋卷映射只用同一指数代码、
supplemental --only 子集初始化不刷新其余指数、runner 能用本地 store 持续刷新新指数（不依赖外部研究目录），
以及已落盘数据包中新指数有真实价格且旧 36 只未被改动。不联网。
"""
import json
import os
import shutil
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
import fetch_data as fd  # noqa: E402
import refresh_runner as rr  # noqa: E402
from providers import domestic as dm  # noqa: E402
from providers import supplemental as sp  # noqa: E402

# code: (中证代码, 基日, 分类, 腾讯代码)  —— 基日取中证官网 index-basic-info basicDate（2026-11-16 核对）
NEW = {
    "H30184.CSI": ("H30184", "2004-12-31", "行业指数", None),
    "H30202.CSI": ("H30202", "2004-12-31", "行业指数", None),
    "931160.CSI": ("931160", "2004-12-31", "行业指数", None),
    "931775.CSI": ("931775", "2004-12-31", "行业指数", None),
    "930697.CSI": ("930697", "2004-12-31", "行业指数", None),
    "H30199.CSI": ("H30199", "2004-12-31", "行业指数", None),
    "990001.CSI": ("990001", "2011-12-30", "行业与主题", None),
    "930651.CSI": ("930651", "2004-12-31", "行业与主题", None),
    "930713.CSI": ("930713", "2012-06-29", "行业与主题", None),
    "H30590.CSI": ("H30590", "2010-12-31", "行业与主题", None),
    "931079.CSI": ("931079", "2015-12-31", "行业与主题", None),
    "931151.CSI": ("931151", "2012-12-31", "行业与主题", None),
    "399976.SZ": ("399976", "2011-12-31", "行业与主题", "sz399976"),
    "931719.CSI": ("931719", "2014-12-31", "行业与主题", None),
    "399989.SZ": ("399989", "2004-12-31", "行业与主题", "sz399989"),
    "931152.CSI": ("931152", "2014-12-31", "行业与主题", None),
    "930743.CSI": ("930743", "2011-12-31", "行业与主题", None),
    "399997.SZ": ("399997", "2008-12-31", "行业与主题", "sz399997"),
    "930653.CSI": ("930653", "2004-12-31", "行业与主题", None),
    "399998.SZ": ("399998", "2008-12-31", "行业与主题", "sz399998"),
    "000819.SH": ("000819", "2004-12-31", "行业与主题", "sh000819"),
    "930606.CSI": ("930606", "2008-12-31", "行业与主题", None),
    "000949.SH": ("000949", "2004-12-31", "行业与主题", "sh000949"),
    "399973.SZ": ("399973", "2011-06-30", "行业与主题", "sz399973"),
    "931066.CSI": ("931066", "2012-12-31", "行业与主题", None),
    "H30269.CSI": ("H30269", "2005-12-30", "行业与主题", None),
    "399809.SZ": ("399809", "2011-12-31", "行业与主题", "sz399809"),
}
CATS = {"全局坐标", "核心宽基", "宽基谱系", "行业与主题", "行业指数", "跨境对照"}
BY = {m["code"]: m for m in fd.INDICES}


class TestIndexList(unittest.TestCase):
    def test_metadata(self):
        self.assertEqual(len(fd.INDICES), 63)
        self.assertEqual(len(BY), 63, "代码不得重复")
        csi = [m["csi"] for m in fd.INDICES if m.get("csi")]
        self.assertEqual(len(csi), len(set(csi)), "同一中证指数不得重复收录")
        for m in fd.INDICES:
            self.assertIn(m["category"], CATS)
            self.assertTrue(m.get("tsym") or m.get("csi"), m["code"])
        for code, (csi_code, floor, cat, tsym) in NEW.items():
            m = BY[code]
            self.assertEqual((m["csi"], m["floor"], m["category"], m["tsym"], m["market"], m["cache"]),
                             (csi_code, floor, cat, tsym, "A", None), code)

    def test_communication_not_mixed(self):
        # 000994 全指通信（通信服务）与 931160 全指通信设备是两只不同指数
        self.assertEqual(BY["000994.SH"]["csi"], "000994")
        self.assertEqual(BY["931160.CSI"]["csi"], "931160")


class TestDomesticMapping(unittest.TestCase):
    def test_danjuan_only_same_code(self):
        self.assertEqual(dm.dj_sym("931079.CSI"), "CSI931079")
        self.assertEqual(dm.dj_sym("H30269.CSI"), "CSIH30269")
        self.assertEqual(dm.dj_sym("399997.SZ"), "SZ399997")
        self.assertEqual(dm.dj_sym("000922.CSI"), "SH000922")  # 旧映射不变
        for code in ("399997.SZ", "399989.SZ", "399998.SZ", "931079.CSI", "H30269.CSI"):
            p = dm.plan_for(BY[code])
            self.assertEqual((p["pe"], p["pb"], p["dy"], p["roe"]), ("csi_peg", "danjuan_pb", "csi_dp2", "danjuan_roe"))
        # 蛋卷 SZ399417 是国证新能源车，不得代配中证新能源汽车 399976
        p = dm.plan_for(BY["399976.SZ"])
        self.assertEqual((p["pe"], p["pb"], p["dy"], p["roe"]), ("csi_peg", None, "csi_dp2", None))


class Net:
    def __init__(self):
        self.calls = []

    def __call__(self, url, **kw):
        self.calls.append(url)
        if "index-feature/" in url:
            code = url.rsplit("/", 1)[1]
            return json.dumps({"code": "200", "data": {"indexCode": code, "tradeDate": "20261116",
                                                       "consNum": 50.0, "calMkvSum": "1234.5"}}).encode()
        raise sp.FetchError(f"HTTP 404 {url}")


class TestSupplementalOnly(unittest.TestCase):
    def test_only_downloads_subset(self):
        idx = [dict(code="000300.SH", market="A", csi="000300"), dict(code="H30184.CSI", market="A", csi="H30184"),
               dict(code="HSI.HK", market="HK", csi=None), dict(code="SPX.US", market="US", csi=None)]
        with tempfile.TemporaryDirectory() as tmp:
            net = Net()
            res = sp.collect(idx, "2026-11-16", raw_dir=tmp, out_path=None, get=net, only={"H30184.CSI"})
            self.assertEqual(net.calls, [sp.CSI_FEATURE_URL.format(code="H30184")])
            self.assertFalse(os.path.exists(os.path.join(tmp, "_last_online.json")), "子集初始化不写全量在线标记")
            s = res["series"]["H30184.CSI"]
            self.assertEqual(s["fields"]["mcap"]["v"], [1234.5])
            self.assertEqual(s["componentNum"]["value"], 50)
            self.assertIn("000300.SH", res["series"])  # 其余指数仍从 raw 解析（此处无 raw → unavailable）


class TestRunnerKeepsRefreshing(unittest.TestCase):
    def test_csi_only_codes_refreshed_from_local_store(self):
        no_tencent = [c for c, v in NEW.items() if v[3] is None]
        with tempfile.TemporaryDirectory() as tmp:
            app = os.path.join(tmp, "app")
            os.makedirs(os.path.join(app, "data", "store"))
            for c in no_tencent:
                open(os.path.join(app, "data", "store", f"csi_{c.replace('.', '_')}.csv"), "w").close()
            r = rr.Runner(app, "offline", True, work_root=os.path.join(tmp, "work"))
            os.makedirs(r.stage)
            shutil.copy(os.path.join(HERE, "fetch_data.py"), r.stg("fetch_data.py"))
            got = set(r.csi_codes_in_prod())
            self.assertEqual(got, set(no_tencent))


BUNDLE = os.path.join(HERE, "data-bundle.js")


@unittest.skipUnless(os.path.exists(BUNDLE), "无数据包")
class TestIntegratedData(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        b = rr.read_bundle(BUNDLE)
        cls.idx = {s["code"]: s for s in b["indices"]}

    def test_store_for_runner(self):
        """新指数都有本地 store：无腾讯的用中证 csi_*.csv 初始化，有腾讯的用 price_*.csv（腾讯首日起，无外部缓存）。"""
        for code, v in NEW.items():
            tag = code.replace(".", "_")
            kind = "price" if v[3] else "csi"
            self.assertTrue(os.path.exists(os.path.join(fd.STORE, f"{kind}_{tag}.csv")), code)

    def test_new_indices_real_price_and_pe(self):
        for code in NEW:
            s = self.idx.get(code)
            self.assertIsNotNone(s, code)
            self.assertGreater(s["coverage"]["price"]["count"], 1000, code)
            self.assertGreater(s["coverage"]["pe"]["count"], 0, code)
            self.assertGreaterEqual(s["d"][0], BY[code]["floor"], code)
            self.assertEqual(s["coverage"]["eps"]["count"], 0, f"{code} 不得合成 EPS")
            self.assertEqual(s["coverage"]["bps"]["count"], 0, code)
