"""Render the 2026-10-07 company-level review for the CN 信息技术 / 公用事业 / 可选消费 universe.

Inputs  (.local/cn-itucd-2026-10-07): facts.json (scripts/cn-itucd-facts.py), theses-*.tsv (analyst judgement per company)
Outputs public/research/cn-itucd-2026-10-07/<code>.md, audit.json, summary.csv, previous.json
        and replaces the matching entries in public/data/cn.json (auto:false, reviewed:true).
No network. Valuation is rule-based on analyst-set growth and class multiples; it is an uncertified research hypothesis.
"""
import csv
import glob
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / '.local/cn-itucd-2026-10-07'
OUT = ROOT / 'public/research/cn-itucd-2026-10-07'
DATE = '2026-10-07'
DISCLAIMER = '本报告仅供研究参考，不构成个人投资建议。'
OUT.mkdir(parents=True, exist_ok=True)

facts = json.loads((BASE / 'facts.json').read_text())
theses = {}
for f in sorted(glob.glob(str(BASE / 'theses-*.tsv'))):
    for line in Path(f).read_text().splitlines():
        if not line.strip():
            continue
        c, cls, g, bull, bear, watch = line.split('|')
        theses[c] = dict(cls=cls, g=float(g), bull=bull, bear=bear, watch=watch)
assert set(theses) <= set(facts), set(theses) - set(facts)
facts = {c: facts[c] for c in theses}  # only companies with analyst theses are (re)rendered

cn_path = ROOT / 'public/data/cn.json'
cn_all = json.loads(cn_path.read_text())
# 手工录入（companies.ts）的公司不在 cn.json 里：并入 cn.json，使其走同一条运行时加载路径
hand_path = BASE / 'hand5.json'
if hand_path.exists():
    known = {r['code'] for r in cn_all}
    cn_all += [h for h in json.loads(hand_path.read_text()) if h['code'] not in known]
prev_path = OUT / 'previous.json'
# previous.json archives the pre-review (programmatic) pages; extend it incrementally, never overwrite with our own output
previous = {r['code']: r for r in json.loads(prev_path.read_text())['companies']} if prev_path.exists() else {}
for r in cn_all:
    if r['code'] in facts and r['code'] not in previous and 'cn-itucd-2026-10-07' not in (r.get('researchReport') or ''):
        previous[r['code']] = r
prev_path.write_text(json.dumps({'date': DATE, 'companies': list(previous.values())}, ensure_ascii=False))

# class: (中文名, bear PE, base PE, bull PE, 行业要点, bear growth offset)
CLS = {
    'hydro': ('水电', 16, 19, 22, '水电盈利取决于来水、上网电价与折旧，现金流稳定、资本开支低，估值接近高股息债券，增长慢。', 15),
    'nuc': ('核电', 13, 16, 19, '核电盈利取决于上网电量、市场化电价与新机组投产节奏，在建工程资本开支大。', 15),
    'thermal': ('火电', 8, 11, 14, '火电盈利取决于煤价、上网电价与利用小时，周期弹性大，资产负债率高是行业特征。', 25),
    'renew': ('新能源发电', 11, 14, 18, '风光发电盈利取决于利用小时、电价市场化与限电率，装机增长靠资本开支驱动。', 25),
    'gaswater': ('燃气 / 水务 / 环保', 9, 12, 15, '特许经营类公用事业，盈利稳定但增长慢，关注应收账款、气价价差与政府付费回款。', 15),
    'mem': ('存储', 7, 11, 15, '存储盈利随DRAM/NAND价格周期大幅波动，高景气阶段的盈利不能外推；估值用低倍PE。', 40),
    'semieq': ('半导体设备 / 材料', 28, 38, 48, '半导体设备与材料受益国产替代与晶圆厂扩产，订单与毛利率是核心；估值高、对增速依赖大。', 35),
    'semides': ('芯片设计', 28, 38, 50, '芯片设计公司盈利随终端需求与库存周期波动，研发投入高；估值依赖新品放量。', 35),
    'analog': ('模拟 / 功率半导体', 25, 32, 42, '模拟与功率器件受国产替代与工控、汽车需求支撑，但价格竞争与产能扩张压力大。', 30),
    'foundry': ('晶圆代工 / 衬底', 22, 35, 50, '晶圆代工与衬底行业资本密集，盈利取决于稼动率与折旧；亏损或低利润率阶段估值难用PE衡量。', 40),
    'pcb': ('PCB / 覆铜板', 18, 26, 36, 'PCB与覆铜板受AI服务器、通信与汽车电子需求拉动，周期与扩产折旧并存。', 35),
    'ems': ('电子制造 / ODM', 10, 14, 19, 'ODM与EMS毛利低、规模大，盈利取决于大客户份额、产品结构与营运资金。', 30),
    'brandce': ('消费电子 / 智能硬件', 13, 18, 24, '智能硬件盈利取决于品类扩张、渠道与海外关税，价格战与营销投入侵蚀利润率。', 30),
    'disp': ('显示面板', 12, 18, 25, '面板行业周期性强，盈利取决于面板价格、稼动率与折旧，高资本开支与有息负债是共同约束。', 35),
    'comp': ('电子元件 / 材料', 18, 26, 34, '电子元件与材料受消费电子、服务器与新能源需求拉动，关注产品结构与客户集中。', 30),
    'opt': ('AI硬件 / 光电 / 安防', 20, 30, 42, 'AI算力与光通信硬件需求高增长，同时客户集中、扩产与资本开支强度大，估值对增速敏感。', 35),
    'soft': ('软件 / 信息服务', 22, 32, 44, '软件与信息服务盈利取决于订阅/续费、政企预算与人力成本，亏损公司需用PS与现金跑道交叉验证。', 30),
    'secsoft': ('网络安全', 25, 35, 45, '网络安全受政企预算与合规驱动，盈利波动大，常处于亏损与盈亏平衡之间。', 30),
    'finsoft': ('金融 / 行业软件', 18, 26, 34, '行业软件盈利取决于客户预算、市场活跃度与订阅转型，强周期者随成交额波动。', 30),
    'appl': ('家电', 8, 11, 14, '家电行业盈利取决于内销需求、补贴政策、原材料与海外关税，估值多为低倍PE+高分红。', 20),
    'autop': ('汽车零部件', 11, 15, 20, '汽车零部件盈利取决于客户车型周期、价格年降与原材料，海外与新能源配套是增长来源。', 25),
    'oem': ('整车', 8, 12, 16, '整车行业价格战激烈，盈利取决于销量结构、新能源转型与资产减值，估值波动大。', 30),
    'tire': ('轮胎', 8, 11, 14, '轮胎行业盈利取决于天然橡胶与炭黑成本、海外贸易壁垒与海外产能利用率。', 25),
    'cbrand': ('消费品牌 / 出行', 11, 16, 22, '消费品牌盈利取决于渠道、品牌力、关税与竞争，增长来自品类扩张与海外。', 25),
    'house': ('家居', 10, 14, 19, '家居行业盈利取决于地产竣工与存量房需求、渠道与价格竞争。', 25),
    'travel': ('旅游 / 酒店 / 免税', 16, 23, 30, '旅游与酒店盈利取决于客流、客单价与政策；轻资产与加盟模式提升利润率稳定性。', 25),
    'copper': ('铜冶炼 / 加工', 10, 14, 18, '铜冶炼与加工利润由铜价、加工费（TC/RC）和副产品贵金属价格决定，毛利很薄，营收增长多来自金属价格。', 30),
    'minor': ('小金属 / 稀土 / 锂', 14, 20, 28, '稀土、钨钼、锡、锂等小金属价格波动大、政策与配额影响强，高景气阶段的盈利不能外推。', 35),
    'gold': ('黄金 / 铜金矿', 14, 20, 26, '黄金与铜金矿盈利取决于金价、铜价、产量与单位成本；价格回落时利润弹性反向。', 20),
    'alu': ('铝', 8, 11, 14, '电解铝盈利取决于铝价、电价与氧化铝成本，产能天花板使供给受限，但价格回落时利润弹性大。', 35),
    'steel': ('钢铁', 9, 13, 18, '钢铁行业产能过剩，盈利取决于吨钢价差、原料成本与产量调控，低毛利、高负债是行业特征。', 40),
    'chem': ('基础化工', 10, 15, 20, '基础化工盈利取决于产品价差与产能周期，新产能投放与供给过剩压制价格。', 35),
    'spec': ('精细化工 / 新材料', 18, 26, 35, '精细化工与新材料盈利取决于下游需求、客户认证与产能爬坡，估值高于基础化工。', 30),
    'cement': ('水泥 / 建材', 10, 14, 18, '水泥与建材需求与地产、基建挂钩，价格战与产能过剩压制盈利。', 30),
    'paper': ('造纸 / 包装', 11, 15, 20, '造纸与包装盈利取决于纸价、浆价与客户集中度，周期性较强。', 25),
    'fiber': ('化纤', 10, 15, 20, '涤纶长丝与PTA盈利取决于价差与产能周期，毛利低、资本开支大。', 35),
    'coal': ('煤炭', 8, 11, 14, '煤炭盈利取决于煤价、长协占比与吨煤成本，高分红是估值支撑，价格下行时弹性反向。', 30),
    'oilmaj': ('油气 / 炼化', 8, 10, 13, '油气与炼化盈利取决于油价、炼油价差与化工品价差，大型国企分红稳定但周期性强。', 30),
    'oilsvc': ('油服 / 工程', 12, 17, 22, '油服与工程盈利取决于油气资本开支、项目节奏与应收账款，订单驱动。', 25),
    'ad': ('广告 / 传媒', 13, 19, 26, '广告与传媒盈利取决于广告预算、内容成本与平台流量，代理类业务毛利极薄。', 30),
    'game': ('游戏', 12, 18, 25, '游戏盈利高度依赖少数爆款与新游节奏，利润波动大，生命周期不确定。', 40),
    'cinema': ('影视 / 影院', 15, 22, 30, '影视与影院盈利取决于票房周期与内容储备，波动大，亏损阶段不适用PE。', 40),
    'publish': ('出版发行', 10, 13, 16, '出版发行依赖教材教辅，现金流稳定、分红较高，增长受学生数与政策影响。', 15),
    'telop': ('电信运营 / 卫星', 11, 14, 17, '电信运营商现金流稳定、高分红，增长受用户饱和与资本开支影响。', 15),
    'idc': ('数据中心 / 云', 20, 28, 36, '数据中心与云服务盈利取决于机柜上架率、电力成本与资本开支，AI算力需求提升景气但投入大。', 30),
    'pharma': ('化药 / 制药', 14, 20, 28, '制药公司盈利取决于集采、医保目录与产品结构，创新药占比提升是长期变量。', 25),
    'tcm': ('中药 / 品牌药', 14, 20, 26, '中药与品牌药盈利取决于品牌、渠道库存与提价，增长平缓。', 25),
    'innov': ('创新药', 22, 32, 45, '创新药盈利取决于核心产品销售、医保谈判、海外授权与研发投入；授权收入一次性，亏损阶段不适用PE。', 40),
    'device': ('医疗器械', 18, 26, 35, '医疗器械盈利取决于国内集采、医院采购与海外拓展，国产替代是长期逻辑。', 30),
    'ivd': ('体外诊断', 15, 22, 30, '体外诊断盈利受集采、检测量与试剂仪器配套影响。', 30),
    'cxo': ('CXO / 药物研发服务', 16, 22, 30, 'CXO盈利取决于订单、产能利用与海外政策风险。', 30),
    'vaccine': ('疫苗 / 生物制品', 18, 26, 35, '疫苗盈利取决于产品竞争、批签与接种政策，波动较大。', 35),
    'blood': ('血制品', 18, 25, 32, '血制品盈利取决于采浆量、白蛋白与免疫球蛋白价格。', 30),
    'hosp': ('医疗服务', 18, 26, 35, '医疗服务盈利取决于诊疗量、客单价与扩张摊销。', 30),
    'distrib': ('医药流通', 8, 11, 14, '医药流通毛利极低，盈利取决于规模、回款与营运资金。', 20),
    'retailpharm': ('药房连锁', 16, 22, 30, '药房连锁盈利取决于同店增长、开店摊销与医保政策。', 25),
    'aesthetic': ('医美', 22, 32, 44, '医美盈利取决于新品放量与竞争，毛利极高但竞争加剧。', 30),
    'cosmetic': ('化妆品', 18, 26, 35, '化妆品盈利取决于品牌、营销费用率与渠道。', 30),
    'liquor': ('白酒', 14, 20, 26, '白酒盈利取决于批价、渠道库存与需求，估值与批价高度相关；本轮未核实最新批价与库存数据 [MISSING]。', 25),
    'beer': ('啤酒', 18, 24, 30, '啤酒盈利取决于吨价提升、结构升级与成本，销量增长有限。', 20),
    'food': ('食品 / 调味品', 15, 21, 28, '食品与调味品盈利取决于原料成本、渠道与品类扩张。', 25),
    'dairy': ('乳制品', 12, 17, 22, '乳制品盈利取决于原奶价格、产品结构与需求。', 25),
    'beverage': ('饮料', 16, 23, 30, '饮料盈利取决于品类竞争、渠道扩张与成本。', 25),
    'hog': ('养殖 / 饲料', 8, 12, 17, '生猪与禽类养殖盈利取决于猪价周期与养殖成本，周期性极强；饲料毛利极薄。', 45),
    'agri': ('农业', 10, 15, 20, '农业盈利取决于农产品价格与土地承包收益，周期与政策影响强。', 30),
    'retail': ('零售 / 分销', 10, 16, 24, '零售与分销毛利薄，盈利取决于规模、门店效率与营运资金。', 30),
}
CYCLICAL = {'copper', 'minor', 'gold', 'alu', 'steel', 'chem', 'fiber', 'coal', 'oilmaj', 'mem', 'hog', 'agri', 'thermal', 'disp', 'tire', 'cement', 'foundry'}
AI_CLS = {'opt', 'mem', 'pcb', 'semieq', 'semides', 'foundry', 'analog', 'comp', 'ems', 'idc'}
EVENT_RE = re.compile(r'减持|增持|回购|转增|定增|发行|重组|收购|并购|投资|担保|诉讼|仲裁|处罚|风险提示|业绩预告|可转债|股权激励|分红|利润分配|退市|终止|冻结|质押|立案|调查|问询|更正|差错|减值|停牌')


def yi(v):
    return '[MISSING]' if v is None else f'{v / 1e8:.2f} 亿元'


def pct(v, d=1):
    return '[MISSING]' if v is None else f'{v:+.{d}f}%'


def sgn(v):
    return f'{v:+.0f}%' if v is not None else '—'


def seg_note(f, s):
    m = '' if s['margin'] is None else f'，毛利率 {s["margin"]:.1f}%'
    return f'东方财富主营构成（{f["segDate"]}，{s["kind"]}）{m}；收入占比按披露口径，不同分类口径不相加'


def key_events(f):
    out = []
    for n in f['notices']:
        if n['date'] >= '2026-07-01' and EVENT_RE.search(n['title']) and not re.search(r'董事会决议|监事会|股东大会|法律意见|独立董事|章程|制度', n['title']):
            out.append(n)
        if len(out) >= 4:
            break
    return out


def classify_quality(f, t, ttm_pe):
    flags = []
    if f['revYoy'] is not None and (f['revYoy'] > 50 or f['revYoy'] < -40):
        flags.append('营收同比波动 >40–50%')
    if f['netTTM'] is not None and f['netFY25'] is not None and (f['netTTM'] > 0) != (f['netFY25'] > 0):
        flags.append('TTM 与上年归母符号翻转')
    if f['coreTTM'] is not None and f['coreFY25'] is not None and (f['coreTTM'] > 0) != (f['coreFY25'] > 0):
        flags.append('TTM 与上年扣非符号翻转')
    return flags


patches, audits, rows = {}, [], []
for code, f in facts.items():
    t = theses[code]
    prev = previous[code]
    cname, bearPE, basePE, bullPE, industry_text, bear_off = CLS[t['cls']]
    P = f['price']
    shares = f['shares']  # 亿股，由市值/价格推得
    cap = f['capYi']
    core_ttm = f['coreTTM']
    ttm_net = f['netTTM']
    quote = f'{P:.2f} 元（腾讯行情，{f["ts"][:4]}-{f["ts"][4:6]}-{f["ts"][6:8]} {f["ts"][8:10]}:{f["ts"][10:12]} 最后报价；节假日休市时为节前最后交易日）'
    ocf_over_net = (f['ocf26'] / f['net26']) if f['net26'] and f['net26'] > 0 and f['ocf26'] is not None else None
    ttm_eps = core_ttm / 1e8 / shares if shares else None
    ttm_pe = P / ttm_eps if ttm_eps and ttm_eps > 0 else None
    flags = classify_quality(f, t, ttm_pe)

    valued = bool(core_ttm and core_ttm > 0 and shares)
    scen, model, ratio, zone, ratio_txt = [], None, None, None, ''
    if valued:
        g = t['g']
        eps0 = core_ttm / 1e8 / shares
        eps = [eps0 * max(0.15, 1 + (g - bear_off) / 100), eps0 * (1 + g / 100), eps0 * (1 + (g + 20) / 100)]
        mult = [bearPE, basePE, bullPE]
        values = [e * m for e, m in zip(eps, mult)]
        bear, base, bull = values
        if not (bear < base < bull):
            base = max(base, bear * 1.05)
            bull = max(bull, base * 1.1)
            values = [bear, base, bull]
        if bear < P < base:
            ratio = (base - P) / (P - bear)
            ratio_txt = f'{ratio:.2f}:1'
        elif P >= base:
            ratio_txt = '不成立：现价 ≥ 基准价'
        else:
            ratio_txt = '不可计算：现价 ≤ 悲观价，需重检压力情景'
        threshold = (base + 2 * bear) / 3
        zone = f'条件研究门槛 P ≤ {threshold:.2f} 元，按 (Base+2×Bear)/3 反推；是研究假设，不是已认证买入区，悲观价不保证最大损失。'
        names = ['悲观', '基准', '乐观']
        gs = [g - bear_off, g, g + 20]
        trig = [f'压力：{t["bear"]}', f'验证：{t["watch"]}', f'兑现：{t["bull"]}且{t["watch"]}同步改善']
        for i in range(3):
            scen.append(dict(name=names[i], prob='[MISSING]（未赋概率）',
                             assumption=f'扣非 TTM 每股 {eps0:.3f} 元（{yi(core_ttm)} ÷ {shares:.2f} 亿股），2027E 盈利假设 {gs[i]:+.0f}%（研究假设，非公司指引）→ EPS {eps[i]:.3f} 元',
                             multiple=f'{mult[i]}× PE（{cname}类假设，未校准历史分位）', price=f'{values[i]:.2f} 元（估值初稿）',
                             change=f'{(values[i] / P - 1) * 100:+.0f}%', trigger=trig[i]))
        model = dict(eps0=eps0, eps=eps, mult=mult, price=values, ratio=ratio, threshold=threshold)
    else:
        for name, a, tr in [('悲观', f'扣非 TTM {yi(core_ttm)} 为负或接近零：亏损延续，需核现金跑道、有息负债与资产回收', '下一份财报扣非亏损扩大或经营现金继续为负'),
                            ('基准', f'先证明：{t["watch"]}；至少连续两个季度扣非为正，再用分部收入×正常利润率或 PS/NAV 重建', '扣非转正并披露现金桥接'),
                            ('乐观', f'{t["bull"]}兑现且利润率修复；仍需核研发与摊薄', '新增业务贡献可核实收入、正毛利与现金')]:
            scen.append(dict(name=name, prob='[MISSING]（未赋概率）', assumption=a, multiple='持续盈利 PE 不适用；PS/NAV 输入待核', price='[MISSING]（未建立可核验价值）', change='[MISSING]', trigger=tr))
        ratio_txt = '[MISSING]：扣非 TTM 为负，不套 PE 情景，不给赔率'
        zone = '等待证据：亏损企业需现金流 / NAV / 分部 PS 交叉验证，未给出买入区。'

    # 评级：沿用站内研究标准（盈亏比 ≥2 优先关注；1–2 条件关注；其余观察；TTM 亏损回避；数据不稳定封顶观察；负债率 >80% 封顶条件关注）
    if not valued:
        rating = '回避'
    elif flags or ratio is None:
        rating = '观察'
    elif ratio >= 2:
        rating = '优先关注'
    elif ratio >= 1:
        rating = '条件关注'
    else:
        rating = '观察'
    capped = None
    if rating == '优先关注':
        # 估值只有一套类别倍数 + 分析师增速假设，没有第二种独立方法交叉验证，评级封顶条件关注；赔率畸高说明悲观价贴近现价
        rating, capped = '条件关注', ('悲观价贴近现价使赔率畸高（>8:1），压力情景不足' if ratio > 8 else '估值未经第二种独立方法交叉验证，评级封顶条件关注')
    if rating == '条件关注' and ratio is not None and ratio > 8:
        rating, capped = '观察', '悲观价贴近现价使赔率畸高（>8:1），压力情景不足，封顶观察'
    if rating in ('优先关注', '条件关注') and f['ocf26'] is not None and f['ocf26'] < 0:
        rating = '观察'

    if t['cls'] in CYCLICAL and rating in ('优先关注', '条件关注'):
        # 技能规则：周期股用中周期盈利，低 PE 不自动便宜；本轮没有中周期盈利和历史倍数分位，不给周期股高于观察的评级
        rating, capped = '观察', '周期行业：需用中周期盈利估值，TTM 低 PE 不自动代表便宜；未取得中周期盈利，评级封顶观察'
    quality = '高' if (valued and ocf_over_net and ocf_over_net >= 0.8 and not flags and (f['coreYoy'] or 0) > -20) else ('低' if (not valued or flags or (f['ocf26'] is not None and f['ocf26'] < 0)) else '中')
    certainty = {'高': '高：扣非为正、经营现金覆盖归母，且口径无翻转；估值输入仍为研究假设', '中': '中：当期盈利与现金有披露支持，持续性与估值容错待核', '低': '低：扣非亏损、现金为负或口径波动大，盈利可见度未闭合'}[quality]

    pe_txt = f'{ttm_pe:.1f}×' if ttm_pe else '不适用（扣非 TTM ≤ 0）'
    headline = f'{rating}：{t["bull"]}；{t["bear"]}。扣非 TTM PE {pe_txt}，赔率 {ratio_txt}。'
    ev = key_events(f)
    segs = [dict(name=s['name'], share=f'{s["share"]:g}%', note=seg_note(f, s)) for s in f['segments'] if not s['name'].startswith(('其他(补充)', '其中')) and s['share'] >= 0.5][:5]
    if not segs:
        segs = [dict(name='[MISSING]', share='[MISSING]', note='东方财富主营构成本次未取到')]
    ocf_txt = f'{yi(f["ocf26"])}；OCF/归母 {ocf_over_net:.2f} 倍' if ocf_over_net is not None else f'{yi(f["ocf26"])}（归母为负或缺失，不计算倍数）'
    q2 = f'；Q2 单季营收同比 {pct(f["q2RevYoy"], 0)}、扣非同比 {pct(f["q2CoreYoy"], 0)}' if f['q2RevYoy'] is not None else ''
    metrics = [
        ['研究复核', f'{DATE}；2026H1 累计合并报表（东方财富数据中心 / 巨潮公告元数据，披露日 {f["notice26"]}）；估值为未认证研究假设'],
        ['价格锚点', quote],
        ['参考股本 / 市值', f'{shares:.2f} 亿股 / {cap:.2f} 亿元（市值 ÷ 价格，第三方字段，未认证完全摊薄）'],
        ['2026H1 营收 / 同比', f'{yi(f["rev26"])} / {pct(f["revYoy"])}'],
        ['2026H1 归母 / 扣非', f'{yi(f["net26"])} / {yi(f["core26"])}（扣非同比 {pct(f["coreYoy"])}）' + q2],
        ['扣非 TTM（上年 + H1 − 上年 H1）', f'{yi(core_ttm)}；归母 TTM {yi(ttm_net)}；PE(扣非 TTM) {pe_txt}'],
        ['现金与盈利质量', f'H1 经营现金净额 {ocf_txt}'],
        ['利润率与回报', f'毛利率 {f["gm"]:.1f}%（去年同期 {f["gm25h"]:.1f}%）；销售净利率 {f["nm"]:.1f}%；加权 ROE {f["roe"]:.2f}%（半年累计，不年化）；ROIC {f["roic"]:.2f}%' if f['roic'] is not None else f'毛利率 {f["gm"]:.1f}%；销售净利率 {f["nm"]:.1f}%；加权 ROE {f["roe"]:.2f}%'],
        ['杠杆', f'资产负债率 {f["debtRatio"]:.1f}%；有息负债率 {f["interestDebt"]:.1f}%；流动比率 {f["current"]:.2f}；货币资金 {yi(f["cash"])}' if f['interestDebt'] is not None else f'资产负债率 {f["debtRatio"]:.1f}%；货币资金 {yi(f["cash"])}'],
        ['估值方法一：扣非 PE 三情景', f'悲观 / 基准 / 乐观 {" / ".join(f"{p:.2f}" for p in model["price"])} 元；赔率 {ratio_txt}' if model else '扣非为负，不适用'],
        ['估值方法二：现价隐含增速（反向）', (f'现价对应 {pe_txt} 扣非 TTM PE；若按基准倍数 {basePE}× 估值，隐含 2027E 盈利需较 TTM {(P / basePE / ttm_eps - 1) * 100:+.0f}%（研究假设框架，非预测）' if (valued and ttm_eps) else '亏损企业无 PE 隐含增速；需 PS/NAV 与现金跑道交叉验证')],
        ['估值认证', '未认证：摊薄股本、完整股权现金流与一致预期未核；不等于最大损失保证'],
    ]
    risk = [f'下一份财报验证：{t["watch"]}；若扣非同比转负或亏损扩大，下修盈利假设。',
            '现金验证：若累计经营现金净额低于归母或转负，撤回高现金转化假设；经营现金不等于自由现金流。',
            '股本验证：新增发行、可转债转股、股权激励或转增改变摊薄股数时，需重算所有每股值。',
            f'最大反证：{t["bull"]}若同时转化为持续扣非与可分配现金，当前审慎判断可能偏保守。']
    views = [f'单模型多视角复核·产业（2026–2027，{"偏多" if (f["coreYoy"] or 0) > 20 else "观望"}）：{t["bull"]}；失效：对应业务收入或利润率在下一份财报不兑现。',
             f'单模型多视角复核·财报（未来两季，{"偏空" if not valued or (f["ocf26"] or 0) < 0 else "观望"}）：扣非 H1 {yi(f["core26"])}，{ocf_txt}；反证：扣非与现金连续改善。',
             f'单模型多视角复核·估值（至 2027 年底，观望）：{pe_txt} 扣非 TTM PE，倍数按{cname}类假设；失效：增速假设不能由订单/量价证据支撑。',
             '共识：行业优势必须经过扣非盈利、现金回报与价格检验。分歧：增长能否补偿周期与资本占用。本轮没有独立专家参与，不以多数票定评级。']
    pit = [f'数据口径：东方财富数据中心（财务指标、主营构成）与巨潮资讯公告元数据；报告期 2026-06-30 累计，披露日 {f["notice26"]}；未逐份读取 PDF 原件，数值以公司披露为准。',
           f'TTM 为算术桥接：上年年报 + H1 − 上年 H1（扣非 {yi(core_ttm)}）；股本变化、会计准则调整与一次性项目未逐项桥接。',
           f'行情为第三方腾讯报价（含自己的 PE {f["providerPe"]}、PB {f["pb"]}，未独立核验）；非交易所收盘确认。',
           '未取到：一致预期 / 远期 PE、完整 FCF（资本开支）、完全摊薄股数、52 周区间 [MISSING]。',
           '估值初稿：盈利增速为分析师假设，倍数为类别假设，未用历史分位校准；赔率不是已认证交易赔率。']
    if flags:
        pit.append('数据不稳定标记（评级封顶观察）：' + '；'.join(flags))
    if code == '600674':
        pit.append('川投能源营收仅 6.8 亿元而扣非 23.2 亿元：利润主要来自参股雅砻江水电的投资收益（权益法），营收口径与利润口径不可直接比较。')
    if prev.get('rating') != rating or prev.get('headline'):
        pit.append(f'旧页（程序化规则页）处理：旧评级「{prev.get("rating")}」→ 本轮「{rating}」；旧页缺失的分部、护城河证据、公告事件与现金验证已补，数值口径以本轮为准，旧情景仅存档于 public/research/cn-itucd-2026-10-07/previous.json。')
    if capped:
        pit.append('评级封顶说明：' + capped + '。')
    pit.append(DISCLAIMER)

    industry = [industry_text, f'公司特定传导（判断）：{t["bull"]}', f'需求与价格风险（判断）：{t["bear"]}']
    event_lines = [f'[{e["date"]} · {e["title"]}]({e["url"]})' for e in ev]
    profile = (f'{f["name"]}（{code}）所属{f["industry"] or cname}，{(f["main"] or "").rstrip("。")}。'
               f'主营构成（{f["segDate"]}）：' + '；'.join(f'{s["name"]} {s["share"]:g}%' for s in f['segments'][:4]) + '。'
               f'2026H1：营收 {yi(f["rev26"])}（{pct(f["revYoy"])}），归母 {yi(f["net26"])}，扣非 {yi(f["core26"])}，经营现金 {yi(f["ocf26"])}。')
    patch = dict(
        name=f['name'], batch=prev.get('batch') or f['sector'], rating=rating, headline=headline,
        asOf=f'{DATE} 研究；价格 {quote}；财务 2026-06-30 累计（东方财富 / 巨潮，披露 {f["notice26"]}）；估值为未认证研究假设，不是目标价。',
        profile=profile, certainty=certainty,
        duration='研究期限至 2027-12-31；增长持续性取决于业务收入、利润率与现金回报，不把本期同比增速外推至 2027 年底。',
        ratioNote=(f'{ratio_txt}；P={P:.2f}，Bear={model["price"][0]:.2f}，Base={model["price"][1]:.2f}；未四舍五入计算；盈利增速与倍数均为研究假设，不认证可交易赔率。' if model else ratio_txt),
        metrics=metrics,
        thesis=[t['bull'], t['bear'], *views[:1]],
        growth=[f'事实：H1 营收同比 {pct(f["revYoy"])}、扣非同比 {pct(f["coreYoy"])}；毛利率 {f["gm"]:.1f}%（去年同期 {f["gm25h"]:.1f}%）。', f'判断：{t["bull"]}', f'验证：{t["watch"]}'],
        moat=[f'待验证的护城河：{t["bull"]}；需份额、客户认证、成本或定价权证据，行业地位标签本身不构成证明。' + (f'ROIC {f["roic"]:.1f}% 可作旁证。' if f['roic'] is not None else '')],
        pros=[t['bull'], f'已披露事实：毛利率 {f["gm"]:.1f}%，H1 经营现金 {yi(f["ocf26"])}'],
        cons=[t['bear'], '一致预期、完整 FCF、摊薄股本 [MISSING]，结论稳健性受限'],
        industry=industry, segments=segs, scenarios=scen,
        discipline=dict(zone=zone, add=f'研究升级条件：{t["watch"]}改善，连续两个季度扣非与现金一致，并完成股本与 FCF 桥接。',
                        trim='研究降级条件：盈利假设下修、回款恶化，或价格只被乐观情景支持；不提供固定卖出比例。', invalid=risk[0],
                        position='本轮不提供个人仓位指令；估值初稿只用于比较假设与等待证据。'),
        bullBear=dict(bull=t['bull'], bear=t['bear'], verdict=f'{rating}；以扣非、现金与价格闭合为裁决，保留成长/周期乐观与现金/估值审慎的分歧。单模型多视角复核。'),
        risk=risk, next=[f'下一份季度披露核对：{t["watch"]}；确切日期待公告。', zone],
        calendar=['下一份季度报告（三季报，通常 10 月底前披露；确切日期待公告）：' + t['watch'] + '。', '未来两个季度：验证扣非与现金；新增融资/转增/股权激励触发股本重算。', '2027-12-31 研究终点：比较正常化利润与本轮假设；不保证实现。'],
        pitfalls=pit,
        aiNote=('AI 为本分类研究变量，但各公司财务传导不同；独立 AI 利润贡献未拆分，不另加概念溢价，需订单/收入/利润量化。' if t['cls'] in AI_CLS else 'AI 为非核心估值变量；不以概念加分，需量化订单、收入、利润与资本开支。'),
        auto=False, reviewed=True, researchReport=f'research/cn-itucd-2026-10-07/{code}.md',
    )
    patches[code] = patch

    md = [f'# {f["name"]}（{code}）｜{f["sector"]}·{patch["batch"]}', '',
          f'## 0｜信息与证据\n\n研究日 {DATE}；沪深 A 股，人民币；价格 {quote}；已取财报 2026H1 累计，披露日 {f["notice26"]}。数据来源：东方财富数据中心（财务指标、主营构成、现金流）、巨潮资讯公告元数据、腾讯行情；分析为研究者判断，未逐份读取 PDF 原件。', '',
          f'## 1｜公司简介\n\n{profile}', '',
          '## 2｜业务分布\n\n| 业务 | 收入占比 | 口径 |\n| --- | --- | --- |\n' + '\n'.join(f'| {s["name"]} | {s["share"]} | {s["note"]} |' for s in segs) + '\n\n占比为收入口径，利润贡献未拆分 [MISSING]。', '',
          f'## 3｜优势与缺点\n\n**优势**：{t["bull"]}。\n\n**限制**：{t["bear"]}。', '',
          '## 4｜行业趋势\n\n' + '\n\n'.join(industry), '',
          f'## 5｜结论卡\n\n**评级：{rating}。** {headline}\n\n确定性：{certainty}。\n\n{patch["ratioNote"]}\n\n{patch["duration"]}', '',
          '## 6｜关键指标\n\n| 指标 | 数值与口径 |\n| --- | --- |\n' + '\n'.join(f'| {k} | {v} |' for k, v in metrics), '',
          '## 7｜增长与护城河\n\n' + '\n\n'.join(patch['growth'] + patch['moat'] + [patch['aiNote']]), '',
          '## 8｜三情景估值\n\n' + '\n\n'.join(f'**{s["name"]}**：{s["assumption"]}；{s["multiple"]}；价格 {s["price"]}（{s["change"]}）；触发：{s["trigger"]}' for s in scen) + f'\n\n{zone}', '',
          '## 9｜条件化研究纪律\n\n' + '\n\n'.join(patch['discipline'].values()), '',
          '## 10｜风险与证伪\n\n' + '\n'.join(f'- {x}' for x in risk), '',
          '## 11｜多空交锋\n\n' + '\n\n'.join(views) + f'\n\n**多头**：{t["bull"]}\n\n**空头**：{t["bear"]}\n\n**裁决**：{patch["bullBear"]["verdict"]}', '',
          '## 12｜口径与陷阱\n\n' + ('近期公告（2026-07 起，关键词筛选）：\n\n' + '\n'.join(f'- {x}' for x in event_lines) + '\n\n' if event_lines else '近期关键词公告：未筛到；全部公告未逐份审阅 [MISSING]。\n\n') + '\n\n'.join(pit), '',
          '## 13｜验证日历\n\n' + '\n'.join(f'- {x}' for x in patch['calendar']), '', f'## 14｜免责声明\n\n{DISCLAIMER}', '']
    (OUT / f'{code}.md').write_text('\n'.join(md))
    audits.append(dict(code=code, name=f['name'], sector=f['sector'], cls=t['cls'], rating=rating, oldRating=prev.get('rating'), flags=flags, model=model, facts={k: f[k] for k in ['price', 'capYi', 'revYoy', 'coreYoy', 'coreTTM', 'netTTM', 'ocf26', 'debtRatio']}))
    rows.append([f['sector'], code, f['name'], rating, prev.get('rating'), f'{ttm_pe:.1f}' if ttm_pe else '', ratio_txt, f['coreYoy'], f['revYoy'], f['gm'], f['debtRatio'], ';'.join(flags)])

# keep audit / summary for every company rendered so far
(OUT / 'audit.json').write_text(json.dumps(audits, ensure_ascii=False, indent=1, default=float))
with open(OUT / 'summary.csv', 'w', newline='') as fh:
    w = csv.writer(fh)
    w.writerow(['分类', '代码', '名称', '评级', '旧评级', '扣非TTM PE', '赔率', '扣非同比%', '营收同比%', '毛利率%', '资产负债率%', '数据不稳定标记'])
    w.writerows(rows)

# replace the programmatic pages in public/data/cn.json
out = []
for r in cn_all:
    if r['code'] in patches:
        out.append({**r, **patches[r['code']]})
    else:
        out.append(r)
cn_path.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
import collections
print(collections.Counter(a['rating'] for a in audits))
