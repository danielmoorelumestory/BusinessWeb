"""海外公司综合排序：同一程序化倍数模型，数据为 yfinance（最近季同比、TTM PE）。在工作目录读 cos_us.json、us.json，写 gen_us.json。"""
import json, os, re, statistics
from qual_us import QU

W = os.getcwd()
cos = json.load(open(f'{W}/cos_us.json')); U = json.load(open(f'{W}/us.json'))
CUR = {'USD': 'US$', 'JPY': '¥', 'KRW': '₩', 'EUR': '€', 'GBp': 'GBp ', 'CHF': 'CHF ', 'DKK': 'DKK ', 'CAD': 'C$', 'AUD': 'A$', 'NOK': 'NOK '}

def tk(code):
    t = re.split(r'\s*/\s*|（', code)[0].strip()
    return t if re.fullmatch(r'[A-Z0-9.\-]+', t) else None
def pct(x):
    return '—' if x is None else f'{x * 100:+.0f}%'
def money(cur, v):
    return f"{CUR.get(cur, cur + ' ')}{v:,.2f}" if v < 1000 else f"{CUR.get(cur, cur + ' ')}{v:,.0f}"

def build(tid):
    seen = set(); rows = []
    for c in cos[tid]:
        k = tk(c['code'])
        if k and k not in seen and U.get(k) is not None:
            seen.add(k); rows.append((c, k))
    pes = [U[k]['trailingPE'] for _, k in rows if U[k]['trailingPE'] and 0 < U[k]['trailingPE'] <= 150]
    med = statistics.median(pes)
    picks, levels = [], []
    for c, k in rows:
        u = U[k]; q = QU.get(c['code']) or QU.get(k)
        if not q: print('NO QUAL', tid, c['name'], c['code']); continue
        cur = u['currency'] or 'USD'; P = u['currentPrice'] or u['regularMarketPrice']
        pe, fpe = u['trailingPE'], u['forwardPE']; rg, eg = u['revenueGrowth'], u['earningsGrowth']
        nm = q.get('nm')
        if P is None: nm = nm or '行情未取到'
        if not nm and (pe is None or pe <= 0): nm = '亏损或 TTM PE 缺失'
        if not nm and pe > 150: nm = 'PE>150'
        pe_s = ('亏损/缺失' if not pe or pe <= 0 else f'{pe:.1f}×') + (f'（远期 {fpe:.1f}×）' if fpe and fpe > 0 else '')
        if pe and pe > 0 and eg and eg > 0:
            peg_s = f'{pe / (eg * 100):.2f}' + ('（利润低基数，参考性弱）' if eg > 1 else '')
        else:
            peg_s = '不适用（亏损或利润负增长）'
        gm, om, roe = u['grossMargins'], u['operatingMargins'], u['returnOnEquity']
        note = f"最近季营收 {pct(rg)}、盈利 {pct(eg)}" + (f"，毛利率 {gm * 100:.0f}%" if gm else '') + (f"、营业利润率 {om * 100:.0f}%" if om is not None else '') + (f"、ROE {roe * 100:.0f}%" if roe is not None and abs(roe) < 5 else '') + (f"；52 周 {u['fiftyTwoWeekLow']:g}–{u['fiftyTwoWeekHigh']:g}" if u['fiftyTwoWeekLow'] else '') + '。'
        pick = dict(name=c['name'], code=c['code'], tier='观察', price=money(cur, P) + '（10-07）' if P else '未取', upDown='—', ratio='未建模', winRate='—', expected='—',
                    moat=q['moat'], growth=q['growth'], note=note, risk=q['risk'] or '—', barrier=q['barrier'], space=q['space'] or c['role'],
                    pe=pe_s, peg=peg_s, growthRate=f'营收 {pct(rg)} / 盈利 {pct(eg)}（最近季同比）')
        lvl = dict(code=c['code'], risk=q['rl'])
        inv = q.get('inv') or (f'毛利率跌破 {gm * 100 - 3:.0f}% 或季度盈利同比转负' if gm and (eg or 0) > 0 else '下一季营收、盈利继续同比下滑')
        g = max(-0.05, min(0.20, (rg or 0) * 0.7)); h = q.get('h', 0.2)
        if nm:
            tier = q.get('tier') or ('观察' if q['growth'] == '高' else '回避追高')
            trig = q.get('trig') or ('扭亏且连续两季盈利后再建模' if '亏' in nm else '利润增长使 PE 回落到 60× 以下后再建模')
            lvl.update(buy=f'不建模（{nm}），不设买入价', gap='—', stop='—', takeProfit='—', cap='0%，等触发' if tier in ('回避追高', '证据不足') else '≤1%，仅观察仓', trigger=trig, invalid=inv)
        else:
            eps = P / pe
            bm = max(7, min(40, min((pe + med) / 2, 1.25 * pe)))
            base = eps * (1 + g) * bm; bear = eps * (1 - h) * max(5, min(pe, 0.6 * med))
            pstar = (base + 2 * bear) / 3
            if base <= P:
                pick.update(upDown=f'基准<现价（基准 {money(cur, base)}，{base / P - 1:+.0%}）', ratio='不成立')
            else:
                R = (base - P) / (P - bear); up, down = base / P - 1, 1 - bear / P
                w = 0.5 if q['moat'] == '高' else 0.45
                pick.update(upDown=f'{up:+.0%} / −{down:.0%}', ratio=f'{R:.2f}:1', winRate=f'{w:.0%}', expected=f'{w * up - (1 - w) * down:+.1%}')
            if q.get('tier'): tier = q['tier']
            elif base > P and (base - P) / (P - bear) >= 2 - 1e-9: tier = '条件关注'
            elif base > P and (q['growth'] == '高' or q['moat'] == '高'): tier = '等回调'
            elif base > P: tier = '观察'
            elif q['growth'] == '高' and q['moat'] != '低': tier = '等回调'
            elif pe > 60: tier = '回避追高'
            else: tier = '观察'
            if not q.get('tier') and tier in ('条件关注', '等回调') and (eg or 0) < -0.2:
                tier = '观察'; pick['risk'] += ' 盈利同比下滑超 20%，模型按营收外推偏乐观，降为观察。'
            gap = pstar / P - 1; stop = pstar - 0.5 * (pstar - bear)
            cap = max(1, int(min(5, 1 / ((pstar - bear) / pstar))))
            if gap < -0.4:
                lvl.update(buy=f'价位过远：2:1 价 {money(cur, pstar)}，不挂单', gap=f'{gap:+.0%}', stop='—', takeProfit=f'{money(cur, base)}（基准价）', cap='0%，等触发',
                           trigger=q.get('trig') or f'利润增长使基准价接近现价，或股价回落到 {money(cur, pstar * 1.25)} 以内后重估', invalid=inv)
            else:
                lvl.update(buy=f'≤{money(cur, pstar)}，分 3 批', gap='现价附近' if abs(gap) < 0.03 else f'{gap:+.0%}', stop=f'{money(cur, stop)}，或基本面失效',
                           takeProfit=f'{money(cur, base)}（基准价）到价减半', cap=f'≤{cap}%', trigger='—', invalid=inv)
        pick['tier'] = tier
        picks.append(pick); levels.append(lvl)
    order = {'条件关注': 0, '等回调': 1, '观察': 2, '回避追高': 3, '证据不足': 4}; mo = {'高': 0, '中': 1, '低': 2, '待核': 3}
    picks.sort(key=lambda p: (order[p['tier']], mo[p['growth']], mo[p['moat']]))
    return dict(picks=picks, levels=levels, median=round(med, 1))

out = {tid: build(tid) for tid in cos}
json.dump(out, open(f'{W}/gen_us.json', 'w'), ensure_ascii=False, indent=1)
for tid, v in out.items():
    print(tid, 'median PE', v['median'], {t: sum(1 for p in v['picks'] if p['tier'] == t) for t in order} if False else '')
    for p in v['picks']:
        l = next(x for x in v['levels'] if x['code'] == p['code'])
        print(f"  {p['tier']}|{p['name']}|{p['price']}|PE {p['pe']}|PEG {p['peg']}|{p['upDown']}|{p['ratio']}|{l['buy']} {l['gap']}")
