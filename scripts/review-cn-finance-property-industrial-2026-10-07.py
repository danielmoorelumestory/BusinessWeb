"""Reproducible dated research renderer; no network and no uniform PE extrapolation.

Source table extraction is retained with PDF physical pages, units and SHA-256.
Analyst focus and scenarios are explicit hypotheses. Missing independent valuation
inputs withdraw old price targets; extracted data is not certified deep coverage.
"""
import csv,json,math,shutil,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
LOCAL=ROOT/'.local/cn-finance-property-industrial-2026-10-07'
OUT=ROOT/'public/research/cn-finance-property-industrial-2026-10-07'
OUT.mkdir(parents=True,exist_ok=True)
DATE='2026-10-07';SECTORS=['金融','房地产','工业'];SLUGS={'金融':'finance','房地产':'property','工业':'industrial'}
published=json.loads((OUT/'input.json').read_text()) if (OUT/'input.json').exists() else None
facts={r['code']:r for r in (json.loads((LOCAL/'reviewed-facts.json').read_text()) if (LOCAL/'reviewed-facts.json').exists() else published['filings'])}
old=json.loads((LOCAL/'previous.json').read_text()) if (LOCAL/'previous.json').exists() else json.loads((OUT/'previous.json').read_text())['companies']
oldby={r['code']:r for r in old};order=[r['code'] for s in SECTORS for r in old if r['sector']==s]
focus={}
focusfile=LOCAL/'focus.tsv' if (LOCAL/'focus.tsv').exists() else OUT/'focus.tsv'
for line in focusfile.read_text().splitlines():
 c,subtype,driver,risk,watch=line.split('|');focus[c]=dict(subtype=subtype,driver=driver,risk=risk,watch=watch)
notes=json.loads((LOCAL/'notes.json').read_text()) if (LOCAL/'notes.json').exists() else published['notes']
events=json.loads((LOCAL/'events-manifest.json').read_text()) if (LOCAL/'events-manifest.json').exists() else published['events']
quotes=published['quotes'] if published else {}
for file in LOCAL.glob('quotes-*.txt'):
 for line in file.read_bytes().decode('gb18030').splitlines():
  a=line.split('~');quotes[a[2]]=dict(name=a[1].strip(),price=float(a[3]),timestamp=a[30],totalShares=int(a[73]),providerPe=float(a[39]),providerPb=float(a[46]),url='https://qt.gtimg.cn/q='+('sh' if a[2].startswith('6') else 'sz')+a[2])
assert set(order)==set(facts)==set(focus)==set(quotes) and len(order)==270
assert all(q['timestamp'].startswith('20260930') for q in quotes.values())
assert {s:sum(facts[c]['sector']==s for c in order) for s in SECTORS}=={'金融':82,'房地产':9,'工业':179}
(OUT/'input.json').write_text(json.dumps(dict(filings=list(facts.values()),quotes=quotes,notes=notes,events=events),ensure_ascii=False,indent=2))
(OUT/'previous.json').write_text(json.dumps(dict(status='旧页存档，数值评级和价位已由本轮覆盖，禁止作为当前结论',archivedOn=DATE,companies=old),ensure_ascii=False,indent=2))
(OUT/'focus.tsv').write_text(focusfile.read_text())
def val(c,k):
 f=facts[c]['fields'].get(k);return f['value'] if f else None
def yi(v):return '[MISSING]' if v is None else f'{v/1e8:.2f}亿元'
def num(v,suffix=''):return '[MISSING]' if v is None else f'{v:g}{suffix}'
def growth(c,k):
 f=facts[c]['fields'].get(k)
 if not f or f.get('prior') is None:return '[MISSING]'
 if f['prior']<=0:return f'本期{yi(f["value"])}、同期{yi(f["prior"])}；亏损/负基数不报普通增长率'
 return f'{(f["value"]/f["prior"]-1)*100:+.2f}%'
def factor(ke,g,tg):
 exp=sum((1+g)**(t-1)/(1+ke)**t for t in range(1,6));tv=(1+g)**4*(1+tg)/(ke-tg)/(1+ke)**5
 return exp+tv,tv/(exp+tv)
SHARES={'000400':1018558239,'002202':4222521647,'002352':5105148078,'688223':10239690997,'601211':17581057948}
BANK_ROE={'000001':9,'002142':12,'002966':11,'600000':8,'600015':8,'600016':7,'600036':12,'600919':12,'600926':12,'601009':11,'601077':9,'601128':12,'601166':10,'601169':8,'601229':9,'601288':10,'601328':9,'601398':10,'601577':10,'601658':9,'601665':11,'601818':8,'601825':10,'601838':12,'601916':8,'601939':11,'601988':9,'601997':8,'601998':10}
DISCLAIMER='本报告仅供研究参考，不构成个人投资建议。'
MISSING='52周行情、同口径TTM/远期盈利、经营利润率、ROIC、完整FCFE/净债务、完全摊薄股数、详细会计分部比例及研究日前全部后续公告闭合 [MISSING]。'
patches={};audits=[];models={};batches=[]
for sector in SECTORS:
 codes=[c for c in order if facts[c]['sector']==sector];n=1
 while codes:
  size=3 if len(codes)==6 else 4 if len(codes)==7 else min(5,len(codes))
  group=codes[:size];codes=codes[size:];batches.append((sector,n,group));n+=1
for c in order:
 r=facts[c];t=focus[c];s=r['sector'];sub=t['subtype'];financial=s=='金融';bank=sub=='银行';insurance=sub in ['寿险','保险综合'];property=s=='房地产';leasing=sub in ['航空租赁','航运租赁','金融租赁'];regular=not financial and not property and not leasing
 f=r['fields'];net=val(c,'net');core=val(c,'core');ocf=val(c,'ocf');revenue=val(c,'revenue');equity=val(c,'equity');p=quotes[c]['price'];shares=SHARES.get(c,quotes[c]['totalShares']);npl=val(c,'npl')
 if c=='002966':npl=.81;f['npl']=dict(value=.81,prior=.82,page=9,unit=None,label='不良贷款率',evidence='第9页监管指标表（≤5为监管标准，第13页复核当期0.81%）',manual=True)
 if c=='601825':f['nim']=dict(value=1.36,prior=1.39,page=13,unit=None,label='净利息收益率',evidence='第13页，年化净利息收益率',manual=True)
 ts=quotes[c]['timestamp'];price=f'{p:g}元（腾讯行情{ts[:4]}-{ts[4:6]}-{ts[6:8]} {ts[8:10]}:{ts[10:12]}:{ts[12:14]}盘后最后报价；未获交易所收盘确认）'
 if c in ['601059','601198']:price+='；换股/终止上市流程下仅作历史报价记录，当前可交易性未认证'
 ev=[e for e in events if e['code']==c]
 if c in ['601059','601198']:ev += [e for e in events if e['id']=='1225579676']
 evt=notes.get(c,[])
 titlecount=sum(1 for e in ev)
 eventnote='已读取本报告列出的'+str(titlecount)+'份后续原件；标题检索限页，完整后续公告、除息与股本桥接仍未闭合。' if ev else '已检索9月1日至研究日的公告标题；标题检索限页，未读取/未列出的全部后续原件仍[MISSING]，不等于没有变动。'
 if c in SHARES:sharetext=f'实施原件核对总股本{shares:,}股；完全摊薄工具及后续变动[MISSING]。'
 else:sharetext=f'行情商参考总股本{shares:,}股；尚未以完整实施公告桥接，不认证完全摊薄股数。'
 if financial:cashnote=f'H1经营现金净额{yi(ocf)}；受客户资金、准备金、保费/投资/回购业务影响。禁止将金融OCF−资本开支当FCFE或以OCF/归母排列盈利质量。'
 elif property:cashnote=f'H1经营现金净额{yi(ocf)}；预售回款、交付、往来和土地支出影响方向，不能等同可自由支配资金。受限现金、集团/项目现金隔离与到期债务桥接[MISSING]。'
 elif leasing:cashnote=f'H1经营现金净额{yi(ocf)}；租赁资产采购、租赁本金、出售与负债融资是业务核心，普通工业OCF−设备购建不构成完整FCFE。'
 else:
  cap=val(c,'cashCapex');cash=val(c,'cashStatementOcf');validcash=cash is not None and cap is not None and cap>=0
  cashnote=f'H1经营现金{yi(ocf)}；合并现金流量表OCF{yi(cash)}；购建长期资产现金支出{yi(cap) if cap is None or cap>=0 else "[MISSING]（抽取符号待复核）"}；简式现金余额{yi(cash-cap) if validcash else "[MISSING]"}。仅OCF−该项支出，不含并购、租赁本金、净借款，不是完整FCFE。'
 gap=net-core if net is not None and core is not None else None
 profitnote=f'H1收入{yi(revenue)}（同比{growth(c,"revenue")}），归母{yi(net)}，扣非归母{yi(core)}（同比{growth(c,"core")}）；归母−扣非{yi(gap)}。该净差额不是每项一次性损益的完整桥接。'
 if insurance:profitnote+='保险主营投资收益与精算假设影响仍可能保留在扣非中；承保盈利与投资盈利必须分拆。'
 if bank:profitnote+='归母权益可能含优先股/永续债；PB必须使用披露的普通股每股净资产，不用全部归母权益÷普通股数。'
 rating='回避' if c in ['000002','600606'] else '等待证据' if net is not None and net<=0 or core is not None and core<=0 else '观察'
 certainty='低：偿债/持续盈利或估值关键证据未闭合' if rating in ['回避','等待证据'] else '中（经营事实）；估值确定性低，未认证'
 scenario=[];model=dict(certified=False,priceAnchor=p,referenceShares=shares,shareSource='实施原件' if c in SHARES else '行情商，未闭合',method='',missing=[])
 if bank:
  bv=val(c,'bvps');base_roe=BANK_ROE[c];weak=base_roe<=8;ke=.14 if weak else .12
  definitions=[('悲观',max(4,base_roe-4)/100,0,ke+.02,.15),('基准',base_roe/100,.02,ke,.05 if weak else .02),('乐观',(base_roe+3)/100,.03,ke-.01,0)]
  ps=[];sens=[]
  for name,roe,g,k,haircut in definitions:
   pb=(roe-g)/(k-g);mp=bv*(1-haircut)*pb if bv else None;ps.append(mp)
   scenario.append(dict(name=name,prob='[MISSING]（未赋概率）',assumption=f'2027正常普通股ROE{roe:.0%}、长期增长{g:.0%}、Ke{k:.0%}、普通股账面折价{haircut:.0%}，均为研究假设；H1普通股BVPS{num(bv,"元")}暂代2027账面值，后续留存与分红桥接未闭合',multiple=f'稳态PB=(ROE−g)/(Ke−g)={pb:.3f}×；未校准历史分位',price=f'{mp:.2f}元（PB敏感性草案，未认证）' if mp else '[MISSING]',change=f'{(mp/p-1)*100:+.1f}%' if mp else '[MISSING]',trigger=f'下一份财报验证{t["watch"]}；该ROE/信用折价不是公司指引'))
  for k in [ke-.02,ke,ke+.02]:
   sens.append([k]+[(base_roe/100-g)/(k-g) for g in [0,.01,.02]])
  hurdle=p*(ke-.02);payout=hurdle/(bv*base_roe/100) if bv else None
  reverse=f'反向DDM：在Ke{ke:.0%}、长期分红增长2%的稳态假设下，首年普通股股息需P×(Ke−g)={hurdle:.2f}元；若正常ROE{base_roe}%、BVPS{num(bv)}成立，隐含派息率{num(None if payout is None else payout*100,"%") }。须受资本要求约束；与稳态PB共享假设，只是一致性检查，不算独立第二方法。'
  ratio='本轮不认证赔率；PB草案尚缺独立信用损失/资本分红验证及2027普通股账面桥接，撤回旧自动PE目标价与2:1区间。'
  model.update(method='普通股稳态PB敏感性+反向DDM一致性检查（非独立认证）',bvps=bv,scenarios=[dict(name=x[0],roe=x[1],g=x[2],ke=x[3],bookHaircut=x[4],price=ps[i]) for i,x in enumerate(definitions)],pbSensitivity=sens,independentMethodsClosed=False)
  method='普通股ROE/PB、信用成本与资本分红约束；第二条独立证据须为贷款质量、信用损失与资本释放分析，尚未闭合。'
 elif insurance:
  method='P/EV或分业务SOTP，以NBV、营运利润、要求资本和财产险承保回报交叉验证；GAAP投资收益型PE不能单独定价。'
  reverse='EV精算假设、分部价值及股东资本分配与完全摊薄股数仍待桥接；没有两个独立可核模型，不生成保险目标价。'
 elif property:
  method='项目/资产折价NAV＋持有物业租金DCF/SOTP；优先穿透现金限制、债务、少数股东及履约义务。账面权益不是清算NAV。'
  reverse='合并资产/负债之外，项目回收折价、受限现金、债务优先级、少数权益和租金现金流[MISSING]；NAV与SOTP未闭合，不生成地产目标价。'
 elif financial or leasing:
  method='券商/控股：正常ROE/PB或业务SOTP＋正常盈利PE/可分配现金DDM；信托/租赁须先核资产减值、资本与融资约束。'
  reverse='经纪、投行、自营、信用业务及资管的正常盈利分拆和风险资本[MISSING]；控股/租赁需穿透子公司现金与负债。未闭合两个独立模型，不生成目标价。'
 else:
  method='正常化盈利/中周期PE或SOTP＋股权现金流DCF；半年利润不能机械乘二，营收增长不能直接替代EPS增长。'
  capital=p*shares;g=.03 if sub in ['港口','公路','铁路','机场','港口公路'] else .05;ke=.16 if core is not None and core<=0 else .14
  fac,tvshare=factor(ke,g,.02);required=capital/fac
  reverse=f'反向股权DCF：全部参考股数按A股价计算的等价权益值{yi(capital)}，假设Ke{ke:.0%}、前五年现金增长{g:.0%}、永续增长2%，首年可分配股权现金要求{yi(required)}，终值占比{tvshare:.1%}。这是现价要求值，不是预测现金/认证估值；A/H/B混合股数乘A价不等于各市场市值之和。'
  sens=[]
  for k in [ke-.02,ke,ke+.02]:sens.append([k]+[capital/factor(k,g,z)[0] for z in [.01,.02,.03]])
  model.update(method='正常化盈利模型待输入；反向股权DCF要求值（非价格模型）',ke=ke,fiveYearCashGrowth=g,terminalGrowth=.02,requiredFirstCash=required,terminalShare=tvshare,cashSensitivity=sens,independentMethodsClosed=False)
 if not bank:
  ratio='[MISSING]：没有闭合的独立悲观/基准价格，不计算赔率；撤回旧自动目标价、±5%区间和固定仓位。'
  for name,state in [('悲观',f'{t["risk"]}兑现；对受影响业务的价格、销量/周转、信用损失和现金占用做压力测试'),('基准',f'{t["driver"]}维持；下一份报告验证{t["watch"]}，只纳入已商业化利润'),('乐观',f'{t["driver"]}改善且{t["watch"]}同时兑现；新增盈利须有回款或资本分红能力支持')]:
   scenario.append(dict(name=name,prob='[MISSING]（未赋概率）',assumption=state,multiple='[MISSING]：正常化利润/现金或NAV/EV桥接未闭合',price='[MISSING]（经营情景，尚非数值估值）',change='[MISSING]',trigger=f'2027-12-31前用后续财报检验；{t["watch"]}为主要验证项'))
  model.update(method=model['method'] or method,missing=['独立双方法未闭合','正常化盈利/完整股东现金/资产价值','完全摊薄股数或2027账面值','可核悲观和基准价格'])
 if bank:riskcondition=f'下一份披露如不良较2026H1上升≥0.20个百分点或核心一级资本下降≥1个百分点（研究触发阈值，非监管线），重做信用折价；即使不触发，也检查{t["watch"]}。'
 elif insurance:riskcondition=f'未来两次公开业绩/偿付能力披露：NBV同比转负、产险综合成本率≥100%或偿付能力显著下降时重做分部模型；以公司实际披露的适用指标为准，检查{t["watch"]}。'
 elif property:riskcondition=f'下一次月度/季度债务或经营公告：新增逾期、重大展期或受限现金上升时先重做债务瀑布；{t["watch"]}未改善，不上调NAV回收率。'
 else:riskcondition=f'未来两份季度财报：若扣非同比转负/亏损扩大且回款未改善，撤回盈利改善论点；重点验证{t["watch"]}，不以单季OCF波动直接判业务失效。'
 missing=MISSING+' 尚未核实历史倍数分位、逐项投资/公允价值/减值桥接，不能宣称估值已校准。'
 revision='保留：主体、分类与具有原件支持的历史财务事实。调整：采用2026H1累计合并口径、公司专属盈利驱动与股本/信用事项。撤回：未完成独立模型和股本桥接的旧评级、自动PE/PEG情景价、历史收盘认证、2:1门槛及固定仓位。旧页原样保存在previous.json，不删除证据。'
 headline=f'{rating}：{t["driver"]}；{t["risk"]}。'+('普通股PB草案仍待信用与资本验证。' if bank else '关键估值输入未闭合，旧价格区间已撤回。')
 metrics=[('研究复核','2026-10-07；2026H1原件定位与财务结构化复核，非认证深度估值'),('价格锚点',price),('2026H1收入 / 同比',f'{yi(revenue)} / {growth(c,"revenue")}'),('2026H1归母 / 扣非',f'{yi(net)} / {yi(core)}'),('2026H1扣非同比',growth(c,'core')),('H1基本 / 稀释EPS',f'{num(val(c,"eps"))} / {num(val(c,"dilutedEps"))}元；累计，非TTM'),('2026-06-30归母权益',yi(equity)),('原件加权ROE',f'{num(val(c,"roe"),"%")}；年化以报告注释为准，不能跨公司直接排名'),('非经常损益净桥接',f'{yi(gap)}；归母−扣非，非完整项目明细'),('现金流口径',cashnote),('参考股本',sharetext),('适用估值方法',method),('第二方法与现价反推',reverse),('估值认证','未认证；暂不认定可交易研究区间')]
 if bank:metrics += [('普通股每股净资产',num(val(c,'bvps'),'元；原件披露，非归母总权益/普通股数')),('信用与资本',f'不良{num(npl,"%")}；拨备覆盖{num(val(c,"coverage"),"%")}；核心一级资本{num(val(c,"cet1"),"%")}；净息差/净利息收益率{num(val(c,"nim"),"%")}（披露口径）')]
 metrics += [('原件专项核读',n) for n in evt]
 thesis=[f'产业论点（判断）：{t["driver"]}',profitnote,cashnote,reverse,f'产业视角（2026–2027，条件偏多）：{t["driver"]}；反证为{t["risk"]}。',f'财报视角（未来两季，观望）：{cashnote}；失效/升级证据：{t["watch"]}。',f'估值视角（至2027年底，观望）：{method}；失效：无法形成可复核悲观/基准价。','共识：业务机会必须兑现为股东可获得的正常盈利和现金。分歧：产业改善是否足以抵消资本占用、信用/周期及当前价格要求。单模型多视角复核，没有独立专家参与。']
 pros=[f'潜在优势（判断，待经营数据验证）：{t["driver"]}'];cons=[t['risk'],cashnote,'盈利、现金或资产价值的独立模型尚未闭合，不能据产业逻辑给买入评级。']
 industry=[f'需求/客户/资产结构传导（研究判断）：{t["driver"]}',f'周期与竞争传导：{t["risk"]}',f'行业方向必须传导至{t["watch"]}，政策/订单不直接等同收入与利润。']
 segments=[dict(name=sub+'（研究分组，非会计分部）',share='[MISSING]',note=f'{t["driver"]}；收入/利润分部占比尚未核对，禁止按名称推算占比。')]
 discipline=dict(zone='[MISSING]：双方法、信用/现金及股本未闭合，不保留旧机械买入区。',add=f'研究升级：{t["watch"]}连续两次披露改善，并闭合独立估值方法及股本。',trim=f'研究降级：{t["risk"]}兑现或正常化盈利/资产回收假设下修。',invalid=riskcondition,position='未提供个人仓位比例；价格草案不作为交易指令。')
 bullBear=dict(bull=t['driver'],bear=f'对多头的回应：{t["risk"]}；盈利机会仍须通过{t["watch"]}与现金/资本检验。',verdict=f'{rating}；先补证据再判断价格，本轮单模型多视角复核。')
 pitfalls=['[STALE]：财务截止2026-06-30，距研究日超过90天；本轮定位到的最新正式半年报不代表10月即时财务状态。',profitnote,cashnote,sharetext,eventnote,missing,revision]
 calendar=[f'下一份季度/中期/年度报告（确切日期待公告）：{t["watch"]}。','未来两次披露：检查信用/回款及融资、回购注销、送转、除息；每股/含息口径变化时重算。','2027-12-31：检验正常化盈利或资产价值，随后仍须检查增长能否持续。']
 ai=f'AI为非核心变量；除非能够量化其对{t["watch"]}、收入、成本或资本开支的影响，否则不给额外倍数。'
 profile=f'{r["name"]}（{c}，沪深，人民币），网站分类{s}，本轮研究分组{sub}。{profitnote} {" ".join(evt)}'
 patch=dict(name=r['name'],batch=f'2026-10-07·{s}复核',rating=rating,headline=headline,asOf=f'研究2026-10-07；财务2026H1累计合并中国会计准则 [STALE]；数据取自报告原件结构化抽取，附物理页码及人工口径修正；{price}；本轮估值未认证。',profile=profile,certainty=certainty,duration='研究期限至2027-12-31；验证后续持续性，不将本期同比线性外推。',ratioNote=ratio,metrics=metrics,thesis=thesis,growth=[profitnote,f'增长质量：{t["driver"]}需拆量、价、结构、费用、投资/并购/信用影响；验证{t["watch"]}。'],moat=pros,pros=pros,cons=cons,industry=industry,segments=segments,scenarios=scenario,discipline=discipline,bullBear=bullBear,risk=[t['risk'],riskcondition,'信用、流动性、竞争、融资和摊薄压力可能超出悲观经营假设；悲观价不是最大损失保证。'],next=[f'下一份披露：{t["watch"]}',discipline['zone']],calendar=calendar,pitfalls=pitfalls,aiNote=ai,auto=False,reviewed=False)
 patches[c]=patch;models[c]=model
 # Fifteen modules, source tables retain physical PDF pages and exact input values.
 lines=[f'# {r["name"]}（{c}）｜{s}｜2026-10-07研究复核', '', '## 0. 头部信息',patch['asOf'],'',f'[2026半年度报告原件]({r["url"]})（披露{r["disclosureDate"]}；{r.get("sourceStatus","交易所/巨潮托管发行人原件")}；PDF共{r["pages"]}页）。','数据方法：原件全文文本提取、表格字段定位、币种/单位及比较期复核；不等同所有分部/脚注已完成逐项深度审计。人工修正记录与原始证据保存在input.json。PDF物理页码与印刷页码可能不同。',f'SHA-256：`{r["sha256"]}`','', '## 1. 公司简介',profile,'','## 2. 业务分布',segments[0]['note'],'','## 3. 优势与缺点','\n'.join('- '+x for x in pros+cons),'','## 4. 行业趋势','\n'.join('- '+x for x in industry),'','## 5. 结论卡',headline,f'确定性：{certainty}；{patch["duration"]}',ratio,'最大风险：'+t['risk'],'','PM七问（研究判断）：',f'1. 潜在误定价：{t["driver"]}能否被市场忽略，尚待同口径价值模型确认。',f'2. 价格反映什么：{reverse}',f'3. 证明论点：{t["watch"]}连续两次披露改善且现金/资本能够承受。',f'4. 推翻论点：{riskcondition}','5. 为什么现在：本轮用2026H1及已列明后续原件替换旧自动规则，研究时点不等于交易时点。','6. 什么改变评级：双模型闭合，信用/现金/股本桥接及公司专属指标改善。','7. 还缺什么：'+missing,'','## 6. 关键指标','|指标|数值与口径|','|---|---|']
 lines += [f'|{k}|{v.replace(chr(10)," ").replace("|","/") }|' for k,v in metrics]
 lines += ['', '财务字段原件定位（金额原单位换算为人民币元；比较期：流量2025H1，存量2025年末；不混为单季）：','|字段|本期原值（元/原披露比率）|比较期原值|单位乘数|PDF物理页|证据|','|---|---:|---:|---:|---:|---|']
 for k in ['revenue','net','core','ocf','equity','eps','dilutedEps','roe','bvps']+(['npl','coverage','cet1','nim'] if bank else ['cashStatementOcf','cashCapex'] if regular else []):
  x=f.get(k)
  if x:lines.append(f'|{k}|{x["value"]}|{x.get("prior")}|{x.get("unit")}|{x["page"]}|{x.get("evidence","").replace(chr(10)," ").replace("|","/")}|')
  else:lines.append(f'|{k}|[MISSING]|[MISSING]|—|—|未闭合字段，未按EPS/估值规则反推|')
 lines += ['','## 7. 增长与护城河','\n'.join(patch['growth']+pros),ai,'','## 8. 三情景估值',method,reverse,'|情景|经营与模型假设|倍数|价格|变动|触发|','|---|---|---|---|---|---|']
 for x in scenario:lines.append('|'+ '|'.join(x[k] for k in ['name','assumption','multiple','price','change','trigger'])+'|')
 lines += [ratio,'未赋概率；不将经营三情景冒充数值估值。缺输入时不会为了出目标价而假造盈利、倍数、NAV或EV。']
 if bank:
  lines += ['','普通股PB敏感性（纯假设，ROE不变；DDM与PB共享假设，不能当两个独立模型）：','|Ke|g=0%|g=1%|g=2%|','|---|---:|---:|---:|']+[f'|{x[0]:.0%}|'+ '|'.join(f'{z:.3f}×' for z in x[1:])+'|' for x in model['pbSensitivity']]
 if regular:
  lines += ['','反向股权DCF首年现金要求敏感性（亿元；不是目标价；前五年增长固定，现金要求从现价反推）：','|Ke|终端g=1%|g=2%|g=3%|','|---|---:|---:|---:|']+[f'|{x[0]:.0%}|'+ '|'.join(f'{z/1e8:.2f}' for z in x[1:])+'|' for x in model['cashSensitivity']]
  if model['terminalShare']>.75:lines.append('终值占比超过75%，模型高度依赖终值，不能用该假设认证安全边际。')
 lines += ['','## 9. 买入纪律','\n'.join(discipline.values()),'','## 10. 风险与证伪','\n'.join('- '+x for x in patch['risk']),'','## 11. 多空交锋与多视角复核',bullBear['bull'],bullBear['bear'],bullBear['verdict'],'\n'.join(thesis[4:]),'主持人裁决：行业机会与价格吸引力分别判断；不因多个模拟视角同意就认定估值已核实。','', '## 12. 口径陷阱与旧报告修订','\n'.join('- '+x for x in pitfalls),'','## 13. 验证日历','\n'.join('- '+x for x in calendar),'','后续公告原件（已留存完整PDF、页数及SHA-256；仅覆盖下列文件）：']
 for e in ev:lines.append(f'- [{e["title"]}]({e["url"]})，披露{e["date"]}；{e["pages"]}页；SHA-256 `{e["sha256"]}`。')
 lines += [eventnote,f'- [行情来源]({quotes[c]["url"]})：{price}；第三方行情非发行人/交易所原件。','- [本轮总览](index.md) · [结构化输入](input.json) · [原始旧页存档](previous.json) · [模型假设](models.json)','', '## 14. 免责声明',DISCLAIMER,'']
 (OUT/(c+'.md')).write_text('\n'.join(lines))
 audits.append(dict(code=c,name=r['name'],sector=s,subtype=sub,rating=rating,certified=False,numericDraft=bank,financialEnd='2026-06-30',stale=True,disclosureDate=r['disclosureDate'],url=r['url'],sha256=r['sha256'],pages=r['pages'],quoteTimestamp=ts,report=f'{c}.md',missingMainFields=[k for k in ['revenue','net','core','ocf','equity'] if not f.get(k)],independentValuationClosed=False))
# Save enriched in-loop regulatory corrections as reproducible public inputs.
(OUT/'input.json').write_text(json.dumps(dict(filings=list(facts.values()),quotes=quotes,notes=notes,events=events),ensure_ascii=False,indent=2))
(OUT/'models.json').write_text(json.dumps(models,ensure_ascii=False,indent=2))
(OUT/'audit.json').write_text(json.dumps(dict(date=DATE,counts={'金融':82,'房地产':9,'工业':179},total=270,numericBankDrafts=29,certifiedValuations=0,filingOriginals=270,eventOriginals=len(events),companies=audits),ensure_ascii=False,indent=2))
with (OUT/'summary.csv').open('w',newline='',encoding='utf-8-sig') as file:
 w=csv.writer(file);w.writerow(['代码','公司','分类','研究分组','评级','认证估值','收入元','归母元','扣非元','经营现金元','普通股BVPS','参考行情元','行情时点','报告'])
 for c in order:w.writerow([c,facts[c]['name'],facts[c]['sector'],focus[c]['subtype'],patches[c]['rating'],'未认证',val(c,'revenue'),val(c,'net'),val(c,'core'),val(c,'ocf'),val(c,'bvps'),quotes[c]['price'],quotes[c]['timestamp'],c+'.md'])
index=['# 沪深：金融、房地产、工业研究复核（2026-10-07）','','覆盖金融82、房地产9、工业179，共270家公司。270份2026H1财报原件与48份后续公告原件已留存。按55批、每批3–5家整理。','本轮交付为公司级事实与论点复核、估值研究初稿，**不是270份已认证深度估值**。29家银行给普通股PB敏感性草案，241家保留经营三情景、价格[MISSING]；0家闭合独立双模型。原件结构化字段有物理页码、单位及SHA-256，人工修正单独记载。','财务截止2026-06-30已超过90天，全部[STALE]；本轮定位的最新正式半年报仍须结合新公告。行情统一2026-09-30最后报价，不称交易所已确认收盘。', '', '金融采用普通股PB/ROE、EV/NBV/SOTP及资本约束；地产采用偿债、项目NAV/持有物业现金流；工业采用正常化/中周期盈利和股东现金，港口、工程建设、航空、光伏及军工按公司分组验证。', '旧自动PE/PEG目标价、未经核实的赔率、机械研究区间和个人固定仓位均已覆盖。保留[旧页存档](previous.json)。', '', '[审计清单](audit.json) · [财务输入与原件来源](input.json) · [模型假设](models.json) · [公司汇总CSV](summary.csv) · [公司专属研究焦点](focus.tsv)','','|分类|批次|公司|','|---|---:|---|']
for s,n,codes in batches:
 name=f'{SLUGS[s]}-batch-{n:02}.md';index.append(f'|{s}|[{n}]({name})|'+ '、'.join(f'{facts[c]["name"]}（{c}）' for c in codes)+'|')
 lines=[f'# {s}第{n}批｜2026-10-07', '', '每家公司按自己的业务模式使用方法；跨银行、保险、券商或跨工业子行业不使用统一PE或增长率评分。此批按证据任务分组，未认证投资收益排序。','','|公司|研究分组|收入同比|扣非同比|评级|优先核查|','|---|---|---|---|---|']
 for c in codes:lines.append(f'|[{facts[c]["name"]}（{c}）]({c}.md)|{focus[c]["subtype"]}|{growth(c,"revenue")}|{growth(c,"core")}|{patches[c]["rating"]}|{focus[c]["watch"]}|')
 lines += ['', '共同变量与陷阱：','金融：信用成本、要求资本、资产公允价值及分红能力；半年ROE年化口径不同。' if s=='金融' else '地产：资产折价、受限现金与债务优先级；OCF为正不是偿债安全。' if s=='房地产' else '工业：需求量价、回款、资本开支与正常利润；不同周转/会计模式的半年现金不能直接评分。','核查优先级（研究任务，非投资排序）：信用/上市主体变化优先，其次亏损与投资收益桥接，再查持续盈利的现金/资本回报。每家公司理由在报告0–14模块；没有闭合价位，不按旧目标回报排序。', '逐家公司下一步：']
 lines += [f'- {facts[c]["name"]}：{focus[c]["risk"]}；验证{focus[c]["watch"]}。' for c in codes]
 previous=f'{SLUGS[s]}-batch-{n-1:02}.md';following=f'{SLUGS[s]}-batch-{n+1:02}.md'
 lines += ['',f'前后批衔接：'+ (f'[上一批]({previous})' if n>1 else '本分类首批')+'；'+(f'[下一批]({following})' if any(bs==s and bn==n+1 for bs,bn,bc in batches) else '本分类末批，转入下一分类/公司证据补充')+'。同口径财务快照沿用，价格和评级不会因进入下一批被自动升级。','[总览](index.md)',DISCLAIMER]
 (OUT/name).write_text('\n'.join(lines)+'\n')
(OUT/'index.md').write_text('\n'.join(index)+'\n'+DISCLAIMER+'\n')
(OUT/'batches.json').write_text(json.dumps([dict(sector=s,batch=n,codes=codes) for s,n,codes in batches],ensure_ascii=False,indent=2))
module="// Dated company-level review; no certified valuations. Generated by scripts/review-cn-finance-property-industrial-2026-10-07.py.\nimport type { Company } from '../companies'\n\nexport const cnFinancePropertyIndustrialResearch: Record<string, Partial<Company>> = "+json.dumps(patches,ensure_ascii=False,indent=2)+'\n'
(ROOT/'src/data/details/cnFinancePropertyIndustrialResearch.ts').write_text(module)
print('Rendered',len(patches),'company reports;',len(batches),'batches; 29 bank PB drafts; 0 certified valuations.')
