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
        self.assertIsNone(G.lm_gate("2026-11-25 09:00:59", "2026-11-25"))  # 同原研究按分钟比较
        self.assertEqual(G.lm_gate("2026-11-25 09:01:00", "2026-11-25"), "lm_late")
        self.assertEqual(G.lm_gate(None, "2026-11-25"), "lm_missing")


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


if __name__ == "__main__":
    unittest.main()
