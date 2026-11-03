"""采集归档里涨停股的历史开盘价、收盘价和前收盘，供打板溢价回补使用。

用法：python scripts/python/collect_premium_history.py public/data/daily-analysis.json 输出.json
依赖：pip install baostock。baostock 不含北交所，北交所股票会缺失，由回补脚本的覆盖率把关。
"""
import json
import sys

import baostock as bs


def main(archive_path, output_path):
    with open(archive_path, encoding="utf-8") as handle:
        snapshots = json.load(handle)["snapshots"]
    dates = sorted(row["dataDate"] for row in snapshots)
    start, end = dates[0], dates[-1]
    codes = sorted({stock["code"] for row in snapshots for stock in row["upStocks"]})

    login = bs.login()
    if login.error_code != "0":
        raise SystemExit(f"baostock 登录失败：{login.error_msg}")
    try:
        calendar = bs.query_trade_dates(start_date=start, end_date=end)
        trading_dates = []
        while calendar.next():
            date, is_trading = calendar.get_row_data()
            if is_trading == "1":
                trading_dates.append(date)
        if not trading_dates:
            raise SystemExit("baostock 交易日历为空")

        prices, failed = {}, []
        for number, code in enumerate(codes, 1):
            if code[0] in "489":
                continue
            exchange = "sh" if code[0] == "6" else "sz"
            # adjustflag=3 不复权：preclose 已按除权除息调整，与当天开盘、收盘直接可比。
            result = bs.query_history_k_data_plus(f"{exchange}.{code}", "date,open,close,preclose,tradestatus", start_date=start, end_date=end, frequency="d", adjustflag="3")
            if result.error_code != "0":
                failed.append(code)
                continue
            rows = {}
            while result.next():
                date, open_price, close, previous_close, status = result.get_row_data()
                if status == "1" and open_price and close and previous_close:
                    rows[date] = [float(open_price), float(close), float(previous_close)]
            prices[code] = rows
            if number % 100 == 0:
                print(f"{number}/{len(codes)}", file=sys.stderr, flush=True)
    finally:
        bs.logout()

    if failed:
        print(f"查询失败 {len(failed)} 只：{','.join(failed[:20])}", file=sys.stderr)
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump({"tradingDates": trading_dates, "prices": prices}, handle)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("用法：collect_premium_history.py 归档.json 输出.json")
    main(sys.argv[1], sys.argv[2])
