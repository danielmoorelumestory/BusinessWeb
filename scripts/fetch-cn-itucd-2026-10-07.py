"""Fetch filings-derived raw data (AkShare / 东方财富 + 巨潮 + 腾讯行情) for the CN 信息技术 / 公用事业 / 可选消费 universe.

Outputs .local/cn-itucd-2026-10-07/raw/<code>.json. Re-runnable; skips codes already fetched.
Usage: python scripts/fetch-cn-itucd-2026-10-07.py [--force]
"""
import json
import sys
import time
import urllib.request
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import akshare as ak

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / '.local/cn-itucd-2026-10-07'
RAW = BASE / 'raw'
RAW.mkdir(parents=True, exist_ok=True)
universe = json.loads((BASE / 'universe.json').read_text())
FORCE = '--force' in sys.argv


def prefix(code):
    return ('SH' if code[0] == '6' else 'BJ' if code[0] in '489' else 'SZ') + code


def retry(fn, n=3):
    for i in range(n):
        try:
            return fn()
        except Exception as e:  # network flake
            err = repr(e)[:160]
            time.sleep(1.5 * (i + 1))
    return {'error': err}


def frame(df, cols, rows=6):
    if isinstance(df, dict):
        return df
    keep = [c for c in cols if c in df.columns]
    d = df.sort_values('REPORT_DATE', ascending=False).head(rows)[keep]
    return json.loads(d.to_json(orient='records', date_format='iso', force_ascii=False))


IND = ['REPORT_DATE', 'REPORT_TYPE', 'NOTICE_DATE', 'EPSJB', 'EPSKCJB', 'BPS', 'MGJYXJJE', 'TOTALOPERATEREVE', 'MLR', 'PARENTNETPROFIT',
       'KCFJCXSYJLR', 'TOTALOPERATEREVETZ', 'PARENTNETPROFITTZ', 'KCFJCXSYJLRTZ', 'ROEJQ', 'ROEKCJQ', 'ZZCJLL', 'XSJLL', 'XSMLL',
       'YSZKYYSR', 'JYXJLYYSR', 'LD', 'SD', 'ZCFZL', 'QYCS', 'ROIC', 'STAFF_NUM', 'INTEREST_DEBT_RATIO', 'FCFF_BACK', 'NCO_NETPROFIT',
       'NCO_FIXED', 'DJD_TOI_YOY', 'DJD_DPNP_YOY', 'DJD_DEDUCTDPNP_YOY', 'INTEREST_COVERAGE_RATIO', 'CHZZTS', 'YSZKZZTS']


def one(item):
    code = item['code']
    out = RAW / f'{code}.json'
    if out.exists() and not FORCE:
        return code
    sym = prefix(code)
    suffix = '.SH' if code[0] == '6' else '.BJ' if code[0] in '489' else '.SZ'
    rec = {'code': code, 'name': item['name'], 'sector': item['sector']}
    ind = retry(lambda: ak.stock_financial_analysis_indicator_em(symbol=code + suffix, indicator='按报告期'))
    rec['indicator'] = ind if isinstance(ind, dict) else json.loads(ind.sort_values('REPORT_DATE', ascending=False).head(12)[[c for c in IND if c in ind.columns]].to_json(orient='records', date_format='iso', force_ascii=False))
    z = retry(lambda: ak.stock_zygc_em(symbol=sym))
    rec['zygc'] = z if isinstance(z, dict) else json.loads(z.head(80).to_json(orient='records', force_ascii=False))
    p = retry(lambda: ak.stock_profile_cninfo(symbol=code))
    rec['profile'] = p if isinstance(p, dict) else json.loads(p.iloc[0].to_json(force_ascii=False))
    d = retry(lambda: ak.stock_zh_a_disclosure_report_cninfo(symbol=code, market='沪深京', start_date='20260401', end_date='20261007'))
    rec['notices'] = d if isinstance(d, dict) else json.loads(d.head(80).to_json(orient='records', force_ascii=False))
    out.write_text(json.dumps(rec, ensure_ascii=False))
    return code


def bulk():
    """Whole-market statements for the periods we need, filtered to the universe."""
    codes = {i['code'] for i in universe}
    res = {}
    for date in ['20260630', '20260331', '20251231', '20250630']:
        for name, fn in [('xjll', ak.stock_xjll_em), ('zcfz', ak.stock_zcfz_em), ('lrb', ak.stock_lrb_em), ('yjbb', ak.stock_yjbb_em)]:
            f = BASE / f'bulk-{name}-{date}.json'
            if f.exists() and not FORCE:
                continue
            df = retry(lambda: fn(date=date))
            if isinstance(df, dict):
                print('bulk error', name, date, df)
                continue
            df = df[df['股票代码'].astype(str).isin(codes)]
            f.write_text(df.to_json(orient='records', force_ascii=False))
    return res


def quotes():
    codes = [i['code'] for i in universe]
    res = {}
    for i in range(0, len(codes), 50):
        chunk = codes[i:i + 50]
        q = ','.join(('sh' if c[0] == '6' else 'bj' if c[0] in '489' else 'sz') + c for c in chunk)
        raw = urllib.request.urlopen(f'https://qt.gtimg.cn/q={q}', timeout=20).read().decode('gb18030')
        for line in raw.splitlines():
            if '~' not in line:
                continue
            a = line.split('~')
            res[a[2]] = {'name': a[1].strip(), 'price': float(a[3] or 0), 'prevClose': float(a[4] or 0), 'timestamp': a[30],
                         'providerPe': a[39], 'pb': a[46], 'capYi': a[45], 'high52': a[47] if len(a) > 47 else None,
                         'totalShares': a[73] if len(a) > 73 else None}
    (BASE / 'quotes.json').write_text(json.dumps(res, ensure_ascii=False, indent=0))


if __name__ == '__main__':
    quotes()
    bulk()  # skips files that already exist
    with ProcessPoolExecutor(5) as ex:
        for i, c in enumerate(ex.map(one, universe), 1):
            if i % 10 == 0:
                print(i, c, flush=True)
    print('done')
