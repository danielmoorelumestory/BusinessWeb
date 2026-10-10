/** Generate progressively disclosed skill references from the website's source catalog. */
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const { asOf, trends } = JSON.parse(await readFile(path.join(root, 'src/data/futureTrends.catalog.json'), 'utf8'))
const destination = path.join(root, '.agents/skills/stock-analysis/references/future-trends')
await mkdir(destination, { recursive: true })
const rules = `整理日期：${asOf}。这是产业链观察池，不是推荐名单或公司级研究认证。\n\n- 九个赛道是检索分类，不是互斥行业；同一公司可在多个环节出现，组合敞口须按发行人去重。\n- 直接业务：有对应产品/服务；多元业务：集团中只有部分业务关联；研发验证：试验、研发或新产品验证；间接配套：工具、材料、设施或应用场景。分类是研究判断，不是营收占比排名。\n- “已查阅所列资料”只支持原件明确披露的事项；更名公告不能证明产品收入，产品网页不能证明上市代码。候选待核条目是扩展检索起点，不能直接形成评级、估值或受益排序。历史资料按统一 Skill 的时效规则更新。\n- 核验顺序：发行人及上市状态 → 具体产品/适应症/技术路线 → 业务收入与订单证据 → 毛利和回款 → 估值。缺分部披露标 [MISSING]，研发规划、定点、合同、验收及收入分别记录。\n- 子公司、母公司股票、ADR 和未上市主体分开；禁止把母公司代码写成子公司的独立股票。境外代码含各地交易所后缀，使用前核对最新交易所公告、分拆、退市及 ADR 比例。\n- 行业需求增长 → 公司收入 → 利润和现金流 → 股价回报是四道独立验证。不能推断供应商关系、收益率或必然受益；书第31.7节及附录G提供观察方法，不证明当前公司事实。\n`
const escape = value => value.replaceAll('|', '\\|').replaceAll('\n', ' ')
const index = ['# 九个未来产业赛道：分类与公司观察池', '', rules, '## 按需读取', '', '| 赛道 | 产业链环节 | 公司关联条目（可重复） |', '| --- | ---: | ---: |']
for (const trend of trends) {
  const entries = trend.chain.reduce((n, l) => n + l.cn.length + l.us.length, 0)
  index.push(`| [${trend.name}](${trend.id}.md) | ${trend.chain.length} | ${entries} |`)
  const content = [`# ${trend.name}`, '', `整理日期：${asOf}。先读 [观察池规则](index.md)。`, '', trend.oneLine, '', `阶段判断：${trend.stage}`, '', `收益传导：${trend.why}`, '', `书中方法：${trend.book}`, '', '## 环节索引', '', ...trend.chain.map(l => `- ${l.link}`)]
  for (const link of trend.chain) {
    content.push('', `## ${link.link}`, '', link.desc, '', `验证指标：${link.verify}`, '', '| 区域 | 公司 | 证券或主体状态 | 业务关联 | 敞口类型 | 证据边界 / 来源 |', '| --- | --- | --- | --- | --- | --- |')
    for (const [region, list] of [['中国（含港股、中概）', link.cn], ['海外（含 ADR 及其他市场）', link.us]]) {
      for (const c of list) {
        const source = c.sourceUrl ? `[${escape(c.sourceTitle)}](${c.sourceUrl})` : escape(c.sourceTitle)
        content.push(`| ${region} | ${escape(c.name)} | ${escape(c.code)} | ${escape(c.role)} | ${c.exposure} | ${escape(c.evidence)}；${source} |`)
      }
    }
  }
  content.push('', '## 全赛道验证', '', ...trend.verify.map(v => `- ${v}`), '', '## 风险与证伪线索', '', ...trend.risks.map(v => `- ${v}`), '')
  await writeFile(path.join(destination, `${trend.id}.md`), content.join('\n'))
}
index.push('', '维护：修改 `src/data/futureTrends.catalog.json` 后运行 `npm run skills:package`。生成各赛道参考、同步项目 agent 技能目录并更新下载包；不要分别维护多份名单。', '')
await writeFile(path.join(destination, 'index.md'), index.join('\n'))
console.log(`Future trends: ${trends.length} tracks, ${trends.reduce((n,t)=>n+t.chain.length,0)} segments`)
