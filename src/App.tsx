import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import SectionChrome from './components/SectionChrome'
import NotFound from './pages/NotFound'
import InvestHub from './pages/InvestHub'
import AiStudio from './pages/AiStudio'
import LifeLab from './pages/LifeLab'
import Home from './pages/Home'

// 重页面按路由拆包：首屏只下载首页和几个小页面，其余进入时再加载
const About = lazy(() => import('./pages/About'))
const Pulse = lazy(() => import('./pages/Pulse'))
const Monitor = lazy(() => import('./pages/Monitor'))
const InvestmentPlan2026 = lazy(() => import('./pages/InvestmentPlan2026'))
const InvestmentTargetsPage = lazy(() => import('./pages/InvestmentTargetsPage'))
const LimitUpAnalysis = lazy(() => import('./pages/LimitUpAnalysis'))
const TradingPhilosophy = lazy(() => import('./pages/TradingPhilosophy'))
const SectorRotation = lazy(() => import('./pages/SectorRotation'))
const MainlandInvestmentTargets = lazy(() => import('./pages/MainlandInvestmentTargets'))
const InvestmentStrategy = lazy(() => import('./pages/InvestmentStrategy'))
const FirstBook = lazy(() => import('./pages/FirstBook'))
const MyBooks = lazy(() => import('./pages/MyBooks'))
const ResearchNotes = lazy(() => import('./pages/ResearchNotes'))
const CompanyDetail = lazy(() => import('./pages/CompanyDetail'))
const GridCalculator = lazy(() => import('./pages/GridCalculator'))
const GridRecords = lazy(() => import('./pages/GridRecords'))
const GridRecordDetail = lazy(() => import('./pages/GridRecordDetail'))
const Valuation = lazy(() => import('./pages/Valuation'))
const IndustryLandscape = lazy(() => import('./pages/IndustryLandscape'))
const KnowledgeCenter = lazy(() => import('./pages/KnowledgeCenter'))
const InvestmentAiTools = lazy(() => import('./pages/InvestmentAiTools'))
const AiLabDirection = lazy(() => import('./pages/AiLabDirection'))
const AiLearningPlan = lazy(() => import('./pages/AiLearningPlan'))

function PageLoading(): JSX.Element {
  return <div role="status" className="container page-loading">加载中…</div>
}

export default function App(): JSX.Element {
  return (
    <div className="app">
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Header />
        <SectionChrome />
        <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/valuation" element={<Valuation />} />
          <Route path="/" element={<Home />} />
          <Route path="/invest" element={<InvestHub />} />
          <Route path="/invest/ai-tools" element={<InvestmentAiTools />} />
          <Route path="/ai" element={<AiStudio />} />
          <Route path="/ai/fullstack-roadmap" element={<AiLearningPlan />} />
          <Route path="/ai/:slug" element={<AiLabDirection />} />
          <Route path="/knowledge" element={<KnowledgeCenter />} />
          <Route path="/life" element={<LifeLab />} />
          <Route path="/about" element={<About />} />
          <Route path="/pulse" element={<Pulse />} />
          <Route path="/monitor" element={<Monitor />} />
          <Route path="/investment-plan-2026" element={<InvestmentPlan2026 />} />
          <Route path="/investment-targets" element={<InvestmentTargetsPage />} />
          <Route path="/limit-up-analysis" element={<LimitUpAnalysis />} />
          <Route path="/trading-philosophy" element={<TradingPhilosophy />} />
          <Route path="/sector-rotation" element={<SectorRotation />} />
          <Route path="/mainland-investment-targets" element={<MainlandInvestmentTargets />} />
          <Route path="/investment-strategy" element={<InvestmentStrategy />} />
          <Route path="/first-book" element={<MyBooks />} />
          <Route path="/first-book/slow-is-fast" element={<FirstBook />} />
          <Route path="/first-book/:file" element={<FirstBook />} />
          <Route path="/industry-landscape" element={<IndustryLandscape />} />
          <Route path="/research-notes" element={<ResearchNotes />} />
          <Route path="/research-notes/:market/:code" element={<CompanyDetail />} />
          <Route path="/grid-trading" element={<GridCalculator />} />
          <Route path="/grid-trading/records" element={<GridRecords />} />
          <Route path="/grid-trading/records/:recordId" element={<GridRecordDetail />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        <Footer />
      </BrowserRouter>
    </div>
  )
}
