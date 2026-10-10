import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

// Export the same research standard used by the website into the portable skill.
const root = new URL('../', import.meta.url)
const source = await readFile(new URL('src/data/notionNotes.ts', root), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const exports = {}
new Function('exports', compiled)(exports)
const standard = exports.researchStandard
const labels = {
  goal: '核心投资目标', applies: '适用范围与项目研究页约定', flow: '研究流程（五步）',
  skills: '统一股票分析与交易分析的分工', pmQuestions: '资深 PM 七问', dataRules: '数据纪律',
  calendar: '各市场财报节奏与看点（使用时核实最新规则）', caliber: '口径纪律',
  checklist: '研究检查项', valuation: '估值方法', traps: '常见数据陷阱', adversarial: '对抗检验',
  verdict: '固定结论格式', finalReport: '最终返回标准（0–14 模块）', depth: '深度分级',
  chat: '即时回复', action: '行动分类（条件化研究）', position: '项目个人仓位原则（按用户选择适用）',
  redlines: '红线',
}
const headings = {
  skills: ['名称', 'Skill', '适用任务', '特点'], calendar: ['市场', '披露节奏', '口径与看点'],
  caliber: ['项目', '要求'], traps: ['陷阱', '典型表现', '做法'],
  finalReport: ['编号', '模块', '必含内容', '最低要求'], depth: ['形式', '包含', '何时使用'],
}
const cell = value => String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>')
const sections = Object.entries(standard).map(([key, value]) => {
  let body
  if (typeof value === 'string') body = value
  else if (headings[key]) {
    body = [headings[key], headings[key].map(() => '---'), ...value]
      .map(row => `| ${row.map(cell).join(' | ')} |`).join('\n')
  } else {
    body = value.map(item => {
      if (typeof item === 'string') return `- ${item}`
      if (item.items) return `### ${item.title}\n\n${item.items.map(line => `- ${line}`).join('\n')}`
      if (item.step) return `### ${item.step} · ${item.title}\n\n${item.desc}（${item.skill}）`
      return `- **${item.label}**：${item.text}`
    }).join('\n\n')
  }
  return `## ${labels[key] ?? key}\n\n${body}`
})
const output = new URL('.agents/skills/stock-analysis/references/research-method.md', root)
await writeFile(output, `# 研究方法 · 适用于所有公司\n\n来源：src/data/notionNotes.ts 的 researchStandard，由 scripts/generate-investment-method.mjs 同步生成，完整保留网站研究方法。程序化补全批规则见 screening-rules.md。\n\n适用时以统一入口 SKILL.md 的冲突处理为准；个人仓位规则仅在用户采用本项目策略时适用，交易分析的三方风险裁决按任务选用。\n\n${sections.join('\n\n')}\n`)
console.log(`Generated ${fileURLToPath(output)}`)
