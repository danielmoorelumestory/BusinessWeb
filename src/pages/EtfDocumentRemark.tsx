import React, { useEffect, useState } from 'react'
import { extractEtfJudgment, latestEtfNote } from '../utils/etfJudgment'
import EtfTrendRemark from './EtfTrendRemark'

export default function EtfDocumentRemark({ code }: { code: string }): JSX.Element {
  const note = latestEtfNote(code)
  const [remark, setRemark] = useState<string | null>(null)
  useEffect(() => {
    setRemark(null)
    if (!note) return
    const controller = new AbortController()
    fetch(`${import.meta.env.BASE_URL}notes/${note.slug}.md`, { signal: controller.signal, cache: 'no-cache' })
      .then(response => response.ok ? response.text() : Promise.reject(new Error('Note unavailable')))
      .then(markdown => { if (!controller.signal.aborted) setRemark(extractEtfJudgment(markdown, note.date)) })
      .catch(() => { if (!controller.signal.aborted) setRemark(null) })
    return () => controller.abort()
  }, [note?.slug, note?.date])
  return remark ? <EtfTrendRemark remark={remark} /> : <span className="etf-empty-cell">—</span>
}
