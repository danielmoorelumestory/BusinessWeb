"""Derive per-company facts from raw AkShare data + bulk statements. Writes .local/cn-itucd-2026-10-07/facts.json and digest.txt."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / '.local/cn-itucd-2026-10-07'
universe = json.loads((BASE / 'universe.json').read_text())
quotes = json.loads((BASE / 'quotes.json').read_text())


def bulk(name, date):
    return {r['股票代码']: r for r in json.loads((BASE / f'bulk-{name}-{date}.json').read_text())}


XJ = {d: bulk('xjll', d) for d in ['20260630', '20250630', '20251231']}
ZC = {d: bulk('zcfz', d) for d in ['20260630', '20251231']}


def ind_by_date(ind, date):
    for r in ind:
        if r['REPORT_DATE'].startswith(date):
            return r
    return None


def num(v):
    return None if v is None else float(v)


def segments(zygc):
    """Latest-period product (else industry) split, top 6 by revenue share."""
    if not zygc or isinstance(zygc, dict):
        return None, []
    latest = max(r['报告日期'] for r in zygc)
    rows = [r for r in zygc if r['报告日期'] == latest]
    for kind in ['按产品分类', '按行业分类']:
        sel = [r for r in rows if r['分类类型'] == kind and r['收入比例'] is not None]
        if sel:
            break
    else:
        sel = []
    sel.sort(key=lambda r: -(r['收入比例'] or 0))
    date = __import__('datetime').datetime.fromtimestamp(latest / 1000, __import__('datetime').timezone.utc).strftime('%Y-%m-%d')
    return date, [dict(name=r['主营构成'], share=round(r['收入比例'] * 100, 1), margin=None if r['毛利率'] is None else round(r['毛利率'] * 100, 1), kind=kind) for r in sel[:6]]


facts = {}
for u in universe:
    c = u['code']
    raw = json.loads((BASE / 'raw' / f'{c}.json').read_text())
    ind = raw['indicator'] if isinstance(raw['indicator'], list) else []
    h26, h25, fy25, q126 = ind_by_date(ind, '2026-06-30'), ind_by_date(ind, '2025-06-30'), ind_by_date(ind, '2025-12-31'), ind_by_date(ind, '2026-03-31')
    q = quotes.get(c)
    f = dict(code=c, name=u['name'], sector=u['sector'], err=None)
    if not (h26 and h25 and fy25 and q):
        f['err'] = 'missing:' + ','.join(k for k, v in [('h26', h26), ('h25', h25), ('fy25', fy25), ('quote', q)] if not v)
        facts[c] = f
        continue
    price = q['price']
    cap = float(q['capYi']) if q['capYi'] else None  # 亿元
    shares = cap / price if cap and price else None  # 亿股
    ttm = lambda k: (num(fy25[k]) or 0) + (num(h26[k]) or 0) - (num(h25[k]) or 0)
    seg_date, segs = segments(raw['zygc'])
    prof = raw['profile'] if isinstance(raw['profile'], dict) else {}
    ocf26 = num(XJ['20260630'].get(c, {}).get('经营性现金流-现金流量净额'))
    ocf25h = num(XJ['20250630'].get(c, {}).get('经营性现金流-现金流量净额'))
    ocf25 = num(XJ['20251231'].get(c, {}).get('经营性现金流-现金流量净额'))
    notices = [dict(date=n['公告时间'], title=n['公告标题'], url=n['公告链接']) for n in raw['notices'] if isinstance(n, dict)] if isinstance(raw['notices'], list) else []
    f.update(
        price=price, ts=q['timestamp'], capYi=cap, shares=shares, providerPe=q['providerPe'], pb=q['pb'],
        rev26=num(h26['TOTALOPERATEREVE']), rev25h=num(h25['TOTALOPERATEREVE']), revYoy=num(h26['TOTALOPERATEREVETZ']),
        net26=num(h26['PARENTNETPROFIT']), net25h=num(h25['PARENTNETPROFIT']), netYoy=num(h26['PARENTNETPROFITTZ']),
        core26=num(h26['KCFJCXSYJLR']), core25h=num(h25['KCFJCXSYJLR']), coreYoy=num(h26['KCFJCXSYJLRTZ']),
        revFY25=num(fy25['TOTALOPERATEREVE']), netFY25=num(fy25['PARENTNETPROFIT']), coreFY25=num(fy25['KCFJCXSYJLR']),
        revTTM=ttm('TOTALOPERATEREVE'), netTTM=ttm('PARENTNETPROFIT'), coreTTM=ttm('KCFJCXSYJLR'),
        gm=num(h26['XSMLL']), gm25h=num(h25['XSMLL']), nm=num(h26['XSJLL']), roe=num(h26['ROEJQ']), roic=num(h26['ROIC']),
        debtRatio=num(h26['ZCFZL']), interestDebt=num(h26['INTEREST_DEBT_RATIO']), current=num(h26['LD']), epsH=num(h26['EPSJB']), bps=num(h26['BPS']),
        q2RevYoy=num(h26.get('DJD_TOI_YOY')), q2CoreYoy=num(h26.get('DJD_DEDUCTDPNP_YOY')),
        q1Rev=num(q126['TOTALOPERATEREVE']) if q126 else None,
        ocf26=ocf26, ocf25h=ocf25h, ocf25=ocf25, fcff=num(h26['FCFF_BACK']), fixedRatio=num(h26['NCO_FIXED']),
        equity=num(ZC['20260630'].get(c, {}).get('股东权益合计')), cash=num(ZC['20260630'].get(c, {}).get('资产-货币资金')),
        liab=num(ZC['20260630'].get(c, {}).get('负债-总负债')),
        notice26=h26['NOTICE_DATE'][:10], segDate=seg_date, segments=segs, industry=prof.get('所属行业'), main=prof.get('主营业务'),
        scope=(prof.get('经营范围') or '')[:160], listed=prof.get('上市日期'), notices=notices[:40],
    )
    facts[c] = f
(BASE / 'facts.json').write_text(json.dumps(facts, ensure_ascii=False, indent=0))
bad = {c: f['err'] for c, f in facts.items() if f['err']}
print('companies', len(facts), 'errors', bad)
lines = []
for u in universe:
    f = facts[u['code']]
    if f['err']:
        lines.append(f"{f['code']}|{f['name']}|{f['sector']}|ERR {f['err']}")
        continue
    segs = '；'.join(f"{s['name']}{s['share']:g}%" for s in f['segments'][:4])
    lines.append(f"{f['code']}|{f['name']}|{f['sector']}|{f['industry']}|营收{f['rev26']/1e8:.1f}亿 {f['revYoy']:+.0f}%|扣非{(f['core26'] or 0)/1e8:.1f}亿 {f['coreYoy'] if f['coreYoy'] is None else format(f['coreYoy'], '+.0f')}%|毛利{f['gm']:.0f}%|市值{f['capYi']}亿|{segs}|{(f['main'] or '')[:40]}")
(BASE / 'digest.txt').write_text('\n'.join(lines))
seen = {l.split('|')[0] for l in (BASE / 'digest-done.txt').read_text().splitlines()} if (BASE / 'digest-done.txt').exists() else set()
