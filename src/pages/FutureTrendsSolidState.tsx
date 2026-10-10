import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import companies from '../data/solidState/companies.json'
import { AS_OF, CHAIN, FOCUS, PERSPECTIVES, ROUTES, SCENARIOS, SOURCES, type SourceId } from '../data/solidState/research'
import { researchForCompany, researchPath } from '../data/futureTrendsResearch'
import { MCP, GROUP_QUESTIONS, PRIMARY_CHECKS, amount, cashAssessment, mcpCompany, primaryListing, rawUrl, type McpCompany } from '../data/solidState/mcpResearch'
import { solidCompanyPath } from '../data/solidState/companyResearch'
import coreReview from '../data/solidState/coreReview.json'
import '../styles/solid-state.css'

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }): JSX.Element {
  return <section id={id} className="solid-section" aria-labelledby={`${id}-title`}><h2 id={`${id}-title`}>{title}</h2>{children}</section>
}
function Listings({ company }: { company: McpCompany | undefined }): JSX.Element {
  if (!company?.listings.length) return <p className="solid-meta">[MISSING] 独立上市主体 / 代码待核</p>
  return <div>{company.listings.map(l => <p className="solid-meta" key={l.symbol}>
    <a href={rawUrl(l.source)} target="_blank" rel="noreferrer">{l.symbol}</a> · {l.available ? `${l.currency} ${l.price}` : '[MISSING] 数据源空资料'}
    {l.available && <><br />{l.marketTime} · {l.timezone}<br />PE TTM：{l.peTtm?.toFixed(1) ?? '不适用 / 缺失'} · 数据可能延迟</>}
  </p>)}</div>
}
function SourceLinks({ ids }: { ids: SourceId[] }): JSX.Element {
  return <p className="solid-meta">依据：{ids.map(id => {
    const s = SOURCES.find(s => s.id === id)!
    return <a key={id} href={`#solid-source-${id}`}>{s.title}</a>
  })}</p>
}
export default function FutureTrendsSolidState(): JSX.Element {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('全部')
  const groups = ['全部', ...new Set(companies.map(c => c.group))]
  const filtered = useMemo(() => companies.filter(c => (group === '全部' || c.group === group) &&
    `${c.name} ${mcpCompany(c.name)?.displayName} ${c.code} ${mcpCompany(c.name)?.listings.map(l => l.symbol).join(' ')} ${c.path}`.toLowerCase().includes(query.trim().toLowerCase())), [group, query])
  return <article className="solid-state">
    <section className="solid-section solid-hero" aria-labelledby="solid-title">
      <p className="solid-eyebrow">未来趋势 / 产业专题 · {AS_OF}</p>
      <h2 id="solid-title">固态电池</h2>
      <p className="solid-lead">从材料突破，到可持续的量产利润</p>
      <p><strong>综合结论：观察，等待商业化证据。</strong>研究重点放在可验证的材料复购、专用设备验收和电芯单位经济。半固态的商业交付，不能直接证明全固态已实现低成本规模生产。</p>
      <p>按 stock-analysis 五步方法开展产业专题复核，研究期限至 2027 年底，并持续验证更长期的成本与现金回报。{companies.length} 家专题公司、{MCP.stats.extendedCompanies} 家原树延伸对照及 {MCP.stats.supplementalCompanies} 家补充候选，均可进入独立公司研究页；其中 {FOCUS.length} 家有重点专题分析。</p>
      <p className="solid-meta">本轮通过 Yahoo Finance 与 AKShare MCP 重新核对公司资料、行情与财报：原树 {MCP.stats.originalWithQuotes} / {MCP.stats.originalCompanies} 家取得有效行情，{MCP.stats.normalizedH1} 家完成 H1 财务标准化，另补 {MCP.stats.officialH1Summaries} 家公司原件摘要。二手数据与公告核对结果分开标记；EPS×PE 保留为待验证草稿，PB 和现金质量检查不能代替独立估值。固态分部利润与单位经济仍是 [MISSING]。</p>
      <Link to="/industry-landscape">查看产业格局原始固态电池树 →</Link>
    </section>
    <nav className="solid-nav" aria-label="固态电池专题索引">
      <a href="#solid-core-review">核心候选池竞选</a>
      <a href="#solid-mcp">本轮 MCP 更新</a>
      {['研究主线', '技术路线', '价值链', '公司观察池', '重点公司', '三情景与赔率', '多空复核', '验证日历', '来源与口径'].map((t, i) => <a key={t} href={`#solid-${i}`}>{t}</a>)}
    </nav>
    <Section id="solid-core-review" title="核心候选池竞选复核">
      <p><strong>宁德时代保留现有核心研究资格；先导智能、新宙邦、赢合科技优先竞选，当升科技列为备选。</strong>综合评级均为观察；新增竞选者仍需补齐固态业务兑现证据与公司级双方法估值，本轮没有新增已认证的现价买入标的。</p>
      <p className="solid-meta">{coreReview.asOf} 重新查询 Yahoo Finance 与 AKShare MCP：原分类 {coreReview.originalCompanies} 家及补充 {coreReview.supplementalCompanies} 家，{coreReview.companiesWithQuotes} 家取得 {coreReview.validListings} 个有效证券报价，共 {coreReview.requests} 项独立请求。5 家 A 股日线价格交叉核对一致，另取得 4 家港股财务指标；2 家港股历史行情及 2 家北交所资料接口失败，缺失不填零。延伸对照沿用之前的快照，逐证券日期见公司页。</p>
      <div className="solid-table"><table><thead><tr>{['公司', '竞选结论', '证据与晋级障碍'].map(t => <th key={t} scope="col">{t}</th>)}</tr></thead><tbody>{['宁德时代', '先导智能', '新宙邦', '赢合科技', '当升科技'].map(name => {
        const r = coreReview.outcomes.find(r => r.name === name)!
        return <tr key={r.id}><td><Link to={`/future-trends/solid-state/${r.id}`}>{r.name}</Link></td><td>{r.decision}</td><td>{r.reason}</td></tr>
      })}</tbody></table></div>
      <p>价格分开评估：先导 A 股 36.73 元，H 股 27.48 港元，按本轮汇率约合 23.46 元人民币；相对折价不能证明绝对低估。宁德 A 股旧估值草稿按本轮价格的盈亏比约 0.83∶1，仍缺第二独立估值。先导、赢合、新宙邦 H1 毛利率均同比下降，现金改善需与单位盈利共同验证。</p>
      <details><summary>查看全部 {coreReview.outcomes.length} 家公司的竞选去向</summary><ul>{coreReview.outcomes.map(r => <li key={r.id}><strong><Link to={`/future-trends/solid-state/${r.id}`}>{r.name}</Link> · {r.decision}</strong><p>{r.reason}</p></li>)}</ul></details>
      <p><a href={rawUrl(coreReview.report)} target="_blank" rel="noreferrer">完整竞选报告、估值审查与验证条件 →</a> · <a href={rawUrl(coreReview.manifest)} target="_blank" rel="noreferrer">本次重新查询的 MCP 调用记录 →</a></p>
    </Section>
    <Section id="solid-mcp" title="本轮 MCP 更新：覆盖范围与研究调整">
      <p>{MCP.stats.validListings} 个有效证券记录，覆盖 A 股、美股、港股并保留原树的日、德、澳上市对照；同一发行人的多个上市地不重复计作公司。北交所 {MCP.stats.failedListings} 个 Yahoo 新旧代码请求均为空资料，另试 AKShare 的贝特瑞行情及两家公司资料也报错，缺失不填零。当前为 {MCP.asOf} 的研究快照，市场时间与抓取时间见原始文件。</p>
      <div className="solid-grid">
        <div><h3>设备：先看验收与现金</h3><p>先导和赢合 H1 经营现金流为正，具备继续拆专用订单的研究基础；需核预收款及旧订单回款，不能把集团现金全部归给固态。</p></div>
        <div><h3>电芯与资源：资本投入是约束</h3><p>国轩、赣锋及比亚迪的 H1 简化 FCF 为负；宁德现金流较强，但固态增量仍待单独验证。资源股首先受锂价和中周期成本驱动。</p></div>
        <div><h3>材料：利润与回款一起看</h3><p>当升收入和利润增长，经营现金流却下降；新宙邦有最新半年报支持固态研发及千吨级规划，尚不能计作量产收入。硅基、导电材料也可能服务液态电池。</p></div>
        <div><h3>海外：账单、收入、现金分开</h3><p>QS 的客户账单与 Eagle Line 进展有原件支持，但持续亏损；SLDP 需核收入冲回和材料复购。两者均按项目现金流与融资摊薄分析，暂不给 PE 或目标价。</p></div>
      </div>
      <p>身份修正：长远锂科按上交所资料显示为“五矿新能（688779）”，原名保留以追溯原树。未上市主体、智己子品牌及含糊的“三星”不借用合作方代码。<a href={rawUrl('research/solid-state-mcp-2026-10-09/manifest.json')} target="_blank" rel="noreferrer">下载本轮调用及原始文件索引 →</a></p>
      <p className="solid-meta">独立源复核：AKShare 腾讯历史行情中的先导、宁德 10 月 9 日收盘分别为 CNY 36.73、297.75，与 Yahoo 快照相符；先导同花顺财务摘要已取得。赣锋港股指标与 IFRS 原件的营收为 228.84121 亿元，A 股供应商为 230.96945 亿元，差异桥待核，按不同口径保留。</p>
      <SourceLinks ids={['lead', 'easpring-report', 'capchem', 'qs', 'sldp', 'ganfeng-report', 'minmetals', 'mcp']} />
    </Section>
    <Section id="solid-0" title="研究主线：技术成功如何变成股东回报">
      <div className="solid-flow" aria-label="商业化证据链">材料 / 电芯样品 → 客户认证 → 商业订单 → 验收与复购 → 利润 → 自由现金流 → 合理价格</div>
      <div className="solid-grid">
        <div><h3>真正的分歧</h3><p>判断：市场可能将实验室参数、规划产能和客户合作提前折算为利润。本轮已补现价，但尚无经过独立双方法验证的市场预期模型，不能证明存在错误定价。应比较“性能提升带来的可收取溢价”和“新增材料、制造、质保及资本成本”。</p></div>
        <div><h3>谁先兑现</h3><p>判断：设备可能先获得中试收入，材料需要稳定复购，电芯需要质量与成本同时达标。设备早收入也可能是一次性研发支出；材料高价值量也可能随减薄、降耗和竞争下降。</p></div>
        <div><h3>竞争基准持续移动</h3><p>判断：固态需要面对持续升级的液态锂电，而非静态旧产品。高端乘用车看续航与溢价；储能看全生命周期度电成本；飞行器看系统能量密度、倍率、寿命和认证，三个市场不能合并套同一渗透率。</p></div>
        <div><h3>市场空间怎么算</h3><p>TAM 是满足性能需求的潜在应用；SAM 只包含成本与认证达标的应用；SOM 还需受客户定点、产能、良率与竞争份额限制。可服务需求 = 应用数量 × 单机电量 × 可接受渗透率，收入再乘单价；本轮输入 [MISSING]，不引用原树无出处 GWh / CAGR。</p></div>
      </div>
      <p>PM 七问收口：错误定价和现价隐含预期未证实；现在研究的依据是已有产品与中试披露；证明变量是复购、验收、单位毛利和回款；反证是延迟、负毛利与摊薄；上述变量改变结论；关键缺项是固态分部财务、可校准的预测与第二种独立估值。</p>
    </Section>
    <Section id="solid-1" title="技术路线：半固态与全固态分开比较">
      <p>口径：半固态 / 固液混合仍保留液相；全固态的判断应查具体组成、判定方法和测试条件。本页不沿用原树按液相比例自行划分的固定界限。凝聚态、硅碳或高能量密度也不能仅凭名称视为全固态。</p>
      <div className="solid-grid">{ROUTES.map(([name, tradeoff, business]) => <div key={name}><h3>{name}</h3><p>{tradeoff}</p><p><strong>产业观察：</strong>{business}</p></div>)}</div>
      <p className="solid-meta">以上为技术与产业分析判断，路线并非互斥分类。性能比较须同时列电芯容量 / 层数、温度、倍率、运行压力、循环截止容量、能量密度层级和良率定义；缺测试条件的单个数字不用于排名。固态体系仍需检验短路、热失控与系统安全。</p>
      <p>海外历史对照：丰田与出光 2023 年公告提出硫化物电解质合作与 2027–2028 商业化目标。该文件 [STALE]，只能说明当时路线和规划，不能当作本轮已确认的投产日期。</p><SourceLinks ids={['toyota', 'gotion', 'equipment']} />
    </Section>
    <Section id="solid-2" title="价值链：谁付钱，利润在哪里，现金何时回来">
      <div className="solid-table"><table><thead><tr>{['环节', '赚钱机制', '主导变量', '最大反证'].map(x => <th key={x} scope="col">{x}</th>)}</tr></thead><tbody>{CHAIN.map(row => <tr key={row[0]}>{row.map((x, i) => <td key={i}>{x}</td>)}</tr>)}</tbody></table></div>
      <p>模型纪律：材料用合格出货量而非规划吨数，设备用验收而非中标额，电芯用系统成本而非样品材料成本；从经营现金流扣除资本开支才接近自由现金流。AI 为非核心变量，本轮没有可量化传导证据。</p>
    </Section>
    <Section id="solid-3" title="公司观察池：从产业格局逐条提取">
      <p>名称全部来自原始固态电池树，按主体去重；分类为本轮研究判断，原树提及仅证明存在研究线索。新增代码为 MCP 候选映射；返回的发行人名称、币种和市场时间可逐条查看，但全池法律主体和上市状态尚未逐一取得公告认证。应用公司、子公司与材料供应商分别核验。</p>
      <div className="solid-filters"><label>搜索公司 / 代码<input value={query} onChange={e => setQuery(e.target.value)} placeholder="例如：先导、赣锋、电解质" /></label><label>产业环节<select value={group} onChange={e => setGroup(e.target.value)}>{groups.map(g => <option key={g}>{g}</option>)}</select></label></div>
      <p role="status">显示 {filtered.length} / {companies.length} 家</p>
      <div className="solid-table"><table><thead><tr>{['公司 / 主体', '环节', 'MCP 行情 / 市场时间', '原树位置', '现金与研究入口'].map(x => <th key={x} scope="col">{x}</th>)}</tr></thead><tbody>{filtered.map(c => {
        const mcp = mcpCompany(c.name)
        const old = c.code ? researchForCompany(c.name, c.code) : undefined
        return <tr key={c.name}><td><strong>{mcp ? <Link to={solidCompanyPath(mcp)}>{mcp.displayName}</Link> : c.name}</strong><small>{c.code || '原目录未附代码'}</small></td><td>{c.group}</td><td><Listings company={mcp} /></td><td>{c.path}</td><td>{c.evidence}<p>{cashAssessment(mcp)}</p><small>{GROUP_QUESTIONS[c.group] ?? (c.group === '资源与回收' ? '优先看中周期锂价、资源成本与资本开支；新增固态需求不能直接换算成资源净利润。' : '验证电池采购、装车或终端订单；应用端需求不等于本公司拥有固态材料利润。')}</small>{mcp && <div><Link to={solidCompanyPath(mcp)}>进入公司二级研究页 →</Link></div>}{old && <div><Link to={researchPath(old.key)}>本站既有公司研究（日期与模型以原页为准）</Link></div>}</td></tr>
      })}</tbody></table></div>
      {!filtered.length && <p>未找到匹配公司，可清空搜索或切换到全部环节。</p>}
      <h3>本轮补充候选（独立于原树）</h3>
      <div className="solid-grid">{MCP.companies.filter(c => c.origin === '本轮补充候选').map(c => <div key={c.name}>
        <h3>{c.name}</h3><Listings company={c} />
        <p>{c.name === '三祥新材' ? '氧化物材料研究线索；已取得行情，固态专用订单、独立收入和最新业务原件仍待复核。' : c.name === '纳科诺尔' ? '辊压设备研究线索；北交所新旧代码均未返回有效资料，上市身份及商业订单需另取公告。' : cashAssessment(c)}</p>
        <Link to={solidCompanyPath(c)}>进入公司二级研究页 →</Link>
      </div>)}</div>
      <details><summary>原树延伸对照 · {MCP.stats.extendedCompanies} 家（资源、通用材料及应用）</summary><p>这些主体在原产业树中有线索，但固态通常只是间接变量，独立列出以免与专用材料、电芯和设备混为同一敞口。</p><div className="solid-grid">{MCP.companies.filter(c => c.origin === '原树延伸对照').map(c => <div key={c.id}><h3><Link to={solidCompanyPath(c)}>{c.displayName}</Link></h3><p>{cashAssessment(c)}</p></div>)}</div></details>
      <p className="solid-meta">智己与三星等名称需要进一步穿透法律主体；清陶、卫蓝、辉能等不能用合作车企代码代替。已剔除 28 个关联较弱的主体（锂矿 / 盐湖 / 回收、铜箔、通用车企与储能、机器人应用等，其主要驱动是锂价、存量电池周期或整车销量，而非固态技术）；原树仍保留这些节点，需要时可回看。原树中的客户关系、供应份额和“唯一龙头”未自动获得认证。</p>
    </Section>
    <Section id="solid-4" title="重点公司：商业模式、核心假设与最大反证">
      <p>两组横向比较：设备 / 电芯 / 一体化（先导、国轩、赣锋）看兑现环节；材料与海外技术（洗霸、当升、贝特瑞、Solid Power、QuantumScape）看认证、复购、授权和现金。跨组不能按集团增速或总利润直接排名。</p>
      <p>研究优先级按证据强弱：先导、赢合优先拆设备专用验收；宁德作为现金与制造基准；当升、新宙邦看材料复购和回款；国轩、赣锋、比亚迪看资本回报与净债务；天奈、天赐核配方敞口；洗霸、贝特瑞及海外研发企业保留证据缺项。此顺序不代表买入排序。</p>
      <h3>2026H1 集团财务比较</h3>
      <p className="solid-meta">金额为各自财报币种的“亿”，人民币与美元不横向相加。流量 = 数据源 Q1 + Q2；简化 FCF = 经营现金流 − 数据源资本支出，并非 FCFF 或可分配现金。数据源滚动摘要和 H1 不能混用，缺季不拼 TTM。</p>
      <div className="solid-table"><table><thead><tr>{['公司', '财报币种', '收入', '归母 / 普通股净利', '经营现金流', '资本支出', '简化 FCF', '核对状态 / 原始报表'].map(t => <th key={t} scope="col">{t}</th>)}</tr></thead><tbody>{FOCUS.map(c => {
        const f = mcpCompany(c.name)?.financials
        return <tr key={c.id}><td><Link to={solidCompanyPath(mcpCompany(c.name)!)}>{c.name}</Link></td><td>{f?.currency ?? '[MISSING]'}</td><td>{amount(f?.revenue)}</td><td>{amount(f?.netIncome)}</td><td>{amount(f?.cfo)}</td><td>{amount(f?.capex)}</td><td>{amount(f?.fcf)}</td><td>{PRIMARY_CHECKS[c.name] ?? '第三方标准化；尚未完成公告逐项核对。'}{f?.sources.map((path, i) => <div key={path}><a href={rawUrl(path)} target="_blank" rel="noreferrer">{f.sourceKind === 'filing' ? '公司原件摘要摘录' : `${['利润表', '资产负债表', '现金流量表'][i]}原始 MCP 返回`}</a></div>)}</td></tr>
      })}</tbody></table></div>
      <div className="solid-grid">{FOCUS.map(c => <div key={c.id} id={`solid-company-${c.id}`} className="solid-company">
        <h3><Link to={solidCompanyPath(mcpCompany(c.name)!)}>{c.name} · 完整研究 →</Link></h3><p>{c.conclusion}</p><p>{cashAssessment(mcpCompany(c.name))}</p>
        <p className="solid-meta">独立页面包含业务与产业敞口、季度财务、盈利质量、资本约束、估值情景、多空复核、同环节比较和来源原件。</p>
      </div>)}</div>
    </Section>
    <Section id="solid-5" title="三情景与赔率：先拆经营，再到公司页定价">
      <p>公司级 EPS×PE 假设、敏感性、现金桥与缺项已移入二级页。PB 和现金质量不能代替第二种独立估值；缺正常化盈利、项目成功率或摊薄桥时不认证目标价。贝特瑞旧价未获本轮 MCP 复核，不输出当前赔率。</p>
      <div className="solid-table"><table><thead><tr>{['情景', '经营假设', '盈利与现金处理', '验证 / 证伪'].map(x => <th key={x} scope="col">{x}</th>)}</tr></thead><tbody>{SCENARIOS.map(row => <tr key={row[0]}>{row.map((x, i) => <td key={i}>{x}</td>)}</tr>)}</tbody></table></div>
      <p>QS 客户账单与 GAAP 收入分列；SLDP 现金及短期投资与包括长期证券的全部流动性分列。两家公司都须计入后续现金投入和融资摊薄，不以市值减现金直接认定技术低估。</p>
      <Link to={solidCompanyPath(mcpCompany('QuantumScape')!)}>QuantumScape 二级研究 →</Link> · <Link to={solidCompanyPath(mcpCompany('Solid Power')!)}>Solid Power 二级研究 →</Link>
    </Section>
    <Section id="solid-6" title="多空复核：单模型多视角复核">
      <p>以下为主模型按 stock-analysis 逐视角复核，未调用独立专家。共识是要把技术、订单与现金分层；分歧在于设备先兑现能否持续、材料认证能否转化为超额利润。</p>
      <div className="solid-grid">{PERSPECTIVES.map(([title, thesis, counter]) => <div key={title}><h3>{title}</h3><p>{thesis}</p><p>{counter}</p></div>)}</div>
      <p><strong>裁决：</strong>产业机会进入持续观察，股票层面等待价格和单位经济证据。最大的反证是：即便技术可用，客户愿付的溢价仍不能覆盖量产、质保及资金成本。能量密度提升本身不能推翻这个反证。</p>
    </Section>
    <Section id="solid-7" title="验证日历：用下一份证据改变结论">
      <ul>
        <li>下一次公司定期报告（确切日期待公告）：按收入、扣非利润、现金、资本开支、应收及合同资产检查经营质量，核实固态是否独立披露。</li>
        <li>2026Q4：SLDP 连续制造线验证与启动为管理层计划；若延后一季度，重新测算现金消耗和摊薄风险。</li>
        <li>2027 年底检查点（研究假设）：设备订单能否连续验收、材料是否跨两个披露期复购、电芯能否连续交付并有单位毛利；缺项继续标等待证据，不以年度到来自动宣布成熟。</li>
        <li>客户量产 / 安全认证 / 重大融资公告（待公告）：核对主体、规模、测试条件、责任与质保；规划产能不计为销量，合作框架不计为正式订单。</li>
      </ul>
      <p>新增结论的条件：正式商业合同 → 实际验收 / 复购 → 利润与现金桥接 → 双方法估值。撤回条件：里程碑持续顺延、两期回款恶化、量产负毛利或摊薄超过经营增量。阈值是研究规则，不能冒充公司指引。</p>
    </Section>
    <Section id="solid-8" title="来源与口径：每条证据支持到哪里">
      <p>公司池来源：<a href={`${import.meta.env.BASE_URL}industry/solid-state.json`} target="_blank" rel="noreferrer">产业格局原始树</a>。原树未标日期；其历史成本、渗透率、市场规模、量产年份、份额、星级和配置比例未被本轮认证。公司池只迁移名称与位置。</p>
      <ul className="solid-sources">{SOURCES.map(s => <li id={`solid-source-${s.id}`} key={s.id}><a href={s.id === 'mcp' ? rawUrl('research/solid-state-mcp-2026-10-09/manifest.json') : s.url} target="_blank" rel="noopener noreferrer">{s.title}</a><div>{s.date} · {s.status}</div></li>)}</ul>
      <p>网页材料统一于 {AS_OF} 查阅或定位；网页无发布日期时不推断时效。超过 90 天的历史原件标 [STALE]；报告期早于披露日期不能混同。产品网页支持产品存在或公司自述，不能证明上市代码、收入占比或客户排他性。</p>
      <p>[MISSING] 清单：全池法律主体与上市状态逐一核验、固态分部销量 / 收入 / 毛利、单位成本与合格率、ROIC / 净杠杆完整标准化、市场一致预期、赣锋 A/H 会计差异桥、项目 rNPV 与未来摊薄。本轮行情和标准化报表来自真实 Yahoo Finance MCP 调用；AKShare MCP 提供腾讯行情、同花顺摘要和港股指标交叉检查。公告逐项核对范围见 H1 表格，不把第三方全表自动升级为已认证。未取得原件不等于经营恶化。</p>
      <p>既有研究处理：保留可回溯原件的主营事实；原树无出处的供应份额、盈利预测、成本和配置建议不迁移为本轮结论；旧公司研究独立保留，其行情日期与模型有效性需在原页审阅。</p>
    </Section>
    <p className="solid-disclaimer">本报告仅供研究参考，不构成个人投资建议。</p>
  </article>
}
