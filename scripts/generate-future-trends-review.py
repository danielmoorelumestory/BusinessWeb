"""Reproducible coverage ledger. No fabricated missing financials or probabilities."""
import json, re, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/research/future-trends-2026-10-09'
def read(p): return json.loads((ROOT / p).read_text())
def write(p, x): p.write_text(json.dumps(x, ensure_ascii=False, indent=2) + '\n')
pool = read('public/research/future-trends-2026-10-09/input-pool.json')
quotes = read('public/research/future-trends-2026-10-09/quotes.json')['quotes']
dated_quotes = read('public/research/future-trends-2026-10-09/dated-quotes.json')
reviewed = {x['key']: x for x in read('scripts/future-trends-reviewed.json')}
selection = {x['key']: x for x in read('src/data/futureTrendsSelection.json')}
catalog = read('src/data/futureTrends.catalog.json')['trends']
old = {}
for market in ['cn', 'us', 'hk', 'adr']:
    for c in read(f'public/data/{market}.json'):
        old[(market, c['code'])] = c
def primary(code): return re.split(r'\s*[/（]\s*', code)[0].strip()
def identity(c):
    p = primary(c['code'])
    return p if re.fullmatch(r'(?:\d{6}|\d{4,6}\.[A-Z]+|[A-Z][A-Z0-9.-]*)', p) else c['name']
members = {}
for t in catalog:
    for link in t['chain']:
        for market in ['cn', 'us']:
            for c in link[market]:
                ident = identity(c)
                v = members.setdefault(ident, {'company': c, 'trends': [], 'roles': [], 'sources': [], 'verify': [], 'industry': []})
                if t['name'] not in v['trends']: v['trends'].append(t['name'])
                role = f"{t['name']} / {link['link']}：{c['role']}（{c['exposure']}）"
                if role not in v['roles']: v['roles'].append(role)
                s = {'title': c['sourceTitle'], 'url': c['sourceUrl'], 'status': '目录既有来源；仅支持所列业务关联，不认证财务及估值'}
                if s not in v['sources']: v['sources'].append(s)
                for field in ['verify']:
                    if link.get(field) and link[field] not in v['verify']: v['verify'].append(link[field])
                v['industry'] = list(dict.fromkeys(v['industry'] + [t['oneLine'], t['stage']] + t['risks']))
bycode = {primary(x['pick']['code']): x for x in pool}
def arr(x):
    if isinstance(x, list): return [str(i) if not isinstance(i, dict) else '；'.join(f'{k}：{v}' for k,v in i.items()) for i in x]
    if isinstance(x, dict): return [f'{k}：{v}' for k,v in x.items()]
    return [x] if isinstance(x,str) and x else []
summaries=[]
pages = OUT / 'companies'; pages.mkdir(exist_ok=True)
for ident, m in members.items():
    c=m['company']; item=bycode.get(ident); p=item['pick'] if item else {}; level=(item or {}).get('level') or {}
    key=item['key'] if item else f'非上市:{ident}'
    n=reviewed.get(key); chosen=selection.get(key); q=quotes.get(key) or dated_quotes.get(key)
    code=primary(c['code'])
    om='hk' if code.endswith('.HK') else 'cn' if re.fullmatch(r'\d{6}',code) else 'us'
    oc=code.replace('.HK','').zfill(5) if om=='hk' else code
    prev=old.get((om,oc)) or old.get(('adr',code)) or {}
    # Existing research remains a dated prior, not a new primary-source certification.
    price=q['price'] if q else None
    currency=q['currency'] if q else ('EUR' if code.endswith(('.PA','.DE')) else 'DKK' if code.endswith('.CO') else 'JPY' if code.endswith('.T') else '')
    stamp=q['time'] if q else '旧目录价截至 2026-10-07；本次未取得可核实时点行情'
    if re.fullmatch(r'\d{14}', stamp):
        stamp=f'{stamp[:4]}-{stamp[4:6]}-{stamp[6:8]} {stamp[8:10]}:{stamp[10:12]}:{stamp[12:14]}'
    if n and n.get('blockPrice') and key not in dated_quotes: price=None; stamp='[MISSING] 拆股后报价口径待核；旧目录价不可直接使用'
    src=m['sources'].copy()
    if prev.get('researchReport'):
        src.append({'title':'既有公司研究原报告（历史分析）','url':'/'+prev['researchReport'].lstrip('/'),'status':'既有研究，非财报原件；本次未重新认证其中旧估值及评级'})
    if q: src.insert(0,{'title':q.get('title','腾讯延迟行情原始快照'),'url':q['source'],'status':f"时间 {q['time']}（市场当地时间；历史锚点与延迟价分别标注）"})
    if n:
        src.insert(0,{'title':'本次公司级核对的业绩披露','url':n['url'],'status':n.get('sourceStatus','一手原件：仅核对本页列出的摘录，不代表全部报表完成审计')})
        if n.get('extra'):src.insert(1,{'title':'证券单位 / 拆股及上市结构','url':n['extra'],'status':'公司一手公告'})
    scenarios=[]
    if n:
        scenarios=[{'name':name,'eps':eps,'multiple':pe,'price':eps*pe*n.get('fx',1),'probability':(n['prob'][i] if n.get('prob') else None),'assumption':f"{n['basis']}；EPS {eps} × PE {pe} × 汇率 {n.get('fx',1)}"} for i,(name,eps,pe) in enumerate(zip(['悲观','基准','乐观'],n['eps'],n['pe']))]
    else:
        scenarios=[{'name':name,'eps':None,'multiple':None,'price':None,'probability':None,'assumption':'[MISSING] 未建立公司分部、正常化盈利与独立估值；撤回旧程序化目标价的可投资解释'} for name in ['悲观','基准','乐观']]
    bear,base,bull=[s['price'] for s in scenarios]
    valid=price is not None and bear is not None and bear < price < base
    ratio=(base-price)/(price-bear) if valid else None
    threshold=(base+2*bear)/3 if bear is not None else None
    win=exp=None
    if n and n.get('prob') and price:
        win=sum(sc['probability'] for sc in scenarios if sc['price']>=price*1.1)
        exp=sum(sc['probability']*sc['price'] for sc in scenarios)/price-1
    up=base/price-1 if price and base else None
    down=1-bear/price if price and bear and bear < price else None
    concern=n['risk'] if n else p.get('risk') or '非上市或证券主体待核；财务、股本、估值与退出流动性不足，不能给公开市场买入结论。'
    moat=n['moat'] if n else p.get('barrier') or '；'.join(arr(prev.get('moat'))) or f"待验证：{c['role']}。业务关联不自动构成可持续定价权。"
    headline=(n['fact'] if n else p.get('note') or c['role'])
    if not n: headline='既有研究待核：'+headline
    id=('listed-'+code.lower().replace('.','-')) if item else 'private-'+hashlib.sha256(ident.encode()).hexdigest()[:12]
    summary=dict(id=id,key=key,name=c['name'],code=c['code'],asOf='2026-10-09',depth='公司证据摘录＋情景草稿' if n else '逐家初筛／既有研究复核，未认证',rating='观察／等待估值证据' if item else '不纳入上市候选池',headline=headline,price=price,priceText=(f'{currency} {price:,.2f}' if price is not None else '[MISSING]'),priceDate=stamp,currency=currency,ratio=ratio,up=up,down=down,threshold=threshold,breakEven=1/(1+ratio) if valid else None,winRate=(f"假设胜率 {win:.0%}（情景价 ≥ 现价 +10% 的概率合计；悲观/基准/乐观 = {'/'.join(str(round(q*100)) for q in n['prob'])}，主观研究概率，非历史回测）" if win is not None else '[MISSING] 未经历史样本校准；不沿用固定 45% / 50%'),expected=exp,valuationStatus='正常化 EPS 情景草稿；第二独立方法缺失，未认证' if n else '旧程序化赔率撤回；公司级估值待补',primaryTrend=chosen['sector'] if chosen else m['trends'][0],riskGroup=n['group'] if n else '／'.join(item['trends']) if item else '非上市流动性与融资',core=bool(chosen and chosen['priority'] < 3),moat=moat,concern=concern,certainty='证据中等／估值低，非综合高确定性' if n else '待核',sources=src)
    missing=['[MISSING] 第二种独立估值、净债务与最新摊薄股数桥接，当前不认证买入评级。','[MISSING] 可校准概率的历史可比样本、样本外验证与交易成本；实际胜率未知。','[MISSING] 52 周价格区间、历史估值分位、同口径两期盈利预测桥和完整分部现金回报。']
    if not n: missing.insert(0,'[MISSING] 最新完整报表一手原件逐表核对、分部收入利润、持续经营正常化 EPS。')
    if not q: missing.append('[MISSING] 本次实时/延迟行情。外国非美交易所接口未覆盖；Yahoo 替代接口返回 HTTP 429，旧价不冒充新价。')
    profile=('[既有简介，未重新认证] '+prev['profile']) if prev.get('profile') else f"{c['name']}：{c['role']}。证券信息：{c['code']}；关联类型：{c['exposure']}。主体与业务边界以公司披露为准。"
    drivers=n['driver'].split('；') if n else [p.get('space') or c['role'], '验证业务收入占比、增量利润率及经营现金回收；不能以总市场空间替代公司份额。', '核对客户集中、可替代方案与持续研发/资本开支；业务增长不自动转化成每股收益。']
    d=dict(**summary,trends=m['trends'],period='研究期限 2027-12-31；财年不同者按情景说明，非保本承诺',profile=profile,segments=(n.get('segments',[]) if n else [])+m['roles']+['既有分部资料（原始口径，待复核）：'+x for x in arr(prev.get('segments'))],mechanism='客户需求 → 销量/服务使用量 × 单价 → 收入 − 成本与费用 → 持续经营净利润 ÷ 摊薄股数 → EPS；再扣资本开支、营运资金并核对股东可得现金。',drivers=drivers,pros=[moat]+['既有材料（未复核）：'+x for x in arr(prev.get('pros'))],cons=[concern]+['既有材料（未复核）：'+x for x in arr(prev.get('cons'))],industry=m['industry'],metrics=[['本次价格',summary['priceText']],['价格时间',stamp],['一手事实摘录',n['fact'] if n else '[MISSING] 本次未完成最新报表逐项核实'],['历史筛选增速（未重新认证）',p.get('growthRate','[MISSING]')],['同口径 TTM / 远期 PE / PEG','[MISSING] 尚未完成正常化、拆股及币种桥接'],['52 周区间 / 历史估值分位','[MISSING] 未核实'],['ROIC / 净债务 / 利息覆盖','[MISSING] 需要公司完整财报及最新股本'],['股东现金流','已取得部分 CFO / 资本开支摘录；具体见事实，不等同已建立 FCFE 模型' if n else '[MISSING] 不将经营现金流视为自由现金流'],['旧财务资料日期',prev.get('asOf','[MISSING]')]]+[['旧资料指标（未复核）：'+str(k),str(v)] for k,v in prev.get('metrics',[])],growth=drivers+['既有材料（未复核）：'+x for x in arr(prev.get('growth'))],moatAnalysis=[moat,'需验证定价权、留存率、投入资本回报和竞争份额；高毛利本身不足以证明不可替代。'],scenarios=scenarios,modelNote=('三情景均为分析者假设，非公司指引或市场一致预期。'+n['basis'] if n else '公司级正常化盈利模型缺失；历史自动化价格仅保留在输入快照，不再用于判断能否现在投资。'),secondMethod='[MISSING] 独立 DCF / SOTP / 现金收益交叉验证尚未完成。反向 PE 与 EPS×PE 是同一种方法，不能冒充第二种方法。',sensitivity=([f'基准 EPS ±10% → 基准价 {base*.9:,.2f}–{base*1.1:,.2f}（固定 PE 和汇率）。',f'基准 PE ±2 倍 → 基准价 {(n["pe"][1]-2)*n["eps"][1]*n.get("fx",1):,.2f}–{(n["pe"][1]+2)*n["eps"][1]*n.get("fx",1):,.2f}（固定 EPS 和汇率）。'] if n else ['输入缺失，不计算伪精确敏感性。']),probabilityNote=(f"悲观/基准/乐观概率 {'/'.join(str(round(q*100)) for q in n['prob'])}% 为分析者主观假设，未经历史样本校准；假设胜率 = 情景价高于现价 10% 以上的概率合计，期望收益 = Σ概率×情景价 ÷ 现价 − 1，均不含分红、交易成本与情景之外的尾部风险。" if n and n.get('prob') else '')+'实际未来胜率不可确知。仅在 Bear<P<Base 时，二点、无分红、无成本模型的保本所需胜率 q=(P−Bear)/(Base−Bear)=1/(1+R)。它是代数门槛，不是该公司上涨概率；无校准概率则不计算期望收益。',discipline=['评级为观察，核心表示优先长期研究，不表示现价可以买。', 'R=(Base−P)/(P−Bear)，须 Bear<P<Base；P*=(Base+2Bear)/3。未完成盈利和第二方法核实，达到 P* 也不自动升级买入。', '悲观价不是止损保证；实际破产、监管、质量事故或摊薄可使损失更大。'],falsification=([n['test']] if n else [level.get('invalid') or '未来两份披露：核实本页业务是否形成可分辨收入和正现金贡献；若无法确认，维持等待证据。'])+m['verify'],debate=[{'perspective':'产业／成长','stance':'条件偏多','evidence':drivers[0],'counter':concern},{'perspective':'估值／逆向','stance':'观望','evidence':summary['valuationStatus'],'counter':'低 TTM PE、股价下跌或大市场空间不能单独证明低估。'},{'perspective':'财报／质量','stance':'分歧待核','evidence':n['fact'] if n else '仅有既有研究摘要，需一手报表核实。','counter':'现金流、持续经营利润、摊薄股数和调整后利润可能指向不同判断。'},{'perspective':'信号／短线','stance':'不作短线判断','evidence':'[MISSING] 时点完整资金流、技术序列与事件研究','counter':'日级趋势不能替代到 2027 年的盈利验证。'}],verdict='单模型多视角复核：保留业务优势，撤回未经证据支持的现价买入、固定胜率和自动化赔率；逐项补齐证据再升级。',pitfalls=['事实、分析者假设与旧资料分开；本页创建日期不意味着旧财务数据已更新。','累计/单季、GAAP/调整后、财报/交易币种、普通股/ADS 和拆股口径必须一致。','AI、量子、脑机接口等目录关联不能替代主营收入敞口。']+missing,missing=missing,calendar=['既有日历（需核对是否已发生）：'+x for x in arr(prev.get('calendar'))]+['未来两期定期业绩披露（确切日期待公司公告）：复核上述证伪指标。','每次新增融资、拆股、重大监管及财报指引变化后重算情景。'],prior=['旧资料只作审计轨迹，不沿用旧买入评级：'+str(prev.get('headline','未匹配既有研究页')),'旧程序化输入：public/research/future-trends-2026-10-09/input-pool.json；其中旧赔率与固定胜率已撤回。'])
    write(pages / f'{id}.json',d);summaries.append(summary)
write(ROOT / 'src/data/futureTrendsResearch.index.json', summaries)
write(OUT / 'coverage.json', {'asOf':'2026-10-09','companies':len(summaries),'listed':len(pool),'unlistedOrUncertain':len(summaries)-len(pool),'freshQuotes':len(quotes),'companyEvidenceDrafts':len(reviewed),'certifiedValuations':0,'actualWinRatesCalibrated':0,'missing': '详见每家公司二级页；覆盖不等于完成深度认证'})
write(OUT / 'reviewed-input.json',list(reviewed.values()))
print(f'Generated {len(summaries)} secondary reports, {len(reviewed)} company evidence drafts, {len(quotes)} quote snapshots.')
