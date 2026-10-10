import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, List } from 'lucide-react'

export interface NavChapter {
  no: string
  title: string
  file: string
  status: string
}

export interface NavPart {
  id: string
  title: string
  chapters: NavChapter[]
}

interface ChapterNavProps {
  parts: NavPart[]
  currentFile: string
  /** 放在最前面、不属于任何一部的入口，如“全书大纲” */
  topLinks?: NavChapter[]
}

const chapterHref = (file: string): string => `/first-book/read/${encodeURIComponent(file)}`

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

export default function ChapterNav({ parts, currentFile, topLinks = [] }: ChapterNavProps): JSX.Element {
  const current = safeDecode(currentFile)
  const currentPart = parts.find(p => p.chapters.some(c => c.file && c.file === current))
  const currentChapter =
    currentPart?.chapters.find(c => c.file === current) ?? topLinks.find(c => c.file === current)

  const [openParts, setOpenParts] = useState<Set<string>>(() => new Set(currentPart ? [currentPart.id] : []))
  const [panelOpen, setPanelOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const curRef = useRef<HTMLAnchorElement | null>(null)

  // 换章后：展开所在的部，收起手机面板，并把当前章滚到目录中部
  useEffect(() => {
    if (currentPart) {
      setOpenParts(prev => (prev.has(currentPart.id) ? prev : new Set(prev).add(currentPart.id)))
    }
    setPanelOpen(false)
  }, [current, currentPart?.id])

  useEffect(() => {
    const box = boxRef.current
    const el = curRef.current
    if (box && el) box.scrollTop = Math.max(0, el.offsetTop - box.clientHeight / 2)
  }, [current, openParts])

  const togglePart = (id: string) =>
    setOpenParts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const renderItem = (ch: NavChapter, key: string) => {
    if (!ch.file) {
      return (
        <li key={key} className="chapter-nav__item is-disabled" aria-disabled="true">
          <span className="chapter-nav__no">{ch.no}</span>
          <span className="chapter-nav__text">{ch.title}</span>
        </li>
      )
    }
    const active = ch.file === current
    return (
      <li key={key}>
        <Link
          to={chapterHref(ch.file)}
          ref={active ? curRef : undefined}
          className={active ? 'chapter-nav__item is-active' : 'chapter-nav__item'}
          aria-current={active ? 'page' : undefined}
          onClick={() => setPanelOpen(false)}
        >
          <span className="chapter-nav__no">{ch.no}</span>
          <span className="chapter-nav__text">{ch.title}</span>
        </Link>
      </li>
    )
  }

  return (
    <nav className="chapter-nav" aria-label="章节目录">
      <button
        type="button"
        className="chapter-nav__toggle"
        aria-expanded={panelOpen}
        onClick={() => setPanelOpen(v => !v)}
      >
        <List size={18} aria-hidden="true" />
        <span className="chapter-nav__toggle-text">
          目录{currentChapter ? ` · ${currentChapter.no} ${currentChapter.title}` : ''}
        </span>
        <ChevronDown size={18} aria-hidden="true" className={panelOpen ? 'is-flipped' : undefined} />
      </button>

      <div className={panelOpen ? 'chapter-nav__panel is-open' : 'chapter-nav__panel'} ref={boxRef}>
        {topLinks.length > 0 && <ul className="chapter-nav__list">{topLinks.map(ch => renderItem(ch, ch.file || ch.title))}</ul>}
        {parts.map(part => {
          const open = openParts.has(part.id)
          return (
            <div key={part.id} className="chapter-nav__part">
              <button
                type="button"
                className="chapter-nav__part-title"
                aria-expanded={open}
                onClick={() => togglePart(part.id)}
              >
                <ChevronRight size={14} aria-hidden="true" className={open ? 'is-open' : undefined} />
                <span>{part.title}</span>
              </button>
              {open && <ul className="chapter-nav__list">{part.chapters.map(ch => renderItem(ch, ch.no + ch.title))}</ul>}
            </div>
          )
        })}
      </div>
    </nav>
  )
}
