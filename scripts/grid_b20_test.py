"""grid_b20.py 单元测试：python3 -m unittest scripts/grid_b20_test.py"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import grid_b20 as G  # noqa: E402

CAL = [f"2026-01-{d:02d}" for d in range(1, 31)]  # 30 个合成交易日


def stock(closes: dict, divs=None, qfq=None, events=None):
    """closes: {date: 不复权收盘}；events: {date: FHcontent}（腾讯日线内嵌）。默认东财空表 + 巨潮无实施公告 = 无事件。"""
    raw = []
    for d in sorted(closes):
        row = [d, "0", str(closes[d]), "0", "0", "1"]
        if events and d in events: row.append({"FHcontent": events[d]})
        raw.append(row)
    if divs is None: divs, cninfo = {"success": False, "code": 9201}, []
    else: cninfo = None
    return G.build_stock(raw, divs, cninfo, qfq)


def em(rows):
    return {"success": True, "result": {"pages": 1, "data": [{"ASSIGN_PROGRESS": "实施分配", "EX_DIVIDEND_DATE": d + " 00:00:00", "IMPL_PLAN_PROFILE": t} for d, t in rows]}}


def flat(value=10.0, last=None, missing=()):
    c = {d: value for d in CAL if d not in missing}
    if last is not None: c[CAL[-1]] = last
    return c


class MemberState(unittest.TestCase):
    T = len(CAL) - 1

    def test_strictly_above_mean(self):
        self.assertEqual(G.member_state(stock(flat(last=10.01)), CAL, self.T), (True, None))

    def test_equal_to_mean_is_false(self):
        self.assertEqual(G.member_state(stock(flat()), CAL, self.T), (False, None))

    def test_window_excludes_today(self):
        # 前 20 日均值 = 10（含当天则 > 10）；当日 10.5 必须高于不含当天的 10 才算真；再造一个只在含当天时才“站上”的反例
        c = flat(); c[CAL[-1]] = 10.5
        self.assertTrue(G.member_state(stock(c), CAL, self.T)[0])
        c = {d: 10.0 for d in CAL}; c[CAL[self.T - 21]] = 30.0; c[CAL[-1]] = 10.5  # t−21 不在窗口内（窗口 = t−20..t−1）
        self.assertTrue(G.member_state(stock(c), CAL, self.T)[0])
        c[CAL[self.T - 1]] = 30.0  # t−1 在窗口内：均值 = 11 > 10.5
        self.assertFalse(G.member_state(stock(c), CAL, self.T)[0])

    def test_missing_kline_in_window_is_unknown_not_filled(self):
        self.assertEqual(G.member_state(stock(flat(missing=[CAL[self.T - 5]])), CAL, self.T), (None, "kline"))
        self.assertEqual(G.member_state(stock(flat(missing=[CAL[-1]])), CAL, self.T), (None, "kline"))
        # 缺的那天在窗口外（t−21）不影响
        self.assertEqual(G.member_state(stock(flat(missing=[CAL[self.T - 21]], last=11)), CAL, self.T), (True, None))

    def test_history_shorter_than_window(self):
        self.assertEqual(G.member_state(stock(flat()), CAL, 19), (None, "kline"))
        self.assertEqual(G.member_state(stock(flat()), CAL, 20)[1], None)

    def test_unknown_adjustment_and_bad_event(self):
        S = G.build_stock([[d, "0", "10", "0", "0", "1"] for d in CAL], None, None)
        self.assertEqual(G.member_state(S, CAL, self.T), (None, "adj"))
        # 腾讯有事件、东财没有 → bad_ev，跨越它的窗口未知；bad_ev 恰在 t−20（窗口左端，不在 (t−20, t]）不影响
        ev_day = CAL[self.T - 3]
        S = stock(flat(), divs=em([]), events={ev_day: "10派1元"})
        self.assertEqual(S["bad_ev"], [ev_day])
        self.assertEqual(G.member_state(S, CAL, self.T), (None, "adj"))
        S = stock(flat(), divs=em([]), events={CAL[self.T - 20]: "10派1元"})
        self.assertEqual(G.member_state(S, CAL, self.T)[1], None)


class StableCompare(unittest.TestCase):
    def test_equal_decimal_prices_are_not_above(self):
        # 二十个相等的复权收盘：朴素 sum/20 会比单值小一个 ulp，得到假站上
        for p, f in [(281.78, 1.691400829417505), (52.316, 1.1729351794564966), (5.5, 2.5082905703125413), (0.7, 1.0)]:
            x = p * f
            self.assertFalse(G.above_mean(x, [x] * 20))
        self.assertTrue(sum([281.78 * 1.691400829417505] * 20) / 20 < 281.78 * 1.691400829417505)  # 旧写法确实会误判

    def test_decimal_mean_equal_to_today_is_not_above(self):
        for a, b, c in [(87.99, 88.09, 88.04), (38.42, 39.12, 38.77), (43.86, 44.26, 44.06)]:
            self.assertTrue(c > sum([a] * 10 + [b] * 10) / 20)  # 旧写法误判
            self.assertFalse(G.above_mean(c, [a] * 10 + [b] * 10))

    def test_real_small_difference_still_counts(self):
        # 最小真实价差：一分钱摊到 20 日、两千元股价，再乘复权因子
        for f in (1.0, 1.2345678, 3.3):
            prev = [2000.00 * f] * 19 + [2000.01 * f]
            self.assertTrue(G.above_mean(2000.01 * f, prev))
            self.assertFalse(G.above_mean(2000.00 * f, prev))
            self.assertTrue(G.above_mean(0.701 * f, [0.70 * f] * 20))
            self.assertFalse(G.above_mean(0.699 * f, [0.70 * f] * 20))


class Adjustment(unittest.TestCase):
    def test_proportional_chain_identity(self):
        c = {d: 10.0 for d in CAL}
        ex = CAL[10]
        for d in CAL[10:]: c[d] = 4.5  # 10 送 10 派 10 元：ref = (10 − 1) / 2 = 4.5
        S = stock(c, divs=em([(ex, "10送10派10元")]), events={ex: "10送10派10元(含税)"})
        self.assertEqual(S["bad_ev"], [])
        self.assertEqual(list(S["good_ev"]), [ex])
        adj = [S["adj"][d] for d in CAL]
        # 除权日：adj_t / adj_{t−1} = raw_t / ref；其余日 = raw_t / raw_{t−1}
        self.assertAlmostEqual(adj[10] / adj[9], 4.5 / 4.5)
        for i in range(1, len(CAL)):
            if i != 10: self.assertAlmostEqual(adj[i] / adj[i - 1], c[CAL[i]] / c[CAL[i - 1]])
        # 后复权方向：除权日前因子为 1
        self.assertEqual(S["adj"][CAL[0]], 10.0)

    def test_amount_mismatch_is_bad(self):
        ex = CAL[10]
        S = stock(flat(), divs=em([(ex, "10派2元")]), events={ex: "10派1元"})
        self.assertEqual(S["bad_ev"], [ex])

    def test_qfq_check_flags_unrecorded_action(self):
        c = {d: 10.0 for d in CAL}
        ex = CAL[12]
        for d in CAL[12:]: c[d] = 9.5
        # 两源都记 10 派 5 元，前复权也一致 → 无断点
        q_ok = [[d, "0", f"{(c[d] - 0.5) if d < ex else c[d]:.3f}"] for d in CAL]
        S = stock(c, divs=em([(ex, "10派5元")]), events={ex: "10派5元"}, qfq=q_ok)
        self.assertEqual(S["qfq_check"]["breaks"], [])
        # 两源都不记，但前复权在 ex 有跳变（如配股）→ 断点并入 bad_ev
        S = stock(c, divs=em([]), qfq=q_ok)
        self.assertEqual(S["qfq_check"]["breaks"], [ex])
        self.assertIn(ex, S["bad_ev"])

    def test_qfq_check_with_bonus_shares(self):
        c = {d: 20.0 for d in CAL}
        ex = CAL[8]
        for d in CAL[8:]: c[d] = 9.0  # 10 转 10 派 2 元：ref = (20 − 0.2) / 2 = 9.9
        c[CAL[20]] = 9.3
        q = [[d, "0", f"{((c[d] - 0.2) / 2) if d < ex else c[d]:.3f}"] for d in CAL]
        S = stock(c, divs=em([(ex, "10转10派2元")]), events={ex: "10转10派2元"}, qfq=q)
        self.assertEqual(S["qfq_check"]["breaks"], [])


class Pcf(unittest.TestCase):
    TEXT = """
                                               ( 2026-11-25 )
                                        基金代码：  159593
                                    目标指数代码：  930050
                        全部申购赎回组合证券只数：  4只(含"159900"证券)
 000333                               美的集团                                  1,000         允许               34.00%                    0.00%                 0.0000           0.0000     深圳市场
 159900                               申赎现金                                      0         必须                0.00%                    0.00%         1,254,969.1000   1,026,792.9000     深圳市场
 600519                               贵州茅台                                    100         允许               10.00%                   10.00%                 0.0000           0.0000     上海市场
 605499                               东鹏饮料                                      0         必须                0.00%                    0.00%                 0.0000           0.0000     上海市场
"""

    def test_members_exclude_cash_placeholder_keep_zero_qty(self):
        b, why = G.verify_pcf(G.parse_szse_pcf(self.TEXT), "159593", "930050", "2026-11-25")
        self.assertIsNone(why)
        self.assertEqual(b["codes"], ["000333", "600519", "605499"])
        self.assertEqual((b["declared"], b["qty0"], b["must_cash"]), (4, 1, 1))

    def test_rejects_mismatches(self):
        x = G.parse_szse_pcf(self.TEXT)
        self.assertIn("日期", G.verify_pcf(x, "159593", "930050", "2026-11-24")[1])
        self.assertIn("目标指数", G.verify_pcf(x, "159593", "000300", "2026-11-25")[1])
        self.assertIn("基金代码", G.verify_pcf(x, "159595", "930050", "2026-11-25")[1])
        y = G.parse_szse_pcf(self.TEXT.replace("4只", "5只"))
        self.assertIn("只数不符", G.verify_pcf(y, "159593", "930050", "2026-11-25")[1])

    def test_lm_gate(self):
        self.assertEqual(G.lm_beijing("Wed, 25 Nov 2026 00:11:08 GMT"), "2026-11-25 08:11:08")
        self.assertIsNone(G.lm_gate("2026-11-25 08:11:08", "2026-11-25"))
        # 比较到秒：09:00:00 有效，09:00:01 起算晚（原研究按分钟比较会把 09:00:59 当有效）
        self.assertIsNone(G.lm_gate("2026-11-25 09:00:00", "2026-11-25"))
        self.assertEqual(G.lm_gate("2026-11-25 09:00:01", "2026-11-25"), "lm_late")
        self.assertEqual(G.lm_gate("2026-11-25 09:00:59", "2026-11-25"), "lm_late")
        self.assertEqual(G.lm_gate("2026-11-24 23:59:59", "2026-11-25"), None)
        self.assertEqual(G.lm_gate(None, "2026-11-25"), "lm_missing")
        self.assertEqual(G.lm_gate("2026-11-25 08:11", "2026-11-25"), "lm_missing")  # 格式不全不猜


class Rows(unittest.TestCase):
    def setUp(self):
        self.t = CAL[-1]; self.y = CAL[-2]
        self.stocks = {f"S{i:02d}": stock(flat(last=11 if i < 10 else 9)) for i in range(20)}
        self.stocks.update({f"X{i}": stock(flat(last=11)) for i in range(3)})
        self.lm = {d: f"{d} 08:10:00" for d in CAL}

    def test_each_day_uses_its_own_basket(self):
        today = sorted(self.stocks)[:20]               # 今天的篮子：S00..S19
        yesterday = ["X0", "X1", "X2"] + today[3:]     # 昨天的篮子含调出成员 X*
        rows, _ = G.compute_rows([self.y, self.t], {self.y: yesterday, self.t: today}, {}, self.lm, self.stocks, CAL)
        by = {r[0]: r for r in rows}
        self.assertEqual(by[self.t][2:5], [10, 20, 20])
        # 昨天：X* 的当日（CAL[-2]）收盘 10 = 均值，S03..S09 也是 10 → 全部为假；若误用今天篮子会得到不同的成员与计数
        self.assertEqual(by[self.y][2:5], [0, 20, 20])
        rows2, _ = G.compute_rows([self.y], {self.t: today}, {}, self.lm, self.stocks, CAL)
        self.assertEqual(rows2[0][1:6], [None, None, None, None, "pcf"])  # 缺当天篮子 → 留空，不拿今天篮子回填

    def test_coverage_boundary(self):
        codes = sorted(self.stocks)[:20]
        self.stocks["S19"] = stock(flat(missing=[CAL[-3]]))   # 1/20 未知 → 覆盖 95%，有效
        rows, _ = G.compute_rows([self.t], {self.t: codes}, {}, self.lm, self.stocks, CAL)
        self.assertEqual(rows[0][1:6], [round(10 / 19, 6), 10, 19, 20, None])
        self.stocks["S18"] = stock(flat(missing=[CAL[-3]]))   # 2/20 未知 → 90%，留空但保留计数
        rows, counts = G.compute_rows([self.t], {self.t: codes}, {}, self.lm, self.stocks, CAL)
        self.assertEqual(rows[0][1:6], [None, 10, 18, 20, "coverage"])
        self.assertEqual(counts["coverage"], 1)

    def test_lm_gate_masks_value_keeps_counts(self):
        codes = sorted(self.stocks)[:20]
        rows, _ = G.compute_rows([self.t], {self.t: codes}, {}, {self.t: f"{self.t} 17:30:00"}, self.stocks, CAL)
        self.assertEqual(rows[0][1:6], [None, 10, 20, 20, "lm_late"])


# ---------------------------------------------------------------- 三个周期：边界、等于均线、缺值、预热、旧快照兼容
CAL2 = [(__import__("datetime").date(2025, 1, 1) + __import__("datetime").timedelta(days=i)).isoformat() for i in range(130)]  # 130 个合成交易日


def stock2(closes: dict, events=None, divs=None):
    raw = []
    for d in sorted(closes):
        row = [d, "0", str(closes[d]), "0", "0", "1"]
        if events and d in events: row.append({"FHcontent": events[d]})
        raw.append(row)
    return G.build_stock(raw, divs if divs is not None else {"success": False, "code": 9201}, None if divs is not None else [], None)


class Windows(unittest.TestCase):
    T = len(CAL2) - 1

    def flat2(self, **over):
        c = {d: 10.0 for d in CAL2}
        for k, v in over.items(): c[CAL2[int(k[1:])]] = v
        return c

    def test_window_bounds_each_period(self):
        for n in G.WINDOWS:
            with self.subTest(n=n):
                spike = 10 + 0.5 * n + 30                      # 单日足以把 n 日均值抬过 10.5
                c = {d: 10.0 for d in CAL2}; c[CAL2[-1]] = 10.5
                c[CAL2[self.T - n - 1]] = spike                 # t−n−1：在窗口外
                self.assertEqual(G.member_state(stock2(c), CAL2, self.T, n), (True, None))
                c[CAL2[self.T - n]] = spike                     # t−n：窗口最左一天（窗口 = t−n..t−1，不含 t）
                self.assertEqual(G.member_state(stock2(c), CAL2, self.T, n), (False, None))

    def test_equal_to_mean_is_not_above_each_period(self):
        for n in G.WINDOWS:
            with self.subTest(n=n):
                self.assertEqual(G.member_state(stock2({d: 10.0 for d in CAL2}), CAL2, self.T, n), (False, None))
                # 十进制价格均值恰等于当日价：一半 15.62、一半 15.64，当日 15.63
                c = {d: (15.62 if i % 2 else 15.64) for i, d in enumerate(CAL2)}; c[CAL2[-1]] = 15.63
                if n % 2: c[CAL2[self.T - n]] = 15.63               # 奇数长度窗口补一个等值日
                self.assertFalse(G.member_state(stock2(c), CAL2, self.T, n)[0])

    def test_missing_and_short_history_each_period(self):
        for n in G.WINDOWS:
            with self.subTest(n=n):
                c = {d: 10.0 for d in CAL2}; del c[CAL2[self.T - n]]
                self.assertEqual(G.member_state(stock2(c), CAL2, self.T, n), (None, "kline"))
                c = {d: 10.0 for d in CAL2}; del c[CAL2[self.T - n - 1]]
                self.assertEqual(G.member_state(stock2(c), CAL2, self.T, n)[1], None)
                self.assertEqual(G.member_state(stock2({d: 10.0 for d in CAL2}), CAL2, n - 1, n), (None, "kline"))
                self.assertEqual(G.member_state(stock2({d: 10.0 for d in CAL2}), CAL2, n, n)[1], None)
        # 同一缺日只影响覆盖到它的周期：t−30 缺数 → B20 仍有效，B55/B120 未知
        c = {d: 10.0 for d in CAL2}; del c[CAL2[self.T - 30]]
        self.assertEqual([G.member_state(stock2(c), CAL2, self.T, n)[1] for n in G.WINDOWS], [None, "kline", "kline"])

    def test_bad_event_only_blanks_windows_that_span_it(self):
        ev = CAL2[self.T - 40]
        S = stock2({d: 10.0 for d in CAL2}, events={ev: "10派1元"}, divs=G_em_empty())
        self.assertEqual(S["bad_ev"], [ev])
        self.assertEqual([G.member_state(S, CAL2, self.T, n)[1] for n in G.WINDOWS], [None, "adj", "adj"])
        # 事件恰在 t−n（窗口左端，不在 (t−n, t]）不影响该周期
        S = stock2({d: 10.0 for d in CAL2}, events={CAL2[self.T - 55]: "10派1元"}, divs=G_em_empty())
        self.assertEqual(G.member_state(S, CAL2, self.T, 55)[1], None)
        self.assertEqual(G.member_state(S, CAL2, self.T, 120)[1], "adj")

    def test_rows_warmup_priority(self):
        stocks = {f"S{i:02d}": stock2({d: 10.0 for d in CAL2}) for i in range(20)}
        codes = sorted(stocks)
        days = [CAL2[54], CAL2[55], CAL2[119], CAL2[120]]
        lm = {d: f"{d} 08:00:00" for d in CAL2}
        for n, first_ok in ((55, CAL2[55]), (120, CAL2[120])):
            rows, counts = G.compute_rows(days, {d: codes for d in days}, {}, lm, stocks, CAL2, n)
            by = {r[0]: r for r in rows}
            for d in days:
                if d < first_ok: self.assertEqual(by[d][1:6], [None, None, None, 20, "warmup"]); self.assertIn(f"需此前 {n} 个交易日", by[d][6])
                else: self.assertEqual(by[d][1:6], [0.0, 0, 20, 20, None])
            self.assertEqual(counts["warmup"], sum(d < first_ok for d in days))
        # 优先级：缺篮子 > 预热；预热 > Last-Modified 门槛
        rows, _ = G.compute_rows([CAL2[10]], {}, {CAL2[10]: "PCF 404"}, lm, stocks, CAL2, 55)
        self.assertEqual(rows[0][5], "pcf")
        rows, _ = G.compute_rows([CAL2[10]], {CAL2[10]: codes}, {}, {CAL2[10]: f"{CAL2[10]} 09:30:00"}, stocks, CAL2, 55)
        self.assertEqual(rows[0][5], "warmup")
        # B20 的结果与只传默认周期完全一致（旧调用方式）
        self.assertEqual(G.compute_rows(days, {d: codes for d in days}, {}, lm, stocks, CAL2), G.compute_rows(days, {d: codes for d in days}, {}, lm, stocks, CAL2, 20))


def G_em_empty():
    return {"success": True, "result": {"pages": 1, "data": []}}


class Compat(unittest.TestCase):
    V1 = {"version": 1, "through": "2026-11-25", "rows": [["2026-11-24", 0.5, 25, 50, 50, None, None], ["2026-11-25", 0.3, 15, 50, 50, None, None]]}

    def v2(self, b20, b55=None, b120=None, through="2026-11-25"):
        series = {"20": {"rows": b20}}
        if b55 is not None: series["55"] = {"rows": b55}
        if b120 is not None: series["120"] = {"rows": b120}
        return {"version": 2, "through": through, "series": series}

    def test_v1_snapshot_reads_as_b20(self):
        self.assertEqual(G.page_series(self.V1), {"20": self.V1["rows"]})
        new = self.v2(self.V1["rows"], b55=[["2026-11-25", None, None, None, 50, "warmup", "x"]], b120=[])
        self.assertEqual(G.regressions(self.V1, new), [])          # 迁移：新增周期不算回退
        self.assertEqual(G.value_changes(self.V1, new), [])

    def test_v1_values_cannot_be_blanked_by_v2(self):
        bad = self.v2([["2026-11-24", None, 20, 44, 50, "coverage", "未知 6"], self.V1["rows"][1]])
        self.assertEqual(G.regressions(self.V1, bad), ["B20 2026-11-24 由 0.5 变为缺失（coverage：未知 6）"])

    def test_each_period_guarded(self):
        old = self.v2(self.V1["rows"], b55=[["2026-11-25", 0.46, 23, 50, 50, None, None]], b120=[["2026-11-25", 0.44, 22, 50, 50, None, None]])
        new = self.v2(self.V1["rows"], b55=[["2026-11-25", 0.46, 23, 50, 50, None, None]], b120=[["2026-11-25", None, None, None, 50, "warmup", "x"]])
        self.assertEqual(G.regressions(old, new), ["B120 2026-11-25 由 0.44 变为缺失（warmup：x）"])
        gone = self.v2(self.V1["rows"], b55=[["2026-11-25", 0.46, 23, 50, 50, None, None]])
        self.assertEqual(G.regressions(old, gone), ["B120 2026-11-25 行消失（原值 0.44）"])
        moved = self.v2(self.V1["rows"], b55=[["2026-11-25", 0.48, 24, 50, 50, None, None]], b120=old["series"]["120"]["rows"])
        self.assertEqual(G.value_changes(old, moved), [("55", "2026-11-25", 0.46, 0.48, [23, 50, 50], [24, 50, 50])])


# ---------------------------------------------------------------- 更新流程：假网络上的封锁 / 瞬时失败 / 回退 / 无变化
import datetime as _dt  # noqa: E402
import email.utils as _eu  # noqa: E402
import io  # noqa: E402
import json  # noqa: E402
import tempfile  # noqa: E402
import urllib.error  # noqa: E402
from pathlib import Path  # noqa: E402
from unittest import mock  # noqa: E402

MEMBERS = ["000001", "300001", "600000"]


def business_days(start, end):
    d, out = _dt.date.fromisoformat(start), []
    while d.isoformat() <= end:
        if d.weekday() < 5: out.append(d.isoformat())
        d += _dt.timedelta(days=1)
    return out


class FakeNet:
    """按 URL 返回合成数据：沪深300 / ETF / 三只成员的腾讯日线，逐日 PCF，东财空分红表。fail 指定要模拟的失败。"""
    def __init__(self, end="2024-04-10"):
        self.days = business_days("2024-01-02", end)
        self.fail = {}        # 键：'pcf:YYYYMMDD' / 'tx:sym' / 'em:code' → 403 或 'oserror'
        self.drop = {}        # 'sym' → 该股行情里缺掉的日期集合（模拟数据源静默缺行）
        self.calls = 0
        self.urls = []

    def price(self, sym, i):
        k = sum(map(ord, sym))
        return round(10 + ((i * 7 + k) % 13) / 10, 2)

    def kline(self, sym, fq):
        rows = [[d, "0", f"{self.price(sym, i):.2f}", "0", "0", "1"] for i, d in enumerate(self.days) if d not in self.drop.get(sym, ())]
        if sym == "sz159593": rows = [r for r in rows if r[0] >= "2024-03-12"]
        key = "qfqday" if fq == "qfq" and sym != "sh600000" else "day"  # 600000 模拟从未除权的股票：前复权请求只回 day
        return {"data": {sym: {key: rows}}}

    def pcf(self, d):
        lines = [f"( {d} )", "基金代码：  159593", "目标指数代码：  930050", f"全部申购赎回组合证券只数：  {len(MEMBERS) + 1}只"]
        for c in MEMBERS + ["159900"]:
            lines.append(f" {c}  名称{c}  100  允许  10.00%  10.00%  0.0000  0.0000  深圳市场")
        return "\n".join(lines).encode("gbk")

    def __call__(self, req, timeout=None):
        self.calls += 1
        url = req.full_url
        self.urls.append(url)
        def boom(key):
            how = self.fail.get(key)
            if how in (403, 429, 501): raise urllib.error.HTTPError(url, how, "denied", {}, None)
            if how == "oserror": raise urllib.error.URLError("connection reset")
        if "reportdocs" in url:
            ymd = url[-12:-4]; boom(f"pcf:{ymd}")
            d = f"{ymd[:4]}-{ymd[4:6]}-{ymd[6:]}"
            lm = _eu.format_datetime(_dt.datetime.fromisoformat(f"{d}T00:10:00+00:00"), usegmt=True)
            return Resp(self.pcf(d), {"Last-Modified": lm})
        if "fqkline" in url:
            param = url.split("param=")[1].split(","); sym = param[0]; boom(f"tx:{sym}")
            return Resp(json.dumps(self.kline(sym, param[5])).encode())
        if "eastmoney" in url:
            code = url.split("%22")[1]; boom(f"em:{code}")
            return Resp(json.dumps({"success": True, "result": {"pages": 1, "data": []}}).encode())
        raise AssertionError(url)


class Resp(io.BytesIO):
    def __init__(self, body, headers=None):
        super().__init__(body); self.status = 200; self.headers = headers or {}


class UpdateFlow(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); root = Path(self.tmp.name)
        self.patches = [mock.patch.object(G, "ROOT", root), mock.patch.object(G, "CACHE", root / "cache"),
                        mock.patch.dict(G.GAPS, {k: 0 for k in G.GAPS}), mock.patch.object(G, "BACKOFF", 0)]
        for p in self.patches: p.start()
        self.net = FakeNet()
        self.page, self.prov = G.outputs("159593")

    def tearDown(self):
        for p in self.patches: p.stop()
        self.tmp.cleanup()

    def run_update(self, **kw):
        with mock.patch.object(G.urllib.request, "urlopen", self.net):
            return G.update("159593", offline=False, log=lambda *_: None, **kw)

    def snapshot(self):
        return self.page.read_bytes(), self.prov.read_bytes()

    def good_first(self):
        res = self.run_update()
        self.assertEqual(res["status"], "written")
        return self.snapshot()

    def test_first_run_writes_and_rerun_is_unchanged(self):
        before = self.good_first()
        rows = json.loads(before[0])["series"]["20"]["rows"]
        self.assertEqual(rows[0][0], "2024-03-12")
        qfq = json.loads(before[1])["stocks"]["600000"]["tencent_qfq"]["pages"][0]
        self.assertEqual((qfq["field"], qfq["rows"] > 0), ("day", True))  # 只回 day 键时照用并记下
        self.assertTrue(all(r[1] is not None for r in rows))
        res = self.run_update()
        self.assertEqual(res["status"], "unchanged")      # 无变化：两份文件都不重写，不会产生新提交
        self.assertEqual(self.snapshot(), before)
        self.assertEqual(G.EXIT[res["status"]], 0)

    def test_three_periods_share_one_fetch_and_warm_up_honestly(self):
        before = self.good_first()
        page = json.loads(before[0])
        self.assertEqual((page["version"], page["windows"], sorted(page["series"])), (2, [20, 55, 120], ["120", "20", "55"]))
        # 合成日历自 2024-01-02 起，上市首日 2024-03-12 前只有 50 个交易日：B55 前 5 日、B120 全部预热不足
        b55 = page["series"]["55"]; b120 = page["series"]["120"]
        self.assertEqual([r[5] for r in b55["rows"][:6]], ["warmup"] * 5 + [None])
        self.assertEqual((b55["summary"]["warmupFrom"], b55["summary"]["warmupTo"]), ("2024-03-12", "2024-03-18"))
        self.assertTrue(all(r[5] == "warmup" for r in b120["rows"]))
        self.assertEqual(b120["summary"]["firstValid"], None)
        # 三个周期共用一次取数：每只成员的腾讯日线各 1 次（不复权 + 前复权），没有按周期重复请求
        tx = [u for u in self.net.urls if "fqkline" in u and "sz000001" in u]
        self.assertEqual(len(tx), 2)

    def test_v1_snapshot_migrates_without_changing_b20(self):
        before = self.good_first()
        page = json.loads(before[0])
        v1 = {"version": 1, "code": "159593", "through": page["through"], "generatedAt": "old", "fields": page["fields"], "rows": page["series"]["20"]["rows"]}
        self.page.write_text(json.dumps(v1))
        res = self.run_update()
        self.assertEqual((res["status"], res["regressions"], res["changes"]), ("written", [], []))
        self.assertEqual(json.loads(self.page.read_text())["series"]["20"]["rows"], v1["rows"])
        # v1 快照下数据源静默少一天：B20 过去有值的日期不能被抹掉
        self.page.write_text(json.dumps(v1)); self.net.drop = {"sz000001": {"2024-03-20"}}
        self.assertEqual(self.run_update()["status"], "regressed")
        self.assertEqual(json.loads(self.page.read_text()), v1)

    def test_blocked_source_keeps_existing_files(self):
        before = self.good_first()
        for key in ("tx:sh600000", "em:300001", "pcf:20240410"):
            with self.subTest(key=key):
                self.net.fail = {key: 403}
                if key.startswith("pcf"):  # PCF 已有记录不重取：去掉最后一天的清单记录，模拟新一天要抓
                    prov = json.loads(self.prov.read_text()); prov["pcf"].pop("2024-04-10"); self.prov.write_text(json.dumps(prov))
                    before = self.snapshot()
                res = self.run_update()
                self.assertEqual(res["status"], "failed")
                self.assertTrue(any("403" in f for f in res["failures"]))
                self.assertEqual(G.EXIT[res["status"]], 2)
                self.assertEqual(self.snapshot(), before)

    def test_transient_failure_keeps_existing_files(self):
        before = self.good_first()
        for key in ("tx:sz000001", "em:600000", "tx:sh000300"):
            with self.subTest(key=key):
                self.net.fail = {key: "oserror"}
                res = self.run_update()
                self.assertEqual(res["status"], "failed")
                self.assertEqual(self.snapshot(), before)

    def test_stops_fetching_after_first_failure(self):
        before = self.good_first()
        self.net.urls = []
        self.net.fail = {"tx:sz000001": 501}             # 来源拒绝（非 403/429）：重试后仍失败
        res = self.run_update()
        self.assertEqual(res["status"], "failed")
        self.assertEqual(self.snapshot(), before)
        later = [u for u in self.net.urls if "sz300001" in u or "sh600000" in u or "eastmoney" in u]
        self.assertEqual(later, [])                       # 之后的成员一个都不再请求
        self.assertEqual(sum("sz000001" in u for u in self.net.urls), 4)  # 只有该请求自身的 1 + 3 次重试

    def test_silently_incomplete_source_cannot_erase_history(self):
        before = self.good_first()
        self.net.drop = {"sz000001": {"2024-03-20"}}     # 数据源静默少一天：多个过去有数的日期会被重算成缺失
        res = self.run_update()
        self.assertEqual(res["status"], "regressed")
        self.assertTrue(res["regressions"])
        self.assertEqual(G.EXIT[res["status"]], 3)
        self.assertEqual(self.snapshot(), before)
        res = self.run_update(allow_regress=True)        # 人工确认后才写
        self.assertEqual(res["status"], "written")

    def test_new_day_may_be_marked_coverage_short(self):
        self.good_first()
        self.net.days = business_days("2024-01-02", "2024-04-11")
        self.net.drop = {"sz000001": {"2024-04-11"}}     # 新交易日一只成员缺 K 线：如实标覆盖不足
        res = self.run_update()
        self.assertEqual(res["status"], "written")
        rows = {r[0]: r for r in json.loads(self.page.read_text())["series"]["20"]["rows"]}
        self.assertEqual(rows["2024-04-11"][1:6], [None, rows["2024-04-11"][2], 2, 3, "coverage"])
        self.assertIsNotNone(rows["2024-04-10"][1])
        prov = json.loads(self.prov.read_text())
        self.assertEqual(prov["through"], "2024-04-11")
        self.assertIn("2024-04-11", prov["pcf"])

    def test_main_exit_codes(self):
        self.good_first()
        self.net.fail = {"tx:sh600000": 429}
        with mock.patch.object(G.urllib.request, "urlopen", self.net), mock.patch("builtins.print"):
            self.assertEqual(G.main(["update"]), 2)


if __name__ == "__main__":
    unittest.main()
