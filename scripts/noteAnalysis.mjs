// 从分析笔记的「## 一、结论速览」表里取日线/周线或短期/中期最终判断，生成写入云端 D1 的语句。
// 解析与 SQL 生成放在这里（可单测），读文件与调用 wrangler 的部分在 sync-note-analysis.mjs。

const SECTION = /^##\s*一、结论速览/

/** 去掉 Markdown 标记（粗体、行内代码）并压缩空白。 */
export const cleanText = text => text.replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim()

/** 把表格行拆成单元格；只处理以 | 开头的行，分隔行（---）返回 null。 */
function cellsOf(line) {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|')) return null
  const cells = trimmed.replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim())
  return cells.every(cell => /^:?-{2,}:?$/.test(cell)) ? null : cells
}

/**
 * 解析一篇笔记。文件名形如 516650-nonferrous-metals-etf-analysis.md，开头 6 位数字是标的代码。
 * 返回 { code, slug, asOf, short, mid }；结构不符时返回 { skipped: 原因 }。
 */
export function parseNote(file, text, title = '') {
  const slug = file.replace(/^.*\//, '').replace(/\.md$/, '')
  const code = /^(\d{6})-/.exec(slug)?.[1]
  if (!code) return { skipped: '文件名不以 6 位代码开头' }
  const lines = text.split('\n')
  const start = lines.findIndex(line => SECTION.test(line))
  if (start < 0) return { skipped: '没有「一、结论速览」小节' }
  let short, mid
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break
    const cells = cellsOf(line)
    if (!cells || cells.length < 2) continue
    if (short === undefined && (cells[0].startsWith('短期') || /^日线(?:[（(]|$)/.test(cells[0]))) short = cleanText(cells[1])
    else if (mid === undefined && (/^中期[（(]/.test(cells[0]) || /^周线(?:[（(]|$)/.test(cells[0]))) mid = cleanText(cells[1])
  }
  if (!short) return { skipped: '结论速览里没有「短期」行' }
  if (!mid) return { skipped: '结论速览里没有「中期（…）」行' }
  // 数据基准日：兼容「数据基准：2026-10-09 收盘」「**数据基准**：2026-10-09收盘」等写法
  const asOf = /数据基准[*：:\s]*(\d{4}-\d{2}-\d{2})/.exec(text)?.[1] ?? ''
  return { code, slug, title: title || slug, asOf, short, mid }
}

/** 同一代码有多篇时取数据基准日最新的一篇（相同则取 slug 字典序较大者）。 */
export function pickLatest(rows) {
  const byCode = new Map()
  for (const row of rows) {
    const current = byCode.get(row.code)
    if (!current || `${row.asOf}|${row.slug}` > `${current.asOf}|${current.slug}`) byCode.set(row.code, row)
  }
  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code))
}

/** SQL 字符串字面量：单引号加倍，去掉 NUL 等控制字符。 */
export const sqlString = value => `'${String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/'/g, "''")}'`

export const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS note_analysis (
  code TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  as_of TEXT NOT NULL,
  short_judgment TEXT NOT NULL,
  mid_judgment TEXT NOT NULL,
  updated_at INTEGER NOT NULL
) WITHOUT ROWID;`

/** 生成建表 + 逐行 upsert 的 SQL（幂等，可重复执行）。 */
export function toSql(rows, now = Date.now()) {
  const upserts = rows.map(row => `INSERT INTO note_analysis (code, slug, title, as_of, short_judgment, mid_judgment, updated_at)
VALUES (${sqlString(row.code)}, ${sqlString(row.slug)}, ${sqlString(row.title)}, ${sqlString(row.asOf)}, ${sqlString(row.short)}, ${sqlString(row.mid)}, ${Number(now)})
ON CONFLICT(code) DO UPDATE SET slug = excluded.slug, title = excluded.title, as_of = excluded.as_of,
  short_judgment = excluded.short_judgment, mid_judgment = excluded.mid_judgment, updated_at = excluded.updated_at;`)
  return [CREATE_TABLE, ...upserts].join('\n') + '\n'
}

/** 从 src/data/notes.ts 的文本里取 slug → title（按 slug、title 相邻出现的顺序）。 */
export function titlesFromNotesTs(text) {
  const titles = new Map()
  for (const match of text.matchAll(/slug:\s*'([^']+)'[\s\S]*?title:\s*'((?:[^'\\]|\\.)*)'/g)) titles.set(match[1], match[2].replace(/\\'/g, "'"))
  return titles
}
