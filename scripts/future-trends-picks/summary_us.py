# 海外公司各赛道汇总与风险规则（研究判断；数据刷新后须复核数字）
SU = {
 'ai': dict(
  summary=[
   ('适合买', '37 家里没有一家干净地达到 2:1。谷歌模型赔率 2.31、亚马逊 1.61，但两家的 TTM 利润都含投资收益，PE 被压低，所以降为等回调。剔除这一点后，估值与盈利最平衡的是谷歌（远期 PE 23×）、微软（PE 30×，2:1 价约 403 美元）和 Adobe（PE 13×、盈亏比 1.45，被 AI 替代担忧压低）。'),
   ('有壁垒', '英伟达（CUDA 生态）、台积电（先进制程与 CoWoS）、博通（定制 ASIC）、微软、谷歌、亚马逊、Meta、阿斯麦链上的 Arista、Vertiv、GE Vernova、Amphenol、Apple、Arm。'),
   ('增长空间', '英伟达（营收 +106%、远期 PE 15×）、博通（+86%）、美光与 SK 海力士（存储涨价，营收 +379%/+257%）、Palantir（+93%）、Dell（+58%）、Amphenol（+55%）。英伟达远期 PE 只有 15×，是“高增长 + 不贵”最接近的组合，但按 TTM 口径的 2:1 价约 169 美元。'),
   ('回避', 'Palantir（PE 167×）、Arm（304×）、Datadog（543×）、Lumentum（TTM 亏损、一年涨 7 倍）、康宁（PE 75×）。美光、SK 海力士、三星的低 PE 是存储周期高峰利润，不能当便宜。'),
  ],
  rules=[
   '同一风险合并计：英伟达、AMD、博通、Marvell、台积电同属 AI 芯片链；美光、SK 海力士、三星同属存储周期；Dell、HPE、Super Micro 同属服务器；微软、亚马逊、谷歌、Meta 是同一批云资本开支的买方。同一条链只算一份仓位。',
   '云厂资本开支是共同变量：一旦四大云厂下调资本开支指引，芯片、网络、电力设备会同时下修。',
   '与中国 AI 公司不叠加：中际旭创、新易盛、工业富联的需求同样来自北美云厂，合并算一份风险。',
   '共同外部风险：美国对华出口管制、台海地缘、利率、AI 应用变现慢于投入。',
  ],
  footer='Pure Storage（PSTG）本次未取到行情（代码可能已变更）。SK 海力士、三星只有远期 PE，按高峰周期不建模。数据为 Yahoo Finance 2026-10-07 延迟快照，增速是最近一季同比，不是半年口径；价位来自本站程序化倍数模型，未经公司级三情景认证。本报告仅供研究参考，不构成个人投资建议。'),
 'adas': dict(
  summary=[
   ('适合买', '15 家里没有一家达到 2:1。Versigent（PE 7×、盈亏比 1.72）便宜但只是线束分销，毛利 12%。英伟达、Uber（PE 15×）、NXP（PE 20×、盈利 +73%）是价格与基本面相对平衡的。'),
   ('有壁垒', '英伟达（车载算力平台）、特斯拉（FSD 数据闭环）、Waymo（通过 Alphabet）、Uber（出行网络）、NXP（汽车 MCU 与雷达）、高通。'),
   ('增长空间', 'L4 Robotaxi 是最大增量：Waymo、特斯拉 Robotaxi、Aurora（无人卡车，营收 +100%）。激光雷达 Ouster 营收 +56%，但仍亏损。'),
   ('回避', '特斯拉（PE 350×，汽车业务利润率约 1%）、Mobileye（营收持平、亏损，被中国与英伟达方案替代）、Serve Robotics、BlackBerry（PE 68×）。'),
  ],
  rules=[
   '同一风险合并计：英伟达、高通、NXP、onsemi、Ambarella、Mobileye 同属车载芯片；Waymo（Alphabet）、特斯拉、Uber、Aurora 同属 Robotaxi 赛道。',
   '与中国智能驾驶公司不叠加：禾赛、地平线与 Mobileye、Ouster 是直接竞争关系，不能同时押注两边都赢。',
   '共同外部风险：汽车销量周期、L4 监管与事故责任、关税。',
  ],
  footer='ZF 未独立上市；Waymo 没有独立股票，按母公司 Alphabet 研究。数据为 Yahoo Finance 2026-10-07 延迟快照，价位来自本站程序化倍数模型。本报告仅供研究参考，不构成个人投资建议。'),
 'robot': dict(
  summary=[
   ('适合买', '16 家里没有一家达到 2:1。NSK（PE 24×、盈亏比 1.58）最接近，但盈利 +793% 是低基数。直觉外科（手术机器人，PE 48×）和 FANUC（PE 35×、无负债）质量最高。'),
   ('有壁垒', '直觉外科（装机量与培训生态）、FANUC、Yaskawa、ABB（工业机器人四大家族中的三家）、Harmonic Drive（谐波减速器）、Nabtesco（RV 减速器）、THK（导轨）、Cognex（机器视觉）、Teradyne（UR 协作机器人）。'),
   ('增长空间', '人形机器人带来的核心部件需求：Harmonic Drive、THK、NSK 的丝杠与减速器；Teradyne（营收 +104%，主要来自 AI 芯片测试）。'),
   ('回避', 'Harmonic Drive（PE 388×，人形概念已透支）、特斯拉 Optimus（无独立收入，PE 350×）、Symbotic（PE 541×）。'),
  ],
  rules=[
   '同一风险合并计：Harmonic Drive、Nabtesco、THK、NSK 同属核心部件；FANUC、Yaskawa、ABB 同属工业机器人整机。与中国的绿的谐波、双环传动属于同一需求逻辑。',
   '日本公司以日元计价，汇率波动会直接影响美元或人民币回报。',
   '人形机器人量产节奏不确定，概念溢价高的部件公司可能腰斩。',
  ],
  footer='Figure AI 未上市；波士顿动力不是独立上市证券（母公司现代汽车）。数据为 Yahoo Finance 2026-10-07 延迟快照，价位来自本站程序化倍数模型。本报告仅供研究参考，不构成个人投资建议。'),
 'biotech': dict(
  summary=[
   ('适合买', '25 家里只有第一三共（PE 19×、盈亏比 2.17）达到门槛，它是 ADC 平台（Enhertu），但最近季盈利 −18%。再生元（PE 18×、1.98）、阿斯利康（PE 24×、远期 14×、1.41）接近。'),
   ('有壁垒', '礼来与诺和诺德（GLP-1）、福泰（囊性纤维化垄断）、再生元、安进、阿斯利康、第一三共（ADC）、Thermo Fisher、Danaher、Illumina、Alnylam（RNAi）。'),
   ('增长空间', '礼来（营收 +48%，减重药）是大药企里增长最快的；Alnylam（营收 +67%）。诺和诺德营收仅 +2%、盈利 −21%，被礼来抢走份额，PE 9×是“价值陷阱”还是“错杀”需要验证。'),
   ('回避', '摩德纳、BioNTech、Ionis、Intellia（亏损或收入大幅下滑）；Biogen（盈利 −85%）、Repligen（PE 229×）。默沙东、艾伯维的 TTM PE 含并购费用，按远期 PE（15×/17×）看并不贵。'),
  ],
  rules=[
   '同一风险合并计：礼来、诺和诺德、Viking 同属 GLP-1 减重；Thermo Fisher、Danaher、Agilent、Repligen 同属生命科学工具；CRISPR、Intellia 同属基因编辑。',
   '专利悬崖是大药企的核心风险：默沙东 Keytruda、再生元 Eylea 的专利到期会让盈利跳空下降。',
   '与中国创新药不叠加：中国药企的海外授权买方正是这些大药企，授权节奏同向变化。',
   '共同外部风险：美国药价谈判（IRA）、FDA 审评、关税。',
  ],
  footer='诺和诺德在两个环节以不同代码出现，只列一次。数据为 Yahoo Finance 2026-10-07 延迟快照；亏损生物科技应按管线 rNPV 估值，本页不给 PE 价位。本报告仅供研究参考，不构成个人投资建议。'),
 'aerospace': dict(
  summary=[
   ('适合买', '28 家里没有一家达到 2:1。AerCap（PE 7×、1.52）、达美（PE 14×、1.38）、美联航（PE 10×、1.30）、空客（PE 25×、1.23）接近，但航司利润都在下滑。'),
   ('有壁垒', 'GE 航空航天（LEAP 发动机售后）、RTX、赛峰、罗罗（发动机三巨头）、空客与波音（双寡头）、TransDigm（独家零部件定价权）、Howmet（发动机叶片）、SpaceX（可回收火箭）。'),
   ('增长空间', 'SpaceX（营收 +92%，星链）、Rocket Lab（+62%）、MDA Space（+34%）、Howmet（+24%）、GE 航空航天（+21%）。发动机售后是航空里最稳的增长。'),
   ('回避', 'eVTOL（Joby、Archer、Eve）和卫星新贵（AST SpaceMobile、Planet Labs、Globalstar、Viasat）都在亏损。SpaceX 新上市，市值约 2.2 万亿美元、TTM 亏损，不建模。'),
  ],
  rules=[
   '同一风险合并计：GE、赛峰、罗罗、Howmet、ATI、Carpenter 同属发动机链；达美、美联航、瑞安同属航空运输；Joby、Archer、Eve 同属 eVTOL。',
   '航空公司受油价与经济周期影响，悲观情景按 30% 盈利折扣。',
   '与中国航空航天不叠加：中国商飞供应链与空客、波音存在竞争关系。',
  ],
  footer='数据为 Yahoo Finance 2026-10-07 延迟快照，价位来自本站程序化倍数模型，未经公司级三情景认证。本报告仅供研究参考，不构成个人投资建议。'),
 'newenergy': dict(
  summary=[
   ('适合买', '32 家里只有 NextEra（PE 17×、PEG 0.33、盈亏比 2.39）达到门槛，它是美国最大的可再生能源运营商，属于防御资产，对利率敏感。Umicore（PE 10×、1.67）接近，但毛利率只有 8%。'),
   ('有壁垒', 'GE Vernova（燃机寡头）、Siemens Energy、Vestas（风机）、NextEra、First Solar（美国本土制造补贴）、BWX Technologies（海军核反应堆独家）、Cameco（铀矿）、Air Products。'),
   ('增长空间', '电力设备是最强的增长：GE Vernova（订单排到 2029）、Siemens Energy（盈利 +80%）、Bloom Energy（营收 +166%，数据中心供电）。'),
   ('回避', '16 家回避，主要是固态电池（QuantumScape、Solid Power）、氢能（Plug、Ballard、Nel）、新型储能（Eos、ESS、Energy Vault、Fluence）、小型核电（Oklo、NuScale），它们都在亏损；Bloom PE 383×。'),
  ],
  rules=[
   '同一风险合并计：GE Vernova、Siemens Energy、Eaton 同属电力设备（也是 AI 用电主题）；Cameco、Centrus、BWXT、Oklo、NuScale 同属核能；Plug、Ballard、Nel 同属氢能。',
   '美国政策风险：IRA 补贴调整会直接影响 First Solar、Enphase、NextEra 的盈利。',
   '与中国新能源不叠加：中国电池、光伏与这些公司直接竞争，关税变化方向相反。',
  ],
  footer='数据为 Yahoo Finance 2026-10-07 延迟快照，价位来自本站程序化倍数模型。本报告仅供研究参考，不构成个人投资建议。'),
 'semi': dict(
  summary=[
   ('适合买', '32 家里东京电子（PE 10×、PEG 0.25、盈亏比 2.00）和西门子（PE 27×、2.09）达到门槛。东京电子是涂胶显影与刻蚀设备龙头，中国收入占比高；西门子达标部分因为本赛道中位 PE（48×）偏高，抬高了基准倍数。Amkor（1.90）、达索（1.35）接近。'),
   ('有壁垒', '阿斯麦（EUV 独家）、台积电、应用材料、泛林、科磊（设备四巨头）、新思与楷登（EDA 双寡头）、德州仪器、ADI、英飞凌、Advantest、ASM International。'),
   ('增长空间', '台积电（营收 +36%、EPS +77%）、博通、美光（存储周期）、Advantest（+39%）、Teradyne（+104%）、东京电子（+33%）。'),
   ('回避', 'Arm（PE 304×）、英飞凌（PE 66×，增长一般）。意法半导体、Microchip 的 TTM 利润处于周期底部，PE 失真。'),
  ],
  rules=[
   '同一风险合并计：应用材料、泛林、科磊、阿斯麦、东京电子、ASM 同属前道设备；Advantest、Teradyne、FormFactor 同属测试；德州仪器、ADI、英飞凌、意法、Microchip 同属模拟/功率周期。',
   '设备股对中国出口管制最敏感：中国收入占比普遍 25–40%，管制升级会直接压低订单。',
   '与中国半导体不叠加：北方华创、中微正在替代这些公司的中国份额，两边结论方向相反。',
  ],
  footer='数据为 Yahoo Finance 2026-10-07 延迟快照，价位来自本站程序化倍数模型（高 PE 成长股偏严）。本报告仅供研究参考，不构成个人投资建议。'),
 'material': dict(
  summary=[
   ('适合买', '17 家里没有一家达到 2:1。Constellium（PE 7×、1.67）便宜但是铝材周期股。林德（PE 31×）是质量最高的工业气体龙头。'),
   ('有壁垒', '林德（工业气体全球第一）、康宁（特种玻璃）、Hexcel（航空碳纤维）、ATI 与 Carpenter（高温合金）、Victrex（PEEK）、圣戈班。'),
   ('增长空间', 'MP Materials（营收 +120%，美国唯一稀土矿，依赖政府订单）、Lynas（+87%）；高温合金（ATI、Carpenter）受益航空发动机。'),
   ('回避', '康宁（PE 75×）、阿科玛（PE 219×）；MP Materials 仍亏损。'),
  ],
  rules=[
   '同一风险合并计：MP Materials、Lynas 同属稀土（与中国北方稀土逻辑相反，受益于中国出口管制）；ATI、Carpenter 同属高温合金（与航空航天主题重复）。',
   '材料多为周期股，悲观情景按 25–30% 盈利折扣。',
   '共同外部风险：稀土出口管制、关税、能源价格（欧洲化工）。',
  ],
  footer='数据为 Yahoo Finance 2026-10-07 延迟快照，价位来自本站程序化倍数模型。本报告仅供研究参考，不构成个人投资建议。'),
 'frontier': dict(
  summary=[
   ('适合买', '16 家里没有一家达到 2:1。波士顿科学（PE 17×、盈亏比 1.58，股价在 52 周低点）、美敦力（PE 21×）是脑机接口相关的大型器械公司，靠主业赚钱。'),
   ('有壁垒', '美敦力（脑深部刺激）、IBM 与谷歌（量子计算路线图）、Quantinuum（离子阱）、Keysight（测试测量）、Novonesis（工业酶）。'),
   ('增长空间', '量子计算公司营收增速最高（IonQ +287%、Quantinuum +279%），但规模很小且深度亏损；Keysight（营收 +36%、盈利 +109%）是量子与 AI 测试的“卖铲人”。'),
   ('回避', 'Rigetti、D-Wave、QUBT（亏损、题材定价）；Ginkgo（营收 −48%）。'),
  ],
  rules=[
   '前沿主题只放极少的主动额度：纯量子公司收入规模小，股价由题材驱动，波动极大。',
   '同一风险合并计：IonQ、Rigetti、D-Wave、Quantinuum、QUBT 同属量子计算；Ginkgo、Twist 同属合成生物。',
   '先看主业：美敦力、IBM、谷歌的前沿业务只占很小比例，按主业估值。',
  ],
  footer='Neuralink 未上市；Amyris 上市状态待核。数据为 Yahoo Finance 2026-10-07 延迟快照，价位来自本站程序化倍数模型。本报告仅供研究参考，不构成个人投资建议。'),
}
