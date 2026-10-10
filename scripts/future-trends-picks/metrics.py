import json,re
cos=json.load(open('cos.json')); q=json.load(open('quotes.json')); ea=json.load(open('em_a.json')); eh=json.load(open('em_hkus.json'))
def f(x):
    try: return float(x)
    except: return None
def syms_of(code):
    r=[]
    for part in re.split(r'\s*/\s*',code):
        part=part.strip()
        if re.fullmatch(r'\d{6}',part): r.append(('sh' if part[0] in '69' else 'sz')+part)
        elif part.endswith('.BJ'): r.append('bj'+part[:6])
        elif part.endswith('.HK'): r.append('hk'+part[:-3].zfill(5))
        elif re.fullmatch(r'[A-Z]+',part): r.append('us'+part)
    return r
M={}
for t,l in cos.items():
    for c in l:
        ss=syms_of(c['code'])
        if not ss: continue
        # primary: A share if exists else HK else US
        pri=sorted(ss,key=lambda s:{'sh':0,'sz':0,'bj':0,'hk':1,'us':2}[s[:2]])[0]
        m=dict(sym=pri,others=[s for s in ss if s!=pri])
        qq=q.get(pri) or {}
        m.update(price=f(qq.get('price')),pe=f(qq.get('pe')),cap=f(qq.get('cap')),hi=f(qq.get('hi')),lo=f(qq.get('lo')),cur=qq.get('cur'),qtime=qq.get('time'))
        m['otherQuotes']={s:(q.get(s) or {}).get('price') for s in m['others']}
        if pri[:2] in ('sh','sz','bj'):
            e=ea.get(pri[2:],{})
            h1=e.get('2026-06'); fy=e.get('2025-12'); h1p=e.get('2025-06')
            if h1:
                m.update(period='2026H1',rev=h1['TOTAL_OPERATE_INCOME'],np=h1['PARENT_NETPROFIT'],revYoy=h1['YSTZ'],npYoy=h1['SJLTZ'],gm=h1['XSMLL'],roe=h1['WEIGHTAVG_ROE'],ocfps=h1['MGJYXJJE'],eps=h1['BASIC_EPS'],revQoq=h1['YSHZ'],npQoq=h1['SJLHZ'])
                if fy and h1p and None not in (fy['PARENT_NETPROFIT'],h1p['PARENT_NETPROFIT'],h1['PARENT_NETPROFIT']):
                    m['ttmNp']=fy['PARENT_NETPROFIT']+h1['PARENT_NETPROFIT']-h1p['PARENT_NETPROFIT']
                if fy: m['fyNpYoy']=fy['SJLTZ']; m['fyRevYoy']=fy['YSTZ']
        else:
            d=eh.get(pri,[])
            if d:
                r=d[0]
                if pri.startswith('hk'):
                    m.update(period=r['REPORT_TYPE'],rev=r.get('OPERATE_INCOME'),np=r.get('HOLDER_PROFIT'),revYoy=r.get('OPERATE_INCOME_YOY'),npYoy=r.get('HOLDER_PROFIT_YOY'),gm=r.get('GROSS_PROFIT_RATIO'),roe=r.get('ROE_AVG'),debt=r.get('DEBT_ASSET_RATIO'),pettm_em=r.get('PE_TTM'))
                else:
                    m.update(period=r.get('REPORT_DATA_TYPE'),rev=r.get('OPERATE_INCOME'),np=r.get('PARENT_HOLDER_NETPROFIT'),revYoy=r.get('OPERATE_INCOME_YOY'),npYoy=r.get('PARENT_HOLDER_NETPROFIT_YOY'),gm=r.get('GROSS_PROFIT_RATIO'),roe=r.get('ROE_AVG'),debt=r.get('DEBT_ASSET_RATIO'),ccy=r.get('CURRENCY_ABBR'))
        M[c['code']]=m
json.dump(M,open('metrics.json','w'),ensure_ascii=False)
def s(x,n=1): return '—' if x is None else f'{x:.{n}f}'
for t,l in cos.items():
    print('##',t)
    for c in l:
        m=M.get(c['code'])
        if not m: print(c['name'],c['code'],'NO SYMBOL'); continue
        print(f"{c['name']}|{m['sym']}|P{m['price']}|PE{s(m['pe'])}|cap{s(m['cap'],0)}|52w{s(m['lo'])}-{s(m['hi'])}|{m.get('period')}|rev{s((m.get('rev') or 0)/1e8)}亿{s(m.get('revYoy'))}%|np{s((m.get('np') or 0)/1e8,2)}亿{s(m.get('npYoy'))}%|gm{s(m.get('gm'))}|roe{s(m.get('roe'))}|ttm{s((m.get('ttmNp') or 0)/1e8,1)}")
