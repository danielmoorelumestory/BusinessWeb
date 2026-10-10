"""Render the dated, company-specific research for 化工 (Chemicals) and 高盛增持 (Goldman Sachs Holdings).

Inputs are locally retained filings and Tencent quotes.
No network requests and no automatic revenue-to-EPS extrapolation. The TSV contains
explicit analyst hypotheses; numeric valuations remain provisional pending cash/share checks.
"""
import csv
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / '.local/cn-chem-goldman-2026-10-07'
OUT = ROOT / 'public/research/cn-chem-goldman-2026-10-07'
DATE = '2026-10-07'
SECTORS = ['化工', '高盛增持']
SLUGS = {'化工': 'chem', '高盛增持': 'goldman'}
DISCLAIMER = '本报告仅供研究参考，不构成个人投资建议。'

facts = {r['code']: r for r in json.loads((INPUT / 'facts.json').read_text())}
quotes_raw = json.loads((INPUT / 'quotes.json').read_text())
quotes = {}
if (INPUT / 'quotes.txt').exists():
    for line in (INPUT / 'quotes.txt').read_bytes().decode('gb18030', errors='replace').splitlines():
        a = line.split('~')
        if len(a) > 73 and a[2] in facts:
            code = a[2]
            name = a[1].strip()
            price = float(a[3])
            ts = a[30]
            providerPe = float(a[39])
            providerPb = float(a[46])
            capYi = float(a[45])
            totalShares = int(a[73]) if a[73].isdigit() else int(round(capYi * 1e8 / price))
            quotes[code] = {
                'name': name, 'price': price, 'timestamp': ts,
                'providerPe': providerPe, 'providerPb': providerPb,
                'capYi': capYi, 'totalShares': totalShares,
                'url': 'https://qt.gtimg.cn/q=' + ('sh' if code[0] == '6' else 'sz') + code
            }
else:
    for code, q in quotes_raw.items():
        quotes[code] = {**q, 'totalShares': int(round(q['capYi'] * 1e8 / q['price']))}

old = json.loads((INPUT / 'previous.json').read_text())
old_by_code = {r['code']: r for r in old}
order = [r['code'] for sector in SECTORS for r in old if r['sector'] == sector]

theses = {}
thesis_path = INPUT / 'theses.tsv'
for line in thesis_path.read_text().splitlines():
    if not line.strip(): continue
    c, group, ry, cy, earnings, multiples, g, tier, segments, bull, bear, watch, revision = line.split('|')
    theses[c] = dict(group=group, ry=ry, cy=cy, earnings=earnings, multiples=multiples,
                     g=float(g) / 100, tier=tier, segments=segments.split('、'),
                     bull=bull, bear=bear, watch=watch, revision=revision)

assert set(order) == set(facts) == set(quotes) == set(theses) and len(order) == 27
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'theses.tsv').write_text(thesis_path.read_text())
(OUT / 'input.json').write_text(json.dumps({'filings': list(facts.values()), 'quotes': quotes}, ensure_ascii=False, indent=2))

for c, t in theses.items():
    t['ry'] = f"{facts[c]['revenueYoy']:g}" if facts[c].get('revenueYoy') is not None else "[MISSING]"
    if facts[c].get('coreYoy') is not None:
        t['cy'] = f"{facts[c]['coreYoy']:g}"
    else:
        t['cy'] = '亏损扩大' if (facts[c].get('corePrior') and facts[c]['core'] < facts[c]['corePrior']) else '亏损收窄'

def yi(v):
    return '[MISSING]' if v is None else f'{v / 1e8:.2f} 亿元'

def percent(v):
    return f'{v * 100:+.1f}%'

def factor(ke, g, terminal):
    explicit = sum((1 + g) ** (t - 1) / (1 + ke) ** t for t in range(1, 6))
    tv = (1 + g) ** 4 * (1 + terminal) / (ke - terminal) / (1 + ke) ** 5
    return explicit + tv, tv / (explicit + tv)

patches, audits = {}, []
batch_groups = []

for sector in SECTORS:
    codes = [c for c in order if old_by_code[c]['sector'] == sector]
    sizes = [5, 4, 4, 4, 3] if sector == '化工' else [4, 3]
    offset = 0
    for n, size in enumerate(sizes, 1):
        group = codes[offset:offset + size]
        offset += size
        batch_groups.append((sector, n, group))

assert sum(len(g[2]) for g in batch_groups) == 27

for code in order:
    f, q, t, previous = facts[code], quotes[code], theses[code], old_by_code[code]
    sector, p = previous['sector'], q['price']
    shares = q['totalShares'] / 1e8
    cap = p * shares
    name = previous['name']
    batch = next(n for s, n, group in batch_groups if code in group)
    
    evidence = f"2026H1 合并口径：收入 {yi(f['revenue'])}，归母 {yi(f['net'])}，扣非归母 {yi(f['core'])}，经营现金净额 {yi(f['ocf'])}。"
    source = f"[{'半年报摘要' if f.get('pages', 0) <= 15 else '半年报全文'} PDF 原件]({f['pdf']})"
    cash_source = f"[现金流量表原件，第{f.get('cashCapexPage', '末尾')}页]({f['fullPdf']})"
    fcf_note = f"H1购建固定资产、无形资产及其他长期资产支付现金{yi(f.get('cashCapex'))}；简式FCF=OCF−该项支出={yi(f.get('fcfProxy'))}。不含并购、租赁本金和净借款桥接，不等于完整FCFE或可分配股东现金。"
    
    if f.get('fcfProxy') is not None and f['fcfProxy'] < 0:
        t = {**t, 'bear': t['bear'] + f"；H1简式FCF为{yi(f['fcfProxy'])}，需验证扩产资本支出回报"}
        
    quote_note = f"{p:.2f} 元（腾讯行情，2026-09-30 {q['timestamp'][8:10]}:{q['timestamp'][10:12]}:{q['timestamp'][12:14]} 盘后最后报价；未获交易所收盘确认）"
    core_margin = (f['core'] / f['revenue']) if (f.get('core') is not None and f.get('revenue')) else 0
    cash_quality = f"{f['ocf'] / f['net']:.2f} 倍" if (f.get('net') and f['net'] > 0 and f.get('ocf')) else '不适用（归母亏损或现金为负）'
    
    ke = .16 if (f.get('core') is not None and f['core'] < 0) else (.14 if sector == '高盛增持' else .12)
    dcf_factor, tvshare = factor(ke, t['g'], .02)
    required_cash = cap / dcf_factor
    sensitivity = [[round(cap / factor(k, t['g'], terminal)[0], 4) for terminal in [.01, .02, .03]] for k in [ke-.02, ke, ke+.02]]
    reverse = f"反向股权DCF：若维持全股本参考股权值 {cap:.2f} 亿元，首年可分配股权现金需约 {required_cash:.2f} 亿元；假设 Ke {ke:.0%}、前五年现金增长 {t['g']:.0%}、永续增长 2%。这是要求值，不是公司实际FCF。"
    
    model = None
    if t['earnings'] != '—':
        profits = list(map(float, t['earnings'].split(',')))
        multiples = list(map(float, t['multiples'].split(',')))
        values = [n / shares * m for n, m in zip(profits, multiples)]
        bear, base, bull = values
        assert 0 < bear < base < bull
        threshold = (base + 2 * bear) / 3
        ratio = (base - p) / (p - bear) if bear < p < base else None
        ratio_text = f"{ratio:.3f}:1（仅本组PE假设）" if ratio is not None else ('不成立：参考价≥基准价' if p >= base else '不可计算：参考价≤悲观价，须重检压力情景')
        model = {'horizon': '2027-12-31', 'profitYi': profits, 'pe': multiples, 'approxSharesYi': shares,
                 'shareBasis': '腾讯总股本字段，未认证完全摊薄；跨市场权益按A股价作等价计算',
                 'price': values, 'ratio': ratio, 'threshold': threshold, 'certified': False}
        assumptions = [f"2027 正常化归母利润 {profits[i]:g} 亿元（研究假设）÷参考股数 {shares:.4f} 亿股×{multiples[i]:g}倍PE；不是公司指引" for i in range(3)]
        triggers = [f"压力假设：{t['bear']}", f"基准验证：{t['watch']}；下一份财报须显示扣非和回款改善", f"乐观验证：{t['watch']}与利润率、自由现金流同步改善"]
        scenarios = [dict(name=label, prob='[MISSING]（未赋概率）', assumption=assumptions[i], multiple=f"{multiples[i]:g}× PE（研究假设，未校准历史分位）", price=f"{values[i]:.2f} 元（估值初稿）", change=percent(values[i] / p - 1), trigger=triggers[i]) for i, label in enumerate(['悲观', '基准', '乐观'])]
        ratio_note = f"{ratio_text}；P={p:.2f}，Bear={bear:.4f}，Base={base:.4f}；用未四舍五入值计算。股本及现金流未闭合，本轮不认证可交易赔率。"
        zone = f"条件研究门槛 P≤{threshold:.2f} 元，来自(Base+2×Bear)/3；只有模型及股本验证后才有意义，不是已认证买入区。悲观价不保证最大损失。"
        valuation_text = '\n\n'.join(['本期披露扣非用于事实比较；2027利润另按公司产品、周期和投资收益桥接设研究假设，列盈利受压、正常兑现及较强兑现的利润总额；没有用营收增速计算EPS。利润假设不是一致预期，合理PE没有历史倍数校准。', '\n'.join(['| 情景 | 2027正常化归母利润（假设） | PE（假设） | 隐含价 | 相对报价 |', '| --- | ---: | ---: | ---: | ---: |'] + [f'| {s["name"]} | {profits[i]:g}亿元 | {multiples[i]:g}× | {values[i]:.2f}元 | {s["change"]} |' for i, s in enumerate(scenarios)]), ratio_note, zone])
    else:
        scenarios = [dict(name=label, prob='[MISSING]（未赋概率）', assumption=condition, multiple='不适用持续盈利PE；PS/NAV输入待核', price='[MISSING]（未建立可核验价值）', change='[MISSING]', trigger=trigger) for label, condition, trigger in [
            ('悲观', f"亏损或现金占用延续：{t['bear']}；核现金跑道、到期债务和可回收资产", '下一份财报扣非亏损扩大，或现金及融资覆盖不足'),
            ('基准', f"先证明{t['watch']}改善，再用分部营收×正常利润率及现金流重建", '至少连续两个季度扣非为正，并披露现金及资本开支桥接'),
            ('乐观', f"{t['bull']}兑现；仍需核产品利润率、研发和摊薄成本", '新增业务贡献可核实收入、正毛利及净现金，而非仅定点或研发进度')]]
        ratio_note = '[MISSING]：持续盈利、股本及下行资产回收尚未闭合；不沿用旧PE情景和旧赔率。'
        zone = '等待证据；亏损企业的估值需现金流/NAV或分部PS交叉核实，未给出可认证买入区。'
        valuation_text = '\n\n'.join([f"本期扣非亏损为{yi(f.get('core'))}，不套持续盈利PE。三情景列经营状态及触发条件，不用不可靠估计填价格。", *[f"**{s['name']}**：{s['assumption']}；价格 {s['price']}；{s['trigger']}。" for s in scenarios], ratio_note])
        
    rating = '回避' if (f.get('core') is not None and f['core'] < 0 and f.get('ocf') is not None and f['ocf'] < 0) else '观察'
    qualifier = '盈利与现金尚未验证' if (f.get('core') is not None and f['core'] < 0) else ('优先核实现金回报' if (f.get('ocf') is not None and f['ocf'] < 0) else '经营跟踪；价格与现金回报仍待验证')
    headline = f"{rating}：{qualifier}。{t['bull']}；{t['bear']}。"
    risk = [f"下一份财报验证：{t['watch']}；若主营扣非同比转负或亏损扩大，下修正常化盈利假设。",
            '未来两个季度验证：若累计经营现金净额≤0或回款持续弱于利润，撤回高现金转化假设；经营现金不能替代FCF。',
            '下一份财报及融资公告验证：新增发行、转增、可转债或股份支付改变摊薄股数时，重算所有每股值；股本未核前不使用模型价位。',
            f"最大反证：{t['bull']}若同时转化为持续扣非与可分配现金，当前审慎判断可能偏保守。"]
    views = [f"单模型多视角复核·产业（2026–2027，偏多条件）：{t['bull']}；失效：对应产品收入或单位盈利在下一份财报不兑现。",
             f"单模型多视角复核·财报（未来两季，{'偏空' if (f.get('core') is not None and f['core'] < 0) or (f.get('ocf') is not None and f['ocf'] < 0) else '观望'}）：扣非利润率{core_margin:.2%}，OCF/归母{cash_quality}；反证：扣非和现金连续改善。",
             f"单模型多视角复核·估值（至2027年底，观望）：{reverse}；失效：现金流要求不能被可验证的经营与资本开支假设支撑。",
             '共识：产品/技术优势必须经过扣非盈利、现金回报和价格检验。分歧：产业成长能否补偿利润率、周期与资本占用；本轮没有独立专家参与，不用多数票确定评级。']
    missing = '52周行情、同口径TTM盈利桥接、远期共识PE、PEG、ROIC、经营利润率、完整FCFE、净债务、完全摊薄股数、未列明的详细分部占比及未逐份读取的研究日后续公告 [MISSING]。'
    pitfalls = [f"财务来源（主要会计数据已核原件）：{f['pdf']}", f"资本开支来源（合并现金流量表，第{f.get('cashCapexPage', '未注')}页）：{f['fullPdf']}", fcf_note, f"行情来源（第三方，含自己的PE/PB算法）：{q['url']}",
                '复核范围：2026H1累计合并财报；不是Q2单季，不称未经桥接的TTM。披露至研究日未超过90天，报告期结束已超过90天 [STALE]；不得据此推断Q3经营。',
                '估值初稿：参考股数来自腾讯总股本字段；参考股权值=A股价×全股本，不是A/H/B各市场市值合计，且存在稀释口径风险；并非核实后的最新摊薄股数。未认证情景价、赔率与买入区；半年OCF受季节性和营运资金影响，不能单凭为负断言全年资不抵债。',
                missing, '反向DCF是市值对应的现金要求，不是预测FCF；使用股权资本成本Ke而非企业WACC，不再次扣净债务；五年现金增长率及永续增速均为研究假设。',
                f"旧结论处理：{t['revision']}；完整旧页仅作历史存档见 public/research/cn-chem-goldman-2026-10-07/previous.json。", DISCLAIMER]
    duration = '研究期限至2027-12-31；增长持续性取决于公司专属产品收入、单位利润和现金回报，不把本期同比增速外推至2027年底。'
    ai = 'AI需求仅在特定产品链条（如半导体洁净室、微电子化学品、算力存储）具有间接传导；AI独立利润贡献未拆分，不另加AI概念估值溢价。' if sector == '高盛增持' else 'AI为非核心估值变量；基础化工、大炼化与农化主业受供求及大宗周期主导，不以概念作为估值加分项。'
    segments = [{'name': s, 'share': '[MISSING]', 'note': '产品研究分组，非经核实的会计分部；收入/利润占比本轮未核，不强行相加'} for s in t['segments']]
    
    patch = dict(name=name, batch=f"{DATE}·{sector}第{batch}批", rating=rating, headline=headline,
                 asOf=f"{DATE}研究；财务2026H1累计合并中国会计准则，主要会计数据原件已核；行情{quote_note}；估值为未认证研究假设。",
                 profile=f"{name}（{code}）的研究主体为{t['group']}，主要产品研究分组包括{'、'.join(t['segments'])}。盈利依赖产品销售、单位利润及研发与资本投入的回报。{evidence}最近重大事项与研究日全部后续公告核检 [MISSING]，不将研发/扩产当已完成商业化回报。",
                 certainty=('低：扣非亏损或简式FCF为负，盈利可见度/现金回报未闭合' if (f.get('core') is not None and f['core'] < 0) or (f.get('fcfProxy') is not None and f['fcfProxy'] < 0) else '中：当期盈利与简式FCF有财报支持；持续性、完整股东现金与估值容错仍待核'),
                 duration=duration, ratioNote=ratio_note,
                 metrics=[['研究复核', f"{DATE}；原件主要会计数据已核，估值初稿未认证"], ['价格锚点', quote_note],
                          ['2026H1收入 / 同比', f"{yi(f['revenue'])} / {t['ry'] + '%' if t['ry'] != '[MISSING]' else '[MISSING]'}"],
                          ['2026H1归母 / 扣非', f"{yi(f['net'])} / {yi(f['core'])}"], ['2026H1扣非同比', t['cy'] + ('%' if re.fullmatch(r'-?\d+(\.\d+)?', t['cy']) else '')],
                          ['现金与盈利质量', f"H1经营现金净额{yi(f['ocf'])}；OCF/归母{cash_quality}；扣非/收入{core_margin:.2%}"],
                          ['现金资本开支与简式FCF', fcf_note],
                          ['2026-06-30归母权益', yi(f.get('equity'))],
                          ['行情商PE / PB（未独立核验）', f"{q['providerPe']:.2f}× / {q['providerPb']:.2f}×；PE≤0不具盈利型估值意义，非正常化或远期PE"],
                          ['第二方法·反向股权DCF', reverse], ['估值认证', '未认证：完全摊薄股本与完整股权现金流桥接未闭合；三情景不等于最大损失保证']],
                 thesis=[t['bull'], t['bear'], fcf_note, reverse, *views],
                 growth=[f"事实：H1营收同比{t['ry']}；扣非同比{t['cy'] + ('%' if re.fullmatch(r'-?\d+(\.\d+)?', t['cy']) else '')}。增长来源需按量、价、结构、费用、并购/周期拆分。", f"判断：{t['bull']}", f"验证：{t['watch']}；{duration}"],
                 moat=[f"待验证的护城河：{t['bull']}；需具体份额、客户认证/复购或单位成本证据，行业龙头标签本身不构成证明。"],
                 pros=[f"已核事实：{evidence}", f"产业研究优势：{t['bull']}"],
                 cons=[t['bear'], fcf_note, missing],
                 industry=[f"公司特定传导（判断）：{t['bull']}", f"需求与价格风险（判断）：{t['bear']}", '技术路线、行业供给与客户采购变化须通过产品量价、利润和资本开支验证；政策实施日未核实，不作为确定催化。'],
                 segments=segments, scenarios=scenarios,
                 discipline=dict(zone=zone, add=f"研究升级条件：{t['watch']}改善，未来两个季度扣非与现金趋势一致，并完成股本及FCF桥接。", trim='研究降级条件：盈利假设下修、回款恶化，或价位只被乐观情景支持；不提供固定卖出比例。', invalid=risk[0], position='本轮不提供个人仓位指令；估值初稿只用于比较假设与等待证据。'),
                 bullBear=dict(bull=t['bull'], bear=f"针对上述多头：{t['bear']}；产品机会成立也未证明可分配现金及股东回报。", verdict=f"{rating}；以扣非、现金和价格闭合为裁决，保留产业乐观与现金/估值审慎的分歧。单模型多视角复核。"),
                 risk=risk, next=[f"下一份季度披露核对：{t['watch']}；确切公告日期待公告核实。", zone],
                 calendar=[f"下一份季度报告（确切日期待公告）：{t['watch']}。", '未来两个季度：验证扣非与现金，任一季度新增融资/转增/股权激励触发股本重算。', '2027-12-31研究终点：比较正常化利润及可分配现金与本轮假设；不保证实现。'],
                 pitfalls=pitfalls, aiNote=ai, auto=False, reviewed=True)
    patches[code] = patch
    
    audit = dict(code=code, name=name, sector=sector, batch=batch, rating=rating, tier=t['tier'], filing=f,
                 quote=q, model=model, reverseDcf=dict(ke=ke, fiveYearGrowth=t['g'], terminalGrowth=.02,
                 requiredFirstYearFcfeYi=required_cash, terminalValueShare=tvshare,
                 sensitivityKe=[ke-.02, ke, ke+.02], sensitivityTerminal=[.01, .02, .03], sensitivityRequiredFcfeYi=sensitivity,
                 certified=False), revised=t['revision'], watch=t['watch'])
    audits.append(audit)
    
    sensitivity_md = '\n'.join(['| Ke / 永续增长 | 1% | 2% | 3% |', '| --- | ---: | ---: | ---: |'] + [f'| {k:.0%} | ' + ' | '.join(f'{v:.2f}亿元' for v in sensitivity[i]) + ' |' for i, k in enumerate([ke-.02, ke, ke+.02])])
    questions = [f"待验证的定价分歧：{t['bull']}。关键反证：{t['bear']}。尚无已证实的变异认知，保留监控项。",
                 f"价格反映什么：参考全股本股权值{cap:.2f}亿元，对应可分配现金要求见反向DCF；不声称已掌握市场一致预期。",
                 f"如何证明：{t['watch']}在未来两季财报有收入、扣非和现金支持。",
                 f"如何推翻：{risk[0]}", '为何现在：更新中报并纠正旧口径；没有把未核实政策或研发进度当确定催化。',
                 '何时改变评级/估值：主营、现金或摊薄股数改变时重估；两种估值输入闭合后再认证研究区间。', f"还缺什么：{missing}"]
                 
    text = f"# {name}（{code}）｜{sector}第{batch}批\n\n"
    modules = [
        ('0｜信息与证据', f"研究日{DATE}；沪深A股，人民币；价格{quote_note}；本轮已核财报2026H1。\n\n{source}；{cash_source}；[腾讯报价]({q['url']})。主要指标原件SHA-256：`{f.get('sha256', '[MISSING]')}`；全文原件SHA-256：`{f.get('fullSha256', '[MISSING]')}`。"),
        ('1｜公司简介', patch['profile']),
        ('2｜业务分布', '\n'.join(['| 产品研究分组 | 收入占比 | 口径 |', '| --- | --- | --- |'] + [f'| {s["name"]} | {s["share"]} | {s["note"]} |' for s in segments]) + '\n\n利润集中在哪个产品/地区 [MISSING]；不把研究分类伪装为核实会计分部。'),
        ('3｜优势与缺点', f"**优势**：{t['bull']}。\n\n**限制**：{t['bear']}。\n\n已核财务依据：{evidence}扣非利润率{core_margin:.2%}，OCF/归母{cash_quality}。其他份额、订单现金转化和成本比较待核。"),
        ('4｜行业趋势', '\n\n'.join(patch['industry'])),
        ('5｜结论卡与PM七问', f"**评级：{rating}。** {headline}\n\n确定性：{patch['certainty']}。\n\n{ratio_note}\n\n{duration}\n\n" + '\n'.join(f'- {x}' for x in questions)),
        ('6｜关键指标', '\n'.join(['| 指标 | 数值与口径 |', '| --- | --- |'] + [f'| {k} | {v} |' for k, v in patch['metrics']]) + f"\n\n所有收入、归母、扣非、OCF与权益数值来源：{source}。资本开支：{cash_source}。利润率、现金/归母与简式FCF为本轮算术，未把OCF当FCF。"),
        ('7｜增长与护城河', '\n\n'.join(patch['growth'] + patch['moat'] + [ai])),
        ('8｜三情景与第二方法', valuation_text + f"\n\n**独立现金要求检验（反向股权DCF，未认证）**：{reverse}\n\n计算：参考市值=Σ FCFE₁×(1+g)^(t−1)/(1+Ke)^t，t=1…5，加第五年末终值；终值=FCFE₅×(1+永续增长)/(Ke−永续增长)。这是当前报价下所需现金，不输出另一份未经桥接的正向DCF价值。\n\n终值占比{tvshare:.1%}" + ('，超过75%，反向要求值高度依赖终值假设。' if tvshare > .75 else '，仍对远期现金假设敏感。') + '\n\n敏感性（所需首年FCFE，不是股价）：\n\n' + sensitivity_md + '\n\n首年实际可分配股权现金[MISSING]；已核现金购建支出；维持与增长资本开支拆分、营运资本常态化及净借款桥接仍缺失，不用H1 OCF×2证明现金要求已满足。PE情景为2027年底终点价值，DCF为当前时点现金要求，两者期限不同，不平均成目标价；未赋情景概率，不计算胜率或期望收益。'),
        ('9｜条件化研究纪律', '\n\n'.join(patch['discipline'].values())),
        ('10｜风险与证伪', '\n'.join(f'- {x}' for x in risk)),
        ('11｜多空交锋与复核', '\n\n'.join(views) + f"\n\n**多头**：{t['bull']}\n\n**逐条回应的空头**：{patch['bullBear']['bear']}\n\n**裁决**：{patch['bullBear']['verdict']}"),
        ('12｜口径、陷阱与旧结论处理', '\n\n'.join(pitfalls[:-1]) + '\n\n保留：核实主体及产品研究方向。调整：财务数字和盈利质量，以本轮原件覆盖。撤回：旧未认证赔率、固定仓位和机械买入区；原件未取得的项目不被解释为经营恶化。'),
        ('13｜后续验证日历', '\n'.join(f'- {x}' for x in patch['calendar'])),
        ('14｜免责声明', DISCLAIMER)
    ]
    text += '\n\n'.join(f"## {title}\n\n{body}" for title, body in modules) + '\n'
    (OUT / f"{code}.md").write_text(text)

# Write TypeScript patch
ts_content = f"// 2026-10-07 company-level filing review. Generated by scripts/review-cn-chem-goldman-2026-10-07.py.\n// Valuations are provisional research hypotheses, not certified trading ranges.\nimport type {{ Company }} from '../companies'\n\nexport const cnChemGoldmanResearch: Record<string, Partial<Company>> = {json.dumps(patches, ensure_ascii=False, indent=2)}\n"
(ROOT / 'src/data/details/cnChemGoldmanResearch.ts').write_text(ts_content)

(OUT / 'audit.json').write_text(json.dumps(audits, ensure_ascii=False, indent=2))
(OUT / 'previous.json').write_text(json.dumps({'status': '历史存档；不作为当前研究结论或交易依据', 'archivedAt': DATE, 'companies': old}, ensure_ascii=False, indent=2))

with (OUT / 'summary.csv').open('w', newline='', encoding='utf-8') as handle:
    writer = csv.writer(handle)
    writer.writerow(['分类','批次','代码','公司','评级','研究优先级（非投资排名）','H1营收亿元','H1归母亿元','H1扣非亿元','H1OCF亿元','H1资本开支亿元','H1简式FCF亿元','报价日期','参考价','PE初稿Bear','PE初稿Base','PE初稿Bull','初稿赔率','认证','原件'])
    for a in audits:
        f, q, m = a['filing'], a['quote'], a['model']
        writer.writerow([
            a['sector'], a['batch'], a['code'], a['name'], a['rating'], a['tier'],
            round(f['revenue']/1e8, 4) if f.get('revenue') else None,
            round(f['net']/1e8, 4) if f.get('net') else None,
            round(f['core']/1e8, 4) if f.get('core') else None,
            round(f['ocf']/1e8, 4) if f.get('ocf') else None,
            round(f['cashCapex']/1e8, 4) if f.get('cashCapex') else None,
            round(f['fcfProxy']/1e8, 4) if f.get('fcfProxy') is not None else None,
            q['timestamp'], q['price'],
            *([round(v, 4) for v in m['price']] if m else ['[MISSING]']*3),
            m['ratio'] if m else '[MISSING]',
            False, f['pdf']
        ])

summary = [
    '# 沪深｜化工 → 高盛增持｜2026-10-07研究复核',
    '27家公司，化工20家（5批）与高盛增持7家（2批），共7批，每批3–5家。全部核对2026H1主要会计数据原件与现金流量表。完整个股报告在同目录，旧研究单列存档。',
    '**边界**：这是公司级事实复核及估值初稿，不是27份已认证深度定价。24家有公司特定PE三情景，3家扣非亏损（合盛硅业、黑猫股份、至纯科技）不强套PE；全部进行反向股权DCF现金要求检验。完全摊薄股数、FCF桥接及分部占比等仍缺，不能将初稿赔率认证为可交易赔率。',
    '**统一口径**：财务为2026H1累计合并中国会计准则；不混成Q2单季或TTM。报价为2026-09-30腾讯盘后最后报价，未确认交易所收盘。PE场景终点2027-12-31，利润/倍数为研究假设；反向DCF基于当前市值，不与终点价值直接平均。',
    '**研究优先次序（判断）**：化工板块先比较华鲁恒升、扬农化工、盐湖股份、宝丰能源与云天化的正现金流与成本护城河；大炼化（荣盛、恒力、盛虹、恒逸）与锂电材料（天齐、赣锋）需重点监控负债率与现金流背离风险（恒逸石化H1 OCF为负，巨化股份简式FCF为负）。高盛增持板块重点跟踪兴业银锡与亚翔集成的订单与资源兑现，警惕东芯股份的周期库存反噬、伟测科技重资本折旧压力及至纯科技的高负债亏损。',
    '**共同变量**：大宗化工与大炼化看原料（原油/煤炭）与产品价差、开工率及资产负债率；精细化工看下游需求渗透与ASP；高盛增持看海外半导体订单与大宗贵金属金融属性。现金流质量、资本开支峰值与股本摊薄是两大分类共同的验证核心。',
    '**数据陷阱**：归母净利润激增不等于扣非改善，扣非改善不等于现金流强劲。典型如恒逸石化表观扣非激增但经营现金流为负（-4.88亿）；藏格矿业归母高额但超65%来自巨龙铜业投资收益；亚翔集成归母暴增但H1经营现金流因工程结算滞后而为负；伟测科技购建资产高达17.4亿吞噬现金流。'
]

for sector, n, codes in batch_groups:
    slug = SLUGS[sector]
    table = ['| 公司 | H1收入 | H1扣非 | H1OCF | H1简式FCF | 评级 | 研究优先级 | 最大待证据 |', '| --- | ---: | ---: | ---: | ---: | --- | --- | --- |']
    for code in codes:
        a = next(a for a in audits if a['code'] == code)
        f = a['filing']
        table.append(f"| [{a['name']}（{code}）]({code}.md) | {yi(f.get('revenue'))} | {yi(f.get('core'))} | {yi(f.get('ocf'))} | {yi(f.get('fcfProxy'))} | {a['rating']} | {a['tier']} | {a['watch']} |")
    rank = sorted(codes, key=lambda c: (theses[c]['tier'], codes.index(c)))
    comparison = '本批补证次序：' + ' → '.join(patches[c]['name'] for c in rank) + '。先看扣非及现金可见度，再补分部、股本及估值；字母A/B/C为研究工作优先级，不是投资评分。'
    common = ('本批共同变量：产品ASP、原料价差、装置负荷与现金资本开支；大炼化高负债与周期反转分别定价。' if sector == '化工' else '本批共同变量：海外订单执行、半导体设备/测试折旧、金属资源价格与现金回款周期。')
    body = '\n\n'.join(['\n'.join(table), comparison, common, '数据陷阱：全部财务采用同一H1累计口径；不能把现金高于净利称FCF，也不能把低基数同比当未来盈利增长率。', '与前批衔接：沿用同一报价快照与H1原件标准，不混入上轮排名或程序EPS。下一步：先核本批各公司表中专属变量、FCF及实施后股本，再与下一批在相同口径比较。', DISCLAIMER])
    (OUT / f"{slug}-batch-{n}.md").write_text(f"# {sector}第{n}批｜{DATE}\n\n" + body + '\n')
    summary.extend([f"## {sector}第{n}批", body])

summary.append(DISCLAIMER)
(OUT / 'index.md').write_text('\n\n'.join(summary) + '\n')
print(f"Wrote {len(patches)} company patches/reports, {len(batch_groups)} batch reports, audit and archive.")
