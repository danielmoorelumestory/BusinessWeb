"""Render 127 company-specific evidence reviews; missing valuation stays missing.

Inputs: manually reviewed notes/focus, dated Yahoo snapshots and HKEX originals.
No revenue-to-EPS extrapolation and no uniform PE ranking.
"""
import json, csv, math, re, html
from pathlib import Path
from datetime import datetime, timezone, timedelta
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'public/research/hk-2026-10-07';LOCAL=ROOT/'.local/hk-2026-10-07'
DATE='2026-10-07';HKT=timezone(timedelta(hours=8))
old=json.loads((OUT/'previous.json').read_text())['companies'];order=[c['code'] for c in old]
def tsv(name):return {a[0]:a[1:] for a in (line.split('|') for line in (OUT/name).read_text().splitlines() if line)}
focus=tsv('focus.tsv');notes=tsv('notes.tsv')
if (LOCAL/'evidence.json').exists():
 evidence=json.loads((LOCAL/'evidence.json').read_text())
 quotes={}
 for path in ROOT.glob('.local/hk-yf*.json'):quotes.update(json.loads(path.read_text())['results'])
 fx=json.loads((ROOT/'.local/hk-fx.json').read_text())['results']
else:
 cached=json.loads((OUT/'input.json').read_text());evidence=cached['filings'];quotes=cached['quotes'];fx=cached['fx']
by={r['code']:r for r in evidence}
assert len(order)==len(set(order))==127 and set(order)==set(focus)==set(notes)==set(by)
assert all(q.get('currency')=='HKD' for q in quotes.values())
assert all(not by[c]['errors'] and by[c]['documents'] for c in order)
quote_keys=['symbol','longName','regularMarketPrice','regularMarketTime','marketState','currency','exchangeDataDelayedBy','fiftyTwoWeekLow','fiftyTwoWeekHigh','trailingPE','forwardPE','trailingEps','forwardEps','priceToBook','priceToSalesTrailing12Months','dividendYield','financialCurrency','mostRecentQuarter','totalRevenue','operatingCashflow','freeCashflow','returnOnEquity','grossMargins','operatingMargins','totalCash','totalDebt','sharesOutstanding']
quotes={k:{a:v for a,v in q.items() if a in quote_keys} for k,q in quotes.items()}
# Publish only compact financial evidence; the complete text and PDFs stay local.
sources=[]
for r in evidence:
 row={k:v for k,v in r.items() if k!='documents'};row['documents']=[]
 for d in r['documents']:
  hits=d.get('hits',d.get('evidenceRows',[]));seen=set();selected=[]
  for h in hits:
   line=h['line']
   if line in seen or not re.search(r'\d',line):continue
   seen.add(line);selected.append(dict(page=h['page'],line=' '.join(line.split())[:220]))
   if len(selected)==3:break
  row['documents'].append({**{k:v for k,v in d.items() if k not in ('hits','evidenceRows')},'evidenceRows':selected})
 sources.append(row)
fx={k:{a:v for a,v in q.items() if a in ['regularMarketPrice','regularMarketTime','symbol','currency']} for k,q in fx.items()}
(OUT/'input.json').write_text(json.dumps(dict(researchDate=DATE,filings=sources,quotes=quotes,fx=fx),ensure_ascii=False,indent=2))
rate=fx['CNYHKD=X']['regularMarketPrice']
priority=['00669','01299','00700','00388','02020','06618','01801','02359','09999','03968','01209','00268','06160','02269']
watchloss={'01958','02015','02238','09866','09868'}
bv={'00939':(13.69,9,10),'01288':(8.17,12,10),'01398':(11.12,4,10),'01658':(8.71,13,9),'03328':(13.22,2,8),'03968':(45.40,7,13),'03988':(8.54,11,9)}
GROUPS={'银行':'金融','保险':'金融','其他金融':'金融','地产':'地产与综合控股','房地产投资信托':'地产与综合控股','综合企业':'地产与综合控股','公用事业':'公用事业与电讯','电讯':'公用事业与电讯','汽车':'汽车','石油及天然气':'资源能源','煤炭':'资源能源','一般金属及矿石':'资源能源','黄金及贵金属':'资源能源','药品及生物科技':'医疗','医疗保健':'医疗','半导体':'科技与内容','资讯科技器材':'科技与内容','软件服务':'科技与内容','媒体及娱乐':'科技与内容','工业工程':'工业运输','建筑':'工业运输','工用运输':'工业运输','工用支援':'工业运输'}
families={c['code']:GROUPS.get(c['sector'],'消费与服务') for c in old}
batches=[]
for group in dict.fromkeys(families.values()):
 codes=[c for c in order if families[c]==group];n=0
 while codes:
  size=3 if len(codes)==6 else 4 if len(codes)==7 else min(5,len(codes));part=codes[:size];codes=codes[size:];n+=1
  assert 3<=len(part)<=5
  batches.append(dict(id=f'batch-{len(batches)+1:02}',family=group,number=n,codes=part))
batchof={c:b for b in batches for c in b['codes']}
DISCLAIMER='本报告仅供研究参考，不构成个人投资建议。'
missing='正常化TTM及逐项一次性损益桥接、2027同口径盈利/现金流、完全摊薄股本及后续除权除息闭合、历史倍数分位、独立第二估值方法、完整分部占比及ROIC [MISSING]。'
def stamp(epoch):return datetime.fromtimestamp(epoch,HKT).strftime('%Y-%m-%d %H:%M:%S HKT')
def qnum(q,k,suffix=''):
 v=q.get(k);return '[MISSING]' if v is None else f'{v:g}{suffix}'
def method(c,sub):
 if sub=='银行':return '普通股ROE驱动PB / 剩余收益模型；独立股息贴现校验，先扣优先股与永续债权益'
 if c=='00823':return '可分派收入贴现 / AFFO收益率；独立NAV及租金资本化校验'
 if sub in ['寿险','寿险财险','保险综合']:return 'EV/NBV或分部SOTP；独立营运利润与可汇回自由盈余校验'
 if sub=='财险科技':return '承保利润与科技业务SOTP；独立普通股ROE/PB及资本约束校验'
 if sub=='券商':return '中周期普通股ROE/PB与业务SOTP；独立可分派盈利校验'
 if sub in ['香港地产','内地地产','商业地产','综合地产','轨道地产','综合控股']:return '分部NAV/SOTP；独立持续租金、基础经营或可分派股息贴现，债务逐项扣除'
 if sub in ['集装箱航运','铝业','煤炭','煤炭综合','锂资源','油气炼化','上游油气','综合油气','水泥','建材','玻璃','光伏玻璃','铜金矿业']:return '中周期盈利或分部NAV；独立价格/成本/资本开支压力下的现金流贴现'
 if sub in ['创新药','医药综合']:return '上市产品DCF及管线rNPV/SOTP；独立持续产品盈利校验，许可费单列'
 if c in watchloss:return '分部经营转盈与现金跑道情景；独立净现金/SOTP，暂不采用亏损EPS×PE'
 return '正常化EPS×公司适用倍数；独立FCFE/DCF或业务SOTP，租赁本金与股份支付单列'
records=[];models={};patches={}
for prior in old:
 c=prior['code'];name=prior['name'];sub,driver,risk,watch=focus[c];pages,fact,judgment=notes[c];r=by[c];d=r['documents'][0]
 q=quotes[c[1:]+'.HK'];p=q['regularMarketPrice'];timestamp=stamp(q['regularMarketTime'])
 assert timestamp.startswith(DATE), (c,timestamp)
 price=f'HK${p:g}（{timestamp}，Yahoo Finance延迟盘中快照，非交易所认证收盘价）'
 source=f'[{html.unescape(d["title"]).replace(chr(10)," ")}，PDF物理页{pages}]({d["url"]})'
 sourceplain=f'{d["url"]}（PDF物理页{pages}；披露{d["date"]}）'
 period='截至2026-06-30的半年；部分事实单列Q2'
 if c in ['00241','01929','00823']:period='截至2026-03-31的全年'
 elif c=='00016':period='截至2026-06-30的全年'
 elif c=='01797':period='截至2026-05-31的全年'
 elif c in ['00992','09988']:period='截至2026-06-30的财季；非自然半年'
 date_end='2026-03-31' if c in ['00241','01929','00823'] else '2026-05-31' if c=='01797' else '2026-06-30'
 stale=(datetime.fromisoformat(DATE)-datetime.fromisoformat(date_end)).days
 age=f'[STALE] 报告期末距研究日{stale}天；本轮取得的最新业绩，非声称报告已过期。披露{d["date"]}；后续公告不等于新财报。'
 meth=method(c,sub);rating='等待证据' if c in watchloss else '观察'
 thesis=[f'判断：研究重点是{driver}，需验证能否提高持续盈利而非只扩大收入。',f'事实：{fact}',f'判断：{judgment}']
 scenario=[];model=dict(certified=False,independentMethodsClosed=False,method=meth,price=p,quoteTime=timestamp,numericDraft=False)
 ratio='[MISSING]（未取得经公司核验的Base和Bear；本轮不认证旧赔率，不能据此判断达到2:1）'
 zone='[MISSING]（旧买入区撤回；完成两种独立估值及下行压力后再计算条件化研究价，不套固定±5%）'
 extra=[]
 if c in bv:
  value,pn,roe=bv[c];model.update(numericDraft=True,bvpsCny=value,bvpsPage=pn,fx=rate,source=d['url'],valuationType='普通股PB敏感性，独立DDM尚缺',assumedBaseRoe=roe)
  prices=[];definitions=[('悲观',max(4,roe-4)/100,0,.14,.15),('基准',roe/100,.02,.12,.05),('乐观',(roe+2)/100,.03,.11,0)]
  for n,rr,g,k,h in definitions:
   multiple=(rr-g)/(k-g);v=value*rate*(1-h)*multiple;prices.append(v)
   scenario.append(dict(name=n,prob='未赋概率',assumption=f'研究假设：2027普通股ROE{rr:.0%}、长期g{g:.0%}、Ke{k:.0%}、普通股账面减值{h:.0%}；以H1普通股BVPS人民币{value:g}元×即期CNY/HKD {rate:g}暂代预测账面值，留存/派息/信用桥接未闭合',multiple=f'稳态PB=(ROE−g)/(Ke−g)={multiple:.3f}×，未校准历史分位',price=f'HK${v:.2f}（敏感性草案）',change=f'{(v/p-1)*100:+.1f}%',trigger=f'下一财报验证{watch}；未满足模型ROE或信用折价时重估'))
  bear,base,bull=prices;model.update(bear=bear,base=base,bull=bull,definitions=[dict(name=n,roe=rr,g=g,ke=k,haircut=h) for n,rr,g,k,h in definitions]);model['sensitivity']=[[k,g,value*rate*.95*(roe/100-g)/(k-g)] for k in [.10,.12,.14] for g in [0,.02,.03]]
  extra.append(f'原件普通股BVPS：人民币{value:g}元（第{pn}页，已排除其他权益工具）；按即期外汇折算HK${value*rate:.4f}，价格/该参考净资产={(p/(value*rate)):.3f}×。这是H1账面与当前价的参考PB，非有形净资产或2027预测。')
 elif c=='00823':
  model.update(numericDraft=True,independentMethodsClosed=False,valuationType='分派贴现与NAV双方法敏感性，AFFO/资本开支和后续调整未闭合',dpu=2.5361,nav=57.75,source=d['url']);prices=[];defs=[]
  for n,dpu,k,g,navshock,mult in [('悲观',2.4,.09,0,-.2,.65),('基准',2.5361,.08,.01,-.05,.75),('乐观',2.7,.07,.02,.02,.85)]:
   ddm=dpu*(1+g)/(k-g);nav=57.75*(1+navshock)*mult;v=min(ddm,nav);prices.append(v)
   defs.append(dict(name=n,dpu=dpu,ke=k,g=g,navShock=navshock,navMultiple=mult,ddm=ddm,navValue=nav,conservativeLower=v))
   scenario.append(dict(name=n,prob='未赋概率',assumption=f'研究假设：未来一年DPU HK${dpu:g}，Ke{k:.0%}、长期g{g:.0%}；H1前最新全年NAV HK$57.75×重估变动{navshock:+.0%}×折价倍数{mult:g}，两方法取较低值',multiple=f'DDM HK${ddm:.2f}；NAV HK${nav:.2f}',price=f'HK${v:.2f}（敏感性草案）',change=f'{(v/p-1)*100:+.1f}%',trigger='下一报告核验DPU、续租、出租率、借款与可分派收入现金覆盖'))
  bear,base,bull=prices;model.update(bear=bear,base=base,bull=bull,definitions=defs,sensitivity=[[k,g,2.5361*(1+g)/(k-g)] for k in [.07,.08,.09] for g in [0,.01,.02]])
  extra.append('分派贴现V=DPU₁/(Ke−g)，终值依赖100%：本模型完全取决于长期租金、融资成本和可分派现金假设，NAV也是对未来租金敏感的资产评估值；不将两者视作无风险独立证据。实际AFFO和维修资本支出仍[MISSING]。')
 else:
  for n in ['悲观','基准','乐观']:
   state={'悲观':f'{risk}兑现，持续利润/现金下修；需信用、流动性和摊薄压力测试','基准':f'{driver}兑现且成本和资金占用可控；经营路径尚不等于估值输入','乐观':f'{driver}改善并伴随{watch}超预期；需可持续利润支持，不能外推收入增速'}[n]
   scenario.append(dict(name=n,prob='未赋概率',assumption=f'研究假设（2026-10至2027年底）：{state}。正常化盈利、现金流、资本成本或适用估值输入[MISSING]',multiple=meth+'；关键数值[MISSING]',price='[MISSING]（撤回旧情景价格）',change='[MISSING]',trigger=f'下一财报及经营更新检查{watch}'))
 if model['numericDraft']:
  if bear<p<base:ratio=f'敏感性草案算术R=({base:.4f}−{p:g})/({p:g}−{bear:.4f})={(base-p)/(p-bear):.2f}:1；未完成独立方法和压力检验，不认证可交易赔率。'
  elif p>=base:ratio=f'盘中价格HK${p:g}≥草案Base HK${base:.2f}，该草案基准上行不足；不报正向2:1赔率，模型未认证。'
  else:ratio=f'盘中价格HK${p:g}≤草案Bear HK${bear:.2f}，分母无效，需重建下行，不能报无穷赔率。'
  model['threshold2']=(base+2*bear)/3
  extra.append(f'理论R=2门槛P*=(Base+2×Bear)/3=HK${model["threshold2"]:.4f}，只说明假设下的算术，不是买入区；悲观价不是最大损失保证。')
 invalid=[f'经营证伪（研究假设）：下一份可比报告中，{watch}所涉及的主营利润同比≤0或相关毛利率同比下滑≥2个百分点时，撤回盈利上行假设；一次性项目先桥接。',f'现金证伪（研究假设）：未来两份报告中，持续经营现金不足覆盖维持性投入、债务利息和已承诺分派，需下修估值；银行保险券商改核资本充足/偿付能力及可汇回资金。',f'资本/信用证伪（研究假设）：后续公告出现新增融资或股本摊薄≥10%、债务违约或重大减值时即重估，不能机械沿用每股价位。',f'最大反证：{risk}；若{driver}改善而对应主营利润和现金没有改善，增长论点不成立。']
 pp=[missing,age,f'盈利质量：{judgment}',f'数据层级：价格/估值快照来自Yahoo二手字段；财务核读来自公司港交所原件。来源{sourceplain}。',f'最新业绩检索覆盖2026-01-01至研究日，返回{r.get("titleCount")}条；hasNextRow={r.get("hasNextRow")}。事件标题仅定位；只有单列原件被读，不能声称全部后续事件闭合。','股数纪律：已取得月报者仅证明原件可访问，普通/加权/摊薄股数及月报全部类别逐项桥接仍[MISSING]。未取得月报者不宣称股本不变。']
 if sub in ['银行','寿险','寿险财险','保险综合','财险科技','券商']:cashnote='金融现金流受客户存贷、保费、投资及交易资产影响；禁止把金融OCF−资本开支机械当FCFE，金融负债率不与工业公司直接比较。'
 elif sub in ['香港地产','内地地产','商业地产','综合地产','轨道地产']:cashnote='物业重估、预售回款、交付与土地支出分列；经营现金不等于可自由支配现金，受限资金及项目债务桥接[MISSING]。'
 else:cashnote='经营现金≠FCF；购建资产、并购、租赁本金、股权激励及营运资金分别桥接，同期和本期均须同口径。'
 pp.append(cashnote)
 if c=='09866':pp.append('9月28日换电充电交易原件已读：吉利以资产及6.40亿元现金认购，交割后预期持股30%，估值约160亿元人民币；交割、业绩调整及后续选择权有条件。不能把160亿估值当全部流入上市公司现金。')
 if c=='09961':pp.append('7月27日处罚原件与Q2费用桥接已读：没收所得16.58亿+罚款35.21亿，另退款1.22亿；剔除当期处罚并不删除对商业模式及现金的长期影响。')
 metrics=[('价格锚点',price),('52周区间',f'HK${qnum(q,"fiftyTwoWeekLow")}–HK${qnum(q,"fiftyTwoWeekHigh")}（Yahoo截至该快照的52周统计，未以逐日数据独立复算）'),('原件财务核读',fact+'；'+sourceplain),('研究复核',judgment),('财报期',period+'；'+age),('TTM PE / 动态PE / PB / PS',f'Yahoo供应商字段 {qnum(q,"trailingPE","×")} / {qnum(q,"forwardPE","×")} / {qnum(q,"priceToBook","×")} / {qnum(q,"priceToSalesTrailing12Months","×")}；二手定位，尚未逐项复算TTM/预测及币种换算；不作为研究模型或排名'),('现金流口径',cashnote),('其他关键指标','PEG、ROIC、同口径TTM EPS、正常化FCF和净杠杆 [MISSING]；原件中可确认数字见财务核读，不以Yahoo拼接多个报告期'),('两种估值方法',meth),('Base / Bear 赔率',ratio),('本轮研究日期',DATE+'；公司级事实复核，估值未认证')]
 metrics.append(('行情与外汇来源',f'https://finance.yahoo.com/quote/{c[1:]}.HK/ ；CNY/HKD {rate:g}（{stamp(fx["CNYHKD=X"]["regularMarketTime"])}）：https://finance.yahoo.com/quote/CNYHKD=X/ ；快照来源与时点见input.json'))
 metrics.extend(('估值专项核读',v) for v in extra)
 segs=[]
 for seg in prior.get('segments',[])[:3]:segs.append(dict(name=seg['name'],share='[MISSING]',note='沿用旧业务分类作为待核分部，当前收入/利润占比未逐项核读，不认证旧占比'))
 while len(segs)<3:segs.append(dict(name=['主要经营业务','其他业务/投资','区域/产品补充拆分'][len(segs)],share='[MISSING]',note='正式会计分部及占比待核，不将此占位项当实际独立分部'))
 if c=='00388':segs=[dict(name=n,share=f'{v/13980:.2%}',note=f'H1营业收入{v}百万港元，占营业收入13980百万；不含净投资收益，非利润占比；原件第2页') for n,v in [('交易收费',5991),('结算收费',4349),('上市费',1051)]]
 if c=='00027':segs=[dict(name='澳门银河与其他博彩娱乐业务',share='[MISSING]',note='集团博彩资产以本轮公告为准；移除旧简介误列的澳门巴黎人（非本集团资产）'),*segs[1:]]
 certainty='低（持续盈利/现金和估值尚未闭合）' if rating=='等待证据' else '中（已核读经营事实）；估值确定性低，未认证'
 profile=f'{name}，港股{c}，本轮以{r["stock"]["n"]}及公司公告核对上市主体。研究业务为{sub}，赚钱能力重点看{driver}。{fact} 主要研究判断：{judgment}'
 prospect=[f'研究假设：{driver}是2027盈利路径，而非已验证到2027年底的公司指引。',f'最大约束：{risk}，会影响收入到利润、利润到现金的转换。',f'下期验证：{watch}；先比较同口径再决定是否提高评级。']
 bull=f'多头假设：{driver}若改善且可以转化持续利润和现金，经营质地可支持进一步估值研究。现有原件证据：{fact}'
 beartext=f'空头回应多头：{judgment} 因此{driver}的叙事不等于2027盈利；{risk}还可能令下行超出旧Bear。'
 verdict=f'{rating}；经营事实已经补证，定价依据仍不闭合。'+ratio
 discipline=dict(zone=zone,add=f'条件化研究：下份报告验证{watch}、主营利润与现金同时改善，并完成两方法估值且R≥2，才重评；仅价格突破不构成证据。',trim='条件化研究：若新证据使盈利路径下修、信用压力上升或已验证的估值安全边际消失，重评；没有认证乐观价，不保留旧止盈价。',invalid=invalid[0],position='本轮只作公司研究；不默认指定个人仓位，也不采用旧统一3%/5%或永不空仓规则。')
 cal=[f'下一财报/董事会日期：待公司公告；下一份经营更新核对{watch}。',f'研究期限：{DATE}至2027年底；最新全年/半年之后的同比和现金转换需继续验证。','股本、除权除息、重大融资/资产交易公告出现时立即重新核对每股模型。']
 ai='AI为可量化收入变量，但利润与投入须分列' if c in ['00268','00700','00992','00981','09888','09988','01810','09698'] else 'AI为非核心变量；未核得公司特有收入/利润/资本开支桥接，不作为评级理由。'
 patch=dict(rating=rating,headline=f'{rating}（事实已复核，估值待证）：{judgment}',metrics=metrics,thesis=thesis,risk=invalid,next=cal,asOf=f'研究{DATE}；{period}；{timestamp}延迟盘中价；{sourceplain}；单模型多视角复核。',certainty=certainty,duration=f'研究至2027年底；{driver}持续性待下一报告验证，不将H1/Q2增速当2027指引。',moat=[f'待验证护城河：{driver}对应的客户、品牌、渠道或成本优势须用{watch}核验；缺市占与回报序列，不认证强护城河。'],growth=prospect,scenarios=scenario,ratioNote=ratio,discipline=discipline,bullBear=dict(bull=bull,bear=beartext,verdict=verdict),pitfalls=pp,calendar=cal,aiNote=ai,profile=profile,segments=segs,pros=[f'证据可追溯：{fact}',f'研究优势候选：{driver}；商业优势仍须对应持续利润。'],cons=[judgment,f'主要下行来源：{risk}',missing],industry=prospect,auto=False,reviewed=True,researchReport=f'research/hk-2026-10-07/{c}.html',batch=f'{batchof[c]["id"]} · {families[c]} · 2026-10-07')
 patches[c]=patch;models[c]=model
 text=f'# {name}（{c}）公司研究 · {DATE}\n\n[总览](index.html) · [所属批次]({batchof[c]["id"]}.html)\n\n'
 def section(n,title,body):return f'## {n} · {title}\n\n{body}\n\n'
 def bullets(items):return '\n'.join('- '+s for s in items)
 text+=section(0,'头部信息',f'港股 / {c} / 港元交易；研究日期{DATE}；价格锚点{price}；财报期{period}。\n\n主要来源：{source}。\n\n研究状态：公司级事实复核与模型待建；15模块结构不代表全部数值和深度研究认证已完成。')
 text+=section(1,'公司简介',profile)
 text+=section(2,'业务分布','| 分部 | 占比 | 口径 |\n|---|---|---|\n'+'\n'.join(f'| {s["name"]} | {s["share"]} | {s["note"]} |' for s in segs)+'\n\n利润集中度：[MISSING]；没有以收入占比冒充利润占比。')
 text+=section(3,'优势与缺点',bullets(['优势证据：'+fact,'优势候选（判断）：'+driver,'缺点/限制：'+judgment,'最大风险：'+risk,missing]))
 text+=section(4,'行业趋势',bullets(prospect))
 text+=section(5,'结论卡',f'**{rating}**。{judgment}\n\n盈亏比：{ratio}\n\n确定性：{certainty}；期限：至2027年底，后续持续性待证。最大风险：{risk}。')
 text+=section(6,'关键指标','| 指标 | 数据与口径 |\n|---|---|\n'+'\n'.join(f'| {k} | {v} |' for k,v in metrics)+f'\n\n原件页码与财务摘要对应：{source}。所有供应商字段为二手数据，日期仅指取得快照；财务报告期与会计口径未全部复算。')
 text+=section(7,'增长与护城河',bullets(thesis+[patch['moat'][0],ai]))
 text+=section(8,'三情景及下行检验','方法：'+meth+'。\n\n| 情景 | 盈利/现金/资本假设 | 估值输入 | 隐含价 | 对快照上下行 | 触发与证伪 |\n|---|---|---|---|---|---|\n'+'\n'.join(f'| {s["name"]} | {s["assumption"]} | {s["multiple"]} | {s["price"]} | {s["change"]} | {s["trigger"]} |' for s in scenario)+f'\n\n{ratio}\n\n概率未赋值；不计算概率加权收益或宣称回测胜率。分红、时间成本、费用及税项未计入价差比。'+('\n\n'+bullets(extra) if extra else '')+'\n\n独立方法核验、股本与所有后续融资/信用压力仍未闭合；未做完整数值DCF，不伪造WACC、终值或敏感性矩阵。')
 if model.get('sensitivity'):
  text+='### 数值敏感性（假设，未认证）\n\n| Ke | 长期g | 基准其他输入下的价值（港元） |\n|---|---|---|\n'+'\n'.join(f'| {k:.0%} | {g:.0%} | {v:.2f} |' for k,g,v in model['sensitivity'])+'\n\n'
 labels={'zone':'条件价格','add':'确认条件','trim':'减仓/止盈研究条件','invalid':'失效条件','position':'仓位原则'}
 text+=section(9,'条件化研究纪律',bullets([labels[k]+'：'+v for k,v in discipline.items()]))
 text+=section(10,'风险与证伪',bullets(invalid))
 perspectives=[f'产业视角：观望，2026–2027；证据{fact}；关注{driver}，最大反证{risk}，失效见经营证伪线。',f'财报视角：观望，下一份报告；证据{judgment}；核对{watch}及一次性/现金桥接，现金证伪出现即撤回质量判断。',f'估值视角：观望，至2027年底；采用{meth}，独立输入未闭合，不认证旧价格区间；资本/信用证伪出现即重估。',f'逆向视角：观望，12–18个月；只有{driver}兑现时低价才可能是机会，{risk}未解决时可能是价值陷阱；缺可靠历史分位和走势，不编造支撑位。']
 text+=section(11,'多空交锋与专家视角','单模型多视角复核，非独立真人/多代理专家参与。\n\n'+bullets(perspectives)+f'\n\n**多头**：{bull}\n\n**空头逐条回应**：{beartext}\n\n**主持裁决**：{verdict}\n\n**共识与分歧**：产业视角允许关注经营驱动，估值与财报视角要求持续盈利、现金和下行先闭合。分歧是经营机会与价格安全边际之间的证据强度，不能以多数票改成买入。')
 text+=section(12,'口径、来源及旧结论调整',bullets(pp)+f'\n\n**旧报告处理**：保留公司身份和待核业务框架；调整财务事实与研究重点；撤回旧统一PE、固定±5%区间、机械亏损回避及固定个人仓位。旧页评级为“{prior["rating"]}”，价格、情景与操作假设存档在previous.json，禁止作为当前结论。\n\n'+bullets([f'[原件证据索引：{dd["title"].replace(chr(10)," ")}（披露{dd["date"]}；{dd["pages"]}页；SHA256 {dd["sha256"][:16]}…）]({dd["url"]})' for dd in r['documents']]))
 text+=section(13,'后续验证日历',bullets(cal)+f'\n\nPM七问：当前尚未证明错误定价；快照价格反映的盈利假设[MISSING]。论点是{driver}，证明与推翻看{watch}及第10节阈值。现在研究是为了核对最新披露与旧模型矛盾；改变评级需持续利润、现金、资本和两方法估值；缺失见第12节。')
 text+=section(14,'免责声明',DISCLAIMER)
 (OUT/(c+'.md')).write_text(text)
 records.append(dict(code=c,name=name,sector=prior['sector'],family=families[c],subtype=sub,rating=rating,oldRating=prior['rating'],price=p,quoteTime=timestamp,filing=d['url'],pages=pages,fact=fact,judgment=judgment,driver=driver,risk=risk,watch=watch,numericDraft=model['numericDraft'],certified=False,report=c+'.html',batch=batchof[c]['id']))
recordby={r['code']:r for r in records}
for n,b in enumerate(batches):
 table='| 代码 | 公司 | 本轮判断 | 财务事实 | 研究重点 |\n|---|---|---|---|---|\n'+'\n'.join(f'| {c} | [{recordby[c]["name"]}]({c}.html) | {recordby[c]["rating"]} | {recordby[c]["fact"]} | {recordby[c]["judgment"]} |' for c in b['codes'])
 ranked=sorted(b['codes'],key=lambda c:priority.index(c) if c in priority else 100 if c not in watchloss else 200)
 detail=f'# {b["id"]} · {b["family"]} · {DATE}\n\n[总览](index.html)\n\n{table}\n\n## 统一口径及研究顺序\n\n所有价位为2026-10-07各自时间戳的延迟盘中快照，不能当统一收盘。报告期与币种逐家列明，不混合H1、Q2与不同财年。研究顺序为'+ ' → '.join(recordby[c]['name'] for c in ranked)+'，先核可持续经营及现金，再处理亏损或资本结构；这是取证顺序，非预期收益或买入排名。排序理由逐家如下：\n\n'+'\n'.join(f'- {recordby[c]["name"]}：{recordby[c]["judgment"]}' for c in ranked)+'\n\n## 共同变量与数据陷阱\n\n同组共同变量为持续经营利润、资金占用及资本成本；行业差异按个股两种估值方法处理。不将法定和调整利润、集团与归母、人民币与港元、普通与ADS、IFRS与CAS混用；分红和时间成本另列。未认证价格模型不参加赔率排名。\n\n## 批次衔接与下一步\n\n'+(f'上一批：[{batches[n-1]["id"]}]({batches[n-1]["id"]}.html)。' if n else '本轮第一批。')+(f'下一批：[{batches[n+1]["id"]}]({batches[n+1]["id"]}.html)。' if n+1<len(batches) else '本轮最后一批，返回总览比较经营证据。')+'下一轮优先补正常化TTM、分部现金、完全摊薄股数、公司级2027假设和独立估值，证据不足保持观察/等待证据。\n\n'+DISCLAIMER
 (OUT/(b['id']+'.md')).write_text(detail)
(OUT/'audit.json').write_text(json.dumps(dict(date=DATE,total=127,filingDocuments=sum(len(r['documents']) for r in evidence),numericDrafts=sum(m['numericDraft'] for m in models.values()),certifiedRatings=0,counts={g:list(families.values()).count(g) for g in dict.fromkeys(families.values())},companies=records),ensure_ascii=False,indent=2))
(OUT/'models.json').write_text(json.dumps(models,ensure_ascii=False,indent=2));(OUT/'batches.json').write_text(json.dumps(batches,ensure_ascii=False,indent=2))
(OUT/'patches.json').write_text(json.dumps(patches,ensure_ascii=False,indent=2))
with (OUT/'audit.csv').open('w',newline='',encoding='utf-8-sig') as f:
 writer=csv.DictWriter(f,fieldnames=list(records[0]));writer.writeheader();writer.writerows(records)
intro=f'# 港股127家公司 · {DATE}研究总览\n\n本轮按stock-analysis逐家核对最新业绩和旧页结论。覆盖127家、{sum(len(r["documents"]) for r in evidence)}份财报及事件原件已下载并建立可追溯证据索引、{len(batches)}个3–5家公司批次。新行情均为带各自时间戳的延迟盘中价。**完成的是公司级事实复核与条件研究；0家获得完整两方法及压力检验的深度估值认证。**8家有数值敏感性草案，其他三情景缺数字输入明确标[MISSING]，不冒称已经全部重估。\n\n'
intro+='## 先看这些变化\n\n- 建设银行、农业银行等区分集团净利、归属及普通股EPS；已核得普通股BVPS的7家改用ROE驱动PB敏感性，独立DDM仍待补。\n- 领展撤回机械亏损回避，改看DPU、NAV和租金；分派及NAV下降仍不能认证低估。\n- 长和、电能、长建、长实拆资产处置、IFRS16及减值；增长不直接外推。\n- 携程补入反垄断处罚及整改风险；蔚来补入吉利换电充电交易，明确有条件交割。\n- 阿里健康、新鸿基、周大福、东方甄选及联想等修正财年口径；理想、中通、哔哩哔哩核对年度列序。\n\n## 后续优先取证\n\n'+ '、'.join(f'[{recordby[c]["name"]}]({c}.html)' for c in priority)+'。优先级表示经营证据值得深化，均非本轮认证买入。\n\n'
intro+='## 分批对照\n\n'+'\n'.join(f'- [{b["id"]} · {b["family"]}]({b["id"]}.html)：'+ '、'.join(recordby[c]['name'] for c in b['codes']) for b in batches)+'\n\n## 全部公司\n\n| 代码 | 公司 | 行业 | 判断 | 本轮核心发现 |\n|---|---|---|---|---|\n'+'\n'.join(f'| {r["code"]} | [{r["name"]}]({r["report"]}) | {r["sector"]} | {r["rating"]} | {r["judgment"]} |' for r in records)+'\n\n## 下载与复现\n\n[audit.csv](audit.csv) · [audit.json](audit.json) · [来源/快照](input.json) · [模型及假设](models.json) · [旧页存档](previous.json)。本轮未认证旧价位不作为目前研究区间。\n\n'+DISCLAIMER
(OUT/'index.md').write_text(intro)
# Update original public rows and manual detail source; keep one archived old snapshot.
raw=json.loads((ROOT/'public/data/hk.json').read_text());updated=[{**r,**patches[r['code']]} for r in raw];(ROOT/'public/data/hk.json').write_text(json.dumps(updated,ensure_ascii=False,indent=2))
keys={'rating':'rt','headline':'h','certainty':'cert','duration':'dur','ratioNote':'ratio','aiNote':'ai','profile':'pf'};arrays={'thesis':'t','growth':'g','moat':'o','risk':'rk','pitfalls':'x','calendar':'c','pros':'pro','cons':'con','industry':'ind'}
compact=[]
for c in order:
 a=patches[c];lines=['@hk:'+c]
 for k,v in keys.items():lines.append(v+': '+a[k])
 for k,v in arrays.items():lines.extend(v+': '+x for x in a[k])
 lines.extend('m: '+k+'|'+v for k,v in a['metrics'])
 lines.extend('seg: '+s['name']+'|'+s['share']+'|'+s['note'] for s in a['segments'])
 lines.extend('s: '+'|'.join(s.get(k,'') for k in ['name','prob','assumption','multiple','price','change','trigger']) for s in a['scenarios'])
 lines.extend(k+': '+a['discipline'][v] for k,v in [('z','zone'),('a','add'),('r','trim'),('i','invalid'),('p','position')])
 lines.extend(k+': '+a['bullBear'][v] for k,v in [('bull','bull'),('bear','bear'),('verdict','verdict')]);compact.append('\n'.join(lines))
content='\n\n'.join(compact).replace('`','\\`').replace('${','\\${')
(ROOT/'src/data/details/hk.ts').write_text('// 2026-10-07：127家公司原件事实复核；数值草案未认证。旧页保存在 public/research/hk-2026-10-07/previous.json。\n// 可复现：python3 scripts/review-hk-2026-10-07.py\nexport const hkDetails = `\n'+content+'\n`\n')
print('Reviewed',len(records),'companies;',len(batches),'batches;',sum(m['numericDraft'] for m in models.values()),'numeric drafts; 0 certified valuations')
