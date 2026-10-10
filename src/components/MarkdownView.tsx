import React from 'react'

/* ---------- 轻量 Markdown 渲染（覆盖本书与行业笔记用到的语法子集：标题、表格、引用、列表、粗体、斜体、行内代码、<br>） ---------- */

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|<br\s*\/?>)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const token = m[0]
    if (token.startsWith('<br')) {
      nodes.push(<br key={`${keyPrefix}-br${i}`} />)
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('*')) {
      nodes.push(<em key={`${keyPrefix}-i${i}`}>{token.slice(1, -1)}</em>)
    } else {
      nodes.push(
        <code
          key={`${keyPrefix}-c${i}`}
          style={{
            background: 'var(--system-gray6)',
            padding: '1px 5px',
            borderRadius: '4px',
            fontSize: '0.9em',
          }}
        >
          {token.slice(1, -1)}
        </code>
      )
    }
    last = m.index + token.length
    i += 1
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export function renderMarkdown(md: string): React.ReactNode[] {
  const lines = md.split('\n')
  const out: React.ReactNode[] = []
  let i = 0
  let key = 0
  const nextKey = () => `md-${key++}`

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') {
      i += 1
      continue
    }

    // 表格
    if (line.trim().startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i]
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map(c => c.trim())
        if (!cells.every(c => /^:?-{2,}:?$/.test(c))) rows.push(cells)
        i += 1
      }
      if (rows.length > 0) {
        const [head, ...body] = rows
        out.push(
          <div key={nextKey()} style={{ overflowX: 'auto', margin: '12px 0' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.92rem',
                lineHeight: 1.6,
              }}
            >
              <thead>
                <tr>
                  {head.map((c, j) => (
                    <th
                      key={j}
                      style={{
                        textAlign: 'left',
                        padding: '8px 12px',
                        borderBottom: '2px solid var(--accent)',
                        background: 'var(--system-gray6)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {renderInline(c, nextKey())}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((r, ri) => (
                  <tr key={ri}>
                    {r.map((c, ci) => (
                      <td
                        key={ci}
                        style={{
                          padding: '7px 12px',
                          borderBottom: '1px solid var(--border-subtle)',
                          verticalAlign: 'top',
                        }}
                      >
                        {renderInline(c, nextKey())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
      continue
    }

    // 标题
    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      const level = heading[1].length
      const size = level === 1 ? '1.6rem' : level === 2 ? '1.25rem' : '1.05rem'
      out.push(
        <div
          key={nextKey()}
          style={{
            fontSize: size,
            fontWeight: 700,
            margin: level <= 2 ? '24px 0 10px' : '18px 0 8px',
            lineHeight: 1.4,
          }}
        >
          {renderInline(heading[2], nextKey())}
        </div>
      )
      i += 1
      continue
    }

    // 分隔线
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      out.push(<hr key={nextKey()} style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '20px 0' }} />)
      i += 1
      continue
    }

    // 引用块
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''))
        i += 1
      }
      out.push(
        <blockquote
          key={nextKey()}
          style={{
            margin: '12px 0',
            padding: '10px 16px',
            borderLeft: '3px solid var(--accent)',
            background: 'var(--accent-soft)',
            borderRadius: '0 8px 8px 0',
            lineHeight: 1.7,
          }}
        >
          {quoteLines.map((q, qi) => (
            <div key={qi}>{renderInline(q, nextKey())}</div>
          ))}
        </blockquote>
      )
      continue
    }

    // 有序/无序列表
    if (/^\s*(-|\*|\d+\.)\s+/.test(line)) {
      const items: string[] = []
      const ordered = /^\s*\d+\.\s+/.test(line)
      while (i < lines.length && /^\s*(-|\*|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*(-|\*|\d+\.)\s+/, ''))
        i += 1
      }
      const ListTag = ordered ? 'ol' : 'ul'
      out.push(
        <ListTag
          key={nextKey()}
          style={{ margin: '8px 0', paddingLeft: '22px', lineHeight: 1.8 }}
        >
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, nextKey())}</li>
          ))}
        </ListTag>
      )
      continue
    }

    // 普通段落
    out.push(
      <p key={nextKey()} style={{ margin: '10px 0', lineHeight: 1.8 }}>
        {renderInline(line, nextKey())}
      </p>
    )
    i += 1
  }

  return out
}
