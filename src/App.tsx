import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import Header from './components/Header'
import Footer from './components/Footer'
import SectionChrome from './components/SectionChrome'
import RouteSeo from './components/RouteSeo'
import NotFound from './pages/NotFound'
import InvestHub from './pages/InvestHub'

// 重页面按路由拆包：首屏只下载首页（投资页）和几个小页面，其余进入时再加载
const About = lazy(() => import('./pages/About'))
const Pulse = lazy(() => import('./pages/Pulse'))
const Monitor = lazy(() => import('./pages/Monitor'))
const InvestmentPlan2026 = lazy(() => import('./pages/InvestmentPlan2026'))
const FirstBook = lazy(() => import('./pages/FirstBook'))
const MyBooks = lazy(() => import('./pages/MyBooks'))
const ResearchNotes = lazy(() => import('./pages/ResearchNotes'))
const CompanyDetail = lazy(() => import('./pages/CompanyDetail'))
// 主站自己的网格交易已由 notes 的网格交易计算器取代，旧路径由 GridMoved 跳转或说明
const Notes = lazy(() => import('./pages/Notes'))
const NoteDetail = lazy(() => import('./pages/NoteDetail'))
const IndustryEtf = lazy(() => import('./pages/IndustryEtf'))
const BlogIndex = lazy(() => import('./pages/BlogIndex'))
const BlogArticle = lazy(() => import('./pages/BlogArticle'))
const DailyAnalysis = lazy(() => import('./pages/DailyAnalysis'))
const WatchBoard = lazy(() => import('./pages/WatchBoard'))
const NationalTeam = lazy(() => import('./pages/NationalTeam'))
const GridMoved = lazy(() => import('./pages/GridMoved'))
// 旧的板块轮动、涨停分析同样已由 notes 的股市分析 lab 取代，旧路径由 StockToolsMoved 跳转或说明
const StockToolsMoved = lazy(() => import('./pages/StockToolsMoved'))
const Valuation = lazy(() => import('./pages/Valuation'))
const Dcf = lazy(() => import('./pages/Dcf'))
const FutureTrends = lazy(() => import('./pages/FutureTrends'))
const SolidStateCompany = lazy(() => import('./pages/SolidStateCompany'))
const FutureTrendCompany = lazy(() => import('./pages/FutureTrendCompany'))
const IndustryLandscape = lazy(() => import('./pages/IndustryLandscape'))
const EtfGuide = lazy(() => import('./pages/EtfGuide'))
const BloggerViews = lazy(() => import('./pages/BloggerViews'))
const BloggerViewDetail = lazy(() => import('./pages/BloggerViewDetail'))

function PageLoading(): JSX.Element {
  return <div role="status" className="container page-loading">加载中…</div>
}

function RoutedBoundary({ children }: { children: React.ReactNode }): JSX.Element {
  const { pathname } = useLocation()
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>
}

/** 键盘与读屏用户跳过顶部导航：把焦点移到页面的 main（没有就退到 h1） */
function SkipLink(): JSX.Element {
  return (
    <a
      className="skip-link"
      href="#main-content"
      onClick={e => {
        e.preventDefault()
        const target = document.querySelector<HTMLElement>('main, [role="main"]') ?? document.querySelector<HTMLElement>('h1')
        if (!target) return
        target.setAttribute('tabindex', '-1')
        target.focus()
        target.scrollIntoView()
      }}
    >
      跳到主要内容
    </a>
  )
}

export default function App(): JSX.Element {
  return (
    <div className="app">
      <SkipLink />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <RouteSeo />
        <Header />
        <SectionChrome />
        <RoutedBoundary>
        <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/valuation" element={<Valuation />} />
          <Route path="/dcf" element={<Dcf />} />
          <Route path="/" element={<InvestHub />} />
          {/* 首页就是投资页；旧的 /invest 由 _redirects 跳转，这里是前端兜底 */}
          <Route path="/invest" element={<Navigate to="/" replace />} />
          <Route path="/invest/etf" element={<EtfGuide />} />
          <Route path="/invest/blogger-views" element={<BloggerViews />} />
          <Route path="/invest/blogger-views/:slug" element={<BloggerViewDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/pulse" element={<Pulse />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/notes/:slug" element={<NoteDetail />} />
          <Route path="/industry-etf" element={<IndustryEtf />} />
          <Route path="/blog" element={<BlogIndex />} />
          <Route path="/blog/:slug" element={<BlogArticle />} />
          <Route path="/daily-analysis" element={<DailyAnalysis />} />
          <Route path="/watch" element={<WatchBoard />} />
          <Route path="/invest/national-team" element={<NationalTeam />} />
          <Route path="/monitor" element={<Monitor />} />
          <Route path="/investment-plan-2026" element={<InvestmentPlan2026 />} />
          <Route path="/sector-rotation" element={<StockToolsMoved />} />
          <Route path="/limit-up-analysis/*" element={<StockToolsMoved />} />
          <Route path="/first-book" element={<MyBooks />} />
          <Route path="/first-book/slow-is-fast" element={<FirstBook />} />
          <Route path="/first-book/read/:file" element={<FirstBook />} />
          <Route path="/first-book/:file" element={<FirstBook />} />
          <Route path="/future-trends" element={<FutureTrends />} />
          <Route path="/future-trends/solid-state/:id" element={<SolidStateCompany />} />
          <Route path="/future-trends/company/:id" element={<FutureTrendCompany />} />
          <Route path="/industry-landscape" element={<IndustryLandscape />} />
          <Route path="/research-notes" element={<ResearchNotes />} />
          <Route path="/research-notes/:market/:code" element={<CompanyDetail />} />
          <Route path="/grid-trading/*" element={<GridMoved />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </RoutedBoundary>
        <Footer />
      </BrowserRouter>
    </div>
  )
}
