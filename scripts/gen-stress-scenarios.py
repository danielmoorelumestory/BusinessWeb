"""由书稿附件的真实历史序列生成压力情景数据 src/data/stressScenarios.ts。
窗口在生成前固定，不按结果挑选；资产在窗口起点之前没有数据时记为 null，不用其他资产替代。
数据口径同书第9章9.7：红利、沪深300、标普500 为全收益，国债指数含利息，黄金为ETF收盘价，
恒生科技为价格指数，均未计汇率。"""
import csv, json, pathlib, datetime as dt

ROOT = pathlib.Path(__file__).resolve().parents[2] / "book-慢即是快" / "附件-数据"
FILES = {
    "dividend": "第十五轮-全收益/H00922.csv",
    "bond": "sh000012.csv",
    "sp500": "第十五轮-全收益/SP500TR.csv",
    "gold": "sh518880.csv",
    "hstech": "hkHSTECH.csv",
    "csi300": "第十五轮-全收益/H00300.csv",
}
SCENARIOS = [
    ("gfc2008", "2008 全球金融危机", "2008-01-02", "2008-12-31",
     "全年窗口，沿用书里跨周期压力检查的窗口。黄金ETF（2013年起）与恒生科技（2020年起）当时没有数据。"),
    ("crash2015", "2015 年夏 A 股股灾", "2015-06-12", "2015-09-30",
     "从上证综指高点附近到三季度末。恒生科技当时没有数据。"),
    ("covid2020", "2020 年 3 月流动性踩踏", "2020-02-19", "2020-03-23",
     "标普500 高点到低点：多数资产同跌，连黄金也被抛售。恒生科技2020年7月才开始有数据。"),
    ("hike2022", "2022 美联储加息：股债双杀", "2022-01-04", "2022-12-30",
     "全年窗口，五类资产都有数据。"),
    ("hstech2122", "2021–2022 恒生科技深跌", "2021-02-17", "2022-10-31",
     "恒生科技从高点到低点的整段下跌，用来看主题指数的极端情形。"),
]

def load(path):
    rows = list(csv.reader((ROOT / path).open()))[1:]
    return sorted((r[0], float(r[1])) for r in rows)

DATA = {k: load(v) for k, v in FILES.items()}

def at_or_before(series, d):
    last = None
    for day, v in series:
        if day > d: break
        last = v
    return last

out = []
for sid, name, start, end, note in SCENARIOS:
    days = sorted({d for s in DATA.values() for d, _ in s if start <= d <= end} | {start, end})
    # 日期并集，休市沿用最后可用值；起点需要有数据才算该资产可用
    avail = {k: (s[0][0] <= start) for k, s in DATA.items()}
    if (dt.date.fromisoformat(end) - dt.date.fromisoformat(start)).days > 120:
        weeks = {}
        for d in days:
            y, w, _ = dt.date.fromisoformat(d).isocalendar(); weeks[(y, w)] = d
        keep = set(weeks.values()) | {start, end}
        days = [d for d in days if d in keep]
    series = {}
    for k, s in DATA.items():
        if not avail[k]:
            series[k] = None; continue
        base = at_or_before(s, start)
        series[k] = [round(at_or_before(s, d) / base, 4) for d in days]
    out.append({"id": sid, "name": name, "start": start, "end": end, "note": note, "dates": days, "series": series})

ts = ("// 由 scripts/gen-stress-scenarios.py 生成，勿手改。来源与口径见脚本顶部说明。\n"
      "export interface StressScenario {\n  id: string\n  name: string\n  start: string\n  end: string\n  note: string\n"
      "  dates: string[]\n  /** 各资产自窗口起点归一为 1 的序列；窗口起点前没有数据的资产为 null */\n"
      "  series: Record<'dividend' | 'bond' | 'sp500' | 'gold' | 'hstech' | 'csi300', number[] | null>\n}\n\n"
      "export const STRESS_SCENARIOS: StressScenario[] = " + json.dumps(out, ensure_ascii=False, indent=1) + "\n")
(pathlib.Path(__file__).resolve().parents[1] / "src/data/stressScenarios.ts").write_text(ts)
for o in out:
    print(o["id"], len(o["dates"]), {k: (None if v is None else round(v[-1] - 1, 3)) for k, v in o["series"].items()})
