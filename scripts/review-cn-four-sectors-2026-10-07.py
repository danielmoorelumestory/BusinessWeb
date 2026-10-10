"""Render the dated, company-specific research. Inputs are the locally retained filings.

No network requests and no automatic revenue-to-EPS extrapolation. The TSV contains
explicit analyst hypotheses; numeric valuations remain provisional pending cash/share checks.
"""
import csv
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / '.local/cn-four-sectors-2026-10-07'
OUT = ROOT / 'public/research/cn-four-sectors-2026-10-07'
DATE = '2026-10-07'
SECTORS = ['机器人链', '工程机械', '新能源汽车', 'AI 算力']
SLUGS = dict(zip(SECTORS, ['robotics', 'machinery', 'ev', 'ai-compute']))
DISCLAIMER = '本报告仅供研究参考，不构成个人投资建议。'
published_input = json.loads((OUT / 'input.json').read_text()) if (OUT / 'input.json').exists() else None
facts = {r['code']: r for r in (json.loads((INPUT / 'facts.json').read_text()) if (INPUT / 'facts.json').exists() else published_input['filings'])}
old = json.loads((INPUT / 'previous.json').read_text()) if (INPUT / 'previous.json').exists() else json.loads((OUT / 'previous.json').read_text())['companies']
old_by_code = {r['code']: r for r in old}
order = [r['code'] for sector in SECTORS for r in old if r['sector'] == sector]
quotes = published_input['quotes'] if published_input else {}
if (INPUT / 'quotes.txt').exists():
    for line in (INPUT / 'quotes.txt').read_bytes().decode('gb18030').splitlines():
        a = line.split('~')
        quotes[a[2]] = {'name': a[1].strip(), 'price': float(a[3]), 'timestamp': a[30],
                        'providerPe': float(a[39]), 'providerPb': float(a[46]),
                        'capYi': float(a[45]), 'totalShares': int(a[73]), 'url': 'https://qt.gtimg.cn/q=' + ('sh' if a[2][0] == '6' else 'sz') + a[2]}
theses = {}
thesis_path = INPUT / 'theses.tsv' if (INPUT / 'theses.tsv').exists() else OUT / 'theses.tsv'
for line in thesis_path.read_text().splitlines():
    c, group, ry, cy, earnings, multiples, g, tier, segments, bull, bear, watch, revision = line.split('|')
    theses[c] = dict(group=group, ry=ry, cy=cy, earnings=earnings, multiples=multiples,
                     g=float(g) / 100, tier=tier, segments=segments.split('、'),
                     bull=bull, bear=bear, watch=watch, revision=revision)
assert set(order) == set(facts) == set(quotes) == set(theses) and len(order) == 46
assert all(q['timestamp'].startswith('20260930') for q in quotes.values())
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'theses.tsv').write_text(thesis_path.read_text())
notes = json.loads((INPUT / 'notes.json').read_text()) if (INPUT / 'notes.json').exists() else published_input['notes']
(OUT / 'input.json').write_text(json.dumps({'filings': list(facts.values()), 'quotes': quotes, 'notes': notes}, ensure_ascii=False, indent=2))
for c,t in theses.items():
    t['ry']=f'{facts[c]["revenueYoy"]:g}'
    t['cy']=f'{facts[c]["coreYoy"]:g}' if facts[c]['coreYoy'] is not None else ('亏损扩大' if facts[c]['core'] < facts[c]['corePrior'] else '亏损收窄')

def yi(v):
    return '[MISSING]' if v is None else f'{v / 1e8:.2f} 亿元'

def percent(v):
    return f'{v * 100:+.1f}%'

def factor(ke, g, terminal):
    # First cash distribution at t=1; explicit five-year period, then terminal growth.
    explicit = sum((1 + g) ** (t - 1) / (1 + ke) ** t for t in range(1, 6))
    tv = (1 + g) ** 4 * (1 + terminal) / (ke - terminal) / (1 + ke) ** 5
    return explicit + tv, tv / (explicit + tv)

patches, audits = {}, []
batch_groups = []
for sector in SECTORS:
    codes = [c for c in order if old_by_code[c]['sector'] == sector]
    sizes = {'机器人链':[3], '工程机械':[1], '新能源汽车':[5,5,5,4,4], 'AI 算力':[5,5,5,4]}[sector]
    offset = 0
    for n, size in enumerate(sizes, 1):
        group = codes[offset:offset + size]; offset += size
        batch_groups.append((sector, n, group))
assert sum(len(g[2]) for g in batch_groups) == 46

for code in order:
    f, q, t, previous = facts[code], quotes[code], theses[code], old_by_code[code]
    sector, p = previous['sector'], q['price']
    shares = q['totalShares']/1e8
    cap = p*shares
    extra = notes[code]
    event_text = '\n\n'.join(f'[{e["date"]} · {e["title"]}]({e["url"]})：{e["note"]}' for e in extra['eventNotes']) or '中报后重大事项全文核检[MISSING]；已查询9月1日至研究日公告标题，不以标题检索替代完整风险审查。'
    business_text = '\n\n'.join(extra['extraFacts'])
    event_brief = extra['eventNotes'][0]['note'] if extra['eventNotes'] else '研究日中报后重大事件核检仍未闭合[MISSING]'
    name = {'603501': '豪威集团', '688779': '五矿新能', '688326': '经纬恒润-W'}.get(code, previous['name'])
    batch = next(n for s, n, group in batch_groups if code in group)
    evidence = f'2026H1 合并口径：收入 {yi(f["revenue"])}，归母 {yi(f["net"])}，扣非归母 {yi(f["core"])}，经营现金净额 {yi(f["ocf"])}。'
    source = f'[{"半年报摘要" if f["pages"] <= 13 else "半年报全文"} PDF 原件]({f["pdf"]})'
    cash_source = f'[现金流量表原件，第{f["cashCapexPage"]}页]({f["fullPdf"]})'
    fcf_note = f'H1购建固定资产、无形资产及其他长期资产支付现金{yi(f["cashCapex"])}；简式FCF=OCF−该项支出={yi(f["fcfProxy"])}。不含并购、租赁本金和净借款桥接，不等于完整FCFE或可分配股东现金。'
    if f['fcfProxy'] < 0:
        t = {**t, 'bear': t['bear'] + f'；H1简式FCF为{yi(f["fcfProxy"])}，需验证扩产支出回报'}
    quote_note = f'{p:.2f} 元（腾讯行情，2026-09-30 {q["timestamp"][8:10]}:{q["timestamp"][10:12]}:{q["timestamp"][12:14]} 盘后最后报价；未获交易所收盘确认）'
    core_margin = f['core'] / f['revenue']
    cash_quality = f'{f["ocf"] / f["net"]:.2f} 倍' if f['net'] > 0 else '不适用（归母亏损）'
    # Quoted total shares are a dated third-party input, not certified diluted shares.
    ke = .18 if f['core'] < 0 else (.16 if code in ['688041','688256'] else (.14 if sector in ['机器人链','AI 算力'] else .12))
    dcf_factor, tvshare = factor(ke, t['g'], .02)
    required_cash = cap / dcf_factor
    sensitivity = [[round(cap / factor(k, t['g'], terminal)[0], 4) for terminal in [.01, .02, .03]] for k in [ke-.02, ke, ke+.02]]
    reverse = f'反向股权DCF：若维持全股本按A股价计算的参考股权值 {cap:.2f} 亿元，首年可分配股权现金需约 {required_cash:.2f} 亿元；假设 Ke {ke:.0%}、前五年现金增长 {t["g"]:.0%}、永续增长 2%。这是要求值，不是公司实际FCF。'
    model = None
    if t['earnings'] != '—':
        profits = list(map(float, t['earnings'].split(',')))
        multiples = list(map(float, t['multiples'].split(',')))
        values = [n / shares * m for n, m in zip(profits, multiples)]
        bear, base, bull = values
        assert 0 < bear < base < bull
        threshold = (base + 2 * bear) / 3
        ratio = (base - p) / (p - bear) if bear < p < base else None
        ratio_text = f'{ratio:.3f}:1（仅本组PE假设）' if ratio is not None else ('不成立：参考价≥基准价' if p >= base else '不可计算：参考价≤悲观价，须重检压力情景')
        model = {'horizon': '2027-12-31', 'profitYi': profits, 'pe': multiples, 'approxSharesYi': shares, 'shareBasis': '腾讯总股本字段，未认证完全摊薄；跨市场权益按A股价作等价计算',
                 'price': values, 'ratio': ratio, 'threshold': threshold, 'certified': False}
        assumptions = [f'2027 正常化归母利润 {profits[i]:g} 亿元（研究假设）÷参考股数 {shares:.4f} 亿股×{multiples[i]:g}倍PE；不是公司指引' for i in range(3)]
        triggers = [f'压力假设：{t["bear"]}', f'基准验证：{t["watch"]}；下一份财报须显示扣非和回款改善', f'乐观验证：{t["watch"]}与利润率、自由现金流同步改善']
        scenarios = [dict(name=label, prob='[MISSING]（未赋概率）', assumption=assumptions[i], multiple=f'{multiples[i]:g}× PE（研究假设，未校准历史分位）', price=f'{values[i]:.2f} 元（估值初稿）', change=percent(values[i] / p - 1), trigger=triggers[i]) for i, label in enumerate(['悲观', '基准', '乐观'])]
        ratio_note = f'{ratio_text}；P={p:.2f}，Bear={bear:.4f}，Base={base:.4f}；用未四舍五入值计算。股本及现金流未闭合，本轮不认证可交易赔率。'
        zone = f'条件研究门槛 P≤{threshold:.2f} 元，来自(Base+2×Bear)/3；只有模型及股本验证后才有意义，不是已认证买入区。悲观价不保证最大损失。'
        valuation_text = '\n\n'.join(['本期披露扣非用于事实比较；2027利润另按公司产品、周期和投资收益桥接设研究假设，列盈利受压、正常兑现及较强兑现的利润总额；没有用营收增速计算EPS。利润假设不是一致预期，合理PE没有历史倍数校准。', '\n'.join(['| 情景 | 2027正常化归母利润（假设） | PE（假设） | 隐含价 | 相对报价 |', '| --- | ---: | ---: | ---: | ---: |'] + [f'| {s["name"]} | {profits[i]:g}亿元 | {multiples[i]:g}× | {values[i]:.2f}元 | {s["change"]} |' for i, s in enumerate(scenarios)]), ratio_note, zone])
    else:
        scenarios = [dict(name=label, prob='[MISSING]（未赋概率）', assumption=condition, multiple='不适用持续盈利PE；PS/NAV输入待核', price='[MISSING]（未建立可核验价值）', change='[MISSING]', trigger=trigger) for label, condition, trigger in [
            ('悲观', f'亏损或现金占用延续：{t["bear"]}；核现金跑道、到期债务和可回收资产', '下一份财报扣非亏损扩大，或现金及融资覆盖不足'),
            ('基准', f'先证明{t["watch"]}改善，再用分部营收×正常利润率及现金流重建', '至少连续两个季度扣非为正，并披露现金及资本开支桥接'),
            ('乐观', f'{t["bull"]}兑现；仍需核产品利润率、研发和摊薄成本', '新增业务贡献可核实收入、正毛利及净现金，而非仅定点或研发进度')]]
        ratio_note = '[MISSING]：持续盈利、股本及下行资产回收尚未闭合；不沿用旧PE情景和旧赔率。'
        zone = '等待证据；亏损企业的估值需现金流/NAV或分部PS交叉核实，未给出可认证买入区。'
        valuation_text = '\n\n'.join([f'本期扣非亏损为{yi(f["core"])}，不套持续盈利PE。三情景列经营状态及触发条件，不用不可靠估计填价格。', *[f'**{s["name"]}**：{s["assumption"]}；价格 {s["price"]}；{s["trigger"]}。' for s in scenarios], ratio_note])
    rating = '回避' if f['core'] < 0 and f['ocf'] < 0 else '观察'
    qualifier = '盈利与现金尚未验证' if f['core'] < 0 else ('优先核实现金回报' if f['ocf'] < 0 else '经营跟踪；价格与现金回报仍待验证')
    headline = f'{rating}：{qualifier}。{t["bull"]}；{t["bear"]}。'
    risk = [f'下一份财报验证：{t["watch"]}；若主营扣非同比转负或亏损扩大，下修正常化盈利假设。',
            '未来两个季度验证：若累计经营现金净额≤0或回款持续弱于利润，撤回高现金转化假设；经营现金不能替代FCF。',
            '下一份财报及融资公告验证：新增发行、转增、可转债或股份支付改变摊薄股数时，重算所有每股值；股本未核前不使用模型价位。',
            f'最大反证：{t["bull"]}若同时转化为持续扣非与可分配现金，当前审慎判断可能偏保守。']
    views = [f'单模型多视角复核·产业（2026–2027，偏多条件）：{t["bull"]}；失效：对应产品收入或单位盈利在下一份财报不兑现。',
             f'单模型多视角复核·财报（未来两季，{"偏空" if f["core"] < 0 or f["ocf"] < 0 else "观望"}）：扣非利润率{core_margin:.2%}，OCF/归母{cash_quality}；反证：扣非和现金连续改善。',
             f'单模型多视角复核·估值（至2027年底，观望）：{reverse}；失效：现金流要求不能被可验证的经营与资本开支假设支撑。',
             '共识：产品/技术优势必须经过扣非盈利、现金回报和价格检验。分歧：产业成长能否补偿利润率、周期与资本占用；本轮没有独立专家参与，不用多数票确定评级。']
    missing = '52周行情、同口径TTM盈利桥接、远期共识PE、PEG、ROIC、经营利润率、完整FCFE、净债务、完全摊薄股数、未列明的详细分部占比及未逐份读取的研究日后续公告 [MISSING]。'
    pitfalls = [f'财务来源（主要会计数据已核原件，{f["sourceStatus"]}）：{f["pdf"]}', f'资本开支来源（合并现金流量表，第{f["cashCapexPage"]}页）：{f["fullPdf"]}', fcf_note + (' 单位及符号核对：' + f['cashUnitEvidence'] if f.get('cashUnitEvidence') else ''), f'行情来源（第三方，含自己的PE/PB算法）：{q["url"]}',
                '复核范围：2026H1累计合并财报；不是Q2单季，不称未经桥接的TTM。披露至研究日未超过90天，报告期结束已超过90天 [STALE]；不得据此推断Q3经营。',
                '估值初稿：参考股数来自腾讯总股本字段；参考股权值=A股价×全股本，不是A/H/B各市场市值合计，且存在稀释口径风险；并非核实后的最新摊薄股数。未认证情景价、赔率与买入区；半年OCF受季节性和营运资金影响，不能单凭为负断言全年资不抵债。',
                missing, '反向DCF是市值对应的现金要求，不是预测FCF；使用股权资本成本Ke而非企业WACC，不再次扣净债务；五年现金增长率及永续增速均为研究假设。',
                f'旧结论处理：{t["revision"]}；完整旧页仅作历史存档见 public/research/cn-four-sectors-2026-10-07/previous.json。', DISCLAIMER]
    duration = '研究期限至2027-12-31；增长持续性取决于公司专属产品收入、单位利润和现金回报，不把本期同比增速外推至2027年底。'
    ai = 'AI为本分类研究变量，但各公司财务传导不同：芯片研发及采购、光互联量价与客户资本开支、整机低毛利与营运资金、软件付费与服务成本；独立AI利润贡献未完整拆分，不另加概念溢价。' if sector == 'AI 算力' else 'AI为非核心估值变量；自动驾驶、机器人或半导体概念不作为独立估值加分，需量化订单、收入、利润及资本开支。'
    segments = [{'name': s, 'share': '[MISSING]', 'note': '产品研究分组，非经核实的会计分部；收入/利润占比本轮未核，不强行相加'} for s in t['segments']]
    if extra['segments']:
        segments = extra['segments'] + [x for x in segments if x['name'] not in {v['name'] for v in extra['segments']} and len(extra['segments'])<3][:max(0,3-len(extra['segments']))]
    patch = dict(name=name, batch=f'{DATE}·{sector}第{batch}批', rating=rating, headline=headline,
                 asOf=f'{DATE}研究；财务2026H1累计合并中国会计准则，主要会计数据原件已核；行情{quote_note}；估值为未认证研究假设。',
                 profile=f'{name}（{code}）的研究主体为{t["group"]}，主要产品研究分组包括{"、".join(t["segments"])}。盈利依赖产品销售、单位利润及研发与资本投入的回报。{evidence}最近核检事项：{event_brief} 不将研发/定点当已完成商业化。',
                 certainty=('低：扣非亏损或简式FCF为负，盈利可见度/现金回报未闭合' if f['core'] < 0 or f['fcfProxy'] < 0 else '中：当期盈利与简式FCF有财报支持；持续性、完整股东现金与估值容错仍待核'),
                 duration=duration, ratioNote=ratio_note,
                 metrics=[['研究复核', f'{DATE}；原件主要会计数据已核，估值初稿未认证'], ['价格锚点', quote_note],
                          ['2026H1收入 / 同比', f'{yi(f["revenue"])} / {t["ry"] + "%" if t["ry"] != "-" else "6.57%"}'],
                          ['2026H1归母 / 扣非', f'{yi(f["net"])} / {yi(f["core"])}'], ['2026H1扣非同比', t['cy'] + ('%' if re.fullmatch(r'-?\d+(\.\d+)?', t['cy']) else '')],
                          ['现金与盈利质量', f'H1经营现金净额{yi(f["ocf"])}；OCF/归母{cash_quality}；扣非/收入{core_margin:.2%}'],
                          ['现金资本开支与简式FCF', fcf_note],
                          ['2026H1基本 / 稀释EPS', f'{f["eps"]} / {f["dilutedEps"]} 元（累计，非TTM；未据此外推2027）'],
                          ['2026H1毛利率 / 加权ROE', f'{f["grossMargin"]:.2f}% / {f["weightedRoe"]}%（半年累计，不年化；毛利率=1−成本/收入）'],
                          ['非经常损益净桥接', f'归母−扣非={yi(f["net"]-f["core"])}；这是披露净差额，不等于所有投资收益均被排除'],
                          ['2026-06-30归母权益', yi(f['equity'])],
                          ['行情商PE / PB（未独立核验）', f'{q["providerPe"]:.2f}× / {q["providerPb"]:.2f}×；PE≤0不具盈利型估值意义，非正常化或远期PE'],
                          ['第二方法·反向股权DCF', reverse], ['估值认证', '未认证：完全摊薄股本与完整股权现金流桥接未闭合；三情景不等于最大损失保证']],
                 thesis=[t['bull'], t['bear'], business_text or '详细经营分部利润仍待核', fcf_note, reverse, *views], growth=[f'事实：H1营收同比{t["ry"] if t["ry"] != "-" else "6.57"}%；扣非同比{t["cy"] + "%" if re.fullmatch(r"-?\d+(\.\d+)?", t["cy"]) else t["cy"]}。增长来源需按量、价、结构、费用、并购/周期拆分。', f'判断：{t["bull"]}', f'验证：{t["watch"]}；{duration}'],
                 moat=[f'待验证的护城河：{t["bull"]}；需具体份额、客户认证/复购或单位成本证据，行业龙头标签本身不构成证明。'],
                 pros=[f'已核事实：{evidence}', f'产业研究优势：{t["bull"]}'], cons=[t['bear'], fcf_note, missing],
                 industry=[f'公司特定传导（判断）：{t["bull"]}', f'需求与价格风险（判断）：{t["bear"]}', '技术路线、行业供给与客户采购变化须通过产品量价、利润和资本开支验证；政策实施日未核实，不作为确定催化。'],
                 segments=segments, scenarios=scenarios,
                 discipline=dict(zone=zone, add=f'研究升级条件：{t["watch"]}改善，未来两个季度扣非与现金趋势一致，并完成股本及FCF桥接。', trim='研究降级条件：盈利假设下修、回款恶化，或价位只被乐观情景支持；不提供固定卖出比例。', invalid=risk[0], position='本轮不提供个人仓位指令；估值初稿只用于比较假设与等待证据。'),
                 bullBear=dict(bull=t['bull'], bear=f'针对上述多头：{t["bear"]}；产品机会成立也未证明可分配现金及股东回报。', verdict=f'{rating}；以扣非、现金和价格闭合为裁决，保留产业乐观与现金/估值审慎的分歧。单模型多视角复核。'),
                 risk=risk, next=[f'下一份季度披露核对：{t["watch"]}；确切公告日期待公告核实。', zone],
                 calendar=[f'下一份季度报告（确切日期待公告）：{t["watch"]}。', '未来两个季度：验证扣非与现金，任一季度新增融资/转增/股权激励触发股本重算。', '2027-12-31研究终点：比较正常化利润及可分配现金与本轮假设；不保证实现。'],
                 pitfalls=pitfalls, aiNote=ai, auto=False, reviewed=True)
    patches[code] = patch
    audit = dict(code=code, name=name, sector=sector, batch=batch, rating=rating, tier=t['tier'], filing=f,
                 quote=q, model=model, notes=extra, reverseDcf=dict(ke=ke, fiveYearGrowth=t['g'], terminalGrowth=.02,
                 requiredFirstYearFcfeYi=required_cash, terminalValueShare=tvshare,
                 sensitivityKe=[ke-.02,ke,ke+.02], sensitivityTerminal=[.01,.02,.03], sensitivityRequiredFcfeYi=sensitivity,
                 certified=False), revised=t['revision'], watch=t['watch'])
    audits.append(audit)
    sensitivity_md = '\n'.join(['| Ke / 永续增长 | 1% | 2% | 3% |', '| --- | ---: | ---: | ---: |'] + [f'| {k:.0%} | ' + ' | '.join(f'{v:.2f}亿元' for v in sensitivity[i]) + ' |' for i, k in enumerate([ke-.02,ke,ke+.02])])
    questions = [f'待验证的定价分歧：{t["bull"]}。关键反证：{t["bear"]}。尚无已证实的变异认知，保留监控项。',
                 f'价格反映什么：全股本按A股价计算的参考股权值{cap:.2f}亿元，对应可分配现金要求见反向DCF；不声称已掌握市场一致预期。',
                 f'如何证明：{t["watch"]}在未来两季财报有收入、扣非和现金支持。',
                 f'如何推翻：{risk[0]}', '为何现在：更新中报并纠正旧口径；没有把未核实政策或研发进度当确定催化。',
                 '何时改变评级/估值：主营、现金或摊薄股数改变时重估；两种估值输入闭合后再认证研究区间。', f'还缺什么：{missing}']
    text = f'# {name}（{code}）｜{sector}第{batch}批\n\n'
    modules = [
        ('0｜信息与证据', f'研究日{DATE}；沪深A股，人民币；价格{quote_note}；本轮已核财报2026H1。来源状态：{f['sourceStatus']}。披露日期{f['disclosureDate']}。\n\n{source}；{cash_source}；[腾讯报价]({q["url"]})。主要指标原件SHA-256：`{f["sha256"]}`；全文原件SHA-256：`{f["fullSha256"]}`。'),
        ('1｜公司简介', patch['profile']),
        ('2｜业务分布', '\n'.join(['| 产品研究分组 | 收入占比 | 口径 |', '| --- | --- | --- |'] + [f'| {s["name"]} | {s["share"]} | {s["note"]} |' for s in segments]) + '\n\n本表仅收入占比，产品利润贡献仍未完整拆分[MISSING]；披露产品分类可能少于三个，不伪造额外会计分部，地区与产品口径不相加。'),
        ('3｜优势与缺点', f'**优势**：{t["bull"]}。\n\n**限制**：{t["bear"]}。\n\n已核财务依据：{evidence}扣非利润率{core_margin:.2%}，OCF/归母{cash_quality}。其他份额、订单现金转化和成本比较待核。\n\n{business_text}'),
        ('4｜行业趋势', '\n\n'.join(patch['industry'])),
        ('5｜结论卡与PM七问', f'**评级：{rating}。** {headline}\n\n确定性：{patch["certainty"]}。\n\n{ratio_note}\n\n{duration}\n\n' + '\n'.join(f'- {x}' for x in questions)),
        ('6｜关键指标', '\n'.join(['| 指标 | 数值与口径 |', '| --- | --- |'] + [f'| {k} | {v} |' for k, v in patch['metrics']]) + f'\n\n所有收入、归母、扣非、OCF与权益数值来源：{source}。资本开支：{cash_source}。利润率、现金/归母与简式FCF为本轮算术，未把OCF当FCF。'),
        ('7｜增长与护城河', '\n\n'.join(patch['growth'] + patch['moat'] + [ai])),
        ('8｜三情景与第二方法', valuation_text + f'\n\n**独立现金要求检验（反向股权DCF，未认证）**：{reverse}\n\n计算：参考市值=Σ FCFE₁×(1+g)^(t−1)/(1+Ke)^t，t=1…5，加第五年末终值；终值=FCFE₅×(1+永续增长)/(Ke−永续增长)。这是当前报价下所需现金，不输出另一份未经桥接的正向DCF价值。\n\n终值占比{tvshare:.1%}' + ('，超过75%，反向要求值高度依赖终值假设。' if tvshare > .75 else '，仍对远期现金假设敏感。') + '\n\n敏感性（所需首年FCFE，不是股价）：\n\n' + sensitivity_md + '\n\n首年实际可分配股权现金[MISSING]；已核现金购建支出；维持与增长资本开支拆分、营运资本常态化及净借款桥接仍缺失，不用H1 OCF×2证明现金要求已满足。PE情景为2027年底终点价值，DCF为当前时点现金要求，两者期限不同，不平均成目标价；未赋情景概率，不计算胜率或期望收益。'),
        ('9｜条件化研究纪律', '\n\n'.join(patch['discipline'].values())),
        ('10｜风险与证伪', '\n'.join(f'- {x}' for x in risk)),
        ('11｜多空交锋与复核', '\n\n'.join(views) + f'\n\n**多头**：{t["bull"]}\n\n**逐条回应的空头**：{patch["bullBear"]["bear"]}\n\n**裁决**：{patch["bullBear"]["verdict"]}'),
        ('12｜口径、陷阱与旧结论处理', event_text + '\n\n' + '\n\n'.join(pitfalls[:-1]) + '\n\n保留：核实主体及产品研究方向。调整：财务数字和盈利质量，以本轮原件覆盖。撤回：旧未认证赔率、固定仓位和机械买入区；原件未取得的项目不被解释为经营恶化。'),
        ('13｜后续验证日历', '\n'.join(f'- {x}' for x in patch['calendar'])),
        ('14｜免责声明', DISCLAIMER)]
    text += '\n\n'.join(f'## {title}\n\n{body}' for title, body in modules) + '\n'
    (OUT / f'{code}.md').write_text(text)

(ROOT / 'src/data/details/cnFourSectorResearch.ts').write_text("// 2026-10-07 company-level filing review. Generated by scripts/review-cn-four-sectors-2026-10-07.py.\n// Valuations are provisional research hypotheses, not certified trading ranges.\nimport type { Company } from '../companies'\n\nexport const cnFourSectorResearch: Record<string, Partial<Company>> = " + json.dumps(patches, ensure_ascii=False, indent=2) + '\n')
(OUT / 'audit.json').write_text(json.dumps(audits, ensure_ascii=False, indent=2))
(OUT / 'previous.json').write_text(json.dumps({'status':'历史存档；不作为当前研究结论或交易依据', 'archivedAt':DATE, 'companies':old}, ensure_ascii=False, indent=2))
with (OUT / 'summary.csv').open('w') as handle:
    writer = csv.writer(handle)
    writer.writerow(['分类','批次','代码','公司','评级','研究优先级（非投资排名）','H1营收亿元','H1归母亿元','H1扣非亿元','H1OCF亿元','H1购建长期资产现金亿元','H1简式FCF亿元（非完整FCFE）','报价日期','参考价','PE初稿Bear','PE初稿Base','PE初稿Bull','初稿赔率','认证','原件'])
    for a in audits:
        f,q,m=a['filing'],a['quote'],a['model']
        writer.writerow([a['sector'],a['batch'],a['code'],a['name'],a['rating'],a['tier'], *[round(f[k]/1e8,4) for k in ['revenue','net','core','ocf','cashCapex','fcfProxy']], q['timestamp'],q['price'], *([round(v,4) for v in m['price']] if m else ['[MISSING]']*3), m['ratio'] if m else '[MISSING]',False,f['pdf']])
summary = ['# 沪深｜机器人链 → 工程机械 → 新能源汽车 → AI 算力｜2026-10-07研究复核',
           '46家公司：机器人链3家、工程机械1家、新能源汽车23家、AI 算力19家；按此顺序分11组。常规每组3–5家；工程机械分类仅1家公司，单独作专题，不跨分类凑数。完整报告均在本目录；旧研究隔离存档。',
           '**边界**：本轮为公司级事实复核及估值初稿，不能称46份已认证深度定价。41家有公司特定PE情景；5家扣非亏损不强套PE。全部做反向股权DCF现金要求检验，净债务、完全摊薄股本及完整FCFE仍待闭合，不认证交易赔率。',
           '**证据**：46份2026H1半年报PDF、46组现金流量表与20份中报后公告已读取。45份半年报来自巨潮托管；文灿原件来自公告转载平台，托管差异明确标注。毛利率及简式FCF为原件数据算术；EPS/ROE为半年披露口径，不年化。价格重新取自腾讯，返回2026-09-30盘后最后报价，未获交易所收盘确认。',
           '**估值口径**：PE利润与倍数是2027年底研究假设，不能把营业收入增速拿来外推EPS。反向DCF用A股价×行情全股本作参考股权值（不是A/H/B交易市值合计），Ke按研究风险假设12%–18%、五年增长0%–12%、永续2%，并列敏感性。股价情景未加入未来分红，不声称总收益；不与DCF当前时点要求值平均。',
           '**研究优先次序（判断，不是买入排名）**：机器人先核三花执行器收入与主业，双环看齿轮毛利，恒立看收入增而扣非降的原因；徐工先核出海回款与利润。新能源汽车先比较宁德的现金、科达利结构件利润、新宙邦分业务质量，再看比亚迪海外与境内压力。AI先把中际/新易盛/天孚的产品增长与现金区分，再比较沪电PCB、澜起互连及工业富联整机的估值容错。',
           '**关键调整**：撤回特斯拉机器人第1–3名及旧核心配置标签；撤回未经同口径EPS校准的PEG<0.55及0.63–0.83。徐工、恒立、拓普、英维克不是收入增长就利润增长。国轩公允价值收益、金山基金投资收益需要独立桥接，扣非不自动等于主营盈利。',
           '**股本与治理**：生益9月增发已登记；澜起本次激励来自回购库存股、总股本未变；海光注销与浪潮/长安融资预案不能当完成实施。中际公告股本与行情字段存在差额，等待后续H股变化核检。杉杉最新已读关联交易公告显示控股股东为皖维集团，更新旧治理主体。',
           '**共同变量与前批衔接**：承接上批自动驾驶/新材料，继续用H1累计原件与9月30日报价。机器人量产利润、工程机械出口回款、汽车单车/电池单位利润、AI硬件量价与软件付费各自验证；资本开支、营运资金和摊薄是共同门槛。']
for sector,n,codes in batch_groups:
    table = ['| 公司 | H1收入 | H1扣非 | H1OCF | 评级 | 研究优先级 | 最大待证据 |', '| --- | ---: | ---: | ---: | --- | --- | --- |']
    for code in codes:
        a=next(a for a in audits if a['code']==code);f=a['filing']
        table.append(f'| [{a["name"]}（{code}）]({code}.md) | {yi(f["revenue"])} | {yi(f["core"])} | {yi(f["ocf"])} | {a["rating"]} | {a["tier"]} | {a["watch"]} |')
    rank = sorted(codes, key=lambda c: (theses[c]['tier'], codes.index(c)))
    comparison = '本批补证次序：'+' → '.join(patches[c]['name'] for c in rank)+'。先看扣非及现金可见度，再补分部、股本及估值；字母A/B/C为研究工作优先级，不是投资评分。'
    common = {'机器人链':'本批共同变量：执行器/传动收入、量产毛利、主业现金；汽车或液压主业不能全算机器人收入。', '工程机械':'本专题变量：出口量价、应收回款、土方及高空作业分产品盈利、扩产回报；样本仅1家，不作行业公司排名。', '新能源汽车':'本批共同变量：车型交付或电池产品量价、单位利润、客户集中、资本开支与回款；原料涨价不自动增加加工利润。', 'AI 算力':'本批共同变量：实际AI产品收入、技术路线、客户采购、研发及资本开支、营运资金；软件付费与硬件景气分别定价。'}[sector]
    body = '\n\n'.join(['\n'.join(table), comparison, common, '数据陷阱：全部财务采用同一H1累计口径；不能把现金高于净利称FCF，也不能把低基数同比当未来盈利增长率。', '与前批衔接：沿用同一报价快照与H1原件标准，不混入上轮排名或程序EPS。下一步：先核本批各公司表中专属变量、FCF及实施后股本，再与下一批在相同口径比较。', DISCLAIMER])
    (OUT / f'{SLUGS[sector]}-batch-{n}.md').write_text(f'# {sector}第{n}批｜{DATE}\n\n'+body+'\n')
    summary.extend([f'## {sector}第{n}批',body])
summary.append(DISCLAIMER)
(OUT / 'index.md').write_text('\n\n'.join(summary)+'\n')
print(f'Wrote {len(patches)} company patches/reports, {len(batch_groups)} batch reports, audit and archive.')
