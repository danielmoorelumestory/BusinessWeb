/** Convert the book's Markdown into short, readable speech segments. */
function inlineText(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/[^\s<>，。；）]+/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(^|[\s（(])\*([^*]+)\*(?=$|[\s，。！？；）)])/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*/g, '乘以')
    .trim()
}

export function bookSections(markdown: string): { title: string; markdown: string }[] {
  const headings = [...markdown.matchAll(/^##\s+(.+)$/gm)]
  return headings.map((heading, index) => ({
    title: inlineText(heading[1]),
    markdown: markdown.slice(heading.index, headings[index + 1]?.index ?? markdown.length),
  }))
}

export function speechChunks(markdown: string, limit = 150): string[] {
  const paragraphs: string[] = []
  let tableHeaders: string[] | null = null
  let inCode = false
  for (const line of markdown.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { inCode = !inCode; continue }
    if (inCode) continue
    const trimmed = line.trim()
    if (trimmed.startsWith('|')) {
      const cells = trimmed.replace(/^\||\|$/g, '').split('|').map(cell => inlineText(cell.trim()))
      if (cells.every(cell => /^:?-{2,}:?$/.test(cell))) continue
      if (!tableHeaders) { tableHeaders = cells; paragraphs.push('表格。'); continue }
      paragraphs.push(cells.map((cell, index) => `${tableHeaders?.[index] || `第${index + 1}项`}：${cell || '空白'}`).join('；') + '。')
      continue
    }
    tableHeaders = null
    if (!trimmed || /^([-*_])\1{2,}$/.test(trimmed)) continue
    const text = inlineText(trimmed.replace(/^#{1,6}\s+/, '').replace(/^>\s?/, '').replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '').replace(/^\[[ xX]\]\s*/, ''))
    if (text) paragraphs.push(/[。！？!?；;：:]$/.test(text) ? text : `${text}。`)
  }

  const chunks: string[] = []
  let current = ''
  for (const sentence of paragraphs.join('\n').match(/[^。！？!?；;\n]+[。！？!?；;\n]*/g) ?? []) {
    let remaining = sentence.trim()
    while (remaining.length > limit) {
      if (current) { chunks.push(current); current = '' }
      const prefix = remaining.slice(0, limit)
      const punctuation = Math.max(prefix.lastIndexOf('，'), prefix.lastIndexOf('、'), prefix.lastIndexOf(' '))
      const cut = punctuation > limit / 2 ? punctuation + 1 : limit
      chunks.push(remaining.slice(0, cut))
      remaining = remaining.slice(cut).trim()
    }
    if (current.length + remaining.length > limit) { chunks.push(current); current = '' }
    current += remaining
  }
  if (current) chunks.push(current)
  return chunks
}
