import React from 'react'
import { PageTitle } from '../components/ui/PageTabs'
import AIDiffusion from '../components/AIDiffusion'

export default function MainlandInvestmentTargets(): JSX.Element {
  return (
    <main className="container animate-fade-in page-shell">
      <PageTitle desc="2026 年 1 月的 AI 主题标的清单">A 股观察池</PageTitle>

      <AIDiffusion />
    </main>
  )
}
