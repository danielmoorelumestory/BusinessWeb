"""Rebuild the dated 66-company evidence review from audited inputs.

Manual research lives in focus.tsv / notes.tsv. Missing valuation inputs never
become a certified price, and live API output is not needed to reproduce it.
"""
import csv, json, re
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/research/adr-2026-10-07'
LOCAL = ROOT / '.local/adr-2026-10-07'
DATE = '2026-10-07'
DISCLAIMER = '本报告仅供研究参考，不构成个人投资建议。'
MISSING = '[MISSING]'
old = json.loads((OUT / 'previous.json').read_text())['companies']
order = [c['code'] for c in old]
def tsv(name):
    return {v[0]: v[1:] for v in (s.split('|') for s in (OUT / name).read_text().splitlines() if s)}
focus, notes = tsv('focus.tsv'), tsv('notes.tsv')
if (LOCAL / 'selected.json').exists():
    selected = json.loads((LOCAL / 'selected.json').read_text())
    quotes = {}
    keys = ['symbol', 'currency', 'regularMarketPrice', 'regularMarketTime', 'marketState',
            'fiftyTwoWeekLow', 'fiftyTwoWeekHigh', 'financialCurrency', 'exchangeDataDelayedBy']
    for f in LOCAL.glob('quotes-*.json'):
        quotes.update({c: {k: v for k, v in q.items() if k in keys}
                       for c, q in json.loads(f.read_text())['results'].items()})
    fx = {c: {k: v for k, v in q.items() if k in keys}
          for c, q in json.loads((LOCAL / 'fx.json').read_text())['results'].items()}
    sources = {c: {k: v for k, v in d.items() if k != 'path'} for c, d in selected.items()}
    for d in sources.values():
        if 'www.sec.gov/' not in d['primaryUrl'] and d['status'] == '监管原件已核验':
            d.update(status='公司IR原件已核读', primaryCheck='公司IR原网址直接读取，文本与已存档内容一致')
    # Keep metadata for original/ADS corroboration, without republishing reports.
    corroboration = {}
    for c in order:
        corroboration[c] = []
        for f in sorted((LOCAL / c).glob('*.json')):
            d = json.loads(f.read_text())
            if d.get('primaryVerified') and d.get('characters', 0) > 1000:
                if 'www.sec.gov/' not in d['primaryUrl'] and d['status'] == '监管原件已核验':
                    d.update(status='公司IR原件已核读', primaryCheck='公司IR原网址直接读取，文本与已存档内容一致')
                corroboration[c].append({k: v for k, v in d.items() if k != 'path'})
    inputs = dict(researchDate=DATE, sources=sources, corroboration=corroboration, quotes=quotes, fx=fx)
    (OUT / 'input.json').write_text(json.dumps(inputs, ensure_ascii=False, indent=2))
else:
    inputs = json.loads((OUT / 'input.json').read_text())
    sources, quotes, fx = (inputs[k] for k in ['sources', 'quotes', 'fx'])
assert len(order) == len(set(order)) == 66
assert set(order) == set(focus) == set(notes) == set(sources) == set(quotes)
assert all(q['currency'] == 'USD' and q['regularMarketPrice'] > 0 for q in quotes.values())
assert all(d.get('primaryVerified') for d in sources.values())

# Values below were read in the issuer filings. Unverified instruments stay missing.
ratios = {'HSBC': 5, 'SNY': .5, 'SAP': 1, 'SMFG': .6, 'HMC': 3, 'E': 2,
          'BABA': 8, 'PDD': 4, 'JD': 2, 'BIDU': 8, 'NTES': 5, 'TCOM': 1,
          'NIO': 1, 'XPEV': 2, 'LI': 2, 'BEKE': 3, 'TME': 2, 'VIPS': .2,
          'BILI': 1, 'MNSO': 4, 'HTHT': 10, 'FUTU': 8, 'TAL': 1/3, 'EDU': 10,
          'SE': 1, 'INFY': 1, 'IBN': 2, 'VALE': 1, 'ITUB': 1, 'BHP': 2,
          'ONC': 13, 'SKHY': .1}
direct = {'ASML', 'TD', 'RY', 'SHOP', 'SPOT', 'CNI', 'YUMC', 'GRAB', 'MELI', 'NU',
          'CPNG', 'STNE', 'PAGS', 'SPCX'}
def instrument(c):
    if c == 'TAL':
        return '3 ADS = 1 股普通股（1 ADS = 1/3 普通股）；实施日期、后续发行/回购仍需逐项桥接'
    if c in ratios:
        unit = '优先股' if c == 'ITUB' else '普通股'
        return f'1 ADS = {ratios[c]:.10g} 股{unit}；实施日期、后续发行/回购仍需逐项桥接'
    if c in direct:
        return '美国交易的是直接上市/注册普通股；不能套用ADR倍率；股本与类别变化仍需核对'
    return 'ADS底层比例 [MISSING]；公司直接披露的每ADS美元盈利可引用，不能据本币普通股EPS猜倍率'

categories = list(dict.fromkeys(c['sector'] for c in old))
batches = []
cross = ['TSM', 'ARM', 'SKHY', 'SPCX']
for cat in categories[:3]:
    rest = [c['code'] for c in old if c['sector'] == cat and c['code'] not in cross]
    while rest:
        size = 3 if len(rest) == 6 else 4 if len(rest) == 7 else min(5, len(rest))
        part, rest = rest[:size], rest[size:]
        batches.append(dict(id=f'batch-{len(batches)+1:02}', family=cat, codes=part))
batches.append(dict(id=f'batch-{len(batches)+1:02}', family='跨分类：半导体与新上市资本开支对照', codes=cross))
assert sorted(c for b in batches for c in b['codes']) == sorted(order)
assert all(3 <= len(b['codes']) <= 5 for b in batches)
batchof = {c: b for b in batches for c in b['codes']}
missing = ('正常化TTM、逐项一次性损益/税项桥接、2027同口径盈利与现金流、完全摊薄股本与发行回购、'
           '历史倍数分位、独立第二估值方法、完整分部占比及ROIC [MISSING]')
models, patches, audit = {}, [], []
def stamp(epoch):
    return datetime.fromtimestamp(epoch, timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
def money(v): return f'US${v:,.2f}'
def safe(s): return s.replace('|', '／').replace('\n', ' ')

for original in old:
    c = original['code']; name = original['name']; cat = original['sector']
    description, driver, risk, watch, methods, segs = focus[c]
    end, label, facts, judgment, locator = notes[c]
    source = sources[c]; q = quotes[c]; price = q['regularMarketPrice']
    days = (datetime.fromisoformat(DATE) - datetime.fromisoformat(end)).days
    stale = f'；[STALE] 期末距研究日{days}天，保留本次核读期次，不代表已有更晚业绩' if days > 90 else ''
    quote = f'{money(price)}；最近常规交易价，{stamp(q["regularMarketTime"])}；Yahoo Finance第三方快照，非当前盘中价'
    period = f'{label}，期末{end}；公告{source["date"]}{stale}'
    source_note = f'{source["status"]}；{source.get("primaryCheck", "直接公司IR／监管网页核读")}；定位：{locator}'
    unit = instrument(c)
    model = dict(code=c, horizon='2027-12-31', certified=False, numericDraft=False,
                 independentMethodsClosed=False, methods=methods, missing=missing,
                 price=price, instrument=unit, quoteTime=stamp(q['regularMarketTime']))
    scenario_rows = []
    if c in ['HSBC', 'TD']:
        # Bank sensitivity, deliberately not a recommendation or a complete model.
        nav = 10.08 if c == 'HSBC' else 69.69
        currency = 'USD' if c == 'HSBC' else 'CAD'
        conversion = 1 if c == 'HSBC' else fx['CADUSD=X']['regularMarketPrice']
        multiplier = 5 if c == 'HSBC' else 1
        baseusd = nav * conversion * multiplier
        assumptions = [(8, 12, 2, .10), (12, 11, 2, 0), (15, 10, 2, 0)]
        scenarios = []
        for title, (roe, ke, g, impairment) in zip(['悲观', '基准', '乐观'], assumptions):
            pb = (roe-g)/(ke-g); value = baseusd*(1-impairment)*pb
            scenarios.append(dict(name=title, roe=roe, ke=ke, g=g, equityHaircut=impairment,
                                  pb=pb, price=value, change=value/price-1))
            scenario_rows.append(dict(name=title, prob='[MISSING]',
                assumption=f'研究假设：2027普通股ROE {roe}%、股权成本Ke {ke}%、长期g {g}%、权益减记{impairment:.0%}；固定本期BV，未预测2027BV',
                multiple=f'PB {(roe-g)/(ke-g):.3f}×（ROE−g）/（Ke−g）', price=money(value),
                change=f'{value/price-1:+.1%}，未计股息/税费',
                trigger=f'仅作敏感性；后续两次财报核对普通股ROE、信用成本、CET1及股息资本约束，研究假设未获认证'))
        model.update(numericDraft=True, bvps=nav, bvCurrency=currency, ordinaryPerUsInstrument=multiplier,
                     usdPerReportCurrency=conversion, scenarios=scenarios,
                     bear=scenarios[0]['price'], base=scenarios[1]['price'], bull=scenarios[2]['price'],
                     fxTime=None if c == 'HSBC' else stamp(fx['CADUSD=X']['regularMarketTime']),
                     limitation='静态BV的ROE/PB敏感性，不是2027目标价；DDM及资本分派桥接缺失，赔率不认证')
    else:
        for title, condition in [('悲观', f'{risk}兑现，{watch}恶化，重新下调正常化盈利'),
                                 ('基准', f'{driver}得到后续两次财报验证，盈利与现金流同向改善'),
                                 ('乐观', f'{watch}改善超过现有指引且经常性盈利、现金和摊薄后每股价值共同增长')]:
            scenario_rows.append(dict(name=title, prob='[MISSING]', assumption=condition,
                multiple='适用：'+methods+'；定价输入[MISSING]', price='[MISSING]（未认证）',
                change='[MISSING]', trigger='后续两次业绩披露（日期待公告）；'+watch))
    models[c] = model
    rating = '等待证据' if c in ['NIO', 'XPEV', 'LI', 'CPNG', 'SPCX'] else '观察'
    headline = f'{rating}：事实已复核；{judgment}。估值未认证'
    ai = (f'AI相关经营传导需核对：{watch}；需求、资本开支与现金回收分开检验'
          if c in ['TSM','ASML','ARM','SKHY','SPCX','BABA','BIDU','SAP','INFY']
          else 'AI为非核心变量；未核到可独立验证的增量利润与现金回报')
    quantitative = ('连续两次已披露业绩若同口径经常性营业利润/税前利润同比均≤0，且量价/信用质量未改善，'
                    '撤回盈利加速论点；若关键口径无法桥接，维持等待证据。此为研究证伪阈值，非管理层指引')
    metrics = [['价格锚点', quote], ['52周区间', f'US${q.get("fiftyTwoWeekLow", MISSING)}–{q.get("fiftyTwoWeekHigh", MISSING)}；第三方报价口径'],
               ['财报期', period], ['原件财务核读', facts], ['证券单位', unit],
               ['估值状态', '两种独立方法未闭合；旧PE/PEG、赔率与买入区不认证；'+methods],
               ['现金流与资本', '见原件事实；完整正常化OCF→FCF→股东现金及净杠杆桥接[MISSING]；银行不套用工业FCF'],
               ['ROE / ROIC', '完整同口径ROE/ROIC与期初期末权益桥接[MISSING]；不以高毛利替代资本回报'],
               ['研究复核', source_note], ['待补证据', missing]]
    if model['numericDraft']:
        metrics.append(['数值敏感性草案', f'BVPS {nav:g} {currency}/普通股；证券单位折算后US${baseusd:.4f}；仅ROE/PB，DDM未闭合'])
    segments = [dict(name=s, share='[MISSING]', note='业务观察维度，可能交叉；不冒充可加总的财报分部') for s in segs.split(';')]
    if c == 'AZN':
        segments = [dict(name=s, share=f'{v}%', note='H1公司披露收入分类；尚有其他项目，非三项100%') for s,v in [('肿瘤',46),('生物制药',36),('罕见病',16)]]
    if c == 'SPCX':
        segments = [dict(name=s, share=f'{v/7814:.2%}', note=f'Q2收入US${v}m，总收入7814m；不能忽略AI段') for s,v in [('Space',962),('Connectivity',4291),('AI',2561)]]
    discipline = dict(zone='[MISSING]：两种独立估值与下行压力未闭合，不给机械±5%买入区',
                      add='后续两次披露核对：'+watch+'；经常性盈利、现金与摊薄后每股价值同向，再重估',
                      trim='盈利论点触及证伪阈值或独立估值显示安全边际不足时复核；数值价位[MISSING]',
                      invalid=quantitative+'；公司特定风险：'+risk,
                      position='未认证价格与赔率，不给个人仓位百分比；同产业、地区与汇率风险需合并观察')
    pitfalls = [judgment, unit, source_note,
                'GAAP/IFRS与调整后、累计与单季、财年与自然年分列；原件中的adjusted不是自动扣除全部经济成本',
                '营收增长不外推EPS；SBC、受限现金、税项、优先股和客户资金不得默默加入股东价值',
                '行情与外汇为第三方快照；固定FX不是2027汇率预测。旧数值已归档previous.json，当前不认证', missing]
    patch = {**original, 'rating':rating, 'headline':headline,
             'certainty':'经营事实可追溯；2027盈利持续性与价格确定性尚待证据',
             'duration':'跟踪至2027年底；'+driver+'，后续两次财报先验证，不能保证持续增长',
             'ratioNote':'Bear/Base/Bull及独立第二方法未完成认证，盈亏比与概率加权收益[MISSING]；数值草案不是买入区',
             'metrics':metrics, 'profile':name+'：'+description+'。'+facts,
             'segments':segments, 'pros':[driver, '本期经营事实有原件可追溯，见财务核读'],
             'cons':[risk, '正常化盈利、估值及完整资本桥接仍未闭合'],
             'industry':[description+'的景气与竞争需结合'+watch+'判断'],
             'thesis':[judgment, driver], 'growth':[driver, facts, '到2027年验证：'+watch],
             'moat':['竞争优势观察点：'+driver, '护城河须由份额、定价、复购与ROIC证明；量化强弱[MISSING]'],
             'risk':[risk, quantitative], 'next':[watch, '补齐'+methods+'及股本、现金、FX桥接再讨论买入区'],
             'scenarios':scenario_rows, 'discipline':discipline,
             'bullBear':dict(bull=driver+'；本期证据：'+facts, bear=risk+'；'+judgment,
                             verdict='业务事实与价格结论分开；'+methods+'未交叉闭合，保留观察/等待证据'),
             'pitfalls':pitfalls, 'calendar':['后续两次业绩披露：'+watch+'；确切日期待公司公告', '2027年底：验证经常性盈利、现金回报与摊薄后每股价值'],
             'aiNote':ai, 'asOf':f'研究{DATE}；价格{stamp(q["regularMarketTime"])}；{period}',
             'researchReport':f'research/adr-2026-10-07/{c}.html'}
    patch.pop('auto', None)
    patches.append(patch)
    audit.append(dict(code=c, name=name, category=cat, judgment=judgment, certified=False,
                      numericDraft=model['numericDraft'], periodEnd=end, sourceDate=source['date'],
                      filing=source['primaryUrl'], sourceStatus=source['status'], quoteTime=stamp(q['regularMarketTime']),
                      rating=rating, instrument=unit, batch=batchof[c]['id']))
    def table(headers, rows):
        return '| '+' | '.join(headers)+' |\n|'+'|'.join(['---']*len(headers))+'|\n'+'\n'.join('| '+' | '.join(safe(str(x)) for x in row)+' |' for row in rows)
    links = f'[本期原件]({source["primaryUrl"]})；{locator}；{source_note}。原件发布日期{source["date"]}，报告期{end}。'
    supporting = inputs.get('corroboration', {}).get(c, [])
    # Latest annual report and verified corporate actions offer unit/normalization context.
    support_urls = []
    for d in supporting:
        if d.get('form') in ['20-F','40-F','10-K'] and d['primaryUrl'] != source['primaryUrl']:
            support_urls.append(f'[{d["date"]} {d["form"]}原件]({d["primaryUrl"]})')
    # Some financial notes refer to a companion result release or IPO filing.
    same_date = [d for d in supporting if d['date'] == source['date'] and d.get('financial') and d['primaryUrl'] != source['primaryUrl']]
    support_urls += [f'[同日配套原件]({d["primaryUrl"]})' for d in same_date[:3]]
    extra_source = '；'.join(dict.fromkeys(support_urls)) or '额外年报/证券比例实施证据待补；不要猜测未核倍率'
    source_hash = source.get('primarySha256', source['sha256'])
    blocks = [f'# {name}（{c}）｜美股非标普证据复核\n\n[返回总览](index.html) · [所属批次]({batchof[c]["id"]}.html)',
      f'## 0 · 头部信息\n\n研究日{DATE}；分类{cat}；期限至2027年底。{quote}。{period}。\n\n{links}\n\n补充来源：{extra_source}。\n\n原件验证哈希：`{source_hash}`。AZN网页403时使用浏览工具核读，公司网页文本哈希与文件原始字节哈希分列于input.json。',
      f'## 1 · 公司简介\n\n{patch["profile"]}\n\n证券单位：{unit}。行情以美元/美国交易证券计，不把本币普通股EPS直接除美元价。',
      '## 2 · 业务分布\n\n'+table(['业务/维度','收入占比','口径'], [(s['name'],s['share'],s['note']) for s in segments]),
      f'## 3 · 优势与缺点\n\n优势观察点：{driver}。应以份额、定价或客户留存验证，未取得量化护城河序列。\n\n缺点：{risk}。ROIC及同口径净杠杆完整桥接[MISSING]。',
      f'## 4 · 行业趋势\n\n{description}：{driver}。关键监控：{watch}。不能由行业增长推出公司2027年盈利同比。\n\n{ai}。',
      f'## 5 · 结论卡\n\n**{headline}**。研究评级{rating}，不是交易指令。经营证据可追溯；2027盈利持续性与价格确定性仍待核验。\n\n旧结论处理：保留已核原件业务事实；调整{judgment}；撤回未闭合的旧EPS折算、PE/PEG、数值情景、机械买入区及赔率认证。历史存档previous.json不作为当前结论。\n\n最强风险：{risk}。待补：{missing}。',
      '## 6 · 关键指标与证据\n\n'+table(['指标','事实/状态'],metrics)+'\n\n事实以本期原件为准；管理层指引是声明，模型参数是研究假设；未另取分析师共识。未核实指标不复用旧值。',
      f'## 7 · 增长与护城河\n\n增长链：{driver}。核对量价、地域/产品结构、并购、费用及折旧的影响；{judgment}。\n\n验证到2027年的持续性：{watch}。本期增长或转盈只证明本期；需后续两个期次经常性盈利、资本回报与现金验证。护城河量化[MISSING]。',
      '## 8 · 三情景与估值\n\n适用方法：'+methods+'。三情景同一美元证券与2027年底观察期限；缺失模型不生成价格。\n\n'+table(['情景','经营/盈利假设','方法/倍数','隐含价','相对快照','触发'],[(s['name'],s['assumption'],s['multiple'],s['price'],s['change'],s['trigger']) for s in scenario_rows])+
      ('\n\n数值草案公式：PB=(普通股ROE−g)/(股权成本Ke−g)；价值=本期普通股BVPS×证券股数×美元/报告币×(1−权益减记)×PB。使用静态本期BV，不声称预测2027BV；不是企业DCF，Ke不叫WACC。' +
       f'本期BVPS={nav:g} {currency}，证券股数={multiplier}，美元/报告币={conversion:.8g}。'+
       ('FX日期'+model['fxTime']+'。' if model['fxTime'] else 'BV本已是美元，不重复换汇。')+
       '独立DDM、信用损失到权益和可派息资本未闭合，历史PB分位[MISSING]，两方法未认证。' if model['numericDraft'] else
       '\n\n盈利到EPS、股权现金流到每股价值、EV到股权的桥接尚缺；不实施无输入DCF。WACC/Ke、g、终值占比及敏感性[MISSING]，不冒充已完成DCF。')+
       '\n\n盈亏比不认证：只有已核Bear<P<Base才可计算R=(Base−P)/(P−Bear)；P*=(Base+2Bear)/3。没有认证Base/Bear就不发布门槛价。概率与期望收益[MISSING]；股息、税费与汇率收益未计。悲观价不保证最大损失。',
      '## 9 · 条件化研究纪律\n\n'+table(['项目','规则'],list(discipline.items())),
      f'## 10 · 风险与证伪\n\n{risk}。观察{watch}。\n\n{quantitative}。验证窗口为接下来两次公司已披露业绩，确切发布日期待公告；若触发则重做经营/价格研究，不以未取到原件推断经营恶化。信用、汇率、流动性和稀释单独压力检验，不能把模型悲观端当极限损失。',
      f'## 11 · 多空检验与专家视角\n\n以下为**单模型多视角复核**，不是独立专家或多数票。\n\n'+table(['视角','立场/期限','证据与反证','失效/后续'],[
        ('产业','观望；至2027年底',driver+'；反证：'+risk,watch),
        ('财报','观望；后续两次披露',facts+'；反证：一次性损益或现金背离',judgment),
        ('估值','等待证据；2027年底',methods+'；缺失正常化/股本/第二方法',missing),
        ('逆向','观望；后续两个期次',judgment+'；低倍数或股价下跌不等于错杀',risk)])+
      f'\n\n多头一：{driver}。空头回应：{risk}，要以{watch}核实。\n\n多头二：{facts}。空头回应：{judgment}，单期改善不能代替经常性盈利与现金的连续性。\n\n多头三：优势可能带来估值溢价。空头回应：缺少{methods}交叉验证，优势本身没有证明现价安全边际。\n\n主持裁决：经营事实可用；可买价格和赔率尚缺证据。保留产业前景与价格谨慎之间的分歧。\n\n'+table(['PM七问','回答'],[
        ('什么被错误定价？','[MISSING]；待经营与估值交叉证明，不把好公司直接称低估'),
        ('价格反映什么？',quote+'；逆向隐含增长模型[MISSING]'),
        ('什么证明论点？',watch+'及后续两次经常性盈利/现金同步改善'),
        ('什么推翻论点？',risk+'；见量化阈值'),
        ('为什么现在？','本轮原件与快照纠正旧口径；尚不足以认证现在买入'),
        ('什么改变评级/估值？',methods+'闭合、资本/股本桥接完成且下行压力足够'),
        ('还缺什么？',missing)]),
      '## 12 · 口径陷阱与来源\n\n'+'\n\n'.join(pitfalls)+f'\n\n{links}\n\n{extra_source}。行情来自Yahoo Finance；公司页的数值不是共识预测。input.json保存来源状态、抓取哈希、报价及FX时间。focus.tsv/notes.tsv为人工核读输入；生成脚本只整理报告和敏感性算术，不自动认证财务结论。',
      '## 13 · 验证日历\n\n'+'\n\n'.join(patch['calendar'])+'。\n\n缺证优先：正常化损益和股本/单位→现金和资本约束→适用两方法→历史分位与下行压力。报告未给出已公告的具体未来日期，避免猜财报日。',
      '## 14 · 免责声明\n\n'+DISCLAIMER]
    (OUT / f'{c}.md').write_text('\n\n'.join(blocks)+'\n')

def dump(name, obj): (OUT / name).write_text(json.dumps(obj, ensure_ascii=False, indent=2)+'\n')
dump('models.json', models); dump('patches.json', patches); dump('batches.json', batches)
dump('audit.json', dict(date=DATE, total=66, categories={cat:sum(c['sector']==cat for c in old) for cat in categories},
                        certified=0, numericDrafts=sum(m['numericDraft'] for m in models.values()), companies=audit))
with (OUT / 'audit.csv').open('w', newline='') as f:
    w=csv.DictWriter(f,fieldnames=list(audit[0])); w.writeheader(); w.writerows(audit)

comparison = {
 '海外龙头':'半导体看订单、折旧与客户集中；药企看量价、专利与调整桥接；银行看信用与资本；资源看中周期现金；消费看销量与一次性损益。不要跨行业直接PE排名。',
 '中概':'统一ADS单位仍不等于统一业务风险；汽车亏损、互联网利润调整、教育投资重估与临床产品拐点分别检验。美港双挂牌为同一主体风险，不能计成两个分散仓位。',
 '新兴市场平台':'GMV、支付TPV、客户数与收入分开；信贷净息差必须扣信用成本，平台补贴不能仅看adjusted EBITDA。地域汇率及监管需要独立压力测试。',
 '新上市/热门':'SKHY已经上市且1ADS=0.1普通股；SPCX不是只有火箭和Starlink，还包括AI业务。新增股数、资本开支与上市后股本桥接先于PE。'}
def rows_for(codes):
    return [(f'[{p["name"]} {p["code"]}]({p["code"]}.html)',p['sector'],notes[p['code']][3],focus[p['code']][3],p['rating']) for p in patches if p['code'] in codes]
for idx,cat in enumerate(categories,1):
    codes=[c['code'] for c in old if c['sector']==cat]
    content=f'# {cat}｜全部{len(codes)}家公司\n\n[返回总览](index.html)\n\n{comparison[cat]}\n\n'
    content+=table(['公司','分类','本轮修正','验证指标','评级'],rows_for(codes))
    content+='\n\n所有公司已写入来源与财报期；数值模型未完成两种独立方法，不给投资排序。研究优先级：先解决会翻转旧结论的口径/一次性损益，再补正常化、股本和独立估值。\n\n'+DISCLAIMER+'\n'
    (OUT/f'category-{idx}.md').write_text(content)
for idx,b in enumerate(batches):
    codes=b['codes'];prior=batches[idx-1]['id']+'.html' if idx else 'index.html'
    nextpage=batches[idx+1]['id']+'.html' if idx+1<len(batches) else 'index.html'
    content=f'# {b["id"]}｜{b["family"]}\n\n[前批]({prior}) · [后批]({nextpage}) · [总览](index.html)\n\n'
    content+=table(['公司','分类','本轮修正','观察指标','评级'],rows_for(codes))
    content+='\n\n排序：本批按研究池顺序展示，不是收益排序。定价未认证，不能把不同报告期/币种/业务的增长率当选股榜。优先补一次性项目与证券单位，再补现金和两方法。\n\n'
    content+='共同变量：美元汇率、资本成本、资本投入与现金回收；各公司业务证伪指标见表。跨批衔接保留同一报价日期，比较经常性而非headline利润。数据陷阱：累计/单季、财年、调整后利润、ADS倍率与普通股类别。下一步：后续两次业绩按上表验证；如经营证据改善再补估值。\n\n'+DISCLAIMER+'\n'
    (OUT/f'{b["id"]}.md').write_text(content)
index='# 美股非标普｜66家公司、四个分类研究复核\n\n'
index+=f'研究日{DATE}。覆盖海外龙头30家、中概21家、新兴市场平台13家、新上市/热门2家；全部有公司级财务原件、证券单位边界、旧结论修正、三情景框架、风险证伪及多空检验。单模型多视角复核。\n\n'
index+='**这是事实复核与估值缺口清单。2家银行有静态BV/ROE敏感性草案；0家完成两种独立方法认证；其余数值估值输入缺失。当前不认证买入区、目标价或赔率。**原始历史页保存在previous.json；没有把缺证直接当作经营恶化。\n\n'
index+='最近常规交易价为2026-10-06美国交易时段附近的Yahoo快照，逐页列UTC时间；不是10月7日盘中行情。报告期、公告期和研究日期分列，超过90天标[STALE]。\n\n'
index+=' · '.join(f'[{cat}（{sum(c["sector"]==cat for c in old)}）](category-{i}.html)' for i,cat in enumerate(categories,1))+'\n\n'
index+=table(['公司','分类','关键修正','下一次核对','评级'],rows_for(order))
index+='\n\n3–5家公司一批，全部66家仅出现一次：\n\n'+table(['批次','主题','公司'],[(f'[{b["id"]}]({b["id"]}.html)',b['family'],', '.join(b['codes'])) for b in batches])
index+='\n\n可复查：[审计JSON](audit.json) · [审计CSV](audit.csv) · [模型与缺口](models.json) · [来源/报价/FX快照](input.json) · [原件核读笔记](notes.tsv) · [历史存档](previous.json)。\n\n'+DISCLAIMER+'\n'
(OUT/'index.md').write_text(index)

# Write original dataset and effective detail layer together, preventing stale overrides.
(ROOT/'public/data/adr.json').write_text(json.dumps(patches,ensure_ascii=False,indent=2)+'\n')
fieldkeys={'rating':'rt','headline':'h','certainty':'cert','duration':'dur','ratioNote':'ratio','profile':'pf','aiNote':'ai'}
arraykeys={'thesis':'t','growth':'g','moat':'o','risk':'rk','pitfalls':'x','calendar':'c','pros':'pro','cons':'con','industry':'ind'}
lines=['// 2026-10-07原件复核；可复现生成：scripts/review-adr-2026-10-07.py。',
       '// 历史页归档public/research/adr-2026-10-07/previous.json；缺失估值不认证。', 'export const adrDetails = `']
for p in patches:
    lines.append('@adr:'+p['code'])
    for key,k in fieldkeys.items(): lines.append(k+': '+safe(p[key]))
    for key,k in arraykeys.items(): lines.extend(k+': '+safe(v) for v in p[key])
    lines.extend('m: '+safe(k)+'|'+safe(v) for k,v in p['metrics'])
    lines.extend('seg: '+'|'.join(safe(s[k]) for k in ['name','share','note']) for s in p['segments'])
    lines.extend('s: '+'|'.join(safe(s[k]) for k in ['name','prob','assumption','multiple','price','change','trigger']) for s in p['scenarios'])
    for key,k in {'zone':'z','add':'a','trim':'r','invalid':'i','position':'p'}.items():lines.append(k+': '+safe(p['discipline'][key]))
    for k,v in p['bullBear'].items(): lines.append(k+': '+safe(v))
    lines.append('')
lines.append('`\n')
(ROOT/'src/data/details/adr.ts').write_text('\n'.join(lines).replace('${','\\${'))
print(f'Generated {len(patches)} company reports, {len(batches)} batches, 4 categories; 2 numeric drafts, 0 certified')
