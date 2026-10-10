import json, re, statistics, sys

from qual3 import Q, EXTRA
EXTRA['688326'] = ('汽车电子与 ECU 软硬件', '智驾域控与线控底盘')

import os
SP = os.getcwd()  # 工作目录：run.sh 指定的缓存目录
cos = json.load(open(f'{SP}/cos.json')); M = json.load(open(f'{SP}/metrics.json')); quotes = json.load(open(f'{SP}/quotes.json'))
NAMES = {'robot': '机器人与具身智能', 'biotech': '创新药', 'aerospace': '航空航天', 'newenergy': '新能源', 'semi': '半导体与先进制造', 'material': '新材料', 'frontier': '脑机接口、量子计算与合成生物'}

def unit(sym):
    return {'hk': 'HK$', 'us': 'US$'}.get(sym[:2], '')
def money(sym, v):
    u = unit(sym)
    return f'{u}{v:.2f}' + ('' if u else ' 元')
def pct(x, d=0):
    return '—' if x is None else f'{x:+.{d}f}%'

def metric(code):
    m = M.get(code)
    if not m or m.get('price') is None: return None
    pe = m['pe']; ny = m.get('npYoy'); ry = m.get('revYoy')
    pe_s = '亏损' if pe is None or pe <= 0 else f'{pe:.1f}×'
    if pe and pe > 0 and ny and ny > 0:
        peg = pe / ny
        peg_s = f'{peg:.2f}' + ('（利润低基数，参考性弱）' if ny > 100 else '')
    else:
        peg_s = '不适用（亏损或利润负增长）'
    period = m.get('period') or ''
    period = '2026H1' if '中报' in period or 'H1' in period or '第二季' in period else period
    growth = f'营收 {pct(ry)} / 归母 {pct(ny)}（{period}）' if ry is not None else '[MISSING]'
    return dict(pe=pe_s, peg=peg_s, growthRate=growth)

def price_str(code):
    m = M[code]; sym = m['sym']
    s = f"{m['price']:.2f}" if sym[:2] in ('sh', 'sz', 'bj') else f"{unit(sym)}{m['price']:g}（10-07）"
    for o, p in m['otherQuotes'].items():
        if p: s += f' / {unit(o) or "A "}{float(p):g}'
    return s

def build(tid, med=None):
    seen = []; picks = []; levels = []
    rows = []
    for c in cos[tid]:
        k = re.split(r'\s*/\s*', c['code'])[0]
        if c['code'] in M and k not in seen:
            seen.append(k); rows.append(c)
    pes = [M[c['code']]['pe'] for c in rows if M[c['code']]['pe'] and 0 < M[c['code']]['pe'] <= 150]
    med = med or statistics.median(pes)
    for c in rows:
        code = c['code']; m = M[code]; q = Q.get(code)
        if not q: print('NO QUAL', tid, c['name'], code); continue
        P = m['price']; pe = m['pe']; sym = m['sym']
        nm = q.get('nm')
        if not nm and (pe is None or pe <= 0): nm = '亏损'
        if not nm and pe > 150: nm = 'PE>150'
        if not nm and m.get('revYoy') is None: nm = '财报未取到'
        mt = metric(code)
        gm = m.get('gm'); rev = (m.get('rev') or 0) / 1e8; np_ = (m.get('np') or 0) / 1e8
        note = f"H1 营收 {rev:.1f} 亿（{pct(m.get('revYoy'))}），归母 {np_:.2f} 亿（{pct(m.get('npYoy'))}）" + (f"，毛利率 {gm:.1f}%" if gm is not None else '') + (f"；52 周 {m['lo']:g}–{m['hi']:g}" if m.get('hi') else '') + '。'
        if code == '873593.BJ': note = '北交所，本次未取到 2026H1 财报。'
        pick = dict(name=c['name'], code=code, tier='观察', price=price_str(code), upDown='—', ratio='未建模', winRate='—', expected='—',
                    moat=q['moat'], growth=q['growth'], note=note, risk=q['risk'], barrier=q['barrier'], space=q['space'] or f"{c['role']}", **(mt or {}))
        g = (m.get('revYoy') or 0) / 100 * 0.7; g = max(-0.05, min(0.20, g))
        h = q.get('h', 0.2)
        lvl = dict(code=code, risk=q['rl'])
        inv = q.get('inv') or ('毛利率跌破 %.0f%% 或单季归母同比转负' % (gm - 3) if gm and (m.get('npYoy') or 0) > 0 else '下一份财报营收、归母继续同比下滑')
        if nm:
            pick['ratio'] = '未建模'
            tier = q.get('tier') or ('观察' if q['growth'] == '高' else '回避追高')
            trig = q.get('trig') or ('扭亏且连续两季归母为正后再建模' if '亏' in nm else '利润增长使 PE 回落到 60× 以下后再建模')
            lvl.update(buy=f'不建模（{nm}），不设买入价', gap='—', stop='—', takeProfit='—', cap='0%，等触发' if tier in ('回避追高', '证据不足') else '≤1%，仅观察仓', trigger=trig, invalid=inv)
            pick['upDown'] = '—'
        else:
            eps = P / pe
            bmult = min((pe + med) / 2, 1.25 * pe); bmult = max(7, min(40, bmult))
            base = eps * (1 + g) * bmult
            bear = eps * (1 - h) * max(5, min(pe, 0.6 * med))
            pstar = (base + 2 * bear) / 3
            if base <= P:
                pick['upDown'] = f'基准<现价（基准 {money(sym, base)}，{base / P - 1:+.0%}）'
                pick['ratio'] = '不成立'
            else:
                R = (base - P) / (P - bear)
                up, down = base / P - 1, 1 - bear / P
                w = 0.5 if q['moat'] == '高' else 0.45
                pick.update(upDown=f'{up:+.0%} / −{down:.0%}', ratio=f'{R:.2f}:1', winRate=f'{w:.0%}', expected=f'{w * up - (1 - w) * down:+.1%}')
            if q.get('tier'): tier = q['tier']
            elif base > P and (base - P) / (P - bear) >= 2 - 1e-9: tier = '条件关注'
            elif base > P and (q['growth'] == '高' or q['moat'] == '高'): tier = '等回调'
            elif base > P: tier = '观察'
            elif q['growth'] == '高' and q['moat'] != '低': tier = '等回调'
            elif pe > 60: tier = '回避追高'
            else: tier = '观察'
            gap = pstar / P - 1
            stop = pstar - 0.5 * (pstar - bear)
            cap = int(min(5, 1 / ((pstar - bear) / pstar)))
            cap = max(cap, 1)
            if gap < -0.4:
                lvl.update(buy=f'价位过远：2:1 价 {money(sym, pstar)}，不挂单', gap=f'{gap:+.0%}', stop='—', takeProfit=f'{money(sym, base)}（基准价）',
                           cap='0%，等触发', trigger=q.get('trig') or f'利润增长使基准价接近现价，或股价回落到 {money(sym, pstar * 1.25)} 以内后重估', invalid=inv)
            else:
                lvl.update(buy=f'≤{money(sym, pstar)}，分 3 批', gap='现价附近' if abs(gap) < 0.03 else f'{gap:+.0%}', stop=f'{money(sym, stop)}，或基本面失效',
                           takeProfit=f'{money(sym, base)}（基准价）到价减半', cap=f'≤{cap}%', trigger='—', invalid=inv)
        if not q.get('tier') and tier in ('条件关注', '等回调') and (m.get('npYoy') or 0) < -20:
            tier = '观察'
            pick['risk'] += ' 归母同比下滑超 20%，模型按营收外推偏乐观，降为观察。'
        pick['tier'] = tier
        picks.append(pick); levels.append(lvl)
    order = {'条件关注': 0, '等回调': 1, '观察': 2, '回避追高': 3, '证据不足': 4}
    mo = {'高': 0, '中': 1, '低': 2, '待核': 3}
    picks.sort(key=lambda p: (order[p['tier']], mo[p['growth']], mo[p['moat']]))
    return picks, levels, med

def names(ps, f, n=12):
    l = [p['name'] for p in ps if f(p)]
    return '、'.join(l[:n]) + (f' 等 {len(l)} 家' if len(l) > n else '') if l else '无'

out = {}
for tid in NAMES:
    picks, levels, med = build(tid)
    out[tid] = dict(picks=picks, levels=levels, median=round(med, 1))
# 原 AI / 智能驾驶排序补充字段
metrics = {}
for tid in ('ai', 'adas'):
    for c in cos[tid]:
        mt = metric(c['code']) if c['code'] in M else None
        for key in [c['code']] + re.split(r'\s*/\s*', c['code'])[:1]:
            e = metrics.setdefault(key, {})
            if mt: e.update(mt)
            ex = EXTRA.get(c['code']) or EXTRA.get(key)
            if ex: e.update(barrier=ex[0], space=ex[1])
for k, (b, s) in EXTRA.items():
    metrics.setdefault(k, {}).update(barrier=b, space=s)
# 智能驾驶补入 9 家：倍数中位数用整个智能驾驶赛道
ADAS_NEW = ('2382.HK', '300790', '300552', '2533.HK', '002405', '002906', '603786', '1316.HK', '601799')
adas_pes = [M[c['code']]['pe'] for c in cos['adas'] if c['code'] in M and M[c['code']]['pe'] and 0 < M[c['code']]['pe'] <= 150]
cos['_adasx'] = [c for c in cos['adas'] if c['code'] in ADAS_NEW]
p9, l9, adasmed = build('_adasx', statistics.median(adas_pes))
out_adas = dict(picks=p9, levels=l9, median=round(adasmed, 1))
# AI 新增 4 家：倍数中位数用整个 AI 赛道
ai_pes = [M[c['code']]['pe'] for c in cos['ai'] if c['code'] in M and M[c['code']]['pe'] and 0 < M[c['code']]['pe'] <= 150]
cos['_aix'] = [c for c in cos['ai'] if c['code'] in ('300308', '300502', '688111', '600588')]
p4, l4, aimed = build('_aix', statistics.median(ai_pes))
out_ai = dict(picks=p4, levels=l4, median=round(aimed, 1))
json.dump(dict(sectors=out, metrics=metrics, aiExtra=out_ai, adasExtra=out_adas), open(f'{SP}/gen.json', 'w'), ensure_ascii=False, indent=1)
for tid, v in list(out.items()) + [('ai+', out_ai), ('adas+', out_adas)]:
    print(tid, 'median PE', v['median'], {t: sum(1 for p in v['picks'] if p['tier'] == t) for t in ('条件关注', '等回调', '观察', '回避追高', '证据不足')})
    for p, l in zip(v['picks'], v['levels']):
        pass
    for p in v['picks']:
        l = next(x for x in v['levels'] if x['code'] == p['code'])
        print(f"  {p['tier']}|{p['name']}|{p['price']}|PE {p.get('pe')}|PEG {p.get('peg')}|{p['upDown']}|{p['ratio']}|{l['buy']} {l['gap']}")
