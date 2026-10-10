"""Normalize retained MCP responses; never turn absent values into zero.

Run after .agents/mcp/collect_solid_state.py. Financial flows are Q1 + Q2,
balance sheet is June 30, quote and financial currencies remain separate.
"""
import datetime as dt
import json
import math
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'public/research/solid-state-mcp-2026-10-09'
PREFIX = 'research/solid-state-mcp-2026-10-09/'
PERIODS = ['2026-03-31', '2026-06-30']


def number(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) else None


def read(tool, symbol, quarterly=False):
    filename = f'yfinance-{tool}-{symbol}{"-quarterly" if quarterly else ""}.json'
    path = RAW / filename
    return (json.loads(path.read_text()) if path.exists() else {}), PREFIX + filename


def metric(table, names, periods):
    columns = [str(c)[:10] for c in table.get('columns', [])]
    if any(p not in columns for p in periods):
        return None
    for name in names:
        row = next((r for r in table.get('rows', []) if r['metric'] == name), None)
        if row is None:
            continue
        values = [number(row['values'][columns.index(p)]) for p in periods]
        if all(v is not None for v in values):
            return round(sum(values), 2)
    return None


def financials(symbol, currency):
    tables, sources = {}, []
    for key, tool in [('income', 'get_income_statement'), ('balance', 'get_balance_sheet'), ('cash', 'get_cash_flow')]:
        raw, source = read(tool, symbol, True)
        tables[key] = raw.get('data', {}).get('data', {})
        if raw:
            sources.append(source)
    if not sources:
        return None
    income, balance, cash = (tables[k] for k in ['income', 'balance', 'cash'])
    cfo = metric(cash, ['Operating Cash Flow', 'Cash Flowsfromusedin Operating Activities Direct'], PERIODS)
    capex = metric(cash, ['Capital Expenditure'], PERIODS)
    fcf = round(cfo + capex, 2) if cfo is not None and capex is not None and capex <= 0 else None
    values = {
        'revenue': metric(income, ['Total Revenue'], PERIODS),
        'netIncome': metric(income, ['Net Income Common Stockholders', 'Net Income'], PERIODS),
        'grossProfit': metric(income, ['Gross Profit'], PERIODS),
        'cfo': cfo, 'capex': -capex if capex is not None and capex <= 0 else None, 'fcf': fcf,
        'totalDebt': metric(balance, ['Total Debt'], ['2026-06-30']),
        'cashAndShortTermInvestments': metric(balance, ['Cash Cash Equivalents And Short Term Investments'], ['2026-06-30']),
        'cash': metric(balance, ['Cash And Cash Equivalents'], ['2026-06-30']),
        'equity': metric(balance, ['Stockholders Equity'], ['2026-06-30']),
        'assets': metric(balance, ['Total Assets'], ['2026-06-30']),
        'liabilities': metric(balance, ['Total Liabilities Net Minority Interest'], ['2026-06-30']),
        'receivables': metric(balance, ['Accounts Receivable', 'Receivables'], ['2026-06-30']),
        'inventory': metric(balance, ['Inventory'], ['2026-06-30']),
        'goodwill': metric(balance, ['Goodwill'], ['2026-06-30']),
    }
    history = []
    for period in sorted({str(c)[:10] for c in income.get('columns', [])}, reverse=True):
        operating = metric(cash, ['Operating Cash Flow', 'Cash Flowsfromusedin Operating Activities Direct'], [period])
        investment = metric(cash, ['Capital Expenditure'], [period])
        history.append({'period': period, 'revenue': metric(income, ['Total Revenue'], [period]),
                        'netIncome': metric(income, ['Net Income Common Stockholders', 'Net Income'], [period]),
                        'grossProfit': metric(income, ['Gross Profit'], [period]), 'cfo': operating,
                        'capex': -investment if investment is not None and investment <= 0 else None,
                        'fcf': round(operating + investment, 2) if operating is not None and investment is not None and investment <= 0 else None})
    return {'sourceKind': 'mcp', 'period': '2026H1', 'balanceDate': '2026-06-30', 'currency': currency,
            'status': '第三方单季标准化；仅有原件核对标记的指标已复核',
            'sources': sources, 'history': history, **values} if any(v is not None for v in values.values()) else None


def listing(symbol):
    raw, source = read('get_stock_info', symbol)
    data = raw.get('data', {})
    price = number(data.get('currentPrice'))
    valid = data.get('symbol') == symbol and bool(data.get('longName')) and price is not None and price > 0
    timezone = data.get('exchangeTimezoneName')
    epoch = number(data.get('regularMarketTime'))
    market_time = dt.datetime.fromtimestamp(epoch, ZoneInfo(timezone)).isoformat() if epoch and timezone else None
    recent = number(data.get('mostRecentQuarter'))
    return {'symbol': symbol, 'available': valid, 'providerName': data.get('longName'),
            'currency': data.get('currency'), 'financialCurrency': data.get('financialCurrency'),
            'price': price if valid else None, 'marketTime': market_time, 'timezone': timezone,
            'retrievedAt': raw.get('retrievedAt'), 'quoteStatus': '数据源快照；可能延迟，非实时保证',
            'peTtm': number(data.get('trailingPE')) if valid and number(data.get('trailingPE')) and data['trailingPE'] > 0 else None,
            'marketCap': number(data.get('marketCap')) if valid else None,
            'businessSummary': data.get('longBusinessSummary'), 'website': data.get('website'),
            'industry': data.get('industry'), 'country': data.get('country'),
            'valuation': {k: number(data.get(k)) for k in ['forwardPE', 'priceToBook', 'priceToSalesTrailing12Months',
                           'enterpriseValue', 'enterpriseToEbitda', 'trailingEps', 'forwardEps', 'returnOnEquity',
                           'operatingMargins', 'profitMargins', 'revenueGrowth', 'earningsGrowth', 'dividendYield',
                           'fiftyTwoWeekLow', 'fiftyTwoWeekHigh', 'sharesOutstanding']},
            'summary': {'period': '供应商滚动摘要，不能与 H1 混用',
                        'mostRecentQuarter': dt.datetime.fromtimestamp(recent, dt.timezone.utc).date().isoformat() if recent else None,
                        'revenue': number(data.get('totalRevenue')), 'netIncome': number(data.get('netIncomeToCommon')),
                        'cfo': number(data.get('operatingCashflow')), 'fcf': number(data.get('freeCashflow'))},
            'source': source, 'issue': None if valid else data.get('error', '返回空资料；名称、代码与价格未形成有效记录')}


def main():
    candidates = json.loads((RAW / 'candidates.json').read_text())
    original = json.loads((ROOT / 'src/data/solidState/companies.json').read_text())
    tree_text = (ROOT / 'public/industry/solid-state.json').read_text()
    names = [c['name'] for c in original] + [n for n in candidates if n not in {c['name'] for c in original}]
    records = []
    for name in names:
        listings = [listing(symbol) for symbol in candidates.get(name, [])]
        primary = next((v for v in listings if v['available']), None)
        finance = financials(primary['symbol'], primary['financialCurrency']) if primary else None
        filing_path = RAW / 'filing-btr-2026H1.json'
        if name == '贝特瑞' and filing_path.exists():
            filing = json.loads(filing_path.read_text())
            keys = ['revenue', 'netIncome', 'grossProfit', 'cfo', 'capex', 'fcf', 'totalDebt',
                    'cashAndShortTermInvestments', 'cash', 'equity', 'assets', 'liabilities', 'receivables', 'inventory', 'goodwill']
            finance = {'sourceKind':'filing', 'period':'2026H1', 'balanceDate':'2026-06-30', 'currency':'CNY',
                       'status':'公司半年报摘要原件；非MCP补值，未取得完整三表', 'sources':[PREFIX + filing_path.name],
                       'history':[], **{k:filing['data'].get(k) for k in keys}}
        private_ids = {'四川华宜清创':'huayi', '清陶能源':'qingtao', '卫蓝新能源':'weilan', '辉能科技':'prologium',
                       '北京纯锂新能源':'pure-lithium', '智己汽车':'im-motors', '三星':'samsung-unresolved'}
        report_id = candidates[name][0].lower().replace('.', '-') if candidates.get(name) else 'entity-' + private_ids[name]
        records.append({'id': report_id, 'name': name, 'displayName': '五矿新能（原长远锂科）' if name == '长远锂科' else name,
                        'origin': '原产业树' if name in {c['name'] for c in original} else '原树延伸对照' if name in tree_text else '本轮补充候选',
                        'listings': listings, 'financials': finance})
    valid = [v for r in records for v in r['listings'] if v['available']]
    output = {'asOf': '2026-10-09', 'method': '真实 MCP stdio 调用；Yahoo Finance + AKShare；公告原件另行复核',
              'stats': {'originalCompanies': len(original),
                        'originalWithQuotes': sum(r['origin'] == '原产业树' and any(v['available'] for v in r['listings']) for r in records),
                        'supplementalCompanies': sum(r['origin'] == '本轮补充候选' for r in records),
                        'extendedCompanies': sum(r['origin'] == '原树延伸对照' for r in records),
                        'validListings': len(valid), 'failedListings': sum(not v['available'] for r in records for v in r['listings']),
                        'normalizedH1': sum(r['financials'] is not None and r['financials']['sourceKind'] == 'mcp' for r in records),
                        'officialH1Summaries': sum(r['financials'] is not None and r['financials']['sourceKind'] == 'filing' for r in records)},
              'crossChecks': [PREFIX + p.name for p in sorted(RAW.glob('akshare-*.json'))], 'companies': records}
    (ROOT / 'src/data/solidState/mcpSnapshot.json').write_text(json.dumps(output, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    manifest = {'asOf': output['asOf'], 'method': output['method'], 'stats': output['stats'],
                'notes': ['候选代码映射不等于全池发行人认证', '空资料保留为缺失，缺季不拼 TTM',
                          'H1=Q1+Q2；资产负债表为6月末；行情和财报币种分列',
                          '简化FCF=经营现金流−供应商资本支出，非FCFF或可分配现金',
                          '公告核对范围见页面；Yahoo滚动摘要和标准化H1不能混用'],
                'files': []}
    for path in sorted(RAW.glob('*.json')):
        if path.name == 'manifest.json':
            continue
        payload = json.loads(path.read_text())
        manifest['files'].append({'path': PREFIX + path.name,
                                  **{k: payload[k] for k in ['server', 'tool', 'arguments', 'retrievedAt'] if k in payload}})
    (RAW / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(output['stats'], ensure_ascii=False))


if __name__ == '__main__':
    main()
