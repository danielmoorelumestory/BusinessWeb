import { GRID_TRADING_PATH } from './notesLinks'

export type LabVerdict = 'strong' | 'recommend' | 'try' | 'experiment' | 'avoid'
export type LabStatus = '进行中' | '计划中' | '未开始' | '已暂停' | '已停止' | '不做'

export interface LabShowcaseItem {
  title: string
  desc: string
  path: string
}

export interface LabLogEntry {
  date: string
  did: string
  result: string
}

export interface LabDirection {
  slug: string
  title: string
  verdict: LabVerdict
  fit: 1 | 2 | 3 | 4 | 5
  status: LabStatus
  /** 卡片上的一句理由 */
  reason: string
  /** 详情页：为什么做 / 为什么不做 */
  why: string
  hoursPerWeek?: number
  startCost?: string
  limits?: { budget?: string; deadline?: string; stopWhen?: string }
  firstStep?: string
  /** 尚未验证的商业假设，展示在项目二级页 */
  plan?: {
    audience: string
    product: string
    acquisition: string
    monetization: string
    validation: string
    cautions: string[]
  }
  /** 只记已经发生的事，没开始就留空 */
  logs: LabLogEntry[]
}

export const VERDICT_LABEL: Record<LabVerdict, string> = {
  strong: '强烈推荐',
  recommend: '推荐',
  try: '可以试',
  experiment: '实验',
  avoid: '不推荐',
}

// 只放已经做出来、能直接用的东西
export const LAB_SHOWCASE: LabShowcaseItem[] = [
  { title: '投资分析 Skill 包', desc: '三套投资分析 Skill 专家，可完整下载', path: '/invest/ai-tools' },
  { title: '公司估值', desc: '六方法三情景估值与报告导出', path: '/valuation' },
  { title: '网格交易', desc: 'ETF / 个股网格模拟、回测与记录', path: GRID_TRADING_PATH },
  { title: '这个网站', desc: '用 React 自己搭的个人站，本身就是第一个作品', path: '/about' },
]

// 顺序即同分时的展示顺序
export const LAB_DIRECTIONS: LabDirection[] = [
  {
    slug: 'ai-skills',
    title: 'AI 工具 / Skill / Agent',
    verdict: 'strong',
    fit: 5,
    status: '进行中',
    reason: '已有三套投资 Skill，新领域有先发优势',
    why: '把自己反复做的事写成 Skill、Agent 或 MCP，先给自己用，再公开分享。程序员加投资作者的组合刚好能做出别人做不出的专业 Skill，而且这个领域还很新。',
    hoursPerWeek: 3,
    startCost: '¥0',
    firstStep: '把三套投资 Skill 的使用反馈整理出来，挑最常用的一个做成可单独安装的版本。',
    logs: [
      { date: '2026-10-06', did: '发布三套投资分析 Skill 的介绍页与完整下载包', result: '已上线到「投资 › AI 工具」' },
    ],
  },
  {
    slug: 'indie-dev',
    title: '独立产品开发',
    verdict: 'strong',
    fit: 5,
    status: '进行中',
    reason: '程序员本行，第一个产品从书里长出来',
    why: '路线是：建站 → 投资研究助手 V0.1 → 公开验证。V0.1 输入一家公司，按书里的框架一步步提问：分类、产业、商业模式、护城河、财报、估值、周期、证伪条件，最后生成投资决策卡，不预测涨跌。',
    hoursPerWeek: 4,
    startCost: '¥0',
    limits: { stopWhen: '找不到 20 个愿意持续使用的真实用户，就回到框架本身重新想' },
    firstStep: '做出投资研究助手 V0.1 的最小版本，找 20 个真实用户试用。',
    logs: [
      { date: '2026-10-04', did: '个人网站改版为「正念生活」，按书重组栏目', result: '网站作为第一个作品上线' },
    ],
  },
  {
    slug: 'free-tools',
    title: '免费在线工具',
    verdict: 'recommend',
    fit: 4,
    status: '未开始',
    reason: '做一次长期获客，和书互相引流',
    why: '比如 FIRE / 400 万倒计时计算器、家庭财务体检、定投回测。工具解决一个具体问题，用的人会顺着找到书和其他作品。',
    hoursPerWeek: 2,
    startCost: '¥0',
    firstStep: '先做一个 FIRE 倒计时计算器：输入资产、储蓄率、预期收益，算出离目标还有几年。',
    logs: [],
  },
  {
    slug: 'digital-goods',
    title: '数字商品',
    verdict: 'recommend',
    fit: 4,
    status: '未开始',
    reason: '无库存、几乎不用客服',
    why: '书的电子版、投资计划 Notion / Excel 模板、Skill 完整包、小册子。做一次可以卖很多次，和个人定位最搭。',
    hoursPerWeek: 2,
    startCost: '¥0',
    firstStep: '把 2026 投资计划整理成一份可复制的模板，先免费发，看有多少人要。',
    logs: [],
  },
  {
    slug: 'blog',
    title: '博客',
    verdict: 'recommend',
    fit: 4,
    status: '未开始',
    reason: '沉淀自己的读者，也整理思路',
    why: '写 AI 编程实践、副业实验复盘、工具背后的思考。写作本身就是整理思路，文章也是其他方向的入口。',
    hoursPerWeek: 2,
    startCost: '¥0',
    firstStep: '每两周一篇，第一篇写这个 AI 实验室为什么这样分方向。',
    logs: [],
  },
  {
    slug: 'image-tools',
    title: '垂直图片工具 · 按次收费',
    verdict: 'try',
    fit: 3,
    status: '未开始',
    reason: '从商品图或宠物纪念画切入，先验证付费与单笔利润',
    why: '上传图片、选择效果、生成并下载，可以做成一个范围很小的产品。程序员能较快做出原型，但通用换风格的替代品多，需要选一个具体人群，验证用户是否愿意为稳定、可直接使用的结果付费。匹配度是当前判断，尚无用户与收入数据。',
    hoursPerWeek: 2,
    startCost: '¥0 起，先做需求访谈',
    limits: { budget: '建议 ¥500，覆盖接口、托管和试用成本；先不投广告', deadline: '建议 4 周，一次只验证一个场景', stopWhen: '到期仍无真实付费，或计入重试、退款后单笔贡献持续为负，暂停扩展并复盘' },
    firstStep: '在电商商品图和宠物纪念画中只选一个场景，访谈 5 位目标用户，用少量经授权的样图验证效果，再做上传、生成与付费下载的最小流程。',
    plan: {
      audience: '需要商品展示图的小商家，或想制作宠物纪念画的宠物主人；首轮只选一类。',
      product: '一个场景、少量预设效果和清楚的交付规格，记录生成失败与重试。',
      acquisition: '发布真实前后对比和操作演示，向对应社群的小范围用户展示，记录每个渠道带来的试用与付款。',
      monetization: '先验证按次付费；出现重复购买后再考虑次数包，首轮不依赖订阅。',
      validation: '建议目标：获得至少 3 位非亲友支持性质的付费用户；逐单记录售价、生成与重试成本、支付费用、退款和获客支出。这个目标是实验门槛，不是收入预测。',
      cautions: ['单笔贡献 = 实收金额 − 生成与重试成本 − 支付费用 − 退款损失 − 获客与售后成本；同时记录自己的服务时间。', '效果容易被替代，要验证交付质量和重复需求；展示案例须有使用授权，上传图片的保存与删除方式需要讲清楚。'],
    },
    logs: [],
  },
  {
    slug: 'mini-program',
    title: '家庭财务体检小程序',
    verdict: 'try',
    fit: 3,
    status: '未开始',
    reason: '复用财务内容与开发能力，先验证需求，再决定微信入口',
    why: '小程序是交付渠道，需要先确定产品解决什么问题。先从家庭财务体检切入：输入资产、负债和月结余，生成现金储备与目标进度摘要。这与现有内容相近，但微信触达、重复使用和付费意愿都还没有验证，因此暂不放到最高推荐等级。',
    hoursPerWeek: 2,
    startCost: '¥0 起，先用网页原型',
    limits: { budget: '建议 ¥300 用于原型、接口与托管；平台认证等费用另行核实', deadline: '建议 4 周，先验证一个使用流程', stopWhen: '到期仍无真实用户完成流程并愿意再次使用，或微信入口没有带来使用便利，暂停小程序开发' },
    firstStep: '先邀请 5 位目标用户试用一个无需登录的网页原型，观察他们能否独立完成财务体检；确认需求与微信使用场景后，再核对主体条件和发布成本。',
    plan: {
      audience: '希望梳理家庭资产负债与现金储备的人；现有文章读者是待验证的首批触达对象。',
      product: '只做家庭财务体检与目标进度摘要，不接入账户，不提供荐股或收益承诺；原型尽量在本地计算。',
      acquisition: '从相关文章和工具演示导流，观察用户是否愿意分享、再次打开；微信入口的价值需要单独验证。',
      monetization: '基础体检免费，先询问用户愿意为哪些报告或模板付费，再验证一次性购买；不预设订阅成立。',
      validation: '建议目标：至少 5 位真实用户独立完成流程，其中至少 2 位在第二周再次使用或明确提出持续需求；如测试收费，单独记录真实付款。',
      cautions: ['小程序与网页服务同一个需求，先比较访问便利、分享和回访，再决定是否维护两个版本。', '家庭财务信息较私密，首轮避免收集身份与账户信息；每周时间和预算是建议边界，开始前再确认。'],
    },
    logs: [],
  },
  {
    slug: 'newsletter',
    title: 'Newsletter',
    verdict: 'recommend',
    fit: 3,
    status: '计划中',
    reason: '读者归自己，等有读者再开',
    why: '每月一封：实验进展加投资计划执行情况。读者是自己的，不受平台推荐影响。读者太少时发出去没有回应，所以放在博客之后。',
    hoursPerWeek: 1,
    startCost: '¥0',
    firstStep: '博客写满 6 篇后再开订阅。',
    logs: [],
  },
  {
    slug: 'video',
    title: '视频',
    verdict: 'try',
    fit: 3,
    status: '未开始',
    reason: '曝光大但很耗时，先做录屏 + 字幕',
    why: '视频平台曝光最大，但一条像样的视频至少 3 到 5 小时，和每周几小时的预算冲突。先用最低成本的形式试：工具演示录屏加字幕。',
    hoursPerWeek: 2,
    startCost: '¥0',
    limits: { deadline: '先做 5 条', stopWhen: '5 条之后看播放与反馈，没有起色就停' },
    firstStep: '录一条「公司估值」工具的使用演示。',
    logs: [],
  },
  {
    slug: 'game-guides',
    title: '游戏攻略与工具站 · 广告变现',
    verdict: 'experiment',
    fit: 2,
    status: '未开始',
    reason: '只做熟悉的一款游戏，靠原创攻略和实用工具验证流量',
    why: '建站能力可以复用，但游戏知识、内容更新和获客需要额外积累。只有自己熟悉、愿意持续玩的游戏才值得尝试。先做一款游戏的实测攻略或配装计算器，观察真实玩家是否使用；尚无流量数据，不把批量建站或广告收入当作已验证模式。',
    hoursPerWeek: 3,
    startCost: '¥0 起，先用现有建站能力',
    limits: { budget: '建议 ¥300，覆盖域名与托管；先不买流量', deadline: '建议 8 周，只做一款游戏', stopWhen: '到期仍无真实玩家使用或主动反馈，且无明确改进线索，暂停扩展；首轮不以广告收入多少作为唯一判断' },
    firstStep: '选一款自己熟悉的游戏，整理 5 个真实玩家反复问的问题，先发布一篇亲自验证的攻略，再决定是否做一个配装或材料计算器。',
    plan: {
      audience: '遇到具体通关、配装或材料计算问题的玩家，首轮限定一款游戏。',
      product: '少量原创实测攻略，加一个确有需求的计算器或查询工具；标明适用版本与更新时间。',
      acquisition: '围绕具体问题获得搜索访问，并在允许分享的玩家社区发布有用内容，分别记录两个渠道。',
      monetization: '先验证持续访问，再评估广告接入条件与收益；高级功能付费作为后续假设。',
      validation: '记录搜索曝光、自然访问、工具使用、回访与玩家纠错；排除自己的访问，不用页面数量代替用户价值。出现持续需求后才评估复制到第二款游戏。',
      cautions: ['游戏更新会让攻略失效，需把实测和维护时间计入成本；广告收益取决于实际流量，不能预设回本速度。', '避免搬运和无新增价值的批量页面。AI 可辅助整理，结论和攻略仍需实测；图片与游戏素材的使用权限也要核对。'],
    },
    logs: [],
  },
  {
    slug: 'dropshipping',
    title: '无货源电商',
    verdict: 'experiment',
    fit: 2,
    status: '未开始',
    reason: '和优势关系不大，限 3 个月 / ¥5000',
    why: '这个模式拼的是选品、价格战、平台规则和客服，很吃时间，利润也越来越薄，和程序员的优势关系不大。可以当一次实验来了解电商，但先定死边界。',
    hoursPerWeek: 3,
    startCost: '¥5000 以内',
    limits: { budget: '¥5000', deadline: '3 个月', stopWhen: '到期未盈利即停' },
    firstStep: '开始前先写好选品规则和每周记账表，再决定平台。',
    logs: [],
  },
  {
    slug: 'outsourcing',
    title: 'AI 外包接单',
    verdict: 'avoid',
    fit: 1,
    status: '不做',
    reason: '仍是拿时间换钱，和时间自主相反',
    why: '接单本质上是换一个老板拿时间换钱，需求和节奏都由别人定，正是离开全职工作想摆脱的东西。',
    logs: [],
  },
  {
    slug: 'content-farm',
    title: '代写 / 内容农场',
    verdict: 'avoid',
    fit: 1,
    status: '不做',
    reason: '损害个人品牌，平台规则风险高',
    why: '用 AI 批量产出低质内容换流量，短期也许有收入，但会损害个人品牌，平台规则一变就归零。',
    logs: [],
  },
  {
    slug: 'paid-signals',
    title: '付费投资群 / 荐股',
    verdict: 'avoid',
    fit: 1,
    status: '不做',
    reason: '违背书里“不荐股”，且有合规风险',
    why: '书的核心是不盯盘、不预测、不荐股。收费荐股既违背这个原则，又有证券投资咨询的合规风险。',
    logs: [],
  },
]

/** 商业原理：给实验室所有方向定规矩。全部是待验证的设计，不是已有的业绩。 */
export interface LabPrinciple {
  statement: string
  /** 我手里真实有的东西 */
  assets: Array<{ label: string; detail: string }>
  /** 价值怎样转成收入，按顺序 */
  loop: Array<{ step: string; text: string }>
  /** 三层结构，directions 填方向 slug */
  layers: Array<{ name: string; job: string; directions: string[] }>
  rules: Array<{ title: string; text: string }>
  /** 逐级过关，前一关没过不投入下一关 */
  gates: Array<{ stage: string; pass: string }>
  northStar: string
  caveat: string
}

export const LAB_PRINCIPLE: LabPrinciple = {
  statement: '用自己的投资方法做成别人也能用的工具和内容；书建立信任，工具带来使用，可重复交付的小产品带来收入。收入来自“做一次卖很多次”，不来自流量，也不来自卖时间。',
  assets: [
    { label: '一套写成书的方法', detail: '《正念投资》：用规则代替盯盘，不预测、不荐股。这是信任的来源，也是和别人的差别。' },
    { label: '程序员的做事速度', detail: '想法能很快变成可用的工具、Skill 和网页，试错成本低。' },
    { label: '已经在用的作品', detail: '估值、网格、投资 Skill 包和这个站，先解决自己的问题，再公开。' },
    { label: '有限的时间', detail: '在职、每周只有几小时，所以一次只能做一件事，并且必须有止损线。' },
  ],
  loop: [
    { step: '自用', text: '先解决自己的真实问题，做出来自己每周都在用。' },
    { step: '公开', text: '把工具和过程放出来，记录实验日志，包括失败。' },
    { step: '信任', text: '读者因为“方法讲得清、不荐股”而留下，名单归自己。' },
    { step: '使用', text: '免费工具带来重复使用的人，用回访看是否真有用。' },
    { step: '付费', text: '把重复出现的需求做成模板、报告或小产品，收费。' },
    { step: '回流', text: '收入和反馈回来，改进自用工具和下一个实验。' },
  ],
  layers: [
    { name: '信任层', job: '让对的人认识我、相信我', directions: ['blog', 'newsletter', 'video'] },
    { name: '使用层', job: '让人用起来，并且回来', directions: ['ai-skills', 'free-tools', 'mini-program'] },
    { name: '收入层', job: '把重复需求变成可销售的东西', directions: ['digital-goods', 'indie-dev', 'image-tools'] },
  ],
  rules: [
    { title: '卖结果，不卖信息', text: '知识容易被 AI 替代。卖的是省下的时间和能直接用的成品，例如模板、计算器、报告。' },
    { title: '不碰红线', text: '不荐股、不收费咨询、不承诺收益。违背书的核心，也有合规风险。' },
    { title: '不卖时间', text: '外包接单、代写都是换个老板。只做一次做成、可以重复卖的东西。' },
    { title: '一次一个实验', text: '开始前定好每周时间、预算和期限，到期看数据，决定继续还是停。' },
    { title: '读者归自己', text: '站点和邮件名单是自己的资产，不把全部希望押在单一平台推荐上。' },
    { title: '只记真实数据', text: '没开始写“还没开始”。亲友支持不算验证，页面数量不算价值。' },
  ],
  gates: [
    { stage: '第 0 关 · 自用', pass: '我自己每周都在用，否则不公开。' },
    { stage: '第 1 关 · 有人用', pass: '至少 20 位非亲友真实试用，其中一部分第二周再回来。' },
    { stage: '第 2 关 · 有人付', pass: '至少 3 位非亲友愿意付真钱，哪怕价格很低。' },
    { stage: '第 3 关 · 能重复', pass: '单笔扣掉成本和我的时间后为正，且第二个客户明显比第一个省力。' },
    { stage: '第 4 关 · 再放大', pass: '前三关都过了，才考虑投入内容和渠道放大。' },
  ],
  northStar: '每月自愿回来使用的真实用户数（排除自己和亲友）。它比访问量和粉丝数更接近“有没有价值”。',
  caveat: '以上是设计假设，不是业绩。门槛里的数字是建议值，开始每个实验前再确认。',
}

export function recommendedDirections(): LabDirection[] {
  // Array.prototype.sort 是稳定排序，同分保持数据里的顺序
  return LAB_DIRECTIONS.filter(d => d.verdict !== 'avoid').sort((a, b) => b.fit - a.fit)
}

export function avoidedDirections(): LabDirection[] {
  return LAB_DIRECTIONS.filter(d => d.verdict === 'avoid')
}

export function findDirection(slug: string): LabDirection | undefined {
  return LAB_DIRECTIONS.find(d => d.slug === slug)
}

export function labStats(): { works: number; running: number; stopped: number } {
  return {
    works: LAB_SHOWCASE.length,
    running: LAB_DIRECTIONS.filter(d => d.status === '进行中').length,
    stopped: LAB_DIRECTIONS.filter(d => d.status === '已停止').length,
  }
}
