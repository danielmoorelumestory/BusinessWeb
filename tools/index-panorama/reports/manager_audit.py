"""Codex 二审：用 Python 标准库独立复算真实数据，核对 JS 结果。

运行：python3 reports/manager_audit.py。只读生产数据，不联网。
"""
import datetime as dt
import hashlib
import itertools
import json
import math
from pathlib import Path
import statistics as stat
import subprocess

ROOT = Path(__file__).resolve().parents[1]
raw = (ROOT / "data-bundle.js").read_text()
data = json.loads(raw.split("window.PANO_DATA=", 1)[1].strip().removesuffix(";"))
anchor = dt.date.fromisoformat(data["asOf"])
node_code = """
const fs=require('fs'),vm=require('vm'),M=require('./analytics.js');
const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync('data-bundle.js','utf8'),c);
const d=c.window.PANO_DATA,results=[];
for(const s of d.indices)for(const range of ['1','3','5','10','all'])for(const metric of M.FIELDS)
  results.push({code:s.code,range,metric,stats:M.stats(s,metric,range,d.asOf),dd:M.drawdown(M.sliceSeries(s,range,d.asOf))});
const compare=M.compare(d.indices.filter(s=>['000300.SH','000905.SH','HSI.HK'].includes(s.code)),'10',d.asOf);
process.stdout.write(JSON.stringify({results,compare}));
"""
js = json.loads(subprocess.check_output(["node", "-e", node_code], cwd=ROOT))
by_code = {s["code"]: s for s in data["indices"]}


def near(a, b):
    assert a is not None and b is not None
    assert math.isclose(a, b, rel_tol=1e-10, abs_tol=1e-8), (a, b)


def cutoff(years):
    if years == "all":
        return dt.date.min.isoformat()
    y = anchor.year - int(years)
    try:
        return anchor.replace(year=y).isoformat()
    except ValueError:
        return dt.date(y, 2, 28).isoformat()


def pairs(s, field, years="all"):
    return [(d, v) for d, v in zip(s["d"], s[field])
            if cutoff(years) <= d <= data["asOf"] and v is not None
            and math.isfinite(v) and (field != "price" or v > 0)]


fields = ["price", "chg", "pe", "pb", "dy", "mcap", "amt", "turn", "eps", "roe", "bps", "volume"]
for s in data["indices"]:
    assert s["d"] == sorted(set(s["d"])), s["code"]
    for f in fields:
        assert len(s[f]) == len(s["d"]), (s["code"], f)
        assert all(v is None or math.isfinite(v) for v in s[f]), (s["code"], f)
    if s["category"] != "跨境对照":
        # 估值/报告日期可在周末；只对实际价格观测执行交易日检查。
        assert all(dt.date.fromisoformat(d).weekday() < 5
                   for d, price in zip(s["d"], s["price"]) if price is not None), s["code"]

for case in js["results"]:
    s = by_code[case["code"]]
    pv = pairs(s, case["metric"], case["range"])
    st = case["stats"]
    assert st["count"] == len(pv)
    if pv:
        dates, values = zip(*pv)
        near(st["latest"], values[-1])
        assert st["latestDate"] == dates[-1]
        near(st["mean"], stat.fmean(values))
        near(st["min"], min(values))
        near(st["max"], max(values))
        assert st["minDate"] == dates[values.index(min(values))]
        assert st["maxDate"] == dates[values.index(max(values))]
        near(st["percentile"], 100 * sum(v <= values[-1] for v in values) / len(values))
        if len(values) >= 2:
            quintiles = stat.quantiles(values, n=5, method="inclusive")
            near(st["q20"], quintiles[0])
            near(st["q80"], quintiles[-1])
            if values[0]:
                near(st["changePct"], 100 * (values[-1] - values[0]) / abs(values[0]))
    else:
        assert st["latest"] is None and st["percentile"] is None
    price = [v for _, v in pairs(s, "price", case["range"])]
    if price:
        peaks = itertools.accumulate(price, max)
        expected_dd = min(100 * (v / p - 1) for v, p in zip(price, peaks))
        near(case["dd"]["maxDrawdown"], expected_dd)
    else:
        assert case["dd"] is None

# 不依赖 JS 的周划分实现：Python datetime 周一日期 + statistics.correlation。
cmp = js["compare"]
maps = {c: dict(pairs(by_code[c], "price", "10")) for c in cmp["corr"]["codes"]}
common = sorted(set.intersection(*(set(x) for x in maps.values())))
assert cmp["dates"] == common
for line in cmp["lines"]:
    m = maps[line["code"]]
    for d, v in zip(common, line["values"]):
        near(v, 100 * m[d] / m[common[0]])
weeks = {}
for d in common:
    day = dt.date.fromisoformat(d)
    weeks[day - dt.timedelta(days=day.weekday())] = d
week_starts = sorted(weeks)
week_pairs = [(weeks[a], weeks[b]) for a, b in zip(week_starts, week_starts[1:])
              if (b - a).days == 7]
returns = {c: [m[b] / m[a] - 1 for a, b in week_pairs] for c, m in maps.items()}
for i, a in enumerate(cmp["corr"]["codes"]):
    for j, b in enumerate(cmp["corr"]["codes"]):
        near(cmp["corr"]["matrix"][i][j], stat.correlation(returns[a], returns[b]))
        assert cmp["corr"]["counts"][i][j] == len(week_pairs)

# 与本轮最初成功取得的中证官网/腾讯响应抽样对照，不以计算结果自证来源单位。
s = by_code["000300.SH"]
i = s["d"].index("2026-11-11")
near(s["price"][i], 4075.71)
near(s["amt"][i], 4421.28)
near(s["volume"][i], 16119926200)
near(s["price"][s["d"].index("2026-11-13")], 4016.29)

result = {
    "outcome": "passed", "bundleSha256": hashlib.sha256(raw.encode()).hexdigest(),
    "asOf": data["asOf"], "indices": len(data["indices"]),
    "statsAndDrawdownCases": len(js["results"]), "correlationCells": len(maps) ** 2,
    "comparisonCommonDays": len(common), "weeklyReturnPairs": len(week_pairs),
    "sourceSpotChecks": 4,
    "fieldObservationCounts": {f: sum(v is not None for s in data["indices"] for v in s[f])
                      for f in ["pe", "pb", "dy", "mcap", "turn", "eps", "roe", "bps"]},
    "limits": ["本审查只复核实际观测的数值计算；缺失字段、单期或短窗口限制详见逐页报告与coverage。",
               "原始缓存上游未独立全面核验，缺少原站授权数据，未做逐位一致性承诺。"]
}
(ROOT / "reports" / "manager-math-audit.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(result, ensure_ascii=False, indent=2))
