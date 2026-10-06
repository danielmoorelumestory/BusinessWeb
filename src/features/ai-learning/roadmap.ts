import { Marked } from 'marked'
import markdown from '../../../public/ai-learning/AI全栈8周学习路线.md?raw'

export const PROGRESS_KEY = 'businessweb.ai-fullstack-progress.v1'
type Task = { id: string; week: number; day?: number }
export const tasks: Task[] = []
export const weeks: { number: number; title: string; anchor: string }[] = []
const anchor = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-')
const parser = new Marked({ renderer: {
  heading({ tokens, depth, text }) {
    return `<h${depth} id="${anchor(text)}">${this.parser.parseInline(tokens)}</h${depth}>\n`
  },
} })

// Only the repository's trusted, bundled document is rendered as HTML.
let week = 0
let milestone = 0
const annotated = markdown.split('\n').map(line => {
  if (line.startsWith('## ')) {
    const match = line.match(/Week (\d+)：(.+)/)
    week = match ? Number(match[1]) : 0
    if (match) weeks.push({ number: week, title: match[2], anchor: anchor(line.slice(3)) })
  }
  const day = line.match(/^### Day (\d+)(?:[–-](\d+))?：/)
  if (day) {
    const inputs = []
    for (let n = Number(day[1]); n <= Number(day[2] ?? day[1]); n++) {
      const id = `day-${n}`
      tasks.push({ id, week, day: n })
      inputs.push(`<label class="learning-check"><input type="checkbox" data-task="${id}" aria-label="Day ${n} 已完成"> Day ${n} 已完成</label>`)
    }
    return `${line}\n\n<div class="learning-days">${inputs.join('')}</div>\n`
  }
  const check = line.match(/^- \[ \] (.+)/)
  if (check) {
    const id = `check-${++milestone}`
    tasks.push({ id, week })
    return `<div class="learning-check"><label><input type="checkbox" data-task="${id}"> ${parser.parseInline(check[1])}</label></div>\n`
  }
  // The page header supplies the original title.
  return line.startsWith('# ') ? '' : line
}).join('\n')

export const roadmapHtml = parser.parse(annotated) as string
const validIds = new Set(tasks.map(task => task.id))

export function readProgress(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '[]')
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && validIds.has(id)))] : []
  } catch { return [] }
}
