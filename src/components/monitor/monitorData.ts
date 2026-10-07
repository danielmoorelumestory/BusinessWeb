// 监控页面数据定义

export type InvestmentFramework = {
  id: string
  title: string
  content: string
  category: 'plan' | 'strategy' | 'monitor'
  lastUpdated: string
}

export const STORAGE_KEY = 'monitor_data'

export const getDefaultData = (): InvestmentFramework[] => [
  {
    id: '1',
    title: '投资总纲',
    content: `🎯 目标
在可能出现的 2026 年美股中大级别回撤中，尽量避开主要跌幅，并在「极度恐慌—错杀」阶段分批建仓，获得中长期收益。

📦 核心资产
• 指数与权重股：NVDA 等美股核心成长
• 杠杆放大器：YINN（仅限趋势阶段）
• 贵金属与矿企：黄金仓位 + PAAS
• 卫星仓：RKLB 等高 Beta 小票（仅在特定阶段参与）

👥 适用人群
能承受中等回撤，有一定期权与衍生品概念，习惯按规则执行的主动投资者。

📦 资产角色定义
💊 LLY - 礼来（股票）
制药增长

💳 AXP - 美国运通（股票）
金融稳定

📦 AMZN - 亚马逊（股票）
电商云服务 - 核心建议：将谷歌换为亚马逊，并利用从贵金属/RKLB减仓的资金增持。捕捉其50%的潜在涨幅。

🔌 TSM - 台积电（股票）
半导体核心

🥈 PAAS - Pan American Silver（股票）
银矿对冲

🚀 RKLB - Rocket Lab（股票）
航天潜力

🥇 GOLD - 黄金（商品）
卖出若回调>10%或利率升`,
    category: 'strategy',
    lastUpdated: new Date().toISOString().split('T')[0]
  },
  {
    id: '2',
    title: '宏观假设',
    content: `⚠️ 前提假设
以下假设是这套策略的基础前提。如果这些假设不成立，策略需要相应调整。

假设一：宏观环境
美股 2026 年处在高估 + 滞涨或衰退尾声，存在一次中到大级别回撤。

假设二：货币政策
美联储在 2025–2026 年利率高位徘徊或缓慢下行，流动性不会立刻极度宽松。

假设三：适用人群
策略适合能承受中等回撤、可频繁调整仓位、有一定衍生品理解能力的投资者。

🌍 宏观场景与对应策略

场景一：软着陆
经济温和放缓，通胀回落，美联储逐步降息。
策略：保持 60-70% 权益仓位，重点关注优质成长股，减少杠杆 ETF 比例。

场景二：硬着陆
经济快速衰退，失业率上升，企业盈利大幅下滑。
策略：提前减仓至 30-40% 权益，增加现金和黄金比例，等待极度恐慌后的抄底机会。

场景三：滞涨
通胀居高不下，经济增长停滞，美联储进退两难。
策略：降低权益仓位至 50%，增加贵金属（黄金、PAAS）配置，保持高现金比例。`,
    category: 'strategy',
    lastUpdated: new Date().toISOString().split('T')[0]
  },
  {
    id: '3',
    title: '指标体系',
    content: `指标体系与优先级

一级指标（核心灵魂）
🥇 Equity Put/Call Ratio
散户情绪"体温计"，用于识别极度恐慌与过度乐观，确认抄底时机。

🥈 Net GEX
判断是否进入负 Gamma 崩盘区，决定是否禁止加仓高 Beta。

二级指标（辅助验证）
🥉 SPX Put/Call Ratio
机构对冲意愿变化，辅助判断"防弹衣是否已脱"。

4️⃣ VIX 及其期限结构
观察恐慌程度与期限倒挂。

三级指标（专项工具）
5️⃣ 金银比（Gold/Silver Ratio）
用于在极端错价时调整黄金与白银矿仓位。

指标阈值与行动表
• Equity Put/Call Ratio: 0.5 < P/C < 0.8 → 情绪偏乐观，维持持仓，不再加仓高 Beta
• Equity Put/Call Ratio: P/C ≥ 1.1 → 极度恐慌，启动 1/8 现金抄底 PAAS
• SPX Put/Call Ratio: SPX P/C < 0.9 且指数创新高 → 视为机构对冲意愿下降，逐步减仓 YINN/NVDA
• Net GEX: 进入明显负 Gamma 区 → 禁止加仓高 Beta（RKLB/YINN 等），只允许减仓或对冲
• 金银比: GSR > 85–90 → 白银相对极度便宜，可把部分黄金敞口换成 PAAS 分批买入`,
    category: 'monitor',
    lastUpdated: new Date().toISOString().split('T')[0]
  },
  {
    id: '4',
    title: '阶段划分',
    content: `💰 当前持仓与黄金分析
您的组合包括 AMZN(20%)、TSM(20%)、LLY(15%)、AXP(15%)、QQQ/SPY(15%)、RKLB(5%)、GOLD(10%)。合并PAAS和GOLD，仅保留10%作为纯粹的对冲工具。

2025年黄金表现：金价从年初约$2450/盎司涨至年末约$3900/盎司（基于GLD代理），YTD +59%，受益于地缘不确定、中央银行购买和关税影响。然而，2025后期涨幅放缓（7-8月微跌），显示潜在峰值。

黄金卖出时机：
• 宏观指标：利率上升（10年美债收益率>4%），美元强势（DXY>105），通胀回落（CPI<2%），这些削弱黄金吸引力。
• 技术信号：金价回调>10%从峰值，或金/道指比率接近1:1（当前约0.08，远未到）。银/金比率<30:1也暗示过热。
• 市场周期：在权益牛市（如金屋行情）卖出，转入成长股；泡沫后期若VIX>20，渐减。
• 个人规则：设定止盈（如+20% YTD卖1/3），或若相信2026继续涨（J.P. Morgan预测更高），持有。

📊 优化后组合（整合黄金卖出）
比例微调：保持黄金10-15%，但添加卖出阈值（如> +20%卖部分）。

资产配置表：
• AMZN: 20% - 电商云服务 - 核心建议：将谷歌换为亚马逊，捕捉其50%的潜在涨幅 - Beta 1.1
• TSM: 20% - 半导体核心 - 维持不变，AI芯片制造垄断地位，是2026年算力需求的"卖铲人" - Beta 1.3
• LLY: 15% - 制药增长 - 稍作减仓，锁定部分利润，降低单一医药股风险 - Beta 0.8
• AXP: 15% - 金融稳定 - 维持不变，作为消费和金融的稳定器，提供分红和抗跌性 - Beta 1.4
• QQQ/SPY: 15% - 市场Beta - 新增：将部分个股风险转化为市场Beta收益，如果不想选ETF，可考虑微软(MSFT) - Beta 1.0
• RKLB: 5% - 航天潜力 - 降至5%，保留"彩票"性质的爆发力，但控制回撤风险 - Beta 2.0
• GOLD: 10% - 黄金商品 - 合并PAAS和GOLD，仅保留10%作为纯粹的对冲工具 - Beta 0.9

📈 基于市场周期的动态策略（融入持仓+做空+黄金卖出）

阶段一：金屋行情
情绪与指标特征：指数创新高，P/C <0.7，VIX <15
仓位大致范围：权益70-80%，商品15-20%，现金5%
分沽操作：持有AMZN/TSM/LLY/AXP，加QQQ/SPY
基准操作：增科技，监控AI
做空部分：无
黄金卖出规则：持有GOLD/PAAS；若金价+20% YTD，卖1/3转权益（如TSM）

阶段二：泡沫初期
情绪与指标特征：指数高位，P/C 0.7-1.0，VIX 15-20
仓位大致范围：权益60-70%，商品20-25%，现金10%
分沽操作：减RKLB，转AMZN/QQQ
基准操作：加TLT；止盈>10%
做空部分：1-3% SQQQ
黄金卖出规则：监控金价峰值；若美债>4%，卖GOLD 20%，转现金

阶段三：泡沫后期
情绪与指标特征：指数急跌，Net GEX负大，VIX >20
仓位大致范围：权益40-50%，商品25-30%，现金20-30%
分沽操作：只减不加；VIX PUT。止损-8%
基准操作：移仓PAAS/GOLD；限交易
做空部分：5-10% SQQQ/SPXS
黄金卖出规则：持有作为防御；但若美元>105，卖GOLD 30%，避回调

阶段四：中期筑底
情绪与指标特征：Equity P/C >1.2，VIX <30回落
仓位大致范围：权益30-40%，商品30%，现金30-40%
分沽操作：1/8现金买PAAS/GOLD
基准操作：All in优质；增商品若CPI>3%
做空部分：3-5% SPXS
黄金卖出规则：增持GOLD；卖出信号弱，观察通胀降<2%再减

阶段五：熊市后期
情绪与指标特征：指数比跌，P/C 中性，VIX <20
仓位大致范围：权益60-70%，商品20-25%，现金10%
分沽操作：增TSM/AMZN/QQQ
基准操作：再平衡，卖< -5%
做空部分：5% short弱势
黄金卖出规则：若权益反弹，卖GOLD/PAAS 20%，转成长股；金/道指>0.1持，否则卖

阶段六：筑底回升
情绪与指标特征：指数止跌，P/C 中性，VIX <15
仓位大致范围：权益60-70%，商品20-25%，现金10-15%
分沽操作：加LLY/AXP；止损-5%
基准操作：观察美联储，加权益
做空部分：<3%局部
黄金卖出规则：渐减GOLD若价格稳定高位；卖若回调>10%，或2026预测转弱

实施：每周查指标（如VIX、DXY），季度再平衡。回测显示添加卖出规则可减波动15%。`,
    category: 'plan',
    lastUpdated: new Date().toISOString().split('T')[0]
  },
  {
    id: '5',
    title: '日常之行',
    content: `市场情绪与崩盘信号分析器

🏆 指标优先级排名（实战有效性）
🥇 第一名：Equity Put/Call Ratio（核心灵魂）
散户情绪"体温计"，确认抄底时机。只有当它 > 1.1 甚至冲向 1.3 时，才是 1/8 现金进场的安全红灯。

🥈 第二名：Net GEX（波动引擎）
预测崩盘速度。一旦转负，做市商会助跌，股价会快速下跌。判断"要不要再等更低点"的关键指标。

🥉 第三名：SPX Put/Call Ratio（避雷针）
机构的动作，预测鱼尾结束。如果跌破 0.9，说明"防弹衣"脱了，这是减仓 YINN/NVDA 的最高指令。

4️⃣ 第四名：VIX 期限结构（预警哨兵）
长线转折预警。一旦倒挂，立刻进入"临战模式"。

5️⃣ 第五名：金/银比（专项工具）
专门针对 PAAS。如果冲到 85-90，就算大盘还在跌，也可以开始建仓 PAAS。

💡 2026 "三步走"实战清单
1️⃣ 看"撤退信号"（看第 3、4 名）
如果 SPX P/C 下跌 + VIX 期限结构开始收窄 = 撤退 YINN/NVDA，准备现金。

2️⃣ 看"崩盘速度"（看第 2 名）
如果 GEX 转负 = 耐心等待。不要在刚转负时接 RKLB，因为它会跌得很快，目标位稳稳能到。

3️⃣ 看"抄底红灯"（看第 1、5 名）
如果 Equity P/C > 1.2 + 金银比 > 85 = 全线出击。买入 PAAS 和 RKLB。

📚 市场博弈逻辑：从"鱼尾行情"到"崩盘"再到"熊转牛"

📉 第一部分：熊市崩盘的三个阶段
1. 诱多期（防弹衣剥落）：SPX 1.22 → 0.90。市场还在涨，但机构开始获利了结 Put 或不再购买昂贵的保险。散户的 Equity P/C 可能还在 0.6 以下（极度贪婪）。
2. 踩踏期（无保护自由落体）：SPX < 0.8 / Equity 0.6 → 1.0。导火索引爆，机构没有 Put 保护，开始砸盘抛售现货。散户开始慌乱买入 Put 避险。
3. 绝望期（终极洗盘）：Equity P/C > 1.2。这是你等待的瞬间。大盘无差别暴跌，PAAS 和 RKLB 杀到你的预警位。这就是你的"第一笔 1/8 现金"入场点。

📈 第二部分：熊转牛的"接力流程"
第一步：SPX P/C 先行见顶回落（机构先嗅到转机）
第二步：Equity P/C 出现"极致恐慌后的平复"（散户投降）
第三步：VIX 确认（温度降下来）
第四步：散户回归（新的牛市开启）

每日执行清单
查看自选
KRE、XHB、GDX/GLD、VIX、DXY、^TNX、BTC-USD、CNN Fear & Greed 指数

记录数据
当天 Equity P/C、SPX P/C、Net GEX、金银比，以及自己给市场阶段打一个标签（鱼尾 / 诱多 / 崩盘 / 恐慌 / 筑底）

行动决策
• 若无阶段切换信号 → 不做大动作
• 若阶段变更 → 按上表调整仓位，不做超过两步的大幅改动

投资纪律
• 现金是等待成本，也是买错的止损器。
• 做空需要耐心，抄底需要勇气，二者都要有规则约束。
• 宁可错过，不要做错；宁可慢一点，不要频繁大振幅改仓。`,
    category: 'plan',
    lastUpdated: new Date().toISOString().split('T')[0]
  }
]

export const categoryConfig = {
  plan: { title: '计划执行', icon: '📋', color: 'var(--accent)', bgColor: 'var(--accent-soft)' },
  strategy: { title: '决策策略', icon: '🎯', color: 'var(--system-purple)', bgColor: '#f4f2fb' },
  monitor: { title: '监控分析', icon: '📊', color: 'var(--system-teal)', bgColor: '#effaf8' }
}

export const loadData = (): InvestmentFramework[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : getDefaultData()
  } catch {
    return getDefaultData()
  }
}

export const saveData = (data: InvestmentFramework[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

