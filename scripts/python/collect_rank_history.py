"""一次性回补历史「成交额/换手率前五」：用 baostock 取沪深全部 A 股的日线成交额与换手率，按交易日排序后输出 JSON。

baostock 不含北交所，所以换手率榜可能与含北交所的真实榜单不一致；是否可信由 Node 端用已归档的真实榜单核对。
用法：python collect_rank_history.py START END OUT.json   （日期 YYYY-MM-DD）
"""
import json, sys, time, urllib.request, socket
import baostock as bs

socket.setdefaulttimeout(30)
START, END, OUT = sys.argv[1:4]
SINA = 'https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData?page={}&num=80&sort=symbol&asc=1&node=hs_a'


def universe():
    names, page = {}, 1
    while True:
        req = urllib.request.Request(SINA.format(page), headers={'User-Agent': 'Mozilla/5.0'})
        rows = json.loads(urllib.request.urlopen(req).read().decode('utf-8'))
        if not rows:
            break
        for row in rows:
            if row['symbol'][:2] in ('sh', 'sz'):
                names[row['symbol']] = row['name']
        page += 1
    return names


names = universe()
print('universe', len(names), flush=True)
bs.login()
per_date = {}
started = time.time()
for i, (symbol, name) in enumerate(names.items(), 1):
    rs = bs.query_history_k_data_plus(f'{symbol[:2]}.{symbol[2:]}', 'date,close,amount,turn,pctChg', start_date=START, end_date=END, frequency='d', adjustflag='3')
    while rs.error_code == '0' and rs.next():
        date, close, amount, turn, change = rs.get_row_data()
        if not amount or not close:
            continue
        per_date.setdefault(date, []).append({'symbol': symbol, 'name': name, 'price': float(close), 'amount': float(amount) / 1e8,
                                              'turnover': float(turn) if turn else None, 'change': float(change) if change else 0.0})
    if i % 250 == 0:
        print(f'{i}/{len(names)} {round(time.time() - started)}s', flush=True)
bs.logout()
out = {}
for date, rows in per_date.items():
    out[date] = {'amount': sorted(rows, key=lambda r: -r['amount'])[:5],
                 'turnover': sorted([r for r in rows if r['turnover'] is not None], key=lambda r: -r['turnover'])[:5], 'count': len(rows)}
json.dump(out, open(OUT, 'w'), ensure_ascii=False)
print('done', len(out), 'dates', flush=True)
