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


def main() -> None:
    df = ak.stock_ebs_lg()
    df = df.rename(columns={"日期": "date", "沪深300指数": "index", "股债利差": "spread"})
    df = df.dropna(subset=["spread", "index"]).sort_values("date")
    # 上游给的是小数（0.06 即 6 个百分点），统一换成百分点
    scale = 100 if df["spread"].abs().max() < 1 else 1
    rows = [[str(d)[:10], round(float(s) * scale, 3), round(float(i), 2)] for d, s, i in zip(df["date"], df["spread"], df["index"])]
    if len(rows) < 1000:
        raise SystemExit(f"只取到 {len(rows)} 行，疑似上游异常，未写入")
    snapshot = {
        "generatedAt": date.today().isoformat(),
        "source": "乐咕乐股·股债利差（经 AkShare）",
        "window": 750,
        "k": 2,
        "rows": rows,
    }
    OUT.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"已写入 {OUT}：{len(rows)} 行，{rows[0][0]} 至 {rows[-1][0]}，最新息差 {rows[-1][1]}")


if __name__ == "__main__":
    main()
