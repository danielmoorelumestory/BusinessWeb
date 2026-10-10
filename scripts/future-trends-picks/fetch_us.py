"""海外公司行情与指标（yfinance，复用 yahoo-finance MCP 的虚拟环境）。
用法：<venv python> fetch_us.py <catalog.json>，在工作目录写出 cos_us.json、us.json。"""
import json, re, sys, time
import yfinance as yf

d = json.load(open(sys.argv[1]))
cos = {}
for t in d['trends']:
    seen = {}
    for l in t['chain']:
        for c in l['us']:
            seen.setdefault(c['code'], {'name': c['name'], 'code': c['code'], 'role': c['role']})
    cos[t['id']] = list(seen.values())
json.dump(cos, open('cos_us.json', 'w'), ensure_ascii=False, indent=1)

def ticker(code):
    t = re.split(r'\s*/\s*|（', code)[0].strip()
    return t if re.fullmatch(r'[A-Z0-9.\-]+', t) else None

KEYS = ['currentPrice', 'regularMarketPrice', 'currency', 'trailingPE', 'forwardPE', 'pegRatio', 'trailingPegRatio', 'revenueGrowth', 'earningsGrowth',
        'grossMargins', 'operatingMargins', 'profitMargins', 'returnOnEquity', 'fiftyTwoWeekLow', 'fiftyTwoWeekHigh', 'marketCap', 'trailingEps', 'forwardEps',
        'targetMeanPrice', 'recommendationKey', 'numberOfAnalystOpinions', 'debtToEquity', 'freeCashflow', 'totalRevenue', 'netIncomeToCommon', 'mostRecentQuarter', 'shortName']
out = {}
try: out = json.load(open('us.json'))
except Exception: pass
tks = sorted({ticker(c['code']) for l in cos.values() for c in l} - {None})
for tk in tks:
    if tk in out and out[tk]: continue
    for attempt in range(3):
        try:
            info = yf.Ticker(tk).info
            out[tk] = {k: info.get(k) for k in KEYS}
            break
        except Exception as e:
            out[tk] = None; time.sleep(2)
    time.sleep(0.3)
json.dump(out, open('us.json', 'w'), ensure_ascii=False)
print(len(tks), 'tickers;', 'missing:', [k for k in tks if not out.get(k) or out[k].get('regularMarketPrice') is None and out[k].get('currentPrice') is None])
