import React from 'react'

export default function CandidateButton({ on, onClick }: { on: boolean; onClick: () => void }): JSX.Element {
  return (
    <button onClick={onClick} aria-pressed={on}
      style={{ fontFamily: 'inherit', fontSize: '12px', fontWeight: 500, padding: '4px 10px', borderRadius: 'var(--radius-btn)', cursor: 'pointer', whiteSpace: 'nowrap', border: on ? 'none' : '1px solid var(--system-blue)', background: on ? 'color-mix(in srgb, var(--system-green) 14%, transparent)' : 'transparent', color: on ? 'var(--system-green)' : 'var(--system-blue)' }}>
      {on ? '✓ 已候选' : '＋ 加入候选'}
    </button>
  )
}
