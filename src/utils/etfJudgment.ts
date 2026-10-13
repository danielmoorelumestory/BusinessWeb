import { NOTES, type NoteMeta } from '../data/notes'

export function latestEtfNote(code: string, notes: NoteMeta[] = NOTES): NoteMeta | undefined {
  return notes.filter(note => note.slug.startsWith(`${code}-`) && note.slug.endsWith('-etf-analysis'))
    .sort((a, b) => b.date.localeCompare(a.date) || b.slug.localeCompare(a.slug))[0]
}

export function extractEtfJudgment(markdown: string, fallbackDate: string): string | null {
  const section = markdown.match(/^##\s*一、结论速览[^\n]*\n([\s\S]*?)(?=^##\s|(?![\s\S]))/m)?.[1]
  if (!section) return null
  const judgment = section.match(/^\s*\*{0,2}(?:综合|组合)判断\*{0,2}\s*[：:]\s*([\s\S]*?)(?=\n\s*\n|(?![\s\S]))/m)?.[1]
    ?.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
  if (!judgment) return null
  const date = /数据基准[*：:\s]*(\d{4}-\d{2}-\d{2})/.exec(section)?.[1]
    ?? /数据基准[*：:\s]*(\d{4}-\d{2}-\d{2})/.exec(markdown)?.[1] ?? fallbackDate
  return `${date} 收盘｜${judgment}`
}
