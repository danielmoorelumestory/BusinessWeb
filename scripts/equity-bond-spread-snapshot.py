#!/usr/bin/env python3
"""生成监控页「股债息差」标签页的数据快照 public/data/equity-bond-spread.json。

数据来自乐咕乐股的股债利差（沪深300 盈利收益率减 10 年期国债收益率），通过 AkShare 获取。
只保存原始序列，通道在前端计算。用法：npm run spread:update（需要 pip install akshare）。
"""
import json
from datetime import date
from pathlib import Path

import akshare as ak

OUT = Path(__file__).resolve().parent.parent / "public" / "data" / "equity-bond-spread.json"


APPROX = "只有月度的市盈率数据，每天的息差是用月末的盈利水平配合当天收盘价推算的，和真实值有小幅出入，触轨日期可能差几天。"
# (id, 指数名, 按钮文字, 行情代码, 市盈率口径, 说明)
OTHERS = [
    ("csi300-median", "沪深300", "沪深300（中位数）", "sh000300", "滚动市盈率中位数",
     "中位数口径：把 300 家成分股的市盈率从低到高排队，取中间那一家，不受几家大银行影响，更接近一只普通成分股的估值。"
     "这个口径历史上触上轨之后的表现看起来更好，但换到别的指数上并不稳定，这里只作对照，不代表它更准。" + APPROX),
    ("sse50", "上证50", "上证50", "sh000016", "滚动市盈率", "上证50 " + APPROX),
]


def other_index(key: str, name: str, label: str, code: str, column: str, note: str) -> dict:
    """其他指数或口径：乐咕只给月频市盈率，用月末的 指数/市盈率 得到盈利并向后沿用，再按每日收盘还原息差（不含未来数据）。"""
    import pandas as pd

    pe = ak.stock_index_pe_lg(symbol=name)
    pe["日期"] = pd.to_datetime(pe["日期"])
    earn = (pe["指数"] / pe[column]).set_axis(pe["日期"])
    px = ak.stock_zh_index_daily(symbol=code)
    px["date"] = pd.to_datetime(px["date"])
    close = px.set_index("date")["close"]
    bond = ak.bond_zh_us_rate(start_date="20050101")[["日期", "中国国债收益率10年"]].dropna()
    bond = bond.set_axis(pd.to_datetime(bond["日期"]))["中国国债收益率10年"]
    earn = earn.reindex(close.index.union(earn.index)).ffill().reindex(close.index)
    spread = (earn / close * 100 - bond.reindex(close.index).ffill()).dropna()
    rows = [[d.strftime("%Y-%m-%d"), round(float(v), 3), round(float(close[d]), 2)] for d, v in spread.items()]
    if len(rows) < 500:
        raise SystemExit(f"{label} 只取到 {len(rows)} 行，疑似上游异常，未写入")
    print(f"{label}：{len(rows)} 行，{rows[0][0]} 至 {rows[-1][0]}，最新息差 {rows[-1][1]}")
    return {"id": key, "name": name, "label": label, "note": note, "rows": rows}


def main() -> None:
    df = ak.stock_ebs_lg()
    df = df.rename(columns={"日期": "date", "沪深300指数": "index", "股债利差": "spread"})
    df = df.dropna(subset=["spread", "index"]).sort_values("date")
    # 上游给的是小数（0.06 即 6 个百分点），统一换成百分点
    scale = 100 if df["spread"].abs().max() < 1 else 1
    rows = [[str(d)[:10], round(float(s) * scale, 3), round(float(i), 2)] for d, s, i in zip(df["date"], df["spread"], df["index"])]
    if len(rows) < 1000:
        raise SystemExit(f"只取到 {len(rows)} 行，疑似上游异常，未写入")
    extra = [other_index(*item) for item in OTHERS]
    snapshot = {
        "generatedAt": date.today().isoformat(),
        "source": "乐咕乐股·股债利差（经 AkShare）",
        "window": 750,
        "k": 2,
        "rows": rows,
        "extra": extra,
    }
    OUT.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"已写入 {OUT}：{len(rows)} 行，{rows[0][0]} 至 {rows[-1][0]}，最新息差 {rows[-1][1]}")


if __name__ == "__main__":
    main()
