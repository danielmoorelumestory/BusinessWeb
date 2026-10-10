"""Fetch dated quotes without changing the original research snapshot. Python standard library only."""
import concurrent.futures, datetime, json, pathlib, re, subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/research/future-trends-2026-10-09'
pool = json.loads((OUT / 'input-pool.json').read_text())
symbols = {}
for row in pool:
    code = row['key'].split(':', 1)[1]
    if re.fullmatch(r'\d{6}', code): symbol = ('sh' if code[0] in '69' else 'sz') + code
    elif re.fullmatch(r'\d+\.BJ', code): symbol = 'bj' + code[:-3]
    elif re.fullmatch(r'\d+\.HK', code): symbol = 'hk' + code[:-3].zfill(5)
    elif re.fullmatch(r'[A-Z][A-Z0-9-]*', code): symbol = 'us' + code
    else: continue
    symbols[symbol] = row['key']

def fetch(batch):
    url = 'https://qt.gtimg.cn/q=' + ','.join(batch)
    result = subprocess.run(['curl', '--connect-timeout', '5', '--max-time', '20', '-s', url], capture_output=True)
    rows = {}
    for line in result.stdout.decode('gbk', 'replace').split(';'):
        match = re.search(r'v_([^=]+)="([^"]*)"', line)
        if not match: continue
        symbol, raw = match.groups(); fields = raw.split('~')
        if len(fields) < 50 or symbol not in symbols: continue
        try: price = float(fields[3])
        except ValueError: continue
        if price <= 0: continue
        rows[symbols[symbol]] = dict(price=price, time=fields[30], name=fields[1],
            currency='CNY' if symbol[:2] in ('sh', 'sz', 'bj') else 'HKD' if symbol.startswith('hk') else 'USD',
            pe=fields[39], source=url, raw=fields)
    return rows

out = {}; syms = list(symbols)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
    for rows in executor.map(fetch, [syms[i:i+30] for i in range(0, len(syms), 30)]): out.update(rows)
(OUT / 'quotes.json').write_text(json.dumps(dict(fetchedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    source='腾讯延迟行情；原始时间按上市市场当地时间解释，不自动称收盘价', quotes=out,
    missing=[key for key in symbols.values() if key not in out]), ensure_ascii=False, indent=2))
print('quotes:', len(out), '/', len(symbols), 'requested;', len(pool)-len(out), 'without new quotes')
