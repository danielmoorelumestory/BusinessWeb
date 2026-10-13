"""Apply retained public quotes and MCP evidence without relabelling old research as new.

python3 scripts/normalize-market-refresh.py --date 2026-10-13 [--dry-run]
Requires the retained collection in public/research/data-refresh-<date>/.
Company JSON/handwritten overrides are refreshed by the tested TypeScript adapter separately.
"""
import argparse
import copy
import datetime as dt
import json
import math
import re
from collections import Counter
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--date', required=True)
parser.add_argument('--dry-run', action='store_true')
args = parser.parse_args()
AUDIT_DATE = dt.date.fromisoformat(args.date)
RAW = ROOT / f'public/research/data-refresh-{args.date}'
PREFIX = f'research/data-refresh-{args.date}/'
changes = []

def read(path):
    return json.loads(path.read_text())

def save(path, value):
    if args.dry_run:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    compact = path.parent == ROOT / 'public/data' and path.name in ['us.json', 'cn.json', 'lynch.json', 'macro-us.json', 'macro-cn.json', 'macro-hk.json', 'index-history.json']
    temporary.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False, indent=None if compact else 2, separators=(',', ':') if compact else None) + '\n')
    temporary.replace(path)

def number(x):
    return x if isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x) else None

def stamp(x, zone='UTC'):
    if number(x) is None:
        return None
    try:
        return dt.datetime.fromtimestamp(x, ZoneInfo(zone)).isoformat()
    except (ValueError, OverflowError):
        return None

def canonical(symbol):
    if symbol.endswith('.HK'):
        return symbol.split('.')[0].lstrip('0').zfill(4) + '.HK'
    return symbol.replace('BRK.B', 'BRK-B').replace('BF.B', 'BF-B')

def company_symbol(c):
    code = c['code']
    if c.get('market') == 'cn':
        return code + ('.BJ' if code.startswith(('92', '8', '4')) else '.SS' if code.startswith(('6', '9')) else '.SZ')
    if c.get('market') == 'hk':
        return code.lstrip('0').zfill(4) + '.HK'
    return canonical(code)

infos, info_sources, info_errors = {}, {}, {}
for path in [RAW / 'mcp/yfinance-probe-get_multiple_tickers_info.json'] + sorted((RAW / 'mcp').glob('yfinance-info-*.json')) + sorted((RAW / 'mcp').glob('retry-info-*.json')):
    if not path.exists():
        continue
    payload = read(path)
    for symbol, data in payload.get('data', {}).get('results', {}).items():
        key = canonical(symbol)
        if isinstance(data, dict) and not data.get('error') and data.get('regularMarketTime'):
            infos[key] = data
            info_sources[key] = {'source': PREFIX + 'mcp/' + path.name, 'checkedAt': payload['retrievedAt']}
        else:
            info_errors[key] = data.get('error', 'Empty result')

batch = read(RAW / 'yahoo-quote-batch.json')
yahoo = {canonical(k): v for k, v in batch['quotes'].items()}
quotes = {}
rejected = []
for symbol, data in yahoo.items():
    price = number(data.get('regularMarketPrice'))
    time = stamp(data.get('regularMarketTime'), data.get('exchangeTimezoneName', 'UTC'))
    if price is not None and price > 0 and time:
        quotes[symbol] = {'price': price, 'currency': data.get('currency'), 'marketTime': time,
                          'date': time[:10], 'checkedAt': data['checkedAt'], 'provider': 'Yahoo Finance 延迟报价',
                          'source': PREFIX + 'yahoo-quote-batch.json', 'session': '供应商常规交易时段最后报价，非交易所认证收盘'}

tencent = read(RAW / 'tencent-quotes.json')
for key, data in tencent['quotes'].items():
    if not data.get('price'):
        continue
    text = data.get('marketTime', '').replace('/', '-')
    if re.fullmatch(r'\d{14}', text):
        text = f'{text[:4]}-{text[4:6]}-{text[6:8]} {text[8:10]}:{text[10:12]}:{text[12:14]}'
    try:
        zone = 'America/New_York' if key.startswith('us') else 'Asia/Hong_Kong' if key.startswith('hk') else 'Asia/Shanghai'
        market_time = dt.datetime.fromisoformat(text).replace(tzinfo=ZoneInfo(zone)).isoformat()
    except ValueError:
        rejected.append({'symbol': key, 'reason': 'Invalid market timestamp', 'value': text})
        continue
    for symbol in data['symbols']:
        symbol = canonical(symbol)
        # Obsolete BSE tickers can still return a same-day 09:00 stub with an obsolete price.
        if symbol in ('835185.BJ', '832522.BJ'):
            rejected.append({'symbol': symbol, 'reason': 'Obsolete BSE ticker; use the verified 920 code, not the same-day 09:00 stub'})
            continue
        old = quotes.get(symbol)
        if old and market_time[:10] < old['date']:
            continue
        quotes[symbol] = {k: data[k] for k in ['price', 'currency']}
        quotes[symbol].update(marketTime=market_time, date=market_time[:10], checkedAt=data['retrievedAt'],
                              provider='腾讯延迟行情', source=PREFIX + 'tencent-quotes.json',
                              session='供应商最后报价，非交易所认证收盘')

for symbol in list(quotes):
    q = quotes[symbol]
    if dt.date.fromisoformat(q['date']) > AUDIT_DATE + dt.timedelta(days=1) or not q['currency']:
        rejected.append({'symbol': symbol, 'reason': 'Future date or missing currency'})
        del quotes[symbol]
        continue
    info, live = infos.get(symbol, {}), yahoo.get(symbol, {})
    period = stamp(info.get('mostRecentQuarter'))
    source = info_sources.get(symbol, {})
    q.update(financialPeriod=period[:10] if period else None,
             financialSource=source.get('source'), financialCheckedAt=source.get('checkedAt'),
             financialCurrency=info.get('financialCurrency'),
             trailingPE=number(live.get('trailingPE', info.get('trailingPE'))),
             forwardPE=number(live.get('forwardPE', info.get('forwardPE'))),
             low52=number(live.get('fiftyTwoWeekLow', info.get('fiftyTwoWeekLow'))),
             high52=number(live.get('fiftyTwoWeekHigh', info.get('fiftyTwoWeekHigh'))),
             valuationMarketTime=stamp(live.get('regularMarketTime'), live.get('exchangeTimezoneName', 'UTC')),
             valuationSource=PREFIX + 'yahoo-quote-batch.json',
             mcpStatus='资料已取回，第三方字段待原件核实' if info else 'MCP未取回完整资料；使用独立批量行情，财报未重核')
    if q['financialPeriod'] and q['financialPeriod'] > args.date:
        q['financialPeriod'] = None
        q['mcpStatus'] = '供应商报告期晚于核验日，未采纳该期间'

universe = read(RAW / 'company-universe.json')
securities = {}
for c in universe:
    symbol = company_symbol(c)
    if symbol in quotes:
        record = {**quotes[symbol], 'symbol': symbol}
        restrictions = [v for k, v in c['metrics'] if re.search(r'价格锚点|收盘价|现价', k) and re.search(r'可交易性未认证|暂停交易|上市状态待核|终止上市', v)]
        if restrictions:
            record['tradabilityNote'] = '；'.join(restrictions)
        securities[f'{c["market"]}:{c["code"]}'] = record
save(ROOT / 'src/data/companyMarketSnapshot.json', securities)

# Apply only fields actually returned, recording the original observation dates.
macro_changes = {}
macro = read(RAW / 'macro-collected.json')
for market in ['us', 'cn', 'hk']:
    path = ROOT / f'public/data/macro-{market}.json'
    baseline = RAW / f'before/macro-{market}.json'
    old = read(baseline) if baseline.exists() else read(path)
    new = macro[market]
    new['checkedAt'] = macro['completedAt']
    new.pop('fetchedAt', None)
    new['warnings'] = macro['warnings']
    changed = []
    for key, series in new['series'].items():
        before = old['series'].get(key)
        if before and series['latest']['date'] < before['latest']['date']:
            series = copy.deepcopy(before)
            new['series'][key] = series
            status = 'provider-returned-older-data-preserved'
        elif series.get('live') is False:
            status = 'fetch-failed-preserved'
        elif before and series['latest'] == before['latest']:
            status = 'checked-no-new-observation'
        else:
            status = 'updated'
            changed.append(key)
        series.pop('live', None)
        series['checkedAt'] = macro['completedAt']
        series['refreshStatus'] = status
        if market == 'hk' and key in ['hsiDd', 'hsi12m']:
            series['sourceDateKind'] = 'provider-week-label'
            if '供应商周线日期标签' not in series.get('note', ''):
                series['note'] = series.get('note', '') + '；观测日期为供应商周线日期标签，不是该自然日的交易所成交认证'
    macro_changes[market] = changed
    save(path, new)

path = ROOT / 'public/data/index-history.json'
old = read(path)
collected = read(RAW / 'indexes-collected.json')
new = collected['snapshot']
new.update(checkedAt=collected['completedAt'], warnings=collected['warnings'])
for key, index in new['indexes'].items():
    before = old['indexes'].get(key)
    if before and index['latest']['date'] < before['latest']['date']:
        index.update(latest=before['latest'], monthly=before['monthly'])
    index['checkedAt'] = collected['completedAt']
    if index.get('ref'):
        index['ref']['checkedAt'] = collected['completedAt']
        index['ref']['latestObservationDate'] = index['ref']['points'][-1][0]
        index['ref']['refreshStatus'] = 'checked-no-new-observation' if before and before.get('ref', {}).get('points') == index['ref']['points'] else 'updated'
save(path, new)

# Keep the original research date; update only quotes and arithmetic based on explicitly old scenarios.
future_path = ROOT / 'src/data/futureTrendsResearch.index.json'
future = read(future_path)
future_count = 0
for r in future:
    symbol = canonical(r['key'].split(':', 1)[1])
    if re.fullmatch(r'\d{6}', symbol):
        symbol = company_symbol({'market': 'cn', 'code': symbol})
    q = quotes.get(symbol)
    if not q:
        continue
    detail_path = ROOT / f'public/research/future-trends-2026-10-09/companies/{r["id"]}.json'
    if not detail_path.exists():
        raise RuntimeError(f'Missing detail file: {detail_path}')
    detail = read(detail_path)
    dated = re.search(r'\d{4}[-/]\d{2}[-/]\d{2}', r.get('priceDate', ''))
    if dated and q['date'] < dated[0].replace('/', '-'):
        rejected.append({'symbol': symbol, 'reason': 'Quote older than live research quote'})
        continue
    before = {k: r.get(k) for k in ['price', 'priceDate', 'ratio', 'up', 'down', 'expected']}
    targets = {s['name']: number(s.get('price')) for s in detail.get('scenarios', [])}
    bear, base, price = targets.get('悲观'), targets.get('基准'), q['price']
    up = base / price - 1 if base is not None else None
    down = 1 - bear / price if bear is not None else None
    ratio = (base - price) / (price - bear) if base is not None and bear is not None and bear < price < base else None
    threshold = (base + 2 * bear) / 3 if base is not None and bear is not None else None
    scenarios = detail.get('scenarios', [])
    probabilities = [number(s.get('probability')) for s in scenarios]
    prices = [number(s.get('price')) for s in scenarios]
    valid_probability = len(scenarios) == 3 and all(p is not None and 0 <= p <= 1 for p in probabilities) and abs(sum(probabilities) - 1) < 1e-8 and all(p is not None and p > 0 for p in prices)
    expected = sum(p * target for p, target in zip(probabilities, prices)) / price - 1 if valid_probability else None
    win_rate = f'假设胜率 {sum(p for p, target in zip(probabilities, prices) if target >= price * 1.1):.0%}（原研究主观情景概率按新报价复算；非历史回测，模型未重新认证）' if valid_probability else '[MISSING] 未取得可校准的情景概率'
    patch = dict(price=price, priceText=f'{q["currency"]} {price:,.2f}', priceDate=q['marketTime'], currency=q['currency'],
                 priceCheckedAt=q['checkedAt'], priceSource=q['source'], modelAsOf=r.get('modelAsOf', r['asOf']),
                 ratio=ratio, up=up, down=down, threshold=threshold, breakEven=1 / (1 + ratio) if ratio is not None else None,
                 expected=expected, winRate=win_rate, marketRefreshStatus='行情已刷新；原研究模型未重估，不认证买入或胜率')
    for obj in [r, detail]:
        obj.update(patch)
        original = obj.get('valuationStatus', '')
        if '行情刷新不等于重估' not in original:
            obj['valuationStatus'] = original + '；行情刷新不等于重估，旧情景未重新认证'
        fresh_source = {'title': '本轮行情原始证据', 'url': '/' + q['source'], 'status': f'行情 {q["marketTime"]}；核验 {q["checkedAt"]}；{q["provider"]}，不代表财报或模型已重估'}
        obj['sources'] = [fresh_source] + [s for s in obj['sources'] if s.get('url', '').lstrip('/') != q['source']]
    detail['metrics'] = [[k, patch['priceText'] if k == '本次价格' else q['marketTime'] if k == '价格时间' else v] for k, v in detail['metrics'] if k not in ['行情核验时间', '本轮供应商行情估值']]
    detail['metrics'].insert(2, ['行情核验时间', f'{q["checkedAt"]}；来源 {q["source"]}；研究与模型仍为 {r["asOf"]}'])
    save(detail_path, detail)
    changes.append({'scope': 'future', 'id': r['id'], 'before': before, 'after': patch})
    future_count += 1
save(future_path, future)

# Retain verified primary filing fields in the H1 base. Market metadata can be refreshed independently.
solid_path = ROOT / 'src/data/solidState/mcpSnapshot.json'
solid = read(solid_path)
solid_count = 0
for c in solid['companies']:
    c.setdefault('latestFinancialTables', None)
    checked_tables = []
    for listing in c['listings']:
        for tool in ['get_income_statement', 'get_balance_sheet', 'get_cash_flow']:
            path = RAW / f'mcp/retry-{tool}-{listing["symbol"]}.json'
            if not path.exists():
                continue
            payload = read(path)
            table = payload.get('data', {}).get('data', {})
            if table.get('rows') and table.get('columns'):
                checked_tables.append({'tool': tool, 'latestProviderPeriod': table['columns'][0][:10], 'source': PREFIX + 'mcp/' + path.name, 'checkedAt': payload['retrievedAt']})
    if checked_tables:
        c['latestFinancialTables'] = {'checkedAt': max(t['checkedAt'] for t in checked_tables), 'tables': checked_tables, 'status': '本轮已取回供应商单季表；期间按源记录，未覆盖已核H1原件控制值。'}
    for listing in c['listings']:
        symbol = canonical(listing['symbol'])
        if symbol in ('835185.BJ', '832522.BJ'):
            listing.update(available=False, issue='旧北交所代码不作为当前证券；同日09:00占位行情未采纳', checkedAt=tencent['retrievedAt'])
            continue
        q = quotes.get(symbol)
        if not q or (listing.get('marketTime') or '')[:10] > q['date']:
            continue
        before = {k: listing.get(k) for k in ['price', 'marketTime', 'source']}
        info = infos.get(symbol, {})
        live = yahoo.get(symbol, {})
        listing.update(available=True, price=q['price'], currency=q['currency'], marketTime=q['marketTime'],
                       retrievedAt=q['checkedAt'], quoteStatus=q['session'], source=q['source'],
                       providerName=listing.get('providerName') or live.get('longName') or info.get('longName') or c['name'],
                       peTtm=q.get('trailingPE'), marketCap=number(live.get('marketCap', info.get('marketCap'))),
                       issue=None, marketCheckedAt=q['checkedAt'])
        listing.setdefault('valuation', {})
        for target, field in [('forwardPE', 'forwardPE'), ('fiftyTwoWeekLow', 'low52'), ('fiftyTwoWeekHigh', 'high52')]:
            listing['valuation'][target] = q.get(field)
        listing['valuationSource'] = q['valuationSource']
        listing['valuationMarketTime'] = q['valuationMarketTime']
        if info:
            listing['summary'] = {'period': '供应商滚动摘要，不与已核H1原件混用', 'mostRecentQuarter': q['financialPeriod'],
                                  'revenue': number(info.get('totalRevenue')), 'netIncome': number(info.get('netIncomeToCommon')),
                                  'cfo': number(info.get('operatingCashflow')), 'fcf': number(info.get('freeCashflow')),
                                  'checkedAt': q['financialCheckedAt'], 'source': q['financialSource']}
        changes.append({'scope': 'solid', 'id': symbol, 'before': before, 'after': {k: listing[k] for k in ['price', 'marketTime', 'source']}})
        solid_count += 1
solid['marketCheckedAt'] = batch['checkedAt']
solid['priceAsOf'] = args.date
solid['stats']['validListings'] = sum(l.get('available', False) for c in solid['companies'] for l in c['listings'])
solid['stats']['failedListings'] = sum(not l.get('available', False) for c in solid['companies'] for l in c['listings'])
save(solid_path, solid)

review_path = ROOT / 'src/data/solidState/reviewSnapshot.json'
review = read(review_path)
review['priceDate'] = f'行情更新至各上市地2026-10-12/13；逐条见公司行情；研究分层仍为{review["asOf"]}'
review['marketCheckedAt'] = batch['checkedAt']
ak_abstracts = 0
for c in review['companies']:
    base = next((b for b in solid['companies'] if b['id'] == c['id']), None)
    primary = next((l for l in (base or {}).get('listings', []) if l.get('available')), None)
    forecast = c.get('forecast')
    if forecast and primary:
        symbol = primary['symbol']
        estimate_path = RAW / f'mcp/retry-get_earnings_estimates-{symbol}.json'
        if estimate_path.exists():
            payload = read(estimate_path)
            estimate_data = payload.get('data', {})
            table = estimate_data.get('earnings_estimate', {})
            def period_row(table, label):
                row = next((r for r in table.get('rows', []) if r['metric'] == label), None)
                return dict(zip(table.get('columns', []), row['values'])) if row else {}
            next_year = period_row(table, '+1y')
            current_year = period_row(table, '0y')
            trend = period_row(estimate_data.get('eps_trend', {}), '+1y')
            if number(next_year.get('avg')) is not None:
                forecast.update(eps=next_year['avg'], low=number(next_year.get('low')), high=number(next_year.get('high')),
                                currency=next_year.get('currency'), analysts=number(next_year.get('numberOfAnalysts')),
                                currentYearEps=number(current_year.get('avg')), previous30DaysEps=number(trend.get('30daysAgo')),
                                source=PREFIX + 'mcp/' + estimate_path.name, estimateAsOf=payload['retrievedAt'][:10],
                                checkedAt=payload['retrievedAt'], refreshStatus='本轮已更新供应商预测；对应财年与口径待公司原件桥接，不等于研究者估值')
        eps = number(forecast.get('eps'))
        forecast['priceToEps'] = primary['price'] / eps if eps and eps > 0 and forecast.get('currency') == primary.get('currency') else None
        forecast['priceDate'] = primary['marketTime'][:10]
        forecast.setdefault('estimateAsOf', '2026-10-10')
    if base:
        listing = next((l for l in base['listings'] if l['symbol'].endswith(('.SZ', '.SS'))), None)
        path = RAW / f'mcp/akshare-financial-{listing["symbol"].split(".")[0]}.json' if listing else None
        if path and path.exists():
            payload = read(path)
            data = payload.get('data', {})
            periods = data.get('报告期', {}) if isinstance(data, dict) else {}
            if periods:
                index = max(periods, key=periods.get)
                if periods[index] <= args.date:
                    c['financialAbstract'] = {k: v.get(index) for k, v in data.items() if k != '报告期' and isinstance(v, dict)}
                    c.update(financialAbstractPeriod=periods[index], financialAbstractCheckedAt=payload['retrievedAt'],
                             financialAbstractSource=PREFIX + 'mcp/' + path.name)
                    ak_abstracts += 1
save(review_path, review)

# PE is a quote field. Historical classifier/growth/moat evidence has no provable original date.
lynch_path = ROOT / 'public/data/lynch.json'
lynch = read(lynch_path)
lynch_count = 0
for key, entry in lynch.items():
    q = securities.get(key)
    if not q:
        continue
    entry.setdefault('historicalAssessment', entry.get('v'))
    entry.setdefault('historicalPeg', entry.get('peg'))
    entry['pe'] = q.get('trailingPE')
    entry['peg'] = None
    entry.update(peAsOf=(q.get('valuationMarketTime') or q['marketTime'])[:10], checkedAt=q['checkedAt'],
                 classificationAsOf=None, financialPeriod=q.get('financialPeriod'), source=q['valuationSource'])
    entry['v'] = f'PE行情字段于{q["checkedAt"]}核验；分类、增速和护城河为原研究，原核验日期缺失，未按新报表重新认证。PEG待同口径盈利预测，不沿用旧值。'
    lynch_count += 1
save(lynch_path, lynch)

for name in ['meta', 'etf']:
    path = ROOT / f'public/data/national-team/{name}.json'
    data = read(path)
    meta = data['meta'] if name == 'etf' else data
    meta['checkedAt'] = dt.datetime.now(dt.timezone.utc).isoformat()
    if name == 'etf':
        meta['holderFreshnessNote'] = '实名榜单源最新仍为2025-12-31。本轮已核510300、510500、510050的2026H1原件，仅披露匿名持有人结构；其他基金实名字段逐项原件仍待核。旧份额按现价折算只作历史持仓重估，不代表当前持仓市值，不能推断国家队清仓。'
        etf_path = RAW / 'etf-quotes.json'
        if etf_path.exists():
            etf_payload = read(etf_path)
            etf_quotes = {symbol: q for q in etf_payload['quotes'].values() if q.get('price') for symbol in q['symbols']}
            for etf in data['etfs']:
                q = etf_quotes.get(etf['c'] + ('.SS' if etf['c'].startswith('5') else '.SZ'))
                if q:
                    text = q['marketTime'].replace('/', '-')
                    date = f'{text[:4]}-{text[4:6]}-{text[6:8]}' if text.isdigit() else text[:10]
                    etf.update(price=q['price'], priceDate=date, priceCheckedAt=q['retrievedAt'], priceSource=PREFIX + 'etf-quotes.json')
                    etf['mv'] = etf['latest']['shares'] * etf['price'] if etf['status'] == 'hold' else 0
            meta['priceAsOf'] = max(etf.get('priceDate', '') for etf in data['etfs'])
            meta['priceCheckedAt'] = etf_payload['retrievedAt']
            meta['totalMv'] = sum(etf['mv'] or 0 for etf in data['etfs'] if etf['status'] == 'hold')
            themes = {}
            for etf in data['etfs']:
                if etf['status'] == 'hold':
                    theme = themes.setdefault(etf['theme'], {'theme': etf['theme'], 'n': 0, 'mv': 0})
                    theme['n'] += 1
                    theme['mv'] += etf['mv'] or 0
            meta['themes'] = sorted(themes.values(), key=lambda t: -t['mv'])
    else:
        meta['refreshNote'] = '已重抓最近两成熟期；行业160条缺失补抓未取得，保留原行业映射与未分类。未强制切换未成熟报告期。'
    save(path, data)

summary = {'auditDate': args.date, 'normalizedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
           'mcpInfoSuccess': len(infos), 'mcpInfoErrors': len(info_errors), 'quoteSymbols': len(quotes),
           'companyRecordsCovered': len(securities), 'companyRecordsRequested': len(universe),
           'macroUpdatedFields': macro_changes, 'futureUpdated': future_count, 'solidListingsUpdated': solid_count,
           'solidReviewFinancialAbstractsUpdated': ak_abstracts, 'lynchPeUpdated': lynch_count,
           'unresolvedMcpSymbols': sorted(set(info_errors) - set(infos)), 'rejected': rejected,
           'researchBoundary': '仅行情和实际返回摘要字段更新；原模型、原件精度、研究日期保留；空表/限流不能算财报更新'}
save(RAW / 'normalization-summary.json', summary)
save(RAW / 'changes.json', changes)
print(json.dumps({k: v for k, v in summary.items() if k not in ['unresolvedMcpSymbols', 'rejected']}, ensure_ascii=False, indent=2))
