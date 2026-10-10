import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import EtfGuide from './EtfGuide'
import { ETF_SCHOOLS } from '../data/etfGuide'

describe('EtfGuide', () => {
  it('包含视频里提到的五个 ETF，并标记来源', () => {
    render(<EtfGuide />)
    for (const t of ['VOO', 'SPMO', 'MAGS', 'SOXX', 'SMH', 'DRAM']) {
      expect(screen.getByRole('heading', { name: t })).toBeTruthy()
    }
    expect(screen.getAllByText('视频提到').length).toBe(6)
  })

  it('ticker 不重复，每条都有风险说明', () => {
    const all = ETF_SCHOOLS.flatMap(s => s.etfs)
    expect(new Set(all.map(e => e.ticker)).size).toBe(all.length)
    for (const e of all) expect(e.risk.length, e.ticker).toBeGreaterThan(5)
  })
})
