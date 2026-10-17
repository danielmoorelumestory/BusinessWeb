"""Fetch dated market evidence; apply only after all records validate.

python3 scripts/refresh-investment-market.py --date 2026-10-16 --fetch
python3 scripts/refresh-investment-market.py --date 2026-10-16 --write
Raw evidence stays in ../tmp/market-refresh-DATE; published calculations in public/data.
"""
import argparse
import concurrent.futures
import datetime as dt
import json
import re
import statistics as stats
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--date', required=True, type=dt.date.fromisoformat)
parser.add_argument('--fetch', action='store_true')
parser.add_argument('--write', action='store_true')
parser.add_argument('--codes', nargs='+', help='Fetch only these codes; calculations still validate the whole list')
args = parser.parse_args()
ASOF = args.date.isoformat()
CACHE = ROOT.parent / 'tmp' / f'market-refresh-{ASOF}'
CACHE.mkdir(parents=True, exist_ok=True)


def read(path):
    return json.loads(path.read_text())


def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


industry = read(ROOT / 'src/data/industryEtf.json')
broad = read(ROOT / 'src/data/broadEtf.json')
groups = read(ROOT / 'src/data/strategyAssetEtf.json')
items = [dict(i, group=g['name']) for g in industry for i in g['items']]
items += [dict(i, group='宽基 ETF') for i in broad]
items += [dict(i, group=g['title']) for g in groups for i in g['items']]
assert len({i['code'] for i in items}) == len(items)
funds = {i['code'] for g in groups if g['id'] == 'bond-funds' for i in g['items']}


def fetch(item):
    code = item['code']
    symbol = ('sh' if code.startswith('5') else 'sz') + code
    url = (f'https://fund.eastmoney.com/pingzhongdata/{code}.js' if code in funds else
           f'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={symbol},day,2021-01-01,{ASOF},640,qfq')
    error = None
    for _ in range(3):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://fund.eastmoney.com/'})
            with urllib.request.urlopen(request, timeout=25) as response:
                text = response.read().decode('utf-8')
            if code in funds:
                data = {}
                for key in ['Data_netWorthTrend', 'Data_ACWorthTrend']:
                    match = re.search(r'var\s+' + key + r'\s*=\s*(\[[\s\S]*?\]);', text)
                    assert match, (code, key)
                    data[key] = json.loads(match[1])
            else:
                data = json.loads(text)['data'][symbol]
                assert data.get('qfqday') or data.get('day'), code
            save(CACHE / f'{code}.json', {'sourceUrl': url, 'retrievedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'data': data})
            return code, 'OK'
        except Exception as exc:
            error = str(exc)
    raise RuntimeError(f'{code}: {error}')


if args.fetch:
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        for result in executor.map(fetch, [i for i in items if not args.codes or i['code'] in args.codes]):
            print(*result, flush=True)
    if not args.write:
        raise SystemExit(0)


def trend(item):
    code = item['code']
    raw = read(CACHE / f'{code}.json')
    data = raw['data']
    basis = 'qfqday' if data.get('qfqday') else 'day'
    bars = [r[:6] for r in data[basis] if r[0] <= ASOF]
    symbol = ('sh' if code.startswith('5') else 'sz') + code
    quote = data.get('qt', {}).get(symbol)
    appended = False
    quote_date = dt.datetime.strptime(quote[30][:8], '%Y%m%d').date().isoformat() if quote else None
    if bars[-1][0] < ASOF and quote_date == ASOF:
        # Never mix a differently adjusted quote with the historical series.
        assert abs(float(bars[-1][2]) - float(quote[4])) <= 0.00051, (code, 'quote adjustment mismatch')
        bars.append([ASOF, quote[5], quote[3], quote[33], quote[34], quote[6]])
        appended = True
    assert bars[-1][0] == ASOF, (code, 'missing requested close', bars[-1][0])
    assert len(bars) >= 60 and len({r[0] for r in bars}) == len(bars), code
    close = [float(r[2]) for r in bars]
    price = close[-1]
    ma = {str(n): stats.mean(close[-n:]) for n in [5, 10, 20, 60, 120, 250] if len(close) >= n}
    slopes = {str(n): (ma[str(n)] / stats.mean(close[-n-20:-20]) - 1) * 100 for n in [20, 60, 120, 250] if len(close) >= n + 20}
    weeks = {}
    for row in bars:
        weeks[dt.date.fromisoformat(row[0]).isocalendar()[:2]] = {'date': row[0], 'close': float(row[2])}
    weekly = list(weeks.values())
    # Friday's final bar completes the current week; other weekdays remain partial.
    complete = weekly if args.date.weekday() == 4 else weekly[:-1]
    wma = {str(n): stats.mean([r['close'] for r in weekly][-n:]) for n in [5, 10, 20, 60] if len(weekly) >= n}
    volume_base = stats.mean(float(r[5]) for r in bars[-6:-1])
    relative_volume = float(bars[-1][5]) / volume_base if volume_base else None
    if price < ma['20'] and ma['5'] < ma['10'] < ma['20'] and slopes['20'] < 0:
        short = '下降趋势'
    elif price > ma['20'] and ma['5'] > ma['10'] > ma['20'] and slopes['20'] > 0:
        short = '上升趋势'
    else:
        short = '震荡偏强' if price >= ma['20'] else '震荡偏弱'
    if price < ma['60'] and slopes.get('60', 0) < 0 and price < wma['10'] and wma['5'] < wma['10']:
        mid = '下降趋势'
    elif price > ma['60'] and slopes.get('60', 0) > 0 and price > wma['10'] and wma['5'] > wma['10']:
        mid = '上升趋势'
    else:
        mid = '震荡偏强' if price >= ma['60'] and price >= wma['10'] else '震荡偏弱'
    if '250' not in slopes:
        long = '历史不足，长期未确认'
    elif slopes['250'] > 1 and price > ma['250']:
        long = '上升趋势'
    elif slopes['250'] < -1 and price < ma['250']:
        long = '下降趋势'
    elif abs(slopes['250']) <= 1:
        long = '震荡偏强' if price >= ma['250'] else '震荡偏弱'
    else:
        long = '长期结构转弱' if price < ma['250'] else '长期修复，反转未确认'
    return dict(code=code, name=item['name'], group=item['group'], asOf=ASOF, sourceUrl=raw['sourceUrl'], retrievedAt=raw['retrievedAt'],
                priceSeries=basis, appendedQuote=appended, barsAvailable=len(bars), last270Bars=bars[-270:],
                weeklyCloses=weekly[-60:], completedWeeklyClose=complete[-1], weekComplete=args.date.weekday() == 4,
                close=price, previousClose=close[-2], changePct=(price/close[-2]-1)*100, ma=ma,
                maChangeOver20SessionsPct=slopes, weeklyMa=wma, relativeVolume5=relative_volume,
                low20=min(float(r[4]) for r in bars[-20:]), high20=max(float(r[3]) for r in bars[-20:]),
                low60=min(float(r[4]) for r in bars[-60:]), high60=max(float(r[3]) for r in bars[-60:]),
                return20SessionsPct=(price/close[-21]-1)*100, short=short, mid=mid, long=long,
                quoteTimestamp=quote[30] if quote else None, quoteDate=quote_date,
                turnoverYi=float(quote[37])/10000 if quote and quote_date == ASOF else None)


def window(series, start):
    anchor = next((i for i in range(len(series)-1, -1, -1) if series[i]['date'] <= start), 0)
    rows = series[anchor:]
    assert len(rows) > 1
    peak = rows[0]['wealth']
    peak_date = rows[0]['date']
    drawdown = 0
    peak_at_drawdown = trough = peak_date
    for row in rows:
        if row['wealth'] > peak:
            peak, peak_date = row['wealth'], row['date']
        value = row['wealth']/peak-1
        if value < drawdown:
            drawdown, peak_at_drawdown, trough = value, peak_date, row['date']
    value = rows[-1]['wealth']/rows[0]['wealth']-1
    days = (dt.date.fromisoformat(rows[-1]['date'])-dt.date.fromisoformat(rows[0]['date'])).days
    return dict(start=rows[0]['date'], end=rows[-1]['date'], returnPct=value*100,
                annualizedPct=((1+value)**(365.25/days)-1)*100, maxDrawdownPct=drawdown*100,
                peakDate=peak_at_drawdown, troughDate=trough,
                currentDrawdownPct=(rows[-1]['wealth']/peak-1)*100)


def fund(item):
    raw = read(CACHE / f"{item['code']}.json")
    cumulative = dict(raw['data']['Data_ACWorthTrend'])
    wealth = 1
    previous = previous_cumulative = None
    series = []
    rounding_adjustments = []
    for row in raw['data']['Data_netWorthTrend']:
        date = dt.datetime.fromtimestamp(row['x']/1000, dt.timezone(dt.timedelta(hours=8))).date().isoformat()
        if date > ASOF or date < (args.date.replace(year=args.date.year-5)-dt.timedelta(days=10)).isoformat():
            continue
        nav = row['y']
        cum = cumulative.get(row['x'])
        assert cum is not None and nav > 0, (item['code'], date)
        cash = 0
        if previous is not None:
            cash = round((cum-nav)-(previous_cumulative-previous), 8)
            assert '拆分' not in row.get('unitMoney', ''), (item['code'], date, 'split requires manual verification')
            if not row.get('unitMoney') and abs(cash) <= 0.001:
                if abs(cash) >= 1e-7:
                    rounding_adjustments.append(dict(date=date, cumulativeGapChange=cash))
                cash = 0
            assert cash >= -1e-7, (item['code'], date, 'possible split; manual verification required')
            if abs(cash) < 1e-7:
                cash = 0
            assert not cash or row.get('unitMoney'), (item['code'], date, 'unlabelled dividend')
            wealth *= (nav+cash)/previous
        series.append(dict(date=date, nav=nav, cumulativeNav=cum, cashDividendPerUnit=cash, wealth=wealth))
        previous, previous_cumulative = nav, cum
    end = dt.date.fromisoformat(series[-1]['date'])
    assert (args.date-end).days <= 7, (item['code'], 'stale NAV', end)
    three_start = end.replace(year=end.year-3).isoformat()
    five_start = end.replace(year=end.year-5).isoformat()
    quarter_start = (end-dt.timedelta(days=92)).isoformat()
    return dict(code=item['code'], name=item['name'], asOf=end.isoformat(), sourceUrl=raw['sourceUrl'],
                retrievedAt=raw['retrievedAt'], currentNav=series[-1]['nav'], series=series, roundingAdjustments=rounding_adjustments,
                metrics3y=window(series, three_start) if series[0]['date'] <= three_start else None,
                metrics5y=window(series, five_start) if series[0]['date'] <= five_start else None,
                availableWindow=window(series, series[0]['date']), quarter=window(series, quarter_start))


records = [fund(i) if i['code'] in funds else trend(i) for i in items]
for record in records:
    if record['code'] == '511880':
        record.update(stockTrendApplicable=False, short=None, mid=None, long=None)
save(CACHE / 'analysis.json', records)
for record in records:
    print(record['code'], record['asOf'], record.get('short', '净值'), record.get('mid', ''), record.get('long', ''), flush=True)
if not args.write:
    raise SystemExit(0)

ARCHIVE = f'/data/investment-market-refresh-{ASOF}.json'
f = lambda value: f'{value:.3f}'
pct = lambda value: f'{value:+.2f}%'
metrics = read(ROOT / 'src/data/bondFundMetrics.json')
metadata_path = ROOT / 'src/data/notes.ts'
metadata = metadata_path.read_text()
changes = []


def replace_meta(slug, summary):
    global metadata
    pattern = r"\{\s*slug: '" + re.escape(slug) + r"'[\s\S]*?\}"
    match = re.search(pattern, metadata)
    assert match, slug
    block = re.sub(r"date: '[^']*'", f"date: '{ASOF}'", match[0])
    block = re.sub(r"summary: '[^']*'", "summary: '" + summary.replace("'", '’') + "'", block)
    metadata = metadata[:match.start()] + block + metadata[match.end():]


for r in records:
    code = r['code']
    candidates = list((ROOT / 'public/notes').glob(f'{code}-*-analysis.md'))
    suffix = '-bond-fund-analysis' if code in funds else '-etf-analysis'
    candidates = [p for p in candidates if p.stem.endswith(suffix)]
    assert len(candidates) == 1, (code, candidates)
    path = candidates[0]
    text = re.sub(r'^> 本轮行情更新：[^\n]*\n\n', '', path.read_text())
    match = re.search(r'^## 一、结论速览[^\n]*\n([\s\S]*?)(?=^## |\Z)', text, re.M)
    assert match, code
    old = match[1]
    if code in funds:
        quarter, history = r['quarter'], r['availableWindow']
        metric = metrics[code]
        historical_dd = min(metric['maxDrawdownPct'], history['maxDrawdownPct'])
        three = r['metrics3y'] or history
        five = r['metrics5y']
        stage = '净值上行，处于样本高点' if history['currentDrawdownPct'] >= -0.005 else ('净值震荡修复中' if quarter['returnPct'] >= 0 else '净值回撤中')
        summary = f"{stage}，距本次样本高点{abs(history['currentDrawdownPct']):.2f}%。近季度收益{pct(quarter['returnPct'])}；{'近三年' if r['metrics3y'] else '成立以来'}收益{pct(three['returnPct'])}，历史最大回撤{pct(historical_dd)}。按确认净值申赎，结合久期、信用与权益仓位复核。"
        section = f"\n数据基准：{r['asOf']} 净值；更新日期：{ASOF}。单位净值 **{r['currentNav']:.4f}元**。\n\n"
        section += f"**综合判断：{summary}**\n\n| 期限 | 结论 | 判断依据 | 验证与失效条件 |\n| --- | --- | --- | --- |\n"
        section += f"| 短期（1–3个月） | {stage} | {quarter['start']}至{r['asOf']}分红再投资收益{pct(quarter['returnPct'])}；当前样本回撤{pct(history['currentDrawdownPct'])} | 净值回到财富高点并维持；回撤扩大时复核久期、信用利差和权益风险 |\n"
        section += f"| 中期（1–3年） | {'三年记录' if r['metrics3y'] else '成立以来记录，尚不足三年'} | {three['start']}至{r['asOf']}收益{pct(three['returnPct'])}，年化{pct(three['annualizedPct'])}，区间最大回撤{pct(three['maxDrawdownPct'])} | 与同类使用同一窗口；经理、杠杆或组合变化时重新评估 |\n"
        section += f"| 长期（3年以上） | {'具五年历史' if five else '五年历史不足'} | " + (f"五年收益{pct(five['returnPct'])}，年化{pct(five['annualizedPct'])}；" if five else '') + f"历史最大回撤{pct(historical_dd)} | 历史回撤不构成未来上限；持有期和赎回费用仍按基金合同核验 |\n\n"
        section += f"> 复算样本从{history['start']}起，采用公开单位净值与累计净值识别已标注现金分红并逐日再投资；未标注分红且不超过0.001元的累计差额变动按精度差异记录，不当作分红。历史最大回撤沿用此前全历史核验值，并与本次窗口回撤取更大绝对值；本轮未重算更早的拆分记录。费用已反映在净值中，未扣投资者申赎费。实际净值日期为{r['asOf']}，未披露日期不填估值。[净值来源]({r['sourceUrl']}) · [日度复算归档]({ARCHIVE})\n"
        r['historicalMaxDrawdownPct'] = historical_dd
        if history['maxDrawdownPct'] < metric['maxDrawdownPct']:
            metric.update(drawdownStart=history['peakDate'], drawdownEnd=history['troughDate'],
                          drawdownPeriodLabel=f"历史({history['peakDate'][:4]}–{history['troughDate'][:4]})")
        metric.update(asOf=r['asOf'], return3yPct=r['metrics3y']['returnPct'] if r['metrics3y'] else None,
                      returnPct=three['returnPct'], returnStart=three['start'], returnPeriodLabel='近三年' if r['metrics3y'] else '成立来',
                      return5yPct=five['returnPct'] if five else None, return5yPeriodLabel='近五年' if five else '成立不足5年',
                      maxDrawdownPct=historical_dd)
        if not five:
            metric.update(inceptionDate=history['start'], returnSinceInceptionPct=history['returnPct'])
    elif code == '511880':
        summary = f"现金管理工具，股票式趋势判断不适用。{ASOF}收盘{f(r['close'])}元，当日涨跌{pct(r['changePct'])}；成交额{r['turnoverYi']:.2f}亿元。短持有期先比较价差、佣金与预估净收益；场内涨幅不等于七日年化，异日净值不用于计算溢价。"
        section = f"\n数据基准：{ASOF} 收盘。\n\n**综合判断：{summary}**\n\n"
        section += "| 期限 | 结论 | 判断依据 | 验证与失效条件 |\n| --- | --- | --- | --- |\n| 短期（1–7天） | 有成本约束的现金停泊 | 核验成交价、盘口价差和佣金 | 成本超过预估净收益或提现安排不匹配时重新比较工具 |\n| 中期（1–3个月） | 流动性管理 | 净值收益取决于短端利率及再投资 | 持续核验费率、申赎限制与组合风险 |\n| 长期（1年以上） | 辅助现金仓位 | 不能用价格均线推断收益率 | 比较同风险工具的费后收益与资金可用性 |\n\n"
        section += f"> 本轮未取得同日可复核净值与最新A类七日年化，不以场内价格替代。[行情来源]({r['sourceUrl']}) · [行情归档]({ARCHIVE})\n"
    else:
        ma, slopes, w = r['ma'], r['maChangeOver20SessionsPct'], r['weeklyMa']
        stage = f"短期{r['short']}；中期{r['mid']}；长期{r['long']}"
        # Carry forward asset-specific research only as explicitly dated background.
        old_background = re.search(r'\*\*此前研究背景（未在本轮重新核验）：\*\*\s*([^\n]+)', old)
        old_judgment = re.search(r'\*\*(?:综合|组合)判断[：:]\s*([\s\S]*?)\*\*', old)
        background = old_background[1].strip() if old_background else old_judgment[1].strip() if old_judgment else '行业盈利、估值和分红仍需独立验证。'
        background = re.sub(r'^短期[\s\S]*?长期[^。]*。', '', background).strip()
        background = re.sub(r'^短期[\s\S]*?长期[^。]*。', '', background).strip()
        summary = f"{stage}。收盘{f(r['close'])}元，日涨跌{pct(r['changePct'])}，近20交易日{pct(r['return20SessionsPct'])}。" + ('价格结构偏强，观察回踩均线与量能持续性。' if r['short'] == '上升趋势' else '趋势改善需价格、均线方向和量能共同确认。')
        item = next(i for i in items if i['code'] == code)
        if code.startswith('513') or any(term in (item.get('market', '') + item.get('category', '') + item['name']) for term in ['QDII', '港股', '海外', '纳指', '标普']):
            summary += '跨境品种同时核验溢价、汇率及海外交易时差。'
        section = f"\n**当前趋势：{stage}。** 数据基准：{ASOF} 收盘；最新价 **{f(r['close'])}元**，日涨跌{pct(r['changePct'])}。\n\n"
        section += '| 期限 | 结论 | 判断依据 | 验证与失效条件 |\n| --- | --- | --- | --- |\n'
        volume_text = f"{r['relativeVolume5']:.2f}倍" if r['relativeVolume5'] is not None else '缺失'
        section += f"| 短期（1–4周） | **{r['short']}** | MA5/10/20/60为{'/'.join(f(ma[str(n)]) for n in [5,10,20,60])}；距MA20{pct((r['close']/ma['20']-1)*100)}，MA20较20交易日前{pct(slopes['20'])}；当日量/此前5日均量{volume_text} | 改善：连续2日站上动态MA20，MA5＞MA10＞MA20，突破相对量≥1.3；转弱：连续2日失守MA20或收盘跌破20日低点{f(r['low20'])}；20日上沿{f(r['high20'])} |\n"
        section += f"| 中期（1–2季度） | **{r['mid']}** | MA60较20交易日前{pct(slopes['60'])}；周MA5/10/20为{'/'.join(f(w[str(n)]) for n in [5,10,20])}；近20交易日{pct(r['return20SessionsPct'])} | 完整周站上周MA10/20且日MA60转升；周收盘失守MA10并伴随MA60转降，或跌破60日低点{f(r['low60'])}时下修判断 |\n"
        long_basis = f"MA120/250为{f(ma['120'])}/{f(ma['250'])}；距MA250{pct((r['close']/ma['250']-1)*100)}；MA250较20交易日前{pct(slopes['250'])}" if '250' in slopes else f"仅{r['barsAvailable']}根有效日K，不足270根长期确认样本"
        section += f"| 长期（1年以上） | **{r['long']}** | {long_basis} | 站稳MA120/250且年线20日变化超过+1%并验证基本面；价格失守且年线变化低于−1%时保留弱势判断；历史不足不外推长期趋势 |\n\n"
        section += f"**综合判断：{summary}**\n\n"
        section += f"> 日线采用接口实际返回的{'前复权qfqday' if r['priceSeries']=='qfqday' else '未复权day'}；周线按ISO周最后一根有效日线计算，{'本周已包含周五收盘' if r['weekComplete'] else '本周尚未完成'}。MA250变化±1%、连续两日和1.3倍量能是研究观察规则，非胜率承诺。均线及价位随行情滚动。[行情来源]({r['sourceUrl']}) · [复算归档]({ARCHIVE})\n\n"
        section += f"**此前研究背景（未在本轮重新核验）：** {background}\n"
    # Retain historical sections with an explicit snapshot boundary.
    prefix = f"> 本轮行情更新：{ASOF}；数据基准：{r['asOf']} {'净值' if code in funds else '收盘'}。最新结论与验证条件见第一节；后续详细章节为此前研究快照，行情数字、估值、持仓及政策均按原标注日期，不作为本轮最新值。\n\n"
    updated = prefix + text[:match.start()] + '## 一、结论速览\n' + section + '\n' + text[match.end():]
    updated = re.sub(r'^\*\*最终判断：[^\n]*', '**最终判断：' + summary + '**', updated, flags=re.M)
    updated = re.sub(r'^\*\*2026-10-13 趋势复核：[^\n]*', '**本轮趋势复核：' + summary + '**', updated, flags=re.M)
    changes.append((path, updated))
    replace_meta(path.stem, summary)
    r['summary'] = summary

lookup = {r['code']: r for r in records}
for group in industry:
    for item in group['items']:
        r = lookup[item['code']]
        item['trendSummary'] = f"{args.date.month}月{args.date.day}日｜短期：{r['short']}；中期：{r['mid']}；长期：{r['long']}。"
        item['remark'] = f"{ASOF} 收盘｜{r['summary']}"
for item in broad:
    r = lookup[item['code']]
    item.update(quoteAsOf=ASOF, quoteTimestamp=r['quoteTimestamp'])
    if r['turnoverYi'] is not None:
        item['turnoverYi'] = r['turnoverYi']
    # Selection and unrefreshed alternatives retain their original dates.
for path, text in changes:
    path.write_text(text)
save(ROOT / 'src/data/industryEtf.json', industry)
save(ROOT / 'src/data/broadEtf.json', broad)
save(ROOT / 'src/data/bondFundMetrics.json', metrics)
save(ROOT / 'src/data/investmentMarketRefresh.json', {
    'updatedOn': ASOF, 'etfAsOf': ASOF, 'count': len(records),
    'fundNavDates': sorted({r['asOf'] for r in records if r['code'] in funds}),
    'archivePath': ARCHIVE})
array_start = metadata.index('export const NOTES: NoteMeta[] = [')
array_end = metadata.index('\n]', array_start)
body_start = array_start + len('export const NOTES: NoteMeta[] = [')
blocks = re.findall(r'  \{[\s\S]*?\},?', metadata[body_start:array_end])
assert len(blocks) == len(re.findall(r'\bslug:', metadata[body_start:array_end]))
blocks.sort(key=lambda block: re.search(r"date: '([^']+)'", block)[1], reverse=True)
metadata_path.write_text(metadata[:body_start] + '\n' + '\n'.join(blocks) + metadata[array_end:])
save(ROOT / 'public/data' / f'investment-market-refresh-{ASOF}.json', {
    'requestedAsOf': ASOF, 'count': len(records),
    'methodology': {'daily': 'Actual qfqday/day series; see priceSeries per record',
                    'weekly': 'ISO weeks; Friday close completes week',
                    'funds': 'Daily cash-dividend reinvestment; actual disclosed NAV date; no estimated NAV',
                    'scope': 'Market price/NAV calculations; holdings, valuations, policies and fees retain prior source dates'},
    'records': records})
print(f'Updated {len(changes)} reports, metadata, metrics and market archive.')
