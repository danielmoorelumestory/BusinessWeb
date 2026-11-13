"""同花顺 ETF 主升浪采集的关键逻辑：解析、来源截止日、同日幂等、失败保留旧数据、并发互斥、定时注册参数。

只用标准库，可直接运行：python3 -m unittest discover -s scripts -p "etf_uptrend_test.py"
"""
import io
import json
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError

import etf_uptrend as U

TZ = U.TZ


def pool(rows, fields=("tradeCode", "simpleName", "code")):
    # 故意打乱 indexes 顺序，检验按 type 对齐而不是按位置
    order = list(reversed(fields))
    return {"total": len(rows), "indexes": [{"type": f} for f in order],
            "itemList": [[r[fields.index(f)] for f in order] for r in rows]}


ALL = [("589200", "科创200ETF工银", "20:589200"), ("159253", "某ETF", "36:159253"),
       ("515020", "某ETF2", "20:515020"), ("560670", "某ETF3", "20:560670")]


class FakeFetcher(U.Fetcher):
    def __init__(self, end_day="2026-11-13", all_rows=ALL, fail_pool=False, fail_details=False, fail_categories=False):
        super().__init__(min_interval=0, sleep=lambda s: None)
        self.end_day, self.all_rows, self.fail_pool, self.fail_details = end_day, all_rows, fail_pool, fail_details
        self.fail_categories = fail_categories
        self.calls = []

    def json(self, url, payload=None):
        self.calls.append(url)
        if url == U.POOL_API:
            if self.fail_pool:
                raise RuntimeError("HTTP 503 模拟失败")
            c = payload["custom"]
            f = (c.get("filterList") or [{}])[0].get("type")
            pk = payload["businessPoolKey"]
            if pk != U.ALL_POOL and self.fail_categories:
                raise RuntimeError("分类池模拟失败")
            if c.get("uniqueTracking"):
                rows = self.all_rows[0:1] + self.all_rows[2:3]
            elif pk == U.CATEGORY_POOLS["t0"]:
                rows = self.all_rows[1:2]
            elif pk == U.CATEGORY_POOLS["industry"]:
                rows = self.all_rows[2:]
            elif pk == U.CATEGORY_POOLS["broad_index"]:
                rows = self.all_rows[0:2]
            else:
                rows = {None: self.all_rows, "last_day_step_signal": self.all_rows[3:4],
                        "new_up_trend": self.all_rows[0:1]}[f]
            data = pool(rows)
        elif self.fail_details:
            raise RuntimeError("RemoteDisconnected 模拟")
        elif url.startswith(U.PERIOD_API):
            data = [{"start_day": "2026-11-04", "end_day": self.end_day, "period_rise": 11.89, "duration": 7,
                     "step_signal_count": 1, "step_signal_dates": ["2026-11-10"]},
                    {"start_day": "2026-09-16", "end_day": "2026-09-23", "period_rise": 10.67}]
        elif url.startswith(U.REASONS_API):
            data = [{"title": "原因", "content": "AI 文本"}]
        else:
            raise AssertionError(url)
        self.raw.append({"url": url, "payload": payload, "response": {"status_code": 0, "data": data}})
        return data


def clock_at(s):
    t = datetime.fromisoformat(s).replace(tzinfo=TZ)
    return lambda: t


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def collect(self, at, **kw):
        return U.collect(self.root, cfg=dict(U.DEFAULT_CONFIG), fetcher=FakeFetcher(**kw), clock=clock_at(at))


class TestParse(unittest.TestCase):
    def test_aligns_by_index_type(self):
        rows = U.parse_pool(pool(ALL))
        self.assertEqual(rows[0], {"tradeCode": "589200", "simpleName": "科创200ETF工银", "code": "20:589200"})

    def test_incomplete_raises(self):
        d = pool(ALL)
        d["total"] = 268
        with self.assertRaises(RuntimeError):
            U.parse_pool(d)

    def test_normalize_tags_and_warnings(self):
        rows, warn = U.normalize({"all": U.parse_pool(pool(ALL[:2])),
                                  "trend_retracement": U.parse_pool(pool(ALL[3:4])),
                                  "new_pool": U.parse_pool(pool(ALL[:1]))})
        self.assertTrue(rows[0]["new_pool"])
        self.assertFalse(rows[1]["new_pool"])
        self.assertEqual(rows[1]["market"], "36")
        self.assertEqual(len(warn), 1)  # 回踩里的 560670 不在全量池

    def test_source_as_of(self):
        self.assertEqual(U.source_as_of([[{"end_day": "2026-11-12"}], [{"end_day": "2026-11-13"}], []]), "2026-11-13")
        self.assertIsNone(U.source_as_of([]))


class TestCollect(Base):
    def test_snapshot_and_caches(self):
        s = self.collect("2026-11-13T20:30:00")
        self.assertEqual(s["counts"], {"all": 4, "trend_retracement": 1, "new_pool": 1,
                                       "t0": 1, "industry": 2, "broad_index": 2, "unique_rep": 2})
        r0, r1 = s["etfs"][0], s["etfs"][1]
        self.assertTrue(r0["broad_index"] and r0["unique_rep"] and not r0["t0"])
        self.assertTrue(r1["t0"] and not r1["unique_rep"])
        self.assertEqual(s["source_as_of"], "2026-11-13")
        self.assertEqual(s["notes"], [])
        self.assertTrue((self.root / "snapshots" / "2026-11-13.json").exists())
        self.assertTrue((self.root / s["raw_file"]).exists())
        self.assertTrue(U.reason_cache_path(self.root, "20:560670", "2026-11-04").exists())
        self.assertEqual(U.read_json(self.root / "latest.json")["run_id"], s["run_id"])

    def test_stale_source_is_labelled(self):
        s = self.collect("2026-11-15T20:30:00", end_day="2026-11-13")  # 周日
        self.assertEqual(s["collected_on"], "2026-11-15")
        self.assertEqual(s["source_as_of"], "2026-11-13")
        self.assertIn("早于采集日", s["notes"][0])

    def test_rerun_same_day_updates_and_uses_cache(self):
        self.collect("2026-11-13T20:30:00")
        f = FakeFetcher()
        s2 = U.collect(self.root, cfg=dict(U.DEFAULT_CONFIG), fetcher=f, clock=clock_at("2026-11-13T21:00:00"))
        self.assertEqual(U.list_snapshots(self.root), ["2026-11-13"])
        self.assertEqual(s2["fetch_started_at"], "2026-11-13T21:00:00+08:00")
        # 区间仍新鲜、原因已缓存：只有 3 次名单 + 3 只探针
        self.assertFalse(any(c.startswith(U.REASONS_API) for c in f.calls))
        self.assertEqual(sum(c.startswith(U.PERIOD_API) for c in f.calls), U.DEFAULT_CONFIG["probe_count"])

    def test_detail_breaker_keeps_pool_snapshot(self):
        cfg = dict(U.DEFAULT_CONFIG, detail_max_consecutive_failures=2)
        f = FakeFetcher(fail_details=True)
        s = U.collect(self.root, cfg=cfg, fetcher=f, clock=clock_at("2026-11-13T20:30:00"))
        self.assertEqual(s["status"], "partial")
        self.assertEqual(s["counts"]["all"], 4)
        self.assertEqual(sum(c.startswith(U.PERIOD_API) for c in f.calls), 2)   # 熔断后不再请求
        self.assertTrue(any("连续失败" in e["message"] for e in s["errors"]))

    def test_category_failure_is_partial_not_fatal(self):
        s = self.collect("2026-11-13T20:30:00", fail_categories=True)
        self.assertEqual(s["status"], "partial")
        self.assertEqual(s["counts"]["all"], 4)
        self.assertNotIn("t0", s["counts"])
        self.assertIsNone(s["etfs"][0]["t0"])          # 未知，不是「否」
        self.assertTrue(s["etfs"][3]["trend_retracement"])

    def test_page_flags(self):
        self.collect("2026-11-13T20:30:00")
        h = U.page_data(self.root)["history"][0]
        self.assertEqual(h["cats"], list(U.TAG_KEYS))
        flags = {r[0]: r[2] for r in h["rows"]}
        bit = {k: 1 << i for i, k in enumerate(U.TAG_KEYS)}
        self.assertEqual(flags["20:589200"], bit["new_pool"] | bit["broad_index"] | bit["unique_rep"])
        self.assertEqual(flags["20:560670"], bit["trend_retracement"] | bit["industry"])

    def test_empty_pool_rejected(self):
        with self.assertRaises(RuntimeError):
            self.collect("2026-11-13T20:30:00", all_rows=[])

    def test_unchanged_note(self):
        self.collect("2026-11-14T20:30:00", end_day="2026-11-13")
        s = self.collect("2026-11-15T20:30:00", end_day="2026-11-13")
        self.assertTrue(any("尚未更新" in n for n in s["notes"]))


class TestRun(Base):
    def run_with(self, at, scheduled=False, **kw):
        def collector(root, clock, allow_empty):
            return U.collect(root, cfg=dict(U.DEFAULT_CONFIG), fetcher=FakeFetcher(**kw), clock=clock)
        return U.run(self.root, scheduled=scheduled, make_page=False, collector=collector, clock=clock_at(at))

    def test_failure_keeps_last_success(self):
        self.assertEqual(self.run_with("2026-11-13T20:30:00"), 0)
        before = (self.root / "snapshots" / "2026-11-13.json").read_bytes()
        self.assertEqual(self.run_with("2026-11-13T21:00:00", fail_pool=True), 1)
        self.assertEqual((self.root / "snapshots" / "2026-11-13.json").read_bytes(), before)
        st = U.read_json(self.root / "status.json")
        self.assertEqual(st["last_run"]["status"], "failed")
        self.assertIn("503", st["last_run"]["message"])
        self.assertEqual(st["last_success"]["started_at"], "2026-11-13T20:30:00+08:00")
        self.assertEqual(len((self.root / "runs.jsonl").read_text().splitlines()), 2)

    def test_scheduled_dedup(self):
        self.run_with("2026-11-13T14:00:00", end_day="2026-11-12")  # 白天手动跑，来源未更新
        self.assertFalse(U.already_done(U.read_json(U.snapshot_path(self.root, "2026-11-13")),
                                        clock_at("2026-11-13T20:30:00")(), "20:30"))
        self.run_with("2026-11-13T20:30:00", scheduled=True)
        snap = U.read_json(U.snapshot_path(self.root, "2026-11-13"))
        self.assertTrue(U.already_done(snap, clock_at("2026-11-13T23:00:00")(), "20:30"))
        n = len((self.root / "runs.jsonl").read_text().splitlines())
        self.run_with("2026-11-13T23:00:00", scheduled=True)   # 唤醒补跑：跳过，不新增运行记录
        self.assertEqual(len((self.root / "runs.jsonl").read_text().splitlines()), n)
        self.assertFalse(U.already_done(snap, clock_at("2026-11-14T20:30:00")(), "20:30"))

    def test_retry_slot_after_failure(self):
        self.assertEqual(self.run_with("2026-11-13T20:30:00", scheduled=True, fail_pool=True), 1)
        self.assertFalse(U.snapshot_path(self.root, "2026-11-13").exists())
        self.assertEqual(self.run_with("2026-11-13T21:30:00", scheduled=True), 0)   # 补跑时点真正采集
        self.assertEqual(U.read_json(self.root / "status.json")["last_success"]["trigger"], "scheduled")
        n = len((self.root / "runs.jsonl").read_text().splitlines())
        self.run_with("2026-11-13T22:30:00", scheduled=True)                       # 已成功，跳过
        self.assertEqual(len((self.root / "runs.jsonl").read_text().splitlines()), n)

    def test_lock_prevents_reentry(self):
        called = []
        with U.run_lock(self.root) as ok:
            self.assertTrue(ok)
            rc = U.run(self.root, make_page=False, collector=lambda **k: called.append(1), clock=clock_at("2026-11-13T20:30:00"))
        self.assertEqual(rc, 0)
        self.assertEqual(called, [])


class TestFetcher(unittest.TestCase):
    def make(self, responses):
        it = iter(responses)

        def opener(req, timeout):
            r = next(it)
            if isinstance(r, Exception):
                raise r
            return io.BytesIO(json.dumps(r).encode())
        return U.Fetcher(retries=3, min_interval=0, opener=opener, sleep=lambda s: None)

    def test_retry_then_ok(self):
        f = self.make([HTTPError("u", 503, "x", {}, io.BytesIO(b"busy")), TimeoutError("t"), {"status_code": 0, "data": [1]}])
        self.assertEqual(f.json("http://x"), [1])

    def test_no_retry_on_401(self):
        f = self.make([HTTPError("u", 401, "x", {}, io.BytesIO(b"cookie is empty")), {"status_code": 0, "data": 1}])
        with self.assertRaisesRegex(RuntimeError, "401"):
            f.json("http://x")

    def test_api_error_status(self):
        f = self.make([{"status_code": 1, "status_msg": "bad"}] * 3)
        with self.assertRaises(RuntimeError):
            f.json("http://x")


class TestScheduleAndPage(Base):
    def test_next_fire_and_plist(self):
        ref = datetime(2026, 11, 13, 21, 0, tzinfo=TZ)
        self.assertEqual(U.next_fire(20, 30, ref).isoformat(), "2026-11-14T20:30:00+08:00")
        self.assertEqual(U.next_fire(20, 30, ref.replace(hour=9)).isoformat(), "2026-11-13T20:30:00+08:00")
        p = U.build_plist("/usr/bin/python3", [(16, 30), (17, 30)], self.root)
        self.assertEqual(p["Label"], U.LABEL)
        self.assertEqual(p["StartCalendarInterval"], [{"Hour": 16, "Minute": 30}, {"Hour": 17, "Minute": 30}])
        self.assertEqual(U.fire_times(U.DEFAULT_CONFIG), [(20, 30), (21, 30), (22, 30)])
        self.assertEqual(U.fire_times({"time": "23:00", "retry_offsets_min": [60]}), [(23, 0)])  # 不跨日
        self.assertEqual(p["ProgramArguments"][-2:], ["run", "--scheduled"])
        with self.assertRaises(ValueError):
            U.parse_hhmm("25:00")

    def test_export_site_is_idempotent(self):
        self.collect("2026-11-13T20:30:00")
        out = self.root / "site"
        w1 = U.export_site(self.root, out)
        self.assertEqual({p.name for p in w1}, {"2026-11-13.json", "detail.json", "index.json"})
        idx = U.read_json(out / "index.json")
        self.assertEqual(idx["days"][0]["d"], "2026-11-13")
        self.assertEqual(idx["tag_keys"], list(U.TAG_KEYS))
        self.assertEqual(U.export_site(self.root, out), [])     # 内容没变：不写文件
        self.assertEqual(oct((out / "index.json").stat().st_mode & 0o777), "0o644")

    @unittest.skipUnless(U.TEMPLATE.exists(), "本地 HTML 模板只在 gupiaoWS 里有")
    def test_page_empty_and_filled(self):
        out = self.root / "p.html"
        U.build_page(self.root, out)
        self.assertIn('"history":[]', out.read_text())
        self.collect("2026-11-13T20:30:00")
        U.build_page(self.root, out)
        html = out.read_text()
        self.assertNotIn("__DATA__", html)
        self.assertIn("科创200ETF工银", html)
        self.assertIn("AI 文本", html)


if __name__ == "__main__":
    unittest.main()
