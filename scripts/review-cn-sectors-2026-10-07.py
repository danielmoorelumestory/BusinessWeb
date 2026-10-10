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
INPUT = ROOT / '.local/cn-sector-research-2026-10-07'
OUT = ROOT / 'public/research/cn-sectors-2026-10-07'
DATE = '2026-10-07'
DISCLAIMER = '本报告仅供研究参考，不构成个人投资建议。'
published_input = json.loads((OUT / 'input.json').read_text()) if (OUT / 'input.json').exists() else None
facts = {r['code']: r for r in (json.loads((INPUT / 'facts.json').read_text()) if (INPUT / 'facts.json').exists() else published_input['filings'])}
old = json.loads((INPUT / 'previous.json').read_text()) if (INPUT / 'previous.json').exists() else json.loads((OUT / 'previous.json').read_text())['companies']
old_by_code = {r['code']: r for r in old}
order = [r['code'] for sector in ['自动驾驶', '新材料'] for r in old if r['sector'] == sector]
quotes = published_input['quotes'] if published_input else {}
if (INPUT / 'quotes.txt').exists():
    for line in (INPUT / 'quotes.txt').read_bytes().decode('gb18030').splitlines():
        a = line.split('~')
        quotes[a[2]] = {'name': a[1].strip(), 'price': float(a[3]), 'timestamp': a[30],
                        'providerPe': float(a[39]), 'providerPb': float(a[46]),
                        'capYi': float(a[45]), 'url': 'https://qt.gtimg.cn/q=' + ('sh' if a[2][0] == '6' else 'sz') + a[2]}
theses = {}
thesis_path = INPUT / 'theses.tsv' if (INPUT / 'theses.tsv').exists() else OUT / 'theses.tsv'
for line in thesis_path.read_text().splitlines():
    c, group, ry, cy, earnings, multiples, g, tier, segments, bull, bear, watch, revision = line.split('|')
    theses[c] = dict(group=group, ry=ry, cy=cy, earnings=earnings, multiples=multiples,
                     g=float(g) / 100, tier=tier, segments=segments.split('、'),
                     bull=bull, bear=bear, watch=watch, revision=revision)
assert set(order) == set(facts) == set(quotes) == set(theses) and len(order) == 40
assert all(q['timestamp'].startswith('20260930') for q in quotes.values())
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'theses.tsv').write_text(thesis_path.read_text())
(OUT / 'input.json').write_text(json.dumps({'filings': list(facts.values()), 'quotes': quotes}, ensure_ascii=False, indent=2))

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
for sector in ['自动驾驶', '新材料']:
    codes = [c for c in order if old_by_code[c]['sector'] == sector]
    sizes = [5, 4, 4, 4, 4] if sector == '自动驾驶' else [5, 5, 5, 4]
    offset = 0
    for n, size in enumerate(sizes, 1):
        group = codes[offset:offset + size]; offset += size
        batch_groups.append((sector, n, group))
assert sum(len(g[2]) for g in batch_groups) == 40

for code in order:
    f, q, t, previous = facts[code], quotes[code], theses[code], old_by_code[code]
    sector, p, cap = previous['sector'], q['price'], q['capYi']
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
    shares = cap / p  # public total capitalization / A share price, not verified diluted shares
    dcf_factor, tvshare = factor(.12, t['g'], .02)
    required_cash = cap / dcf_factor
    sensitivity = [[round(cap / factor(ke, t['g'], terminal)[0], 4) for terminal in [.01, .02, .03]] for ke in [.10, .12, .14]]
    reverse = f'反向股权DCF：若维持参考市值 {cap:.2f} 亿元，首年可分配股权现金需约 {required_cash:.2f} 亿元；假设 Ke 12%、前五年现金增长 {t["g"]:.0%}、永续增长 2%。这是要求值，不是公司实际FCF。'
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
        model = {'horizon': '2027-12-31', 'profitYi': profits, 'pe': multiples, 'approxSharesYi': shares,
                 'price': values, 'ratio': ratio, 'threshold': threshold, 'certified': False}
        assumptions = [f'2027 正常化归母利润 {profits[i]:g} 亿元（研究假设）÷参考股数 {shares:.4f} 亿股×{multiples[i]:g}倍PE；不是公司指引' for i in range(3)]
        triggers = [f'压力假设：{t["bear"]}', f'基准验证：{t["watch"]}；下一份财报须显示扣非和回款改善', f'乐观验证：{t["watch"]}与利润率、自由现金流同步改善']
        scenarios = [dict(name=label, prob='[MISSING]（未赋概率）', assumption=assumptions[i], multiple=f'{multiples[i]:g}× PE（研究假设，未校准历史分位）', price=f'{values[i]:.2f} 元（估值初稿）', change=percent(values[i] / p - 1), trigger=triggers[i]) for i, label in enumerate(['悲观', '基准', '乐观'])]
        ratio_note = f'{ratio_text}；P={p:.2f}，Bear={bear:.4f}，Base={base:.4f}；用未四舍五入值计算。股本及现金流未闭合，本轮不认证可交易赔率。'
        zone = f'条件研究门槛 P≤{threshold:.2f} 元，来自(Base+2×Bear)/3；只有模型及股本验证后才有意义，不是已认证买入区。悲观价不保证最大损失。'
        valuation_text = '\n\n'.join(['以公司本期扣非盈利体量为起点，分别设定2027盈利修复、正常兑现及较强兑现的利润总额；没有用营收增速计算EPS。利润假设不是一致预期，合理PE没有历史倍数校准。', '\n'.join(['| 情景 | 2027正常化归母利润（假设） | PE（假设） | 隐含价 | 相对报价 |', '| --- | ---: | ---: | ---: | ---: |'] + [f'| {s["name"]} | {profits[i]:g}亿元 | {multiples[i]:g}× | {values[i]:.2f}元 | {s["change"]} |' for i, s in enumerate(scenarios)]), ratio_note, zone])
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
    missing = '52周行情、同口径TTM盈利桥接、远期共识PE、PEG、ROIC、经营利润率、完整FCFE、净债务、实施后最新摊薄股数、详细分部占比及研究日后续公告全量核检 [MISSING]。'
    pitfalls = [f'财务来源（主要会计数据已核原件）：{f["pdf"]}', f'资本开支来源（合并现金流量表，第{f["cashCapexPage"]}页）：{f["fullPdf"]}', fcf_note, f'行情来源（第三方，含自己的PE/PB算法）：{q["url"]}',
                '复核范围：2026H1累计合并财报；不是Q2单季，不称未经桥接的TTM。披露至研究日未超过90天，报告期结束已超过90天 [STALE]；不得据此推断Q3经营。',
                '估值初稿：参考股数=腾讯总市值/A股报价，存在A/H跨市场及稀释口径风险；并非核实后的最新摊薄股数。未认证情景价、赔率与买入区。',
                missing, '反向DCF是市值对应的现金要求，不是预测FCF；使用股权资本成本Ke而非企业WACC，不再次扣净债务；五年现金增长率及永续增速均为研究假设。',
                f'旧结论处理：{t["revision"]}；完整旧页仅作历史存档见 public/research/cn-sectors-2026-10-07/previous.json。', DISCLAIMER]
    duration = '研究期限至2027-12-31；增长持续性取决于公司专属产品收入、单位利润和现金回报，不把本期同比增速外推至2027年底。'
    ai = 'AI需求为管理层披露的收入驱动之一；收入增长已核，但AI独立利润贡献[MISSING]，不另加AI估值溢价。' if code in ['300620', '688048'] else 'AI为非核心估值变量；自动驾驶、机器人或半导体概念不作为独立估值加分，需量化订单、收入、利润及资本开支。'
    segments = [{'name': s, 'share': '[MISSING]', 'note': '产品研究分组，非经核实的会计分部；收入/利润占比本轮未核，不强行相加'} for s in t['segments']]
    if code == '002036':
        segments = [{'name': '车载光学', 'share': '41.12%', 'note': '2026H1收入占比，半年报营业收入构成'}, {'name': '非车载光学', 'share': '15.53%', 'note': '同口径收入占比'}, {'name': '应用终端', 'share': '40.62%', 'note': '同口径收入占比；其余触控显示2.74%，四舍五入合计有尾差'}]
    patch = dict(name=name, batch=f'{DATE}·{sector}第{batch}批', rating=rating, headline=headline,
                 asOf=f'{DATE}研究；财务2026H1累计合并中国会计准则，主要会计数据原件已核；行情{quote_note}；估值为未认证研究假设。',
                 profile=f'{name}（{code}）的研究主体为{t["group"]}，主要产品研究分组包括{"、".join(t["segments"])}。盈利依赖产品销售、单位利润及研发与资本投入的回报。{evidence}最近重大事件与研究日全部后续公告核检 [MISSING]，不将研发/定点当已完成商业化。',
                 certainty=('低：扣非亏损或简式FCF为负，盈利可见度/现金回报未闭合' if f['core'] < 0 or f['fcfProxy'] < 0 else '中：当期盈利与简式FCF有财报支持；持续性、完整股东现金与估值容错仍待核'),
                 duration=duration, ratioNote=ratio_note,
                 metrics=[['研究复核', f'{DATE}；原件主要会计数据已核，估值初稿未认证'], ['价格锚点', quote_note],
                          ['2026H1收入 / 同比', f'{yi(f["revenue"])} / {t["ry"] + "%" if t["ry"] != "-" else "6.57%"}'],
                          ['2026H1归母 / 扣非', f'{yi(f["net"])} / {yi(f["core"])}'], ['2026H1扣非同比', t['cy'] + ('%' if re.fullmatch(r'-?\d+(\.\d+)?', t['cy']) else '')],
                          ['现金与盈利质量', f'H1经营现金净额{yi(f["ocf"])}；OCF/归母{cash_quality}；扣非/收入{core_margin:.2%}'],
                          ['现金资本开支与简式FCF', fcf_note],
                          ['2026-06-30归母权益', yi(f['equity'])],
                          ['行情商PE / PB（未独立核验）', f'{q["providerPe"]:.2f}× / {q["providerPb"]:.2f}×；PE≤0不具盈利型估值意义，非正常化或远期PE'],
                          ['第二方法·反向股权DCF', reverse], ['估值认证', '未认证：最新摊薄股本与完整股权现金流桥接未闭合；三情景不等于最大损失保证']],
                 thesis=[t['bull'], t['bear'], fcf_note, reverse, *views], growth=[f'事实：H1营收同比{t["ry"] if t["ry"] != "-" else "6.57"}%；扣非同比{t["cy"] + "%" if re.fullmatch(r"-?\d+(\.\d+)?", t["cy"]) else t["cy"]}。增长来源需按量、价、结构、费用、并购/周期拆分。', f'判断：{t["bull"]}', f'验证：{t["watch"]}；{duration}'],
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
                 quote=q, model=model, reverseDcf=dict(ke=.12, fiveYearGrowth=t['g'], terminalGrowth=.02,
                 requiredFirstYearFcfeYi=required_cash, terminalValueShare=tvshare,
                 sensitivityKe=[.10,.12,.14], sensitivityTerminal=[.01,.02,.03], sensitivityRequiredFcfeYi=sensitivity,
                 certified=False), revised=t['revision'], watch=t['watch'])
    audits.append(audit)
    sensitivity_md = '\n'.join(['| Ke / 永续增长 | 1% | 2% | 3% |', '| --- | ---: | ---: | ---: |'] + [f'| {ke:.0%} | ' + ' | '.join(f'{v:.2f}亿元' for v in sensitivity[i]) + ' |' for i, ke in enumerate([.10,.12,.14])])
    questions = [f'待验证的定价分歧：{t["bull"]}。关键反证：{t["bear"]}。尚无已证实的变异认知，保留监控项。',
                 f'价格反映什么：参考总市值{cap:.2f}亿元，对应可分配现金要求见反向DCF；不声称已掌握市场一致预期。',
                 f'如何证明：{t["watch"]}在未来两季财报有收入、扣非和现金支持。',
                 f'如何推翻：{risk[0]}', '为何现在：更新中报并纠正旧口径；没有把未核实政策或研发进度当确定催化。',
                 '何时改变评级/估值：主营、现金或摊薄股数改变时重估；两种估值输入闭合后再认证研究区间。', f'还缺什么：{missing}']
    text = f'# {name}（{code}）｜{sector}第{batch}批\n\n'
    modules = [
        ('0｜信息与证据', f'研究日{DATE}；沪深A股，人民币；价格{quote_note}；本轮已核财报2026H1。\n\n{source}；{cash_source}；[腾讯报价]({q["url"]})。主要指标原件SHA-256：`{f["sha256"]}`；全文原件SHA-256：`{f["fullSha256"]}`。'),
        ('1｜公司简介', patch['profile']),
        ('2｜业务分布', '\n'.join(['| 产品研究分组 | 收入占比 | 口径 |', '| --- | --- | --- |'] + [f'| {s["name"]} | {s["share"]} | {s["note"]} |' for s in segments]) + '\n\n利润集中在哪个产品/地区 [MISSING]；不把研究分类伪装为核实会计分部。'),
        ('3｜优势与缺点', f'**优势**：{t["bull"]}。\n\n**限制**：{t["bear"]}。\n\n已核财务依据：{evidence}扣非利润率{core_margin:.2%}，OCF/归母{cash_quality}。其他份额、订单现金转化和成本比较待核。'),
        ('4｜行业趋势', '\n\n'.join(patch['industry'])),
        ('5｜结论卡与PM七问', f'**评级：{rating}。** {headline}\n\n确定性：{patch["certainty"]}。\n\n{ratio_note}\n\n{duration}\n\n' + '\n'.join(f'- {x}' for x in questions)),
        ('6｜关键指标', '\n'.join(['| 指标 | 数值与口径 |', '| --- | --- |'] + [f'| {k} | {v} |' for k, v in patch['metrics']]) + f'\n\n所有收入、归母、扣非、OCF与权益数值来源：{source}。资本开支：{cash_source}。利润率、现金/归母与简式FCF为本轮算术，未把OCF当FCF。'),
        ('7｜增长与护城河', '\n\n'.join(patch['growth'] + patch['moat'] + [ai])),
        ('8｜三情景与第二方法', valuation_text + f'\n\n**独立现金要求检验（反向股权DCF，未认证）**：{reverse}\n\n计算：参考市值=Σ FCFE₁×(1+g)^(t−1)/(1+Ke)^t，t=1…5，加第五年末终值；终值=FCFE₅×(1+永续增长)/(Ke−永续增长)。这是当前报价下所需现金，不输出另一份未经桥接的正向DCF价值。\n\n终值占比{tvshare:.1%}' + ('，超过75%，反向要求值高度依赖终值假设。' if tvshare > .75 else '，仍对远期现金假设敏感。') + '\n\n敏感性（所需首年FCFE，不是股价）：\n\n' + sensitivity_md + '\n\n首年实际可分配股权现金[MISSING]；已核现金购建支出；维持与增长资本开支拆分、营运资本常态化及净借款桥接仍缺失，不用H1 OCF×2证明现金要求已满足。PE情景为2027年底终点价值，DCF为当前时点现金要求，两者期限不同，不平均成目标价；未赋情景概率，不计算胜率或期望收益。'),
        ('9｜条件化研究纪律', '\n\n'.join(patch['discipline'].values())),
        ('10｜风险与证伪', '\n'.join(f'- {x}' for x in risk)),
        ('11｜多空交锋与复核', '\n\n'.join(views) + f'\n\n**多头**：{t["bull"]}\n\n**逐条回应的空头**：{patch["bullBear"]["bear"]}\n\n**裁决**：{patch["bullBear"]["verdict"]}'),
        ('12｜口径、陷阱与旧结论处理', '\n\n'.join(pitfalls[:-1]) + '\n\n保留：核实主体及产品研究方向。调整：财务数字和盈利质量，以本轮原件覆盖。撤回：旧未认证赔率、固定仓位和机械买入区；原件未取得的项目不被解释为经营恶化。'),
        ('13｜后续验证日历', '\n'.join(f'- {x}' for x in patch['calendar'])),
        ('14｜免责声明', DISCLAIMER)]
    text += '\n\n'.join(f'## {title}\n\n{body}' for title, body in modules) + '\n'
    (OUT / f'{code}.md').write_text(text)

(ROOT / 'src/data/details/cnSectorResearch.ts').write_text("// 2026-10-07 company-level filing review. Generated by scripts/review-cn-sectors-2026-10-07.py.\n// Valuations are provisional research hypotheses, not certified trading ranges.\nimport type { Company } from '../companies'\n\nexport const cnSectorResearch: Record<string, Partial<Company>> = " + json.dumps(patches, ensure_ascii=False, indent=2) + '\n')
(OUT / 'audit.json').write_text(json.dumps(audits, ensure_ascii=False, indent=2))
(OUT / 'previous.json').write_text(json.dumps({'status':'历史存档；不作为当前研究结论或交易依据', 'archivedAt':DATE, 'companies':old}, ensure_ascii=False, indent=2))
with (OUT / 'summary.csv').open('w') as handle:
    writer = csv.writer(handle)
    writer.writerow(['分类','批次','代码','公司','评级','研究优先级（非投资排名）','H1营收亿元','H1归母亿元','H1扣非亿元','H1OCF亿元','报价日期','参考价','PE初稿Bear','PE初稿Base','PE初稿Bull','初稿赔率','认证','原件'])
    for a in audits:
        f,q,m=a['filing'],a['quote'],a['model']
        writer.writerow([a['sector'],a['batch'],a['code'],a['name'],a['rating'],a['tier'], *[round(f[k]/1e8,4) for k in ['revenue','net','core','ocf']], q['timestamp'],q['price'], *([round(v,4) for v in m['price']] if m else ['[MISSING]']*3), m['ratio'] if m else '[MISSING]',False,f['pdf']])
summary = ['# 沪深｜自动驾驶 → 新材料｜2026-10-07研究复核', '40家公司，自动驾驶21家后新材料19家；9批，每批3–5家。全部核对2026H1主要会计数据原件。完整个股报告在同目录，旧研究单列存档。',
           '**边界**：这是公司级事实复核及估值初稿，不是40份已认证深度定价。29家有公司特定PE三情景，11家扣非亏损不强套PE；全部进行反向股权DCF现金要求检验。最新摊薄股数、FCF桥接及分部占比等仍缺，不能将初稿赔率认证为可交易赔率。',
           '**统一口径**：财务为2026H1累计合并中国会计准则；不混成Q2单季或TTM。报价为2026-09-30腾讯盘后最后报价，未确认交易所收盘。PE场景终点2027-12-31，利润/倍数为研究假设；反向DCF基于当前市值，不与终点价值直接平均。',
           '**研究优先次序（判断）**：自动驾驶先跟踪亚太与伯特利的制动盈利和现金；新材料先比较安集、恩捷、金力及南大的持续盈利、现金和价格。华阳及璞泰来经营增长值得跟踪，但本期简式FCF为负；华友、巨石按中周期盈利和扩产回报评估。伯特利应先核转增实施与并购。研究优先级不是买入排名，不能认证旧“新材料六家第1–6名”。',
           '**共同变量**：自动驾驶逐层比较量产收入、OEM降价、研发与单车价值；光库/长光的光通信增量单列；新材料拆工艺耗材与资源/产能周期，价格反弹不外推永久增速。现金、摊薄和资本开支是两分类的共同验证门槛。',
           '**数据陷阱**：归母不等于扣非；扣非也不等于FCF。亚太现金/归母较高但现金同比下降；华阳收入增速高于扣非；长光与纳芯归母转正但H1扣非仍亏；方大归母大部分不是扣非。豪威/五矿名称已更新。']
for sector,n,codes in batch_groups:
    table = ['| 公司 | H1收入 | H1扣非 | H1OCF | 评级 | 研究优先级 | 最大待证据 |', '| --- | ---: | ---: | ---: | --- | --- | --- |']
    for code in codes:
        a=next(a for a in audits if a['code']==code);f=a['filing']
        table.append(f'| [{a["name"]}（{code}）]({code}.md) | {yi(f["revenue"])} | {yi(f["core"])} | {yi(f["ocf"])} | {a["rating"]} | {a["tier"]} | {a["watch"]} |')
    rank = sorted(codes, key=lambda c: (theses[c]['tier'], codes.index(c)))
    comparison = '本批补证次序：'+' → '.join(patches[c]['name'] for c in rank)+'。先看扣非及现金可见度，再补分部、股本及估值；字母A/B/C为研究工作优先级，不是投资评分。'
    common = ('本批共同变量：量产产品收入、OEM价格传导、研发费用与现金资本开支。产业标签相同不代表收入来自同一环节。' if sector=='自动驾驶' else '本批共同变量：产品ASP、销量、单位成本与扩产现金；工艺耗材、资源品和制造产能分别定价。')
    body = '\n\n'.join(['\n'.join(table), comparison, common, '数据陷阱：全部财务采用同一H1累计口径；不能把现金高于净利称FCF，也不能把低基数同比当未来盈利增长率。', '与前批衔接：沿用同一报价快照与H1原件标准，不混入上轮排名或程序EPS。下一步：先核本批各公司表中专属变量、FCF及实施后股本，再与下一批在相同口径比较。', DISCLAIMER])
    (OUT / f'{"autonomous" if sector=="自动驾驶" else "materials"}-batch-{n}.md').write_text(f'# {sector}第{n}批｜{DATE}\n\n'+body+'\n')
    summary.extend([f'## {sector}第{n}批',body])
summary.append(DISCLAIMER)
(OUT / 'index.md').write_text('\n\n'.join(summary)+'\n')
print(f'Wrote {len(patches)} company patches/reports, {len(batch_groups)} batch reports, audit and archive.')
